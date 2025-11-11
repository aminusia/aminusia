# Quick Reference Guide

## What Was Built

A complete GitHub profile auto-update system that displays repository statistics and language distribution.

## Key Components

### 1. TypeScript Script (`src/update-profile.ts`)
- Fetches all repositories using GitHub API
- Calculates language percentages
- Generates formatted statistics
- Updates README.md automatically

### 2. GitHub Actions Workflow (`.github/workflows/update-profile.yml`)
- Runs daily at midnight UTC
- Can be triggered manually
- Uses minimal permissions
- Commits changes automatically

### 3. Documentation
- `DOCUMENTATION.md` - Complete setup guide
- `EXAMPLE_OUTPUT.md` - Example of what the profile looks like
- This file - Quick reference

## How to Use

### After Merging This PR:

1. **Automatic Updates** - The workflow runs daily at midnight UTC
2. **Manual Trigger** - Go to Actions tab → "Update GitHub Profile" → "Run workflow"
3. **View Results** - Check your profile at https://github.com/aminusia

### To Customize:

Edit these settings in `src/update-profile.ts`:
- `topLanguages.slice(0, 10)` - Number of languages to show (line ~103)
- `percentage / 2` - Progress bar scale (line ~106)

Edit this in `.github/workflows/update-profile.yml`:
- `cron: '0 0 * * *'` - Update schedule (line 5)

## Technical Stack

- **TypeScript** - Type-safe code
- **@octokit/rest** - GitHub API client
- **GitHub Actions** - Automation
- **Node.js 20** - Runtime environment

## What Gets Updated

The section between these markers in README.md:
```markdown
<!-- STATS:START -->
<!-- Content automatically updated here -->
<!-- STATS:END -->
```

## Troubleshooting

### If the workflow fails:
1. Check Actions tab for error logs
2. Ensure Actions are enabled in repo settings
3. Verify the workflow file syntax

### If no stats appear:
1. Wait for first workflow run (or trigger manually)
2. Check that repositories have code
3. Verify README has the markers

### For local testing:
```bash
export GITHUB_TOKEN=your_token
npm install
npm run update-profile
```

## File Structure

```
aminusia/
├── .github/
│   └── workflows/
│       └── update-profile.yml    # Automation workflow
├── src/
│   └── update-profile.ts         # Main script
├── README.md                     # Your profile (with markers)
├── DOCUMENTATION.md              # Full documentation
├── EXAMPLE_OUTPUT.md             # Example output
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

## Security

✅ No vulnerabilities in dependencies
✅ Minimal workflow permissions
✅ All CodeQL checks passed
✅ Uses built-in GITHUB_TOKEN

## Next Steps

1. Merge this PR
2. Watch the magic happen!
3. Customize to your liking (optional)

---

**Questions?** Check [DOCUMENTATION.md](DOCUMENTATION.md) for detailed information.
