import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

interface LanguageStats {
  [language: string]: number;
}

interface FrameworkStats {
  [framework: string]: number;
}

interface RepoStats {
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
  languages: LanguageStats;
  totalBytes: number;
  frameworks: FrameworkStats;
}

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
  'Laravel': ['composer.json'],
  'Node.js': ['package.json'],
  'Next.js': ['package.json'],
  'Vue.js': ['package.json'],
  'React': ['package.json'],
  'Angular': ['package.json'],
  'Express': ['package.json'],
  'NestJS': ['package.json'],
  'Django': ['requirements.txt', 'Pipfile'],
  'Flask': ['requirements.txt', 'Pipfile'],
  'FastAPI': ['requirements.txt', 'Pipfile'],
  'Spring Boot': ['pom.xml', 'build.gradle'],
  'MySQL': ['docker-compose.yml', 'docker-compose.yaml'],
  'PostgreSQL': ['docker-compose.yml', 'docker-compose.yaml'],
  'MongoDB': ['docker-compose.yml', 'docker-compose.yaml'],
  'Redis': ['docker-compose.yml', 'docker-compose.yaml'],
};

// Check if a file contains specific framework indicators
async function checkFileForFramework(
  octokit: Octokit,
  owner: string,
  repo: string,
  filePath: string,
  framework: string
): Promise<boolean> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      // Check for framework-specific patterns in content
      switch (framework) {
        case 'Laravel':
          return content.includes('"laravel/framework"');
        case 'Next.js':
          return content.includes('"next"');
        case 'Vue.js':
          return content.includes('"vue"');
        case 'React':
          return content.includes('"react"');
        case 'Angular':
          return content.includes('"@angular/core"');
        case 'Express':
          return content.includes('"express"');
        case 'NestJS':
          return content.includes('"@nestjs/core"');
        case 'Django':
          return content.includes('Django');
        case 'Flask':
          return content.includes('Flask');
        case 'FastAPI':
          return content.includes('fastapi');
        case 'Spring Boot':
          return content.includes('spring-boot');
        case 'MySQL':
          return content.includes('mysql');
        case 'PostgreSQL':
          return content.includes('postgres');
        case 'MongoDB':
          return content.includes('mongo');
        case 'Redis':
          return content.includes('redis');
        case 'Node.js':
          // Any package.json indicates Node.js
          return filePath === 'package.json';
        default:
          return false;
      }
    }
  } catch (error) {
    // File doesn't exist or couldn't be read
    return false;
  }
  return false;
}

// Detect frameworks used in a repository
async function detectFrameworks(
  octokit: Octokit,
  owner: string,
  repo: string,
  frameworks: FrameworkStats
): Promise<void> {
  for (const [framework, files] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const file of files) {
      const detected = await checkFileForFramework(octokit, owner, repo, file, framework);
      if (detected) {
        frameworks[framework] = (frameworks[framework] || 0) + 1;
        break; // Don't count the same framework multiple times per repo
      }
    }
  }
}

// Generate SVG donut chart
function generateDonutChart(
  data: Array<{ label: string; value: number; color: string }>,
  title: string,
  width: number = 500,
  height: number = 300
): string {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;
  const innerRadius = radius * 0.6;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${centerX}" y="${centerY}" text-anchor="middle" font-size="16" fill="#666">No data available</text>
    </svg>`;
  }
  
  let currentAngle = -90; // Start at top
  let paths = '';
  let legends = '';
  
  data.forEach((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const endAngle = currentAngle + angle;
    
    // Convert angles to radians
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate arc points
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    const x3 = centerX + innerRadius * Math.cos(endRad);
    const y3 = centerY + innerRadius * Math.sin(endRad);
    const x4 = centerX + innerRadius * Math.cos(startRad);
    const y4 = centerY + innerRadius * Math.sin(startRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    // Create donut segment path
    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');
    
    paths += `<path d="${pathData}" fill="${item.color}" opacity="0.9">
      <title>${item.label}: ${percentage.toFixed(1)}%</title>
    </path>\n`;
    
    // Create legend
    const legendY = 20 + index * 25;
    legends += `<rect x="10" y="${legendY}" width="15" height="15" fill="${item.color}" opacity="0.9"/>
    <text x="30" y="${legendY + 12}" font-size="12" fill="#333">${item.label}: ${percentage.toFixed(1)}%</text>\n`;
    
    currentAngle = endAngle;
  });
  
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; }
  </style>
  <text x="${centerX}" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">${title}</text>
  <g transform="translate(0, 10)">
    ${paths}
  </g>
  ${legends}
</svg>`;
}

