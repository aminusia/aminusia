import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

interface LanguageStats {
  [language: string]: number;
}

interface PlatformStats {
  [platform: string]: number;
}

interface DatabaseStats {
  [database: string]: number;
}

interface RepoStats {
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
  languages: LanguageStats;
  totalBytes: number;
  platforms: PlatformStats;
  databases: DatabaseStats;
  activities: { [month: string]: number };
}

async function fetchRepositoryStats(): Promise<RepoStats> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const octokit = new Octokit({ auth: token });

  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Fetching repositories for user: ${user.login}`);

  const stats: RepoStats = {
    totalRepos: 0,
    publicRepos: 0,
    privateRepos: 0,
    languages: {},
    totalBytes: 0,
    platforms: {},
    databases: {},
    activities: {},
  };

  // Fetch all repositories (user + organization repos)
  let page = 1;
  const perPage = 100;
  let hasMoreRepos = true;

  while (hasMoreRepos) {
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: perPage,
      page: page,
      affiliation: 'owner,collaborator,organization_member',
    });

    if (repos.length === 0) {
      hasMoreRepos = false;
      break;
    }

    for (const repo of repos) {
      stats.totalRepos++;
      if (repo.private) {
        stats.privateRepos++;
      } else {
        stats.publicRepos++;
      }

      // Fetch language statistics for each repository
      try {
        const { data: languages } = await octokit.repos.listLanguages({
          owner: repo.owner.login,
          repo: repo.name,
        });

        // Aggregate language statistics
        for (const [language, bytes] of Object.entries(languages)) {
          stats.languages[language] = (stats.languages[language] || 0) + (bytes as number);
          stats.totalBytes += bytes as number;
        }

        // Detect platforms and databases
        await detectPlatformsAndDatabases(octokit, repo.owner.login, repo.name, stats);
        // Aggregate commit activity for this repository (weekly -> monthly)
        await aggregateRepoCommitActivity(octokit, repo.owner.login, repo.name, stats);
      } catch (error) {
        console.warn(`Failed to fetch data for ${repo.full_name}:`, error);
      }
    }

    page++;
  }

  return stats;
}

async function aggregateRepoCommitActivity(
  octokit: Octokit,
  owner: string,
  repo: string,
  stats: RepoStats
): Promise<void> {
  try {
    // Try the lightweight stats endpoint first (GitHub returns weekly totals for the last year).
    const response = await octokit.request('GET /repos/{owner}/{repo}/stats/commit_activity', {
      owner,
      repo,
    });

    const weeks = response.data as Array<{ week: number; total: number; days: number[] }>;

    // If GitHub returns 202 (computing) or empty/invalid data, fall back to scanning the full commit history.
    if (!Array.isArray(weeks) || weeks.length === 0) {
      await aggregateRepoCommitHistory(octokit, owner, repo, stats);
      return;
    }

    for (const w of weeks) {
      // week is a unix timestamp (seconds) for start of week
      const dt = new Date((w.week as number) * 1000);
      const monthKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      stats.activities[monthKey] = (stats.activities[monthKey] || 0) + (w.total as number);
    }
  } catch (error) {
    // If any error occurs (including 202 responses), fall back to scanning the full commit history.
    await aggregateRepoCommitHistory(octokit, owner, repo, stats);
  }
}

async function aggregateRepoCommitHistory(
  octokit: Octokit,
  owner: string,
  repo: string,
  stats: RepoStats
): Promise<void> {
  try {
    const perPage = 100;
    let page = 1;
    while (true) {
      const response = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
      });

      const commits = response.data as Array<any>;
      if (!Array.isArray(commits) || commits.length === 0) break;

      for (const c of commits) {
        // Prefer authored date, fall back to committer date
        const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
        if (!dateStr) continue;
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) continue;
        const monthKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        stats.activities[monthKey] = (stats.activities[monthKey] || 0) + 1;
      }

      // If fewer than perPage commits were returned, we've reached the end
      if (commits.length < perPage) break;
      page++;

      // Small delay to be polite to the API (helps with rate limits)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    // If anything fails, skip activity aggregation for this repo.
  }
}

function generateBarChartSVG(
  data: Array<{ name: string; value: number }>,
  title: string,
  barColor = '#16a34a'
): string {
  const width = 800;
  const height = 200;
  const padding = { top: 40, right: 30, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">No data available</text>
    </svg>`;
  }

  const maxVal = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.75;
  const gap = chartWidth / data.length * 0.25;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .chart-title { font: bold 18px Arial; fill: #333; }
    .axis-label { font: 10px Arial; fill: #666; }
  </style>
  <text x="${width / 2}" y="20" text-anchor="middle" class="chart-title">${title}</text>
  <g transform="translate(${padding.left}, ${padding.top})">
`;

  // Bars
  data.forEach((d, i) => {
    const x = i * (barWidth + gap);
    const h = maxVal > 0 ? (d.value / maxVal) * chartHeight : 0;
    const y = chartHeight - h;
    svg += `    <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${barColor}" rx="3" />\n`;
    // month label
    svg += `    <text x="${x + barWidth / 2}" y="${chartHeight + 18}" font-family="Arial" font-size="11" fill="#444" text-anchor="middle">${d.name}</text>\n`;
  });

  // Y axis labels (0 and max)
  svg += `    <text x="-6" y="${chartHeight}" font-family="Arial" font-size="11" fill="#666" text-anchor="end">0</text>\n`;
  svg += `    <text x="-6" y="${10}" font-family="Arial" font-size="11" fill="#666" text-anchor="end">${maxVal}</text>\n`;

  svg += '  </g>\n</svg>';

  return svg;
}

