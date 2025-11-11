# GitHub Profile Auto-Update

This project automatically updates your GitHub profile README with statistics about your repositories and language usage.

## Features

- 📊 **Repository Statistics**: Shows total, public, and private repository counts
- 💻 **Language Distribution**: Displays programming language percentages across all repositories
- 🔄 **Automatic Updates**: Runs daily via GitHub Actions
- 📈 **Visual Charts**: Progress bars for top languages
- 📋 **Detailed Breakdown**: Collapsible table with complete language statistics

## How It Works

1. The TypeScript script fetches all repositories you have access to (owned, collaborated, or organization member)
2. It aggregates language statistics from the GitHub API
3. Calculates percentages based on total bytes of code
4. Updates the README.md file with formatted statistics
5. GitHub Actions commits the changes automatically

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

Edit `src/update-profile.ts` to change how many languages are shown:

```typescript
const topLanguages = languages.slice(0, 10); // Change 10 to desired number
```

### Visual Bar Length

Adjust the progress bar scaling:

```typescript
const barLength = Math.round(percentage / 2); // Change divisor for different scales
```

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