// Color palette for charts
const COLORS = [
  '#3178c6', '#f1e05a', '#e34c26', '#563d7c', '#2b7489',
  '#178600', '#f34b7d', '#b07219', '#555555', '#438eff',
  '#00ADD8', '#89e051', '#4F5D95', '#dea584', '#ff6b6b',
  '#c6538c', '#3572A5', '#701516', '#DA5B0B', '#5e5086',
];

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
    frameworks: {},
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
          stats.languages[language] = (stats.languages[language] || 0) + bytes;
          stats.totalBytes += bytes;
        }
      } catch (error) {
        console.warn(`Failed to fetch languages for ${repo.full_name}:`, error);
      }

      // Detect frameworks from repository
      try {
        await detectFrameworks(octokit, repo.owner.login, repo.name, stats.frameworks);
      } catch (error) {
        console.warn(`Failed to detect frameworks for ${repo.full_name}:`, error);
      }
    }

    page++;
  }

  return stats;
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

function generateStatsMarkdown(stats: RepoStats): string {
  const languages = calculateLanguagePercentages(stats);
  
  let markdown = '## 📊 Repository Statistics\n\n';
  
  // Generate Repository Statistics Donut Chart
  if (stats.totalRepos > 0) {
    const repoData = [];
    if (stats.publicRepos > 0) {
      repoData.push({ label: 'Public', value: stats.publicRepos, color: '#28a745' });
    }
    if (stats.privateRepos > 0) {
      repoData.push({ label: 'Private', value: stats.privateRepos, color: '#6f42c1' });
    }
    
    const repoChart = generateDonutChart(repoData, 'Repository Distribution', 500, 300);
    markdown += `<div align="center">\n\n${repoChart}\n\n</div>\n\n`;
  }
  
  markdown += `- **Total Repositories:** ${stats.totalRepos}\n`;
  markdown += `- **Public Repositories:** ${stats.publicRepos}\n`;
  markdown += `- **Private Repositories:** ${stats.privateRepos}\n\n`;
  
  // Language Distribution Section
  markdown += '## 💻 Language Distribution\n\n';
  
  if (languages.length === 0) {
    markdown += '*No language statistics available*\n';
  } else {
    // Generate Language Distribution Donut Chart
    const topLanguages = languages.slice(0, 10); // Top 10 languages
    const languageData = topLanguages.map((lang, index) => ({
      label: lang.language,
      value: lang.bytes,
      color: COLORS[index % COLORS.length]
    }));
    
    const languageChart = generateDonutChart(languageData, 'Top 10 Languages', 500, 300);
    markdown += `<div align="center">\n\n${languageChart}\n\n</div>\n\n`;
    
    // Show all languages in a table
    markdown += '<details>\n<summary>📈 Complete Language Breakdown</summary>\n\n';
    markdown += '| Language | Percentage | Bytes |\n';
    markdown += '|----------|------------|-------|\n';
    
    for (const { language, percentage, bytes } of languages) {
      markdown += `| ${language} | ${percentage.toFixed(2)}% | ${bytes.toLocaleString()} |\n`;
    }
    
    markdown += '\n</details>\n';
  }
  
  // Framework Statistics Section
  const frameworks = Object.entries(stats.frameworks)
    .map(([framework, count]) => ({ framework, count }))
    .sort((a, b) => b.count - a.count);
  
  if (frameworks.length > 0) {
    markdown += '\n## 🔧 Framework & Technology Statistics\n\n';
    
    // Generate Framework Donut Chart
    const frameworkData = frameworks.map((fw, index) => ({
      label: fw.framework,
      value: fw.count,
      color: COLORS[index % COLORS.length]
    }));
    
    const frameworkChart = generateDonutChart(frameworkData, 'Frameworks & Technologies', 500, 300);
    markdown += `<div align="center">\n\n${frameworkChart}\n\n</div>\n\n`;
    
    // Show framework details in a table
    markdown += '<details>\n<summary>📊 Framework Details</summary>\n\n';
    markdown += '| Framework/Technology | Repository Count |\n';
    markdown += '|----------------------|-----------------|\n';
    
    for (const { framework, count } of frameworks) {
      markdown += `| ${framework} | ${count} |\n`;
    }
    
    markdown += '\n</details>\n';
  }
  
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
    console.log(`Detected ${Object.keys(stats.frameworks).length} different frameworks/technologies`);
    
    const statsMarkdown = generateStatsMarkdown(stats);
    
    await updateReadme(statsMarkdown);
    
    console.log('Profile update completed successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    process.exit(1);
  }
}

main();
