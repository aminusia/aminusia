# GitHub Profile Auto-Update

This project automatically updates your GitHub profile README with statistics about your repositories and language usage.

## Features

- 📊 **Repository Statistics**: Shows total, public, and private repository counts with SVG donut charts
- 💻 **Language Distribution**: Displays programming language percentages across all repositories with interactive SVG donut charts
- 🔧 **Framework Detection**: Automatically detects and displays frameworks/technologies used (Laravel, Node.js, Vue.js, React, Django, MongoDB, MySQL, etc.)
- 🔄 **Automatic Updates**: Runs daily via GitHub Actions
- 📈 **Visual Charts**: Beautiful SVG donut charts for all statistics
- 📋 **Detailed Breakdown**: Collapsible tables with complete statistics

## How It Works

1. The TypeScript script fetches all repositories you have access to (owned, collaborated, or organization member)
2. It aggregates language statistics from the GitHub API
3. Detects frameworks and technologies by analyzing package.json, composer.json, requirements.txt, and other configuration files
4. Calculates percentages based on total bytes of code and framework usage
5. Generates beautiful SVG donut charts for visual representation
6. Updates the README.md file with formatted statistics and charts
7. GitHub Actions commits the changes automatically

## Quick Start

**Ready to use immediately!** This repository is already configured and ready to go:

1. **Merge this PR** to your main branch
2. **Check the Actions tab** - the workflow will run automatically:
   - Every day at midnight UTC
   - Whenever you push to main
   - Or manually trigger it from the Actions tab
3. **View your profile** at `https://github.com/aminusia` to see the statistics!

That's it! No additional setup required. The workflow uses the built-in `GITHUB_TOKEN` automatically.

See [EXAMPLE_OUTPUT.md](EXAMPLE_OUTPUT.md) for what your README will look like after the first run.


## Setup Instructions

### Prerequisites

- Node.js 20 or higher
- GitHub account with repositories
- This repository must be named `<username>/<username>` (special profile repository)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variable:**
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   ```
   
   To create a token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` and `read:user` scopes

3. **Run the update script:**
   ```bash
   npm run update-profile
   ```

4. **Build TypeScript (optional):**
   ```bash
   npm run build
   ```

### GitHub Actions Setup

The workflow is already configured in `.github/workflows/update-profile.yml` and will:

- Run automatically every day at 00:00 UTC
- Can be triggered manually from the Actions tab
- Uses the built-in `GITHUB_TOKEN` (no additional setup needed)

### Customizing the README

The statistics are inserted between these markers in README.md:

```markdown
<!-- STATS:START -->
<!-- STATS:END -->
```

You can add any content before or after these markers, and it will be preserved during updates.

## Configuration Options

### Update Frequency

Edit `.github/workflows/update-profile.yml` to change the schedule:

```yaml
schedule:
  - cron: '0 0 * * *'  # Daily at midnight UTC
```

Examples:
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on the 1st

### Top Languages Display

Edit `src/update-profile.ts` to change how many languages are shown in the donut chart:

```typescript
const topLanguages = languages.slice(0, 10); // Change 10 to desired number
```

### Framework Detection

The script automatically detects the following frameworks and technologies:
- **PHP**: Laravel
- **JavaScript/TypeScript**: Node.js, Next.js, Vue.js, React, Angular, Express, NestJS
- **Python**: Django, Flask, FastAPI
- **Java**: Spring Boot
- **Databases**: MySQL, PostgreSQL, MongoDB, Redis

To add more frameworks, edit the `FRAMEWORK_PATTERNS` object in `src/update-profile.ts`.

### SVG Chart Customization

You can customize the SVG charts by modifying the `generateDonutChart` function:
- Chart dimensions: Change `width` and `height` parameters
- Colors: Modify the `COLORS` array
- Inner radius: Adjust `innerRadius = radius * 0.6` (0.6 = 60% of outer radius)

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── update-profile.yml    # GitHub Actions workflow
├── src/
│   └── update-profile.ts         # Main TypeScript script
├── README.md                     # Your profile README
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
└── .gitignore                    # Git ignore rules
```

## Technology Stack

- **TypeScript**: Type-safe JavaScript for better code quality
- **Octokit**: Official GitHub REST API client
- **GitHub Actions**: Automated workflow execution
- **Node.js**: Runtime environment
- **SVG**: Scalable Vector Graphics for beautiful, responsive charts

## Security

- The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions
- Token permissions are scoped to repository access only
- No sensitive data is stored in the repository
- Dependencies are regularly updated for security patches

## Troubleshooting

### Script fails with "GITHUB_TOKEN is required"

Make sure you've set the environment variable:
```bash
export GITHUB_TOKEN=your_token
```

### No statistics appear

Check that:
1. Your repositories have code (not just README files)
2. The GitHub API is accessible
3. The markers are present in README.md

### Workflow doesn't run automatically

- Verify the workflow file is in `.github/workflows/`
- Check the Actions tab for error messages
- Ensure Actions are enabled in repository settings

## Contributing

Feel free to fork this project and customize it for your needs!

## License

ISC

## Acknowledgments

- Built with [Octokit](https://github.com/octokit/rest.js)
- Inspired by various GitHub profile README projects
