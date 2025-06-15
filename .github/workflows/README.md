# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated CI/CD processes.

## Workflows

### 1. Package Extension (`package.yml`)
**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch
- Manual trigger (`workflow_dispatch`)

**What it does:**
- Sets up Node.js environment
- Installs dependencies
- Compiles TypeScript
- Packages the VS Code extension using `vsce`
- Uploads the `.vsix` file as a GitHub artifact

**Artifacts:**
- Extension package (`.vsix` file) with retention of 30 days
- Named as `{package-name}-{version}`

### 2. CI/CD Pipeline (`ci-cd.yml`)
**Triggers:**
- Push to `main` or `develop` branches
- Push of version tags (`v*`)
- Pull requests to `main` branch
- Manual trigger (`workflow_dispatch`)

**Jobs:**

#### Test Job
- Runs linting (if configured)
- Compiles TypeScript
- Runs tests (if configured)

#### Package Job
- Runs on multiple OS (Ubuntu, Windows, macOS)
- Creates extension packages for each platform
- Uploads artifacts for each OS

#### Release Job (only on version tags)
- Creates a GitHub release
- Uploads the extension package as a release asset
- Includes release notes

## Usage

### For Development
1. Push code to `develop` or `main` branch
2. The workflow will automatically build and package the extension
3. Download artifacts from the Actions tab

### For Releases
1. Create and push a version tag: `git tag v1.0.0 && git push origin v1.0.0`
2. The workflow will create a GitHub release with the packaged extension
3. Users can download the `.vsix` file from the releases page

## Installing from Artifacts
1. Go to the Actions tab in your GitHub repository
2. Find the successful workflow run
3. Download the artifact containing the `.vsix` file
4. In VS Code: Extensions → "..." menu → "Install from VSIX..."
5. Select the downloaded `.vsix` file

## Configuration
To enhance the workflows, you can:
- Add proper linting configuration (ESLint)
- Add unit tests and update the `test` script
- Configure automated publishing to VS Code Marketplace
- Add code coverage reporting