function generateActivitiesChart(stats: RepoStats): string {
  // Build a continuous list of months starting from the first month that has activity
  // up to the last month that has activity. Fill gaps with zero values so empty
  // months are rendered as empty bars. Do not render months prior to the first
  // month that contains activity.
  const keys = Object.keys(stats.activities).sort();

  if (keys.length === 0) {
    return generateBarChartSVG([], 'All Time Monthly Commits', '#16a34a');
  }

  const first = keys[0];
  const last = keys[keys.length - 1];

  const [startY, startM] = first.split('-').map(s => Number(s));
  const [endY, endM] = last.split('-').map(s => Number(s));

  const months: string[] = [];
  let y = startY;
  let m = startM;

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const data = months.map(monthKey => ({ name: monthKey, value: stats.activities[monthKey] || 0 }));

  // Labels: only show the year on January, otherwise empty
  const labels = data.map(d => {
    const [yy, mm] = d.name.split('-');
    return mm === '01' ? yy : '';
  });

  const chartData = data.map((d, i) => ({ name: labels[i], value: d.value }));

  return generateBarChartSVG(chartData, 'All Time Monthly Commits', '#16a34a');
}

async function detectPlatformsAndDatabases(
  octokit: Octokit,
  owner: string,
  repo: string,
  stats: RepoStats
): Promise<void> {
  try {
    // Track whether we've already detected a database for this repository
    let dbDetected = false;

    // Check for common framework/platform files
    const filesToCheck = [
      'package.json',
      'composer.json',
      'requirements.txt',
      'Gemfile',
      'go.mod',
      'pom.xml',
    ];

    for (const file of filesToCheck) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: file,
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');

          // Detect platforms/frameworks
          if (file === 'package.json') {
            const packageJson = JSON.parse(content);
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            if (deps['next'] || deps['@next/core']) stats.platforms['Next.js'] = (stats.platforms['Next.js'] || 0) + 1;
            if (deps['vue'] || deps['@vue/core']) stats.platforms['Vue.js'] = (stats.platforms['Vue.js'] || 0) + 1;
            if (deps['react'] || deps['@react/core']) stats.platforms['React'] = (stats.platforms['React'] || 0) + 1;
            if (deps['express']) stats.platforms['Express'] = (stats.platforms['Express'] || 0) + 1;
            if (deps['@nestjs/core']) stats.platforms['NestJS'] = (stats.platforms['NestJS'] || 0) + 1;
            if (deps['nuxt'] || deps['nuxt3']) stats.platforms['Nuxt.js'] = (stats.platforms['Nuxt.js'] || 0) + 1;
            if (deps['svelte']) stats.platforms['Svelte'] = (stats.platforms['Svelte'] || 0) + 1;

            // Node.js is implied if package.json exists
            stats.platforms['Node.js'] = (stats.platforms['Node.js'] || 0) + 1;

            // Detect databases from Node.js dependencies
            if (deps['mongoose'] || deps['mongodb']) { stats.databases['MongoDB'] = (stats.databases['MongoDB'] || 0) + 1; dbDetected = true; }
            if (deps['mysql'] || deps['mysql2']) { stats.databases['MySQL'] = (stats.databases['MySQL'] || 0) + 1; dbDetected = true; }
            if (deps['pg'] || deps['postgres']) { stats.databases['PostgreSQL'] = (stats.databases['PostgreSQL'] || 0) + 1; dbDetected = true; }
            if (deps['redis']) { stats.databases['Redis'] = (stats.databases['Redis'] || 0) + 1; dbDetected = true; }
            if (deps['sqlite3'] || deps['better-sqlite3']) { stats.databases['SQLite'] = (stats.databases['SQLite'] || 0) + 1; dbDetected = true; }
          } else if (file === 'composer.json') {
            const composerJson = JSON.parse(content);
            const deps = { ...composerJson.require, ...composerJson['require-dev'] };

            if (deps['laravel/framework']) stats.platforms['Laravel'] = (stats.platforms['Laravel'] || 0) + 1;
            if (deps['symfony/symfony']) stats.platforms['Symfony'] = (stats.platforms['Symfony'] || 0) + 1;

            // Detect databases from PHP dependencies
            if (content.includes('mongodb')) { stats.databases['MongoDB'] = (stats.databases['MongoDB'] || 0) + 1; dbDetected = true; }
            if (content.includes('mysql')) { stats.databases['MySQL'] = (stats.databases['MySQL'] || 0) + 1; dbDetected = true; }
            if (content.includes('pgsql') || content.includes('postgres')) { stats.databases['PostgreSQL'] = (stats.databases['PostgreSQL'] || 0) + 1; dbDetected = true; }
            if (content.includes('redis')) { stats.databases['Redis'] = (stats.databases['Redis'] || 0) + 1; dbDetected = true; }

            // If this is a Laravel project and no database was detected so far, count it as MySQL
            if (deps['laravel/framework'] && !dbDetected) {
              stats.databases['MySQL'] = (stats.databases['MySQL'] || 0) + 1;
              dbDetected = true;
            }
          } else if (file === 'requirements.txt') {
            if (content.includes('django')) stats.platforms['Django'] = (stats.platforms['Django'] || 0) + 1;
            if (content.includes('flask')) stats.platforms['Flask'] = (stats.platforms['Flask'] || 0) + 1;
            if (content.includes('fastapi')) stats.platforms['FastAPI'] = (stats.platforms['FastAPI'] || 0) + 1;

            // Detect databases from Python dependencies
            if (content.includes('pymongo') || content.includes('motor')) { stats.databases['MongoDB'] = (stats.databases['MongoDB'] || 0) + 1; dbDetected = true; }
            if (content.includes('mysql') || content.includes('pymysql')) { stats.databases['MySQL'] = (stats.databases['MySQL'] || 0) + 1; dbDetected = true; }
            if (content.includes('psycopg') || content.includes('asyncpg')) { stats.databases['PostgreSQL'] = (stats.databases['PostgreSQL'] || 0) + 1; dbDetected = true; }
            if (content.includes('redis')) { stats.databases['Redis'] = (stats.databases['Redis'] || 0) + 1; dbDetected = true; }
            if (content.includes('sqlite')) { stats.databases['SQLite'] = (stats.databases['SQLite'] || 0) + 1; dbDetected = true; }
          }
        }
      } catch (error) {
        // File doesn't exist, skip
      }
    }
  } catch (error) {
    // Repository content access failed, skip
  }
}

