import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

interface LanguageStats {
  [language: string]: number;
}

interface RepoStats {
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
  languages: LanguageStats;
  totalBytes: number;
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
  markdown += `- **Total Repositories:** ${stats.totalRepos}\n`;
  markdown += `- **Public Repositories:** ${stats.publicRepos}\n`;
  markdown += `- **Private Repositories:** ${stats.privateRepos}\n\n`;
  
  markdown += '## 💻 Language Distribution\n\n';
  
  if (languages.length === 0) {
    markdown += '*No language statistics available*\n';
  } else {
    // Show top languages with visual bars
    const topLanguages = languages.slice(0, 10); // Show top 10 languages
    
    for (const { language, percentage, bytes } of topLanguages) {
      const barLength = Math.round(percentage / 2); // Scale down for display
      const bar = '█'.repeat(barLength) + '░'.repeat(50 - barLength);
      markdown += `**${language}** ${percentage.toFixed(2)}% ${bar}\n\n`;
    }
    
    // Show all languages in a table
    markdown += '<details>\n<summary>📈 Complete Language Breakdown</summary>\n\n';
    markdown += '| Language | Percentage | Bytes |\n';
    markdown += '|----------|------------|-------|\n';
    
    for (const { language, percentage, bytes } of languages) {
      markdown += `| ${language} | ${percentage.toFixed(2)}% | ${bytes.toLocaleString()} |\n`;
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
    
    const statsMarkdown = generateStatsMarkdown(stats);
    
    await updateReadme(statsMarkdown);
    
    console.log('Profile update completed successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    process.exit(1);
  }
}

main();