function calculateLanguagePercentages(stats: RepoStats): Array<{ language: string; percentage: number; bytes: number }> {
  const languageArray = Object.entries(stats.languages).map(([language, bytes]) => ({
    language,
    bytes,
    percentage: stats.totalBytes > 0 ? (bytes / stats.totalBytes) * 100 : 0,
  }));

  // Sort by bytes (descending)
  languageArray.sort((a, b) => b.bytes - a.bytes);

  return languageArray;
}

function generateDonutChartSVG(
  data: Array<{ name: string; value: number; percentage: number }>,
  title: string,
  colorPalette: string[]
): string {
  const width = 500;
  const height = 500;
  const centerX = 250;
  const centerY = 180;
  const radius = 100;
  const innerRadius = 60;

  if (data.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="${centerX}" y="${centerY}" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
        No data available
      </text>
    </svg>`;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .chart-title { font: bold 18px Arial; fill: #333; }
    .legend-text { font: 12px Arial; fill: #666; }
    .legend-value { font: 12px Arial; fill: #333; }
    .slice { transition: opacity 0.2s; }
    .slice:hover { opacity: 0.8; }
  </style>

  <text x="${centerX}" y="30" text-anchor="middle" class="chart-title">${title}</text>
`;

  let currentAngle = -90; // Start at top

  // Draw donut slices
  data.forEach((item, index) => {
    const sliceAngle = (item.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const x3 = centerX + innerRadius * Math.cos(endRad);
    const y3 = centerY + innerRadius * Math.sin(endRad);
    const x4 = centerX + innerRadius * Math.cos(startRad);
    const y4 = centerY + innerRadius * Math.sin(startRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const color = colorPalette[index % colorPalette.length];

    svg += `  <path class="slice" d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z" fill="${color}"/>
`;

    currentAngle = endAngle;
  });

  // Draw center circle
  svg += `  <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" fill="white"/>
`;

  // Draw legend
  const legendX = 30;
  let legendY = 220;
  const legendItemHeight = 25;

  data.forEach((item, index) => {
    const color = colorPalette[index % colorPalette.length];
    svg += `  <rect x="${legendX}" y="${legendY}" width="15" height="15" fill="${color}"/>
  <text x="${legendX + 22}" y="${legendY + 12}" class="legend-text">${item.name}</text>
  <text x="${width - 30}" y="${legendY + 12}" text-anchor="end" class="legend-value">${item.percentage.toFixed(1)}%</text>
`;
    legendY += legendItemHeight;
  });

  svg += '</svg>';

  return svg;
}

function generateRepoStatsChart(stats: RepoStats): string {
  const data = [
    { name: 'Public', value: stats.publicRepos, percentage: (stats.publicRepos / stats.totalRepos) * 100 },
    { name: 'Private', value: stats.privateRepos, percentage: (stats.privateRepos / stats.totalRepos) * 100 },
  ];

  const colors = ['#3b82f6', '#8b5cf6'];

  return generateDonutChartSVG(data, 'Repository Statistics', colors);
}

function generateLanguageChart(stats: RepoStats): string {
  const languages = calculateLanguagePercentages(stats);
  const topLanguages = languages.slice(0, 8); // Top 8 languages

  const data = topLanguages.map(lang => ({
    name: lang.language,
    value: lang.bytes,
    percentage: lang.percentage,
  }));

  const colors = ['#3178c6', '#f1e05a', '#e34c26', '#563d7c', '#b07219', '#00ADD8', '#89e051', '#f34b7d'];

  return generateDonutChartSVG(data, 'Language Distribution', colors);
}

function generatePlatformChart(stats: RepoStats): string {
  const platforms = Object.entries(stats.platforms).map(([platform, count]) => ({
    platform,
    count,
  }));

  platforms.sort((a, b) => b.count - a.count);

  const topPlatforms = platforms.slice(0, 8);
  const totalPlatforms = topPlatforms.reduce((sum, p) => sum + p.count, 0);

  const data = topPlatforms.map(p => ({
    name: p.platform,
    value: p.count,
    percentage: (p.count / totalPlatforms) * 100,
  }));

  const colors = ['#61dafb', '#42b883', '#000000', '#339933', '#cc6699', '#00d8ff', '#ff6b6b', '#4fc08d'];

  return generateDonutChartSVG(data, 'Platform Distribution', colors);
}

function generateDatabaseChart(stats: RepoStats): string {
  const databases = Object.entries(stats.databases).map(([database, count]) => ({
    database,
    count,
  }));

  databases.sort((a, b) => b.count - a.count);

  const topDatabases = databases.slice(0, 8);
  const totalDatabases = topDatabases.reduce((sum, d) => sum + d.count, 0);

  if (totalDatabases === 0) {
    return generateDonutChartSVG([], 'Database Distribution', []);
  }

  const data = topDatabases.map(d => ({
    name: d.database,
    value: d.count,
    percentage: (d.count / totalDatabases) * 100,
  }));

  const colors = ['#4db33d', '#00758f', '#336791', '#dc382d', '#003545', '#ffca28', '#ea2845', '#13aa52'];

  return generateDonutChartSVG(data, 'Database Distribution', colors);
}

function saveSVGFile(filename: string, svgContent: string): void {
  const filePath = path.join(__dirname, '..', filename);
  fs.writeFileSync(filePath, svgContent, 'utf8');
  console.log(`Generated ${filename}`);
}

function generateStatsMarkdown(stats: RepoStats): string {
  let markdown = '## 📊 GitHub Statistics\n\n';

  markdown += '### Repository Overview\n\n';
  markdown += `**Total Repositories:** ${stats.totalRepos} | **Public:** ${stats.publicRepos} | **Private:** ${stats.privateRepos}\n\n`;
  markdown += '<p align="center">\n';
  markdown += '  <img src="./repo-stats.svg" alt="Repository Statistics" width="500"/>\n';
  markdown += '</p>\n\n';

  markdown += '### 💻 Programming Languages\n\n';
  markdown += '<p align="center">\n';
  markdown += '  <img src="./languages.svg" alt="Language Distribution" width="500"/>\n';
  markdown += '</p>\n\n';

  if (Object.keys(stats.platforms).length > 0) {
    markdown += '### 🚀 Frameworks & Platforms\n\n';
    markdown += '<p align="center">\n';
    markdown += '  <img src="./platforms.svg" alt="Platform Distribution" width="500"/>\n';
    markdown += '</p>\n\n';
  }

  if (Object.keys(stats.databases).length > 0) {
    markdown += '### 🗄️ Databases\n\n';
    markdown += '<p align="center">\n';
    markdown += '  <img src="./databases.svg" alt="Database Distribution" width="500"/>\n';
    markdown += '</p>\n\n';
  }

  // Activities chart (monthly commits)
  markdown += '### 📈 Activities\n\n';
  markdown += '<p align="center">\n';
  markdown += '  <img src="./activities.svg" alt="Monthly Commits (last 12 months)" width="800"/>\n';
  markdown += '</p>\n\n';

  markdown += `\n*Last updated: ${new Date().toUTCString()}*\n`;

  return markdown;
}

async function updateReadme(statsMarkdown: string): Promise<void> {
  const readmePath = path.join(__dirname, '..', 'README.md');

  let readmeContent = fs.readFileSync(readmePath, 'utf8');

  // Define markers for the stats section
  const startMarker = '<!-- STATS:START -->';
  const endMarker = '<!-- STATS:END -->';

  // Check if markers exist
  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    // Replace content between markers
    const before = readmeContent.substring(0, startIndex + startMarker.length);
    const after = readmeContent.substring(endIndex);
    readmeContent = `${before}\n${statsMarkdown}\n${after}`;
  } else {
    // Append markers and stats to the end of README
    if (!readmeContent.endsWith('\n')) {
      readmeContent += '\n';
    }
    readmeContent += `\n${startMarker}\n${statsMarkdown}\n${endMarker}\n`;
  }

  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log('README.md updated successfully!');
}

async function main(): Promise<void> {
  try {
    console.log('Starting GitHub profile update...');

    const stats = await fetchRepositoryStats();
    console.log(`\nFetched statistics for ${stats.totalRepos} repositories`);
    console.log(`Found ${Object.keys(stats.languages).length} different languages`);
    console.log(`Found ${Object.keys(stats.platforms).length} different platforms/frameworks`);
    console.log(`Found ${Object.keys(stats.databases).length} different databases`);

    // Generate SVG files
    const repoStatsSVG = generateRepoStatsChart(stats);
    saveSVGFile('repo-stats.svg', repoStatsSVG);

    const languageSVG = generateLanguageChart(stats);
    saveSVGFile('languages.svg', languageSVG);

    const platformSVG = generatePlatformChart(stats);
    saveSVGFile('platforms.svg', platformSVG);

    const databaseSVG = generateDatabaseChart(stats);
    saveSVGFile('databases.svg', databaseSVG);

    const activitiesSVG = generateActivitiesChart(stats);
    saveSVGFile('activities.svg', activitiesSVG);

    // Generate and update README
    const statsMarkdown = generateStatsMarkdown(stats);
    await updateReadme(statsMarkdown);

    console.log('\nProfile update completed successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    process.exit(1);
  }
}

main()
