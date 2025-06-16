# Contributing to NestJS Dashboard

Thank you for your interest in contributing to the NestJS Dashboard extension! We welcome contributions from the community and appreciate your help in making this extension better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)
- [Style Guidelines](#style-guidelines)
- [Troubleshooting](#troubleshooting)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful, inclusive, and considerate in all interactions.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 16 or higher
- **npm**: Latest version (comes with Node.js)
- **VS Code**: Latest version
- **Git**: For version control

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug Reports**: Help us identify and fix issues
- ✨ **Feature Requests**: Suggest new functionality
- 📝 **Documentation**: Improve our guides and documentation
- 🛠️ **Code Contributions**: Fix bugs or implement features
- 🎨 **UI/UX Improvements**: Enhance the user experience
- 🧪 **Testing**: Add or improve test coverage

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/yensubldg/nestjs-dashboard-extension.git
cd nestjs-dashboard-extension
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Open in VS Code

```bash
code .
```

### 4. Start Development

```bash
# Watch mode for development
npm run watch

# Or compile once
npm run compile
```

### 5. Launch Extension

- Press `F5` in VS Code to launch a new Extension Development Host window
- Open a NestJS project in the new window to test the extension

## Development Workflow

### Creating a Feature Branch

```bash
# Create and switch to a new feature branch
git checkout -b feat/your-feature-name
```

### Development Process

1. **Make Changes**: Implement your feature or fix
2. **Test Locally**: Use `F5` to test in Extension Development Host
3. **Build**: Run `npm run compile` to ensure it builds correctly
4. **Test Production Build**: Run `npm run vscode:prepublish` to test the production bundle

### Commit Guidelines

We follow conventional commit messages:

```bash
# Format: type(scope): description

# Types:
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc.
refactor: code refactoring
test: adding tests
chore: maintenance tasks

# Examples:
git commit -m "feat(parser): add support for async/await in controllers"
git commit -m "fix(tree-view): resolve icon positioning issue"
git commit -m "docs(readme): update installation instructions"
```

## Project Structure

```
nestjs-dashboard/
├── src/                          # Source code
│   ├── extension.ts             # Main extension entry point
│   ├── ApiTreeProvider.ts       # API endpoints tree view
│   ├── EntityTreeProvider.ts    # TypeORM entities tree view
│   ├── ConfigurationManager.ts  # Settings management
│   ├── parser/                  # Code parsing logic
│   │   ├── NestParser.ts        # NestJS controller parser
│   │   ├── SwaggerParser.ts     # Swagger documentation parser
│   │   └── MonorepoDetector.ts  # Monorepo structure detection
│   ├── providers/               # Various providers
│   │   ├── CopilotModelProvider.ts    # GitHub Copilot integration
│   │   └── EndpointHoverProvider.ts   # Hover information
│   ├── generators/              # Code generation
│   │   └── TestGenerator.ts     # Test file generation
│   └── views/                   # Custom webviews
│       └── StatisticsWebview.ts # Analytics dashboard
├── media/                       # Icons and assets
├── dist/                        # Compiled output
├── package.json                 # Extension manifest
├── esbuild.js                   # Build configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation
```

## Testing

### Manual Testing

1. **Launch Extension**: Press `F5` in VS Code
2. **Open Test Project**: Open a NestJS project in the Extension Development Host
3. **Test Features**:
   - Verify API endpoints appear in the tree view
   - Test entity detection (if using TypeORM)
   - Try test generation features
   - Check statistics dashboard
   - Test monorepo support (if applicable)

### Test Different Scenarios

- **Small Projects**: 1-5 controllers
- **Medium Projects**: 10-20 controllers
- **Large Projects**: 50+ controllers
- **Monorepo Projects**: Multiple apps
- **Various NestJS Versions**: Test compatibility

### Performance Testing

```bash
# Build for production and check bundle size
npm run vscode:prepublish

# Check the dist/ directory for bundle size
ls -la dist/
```

## Submitting Changes

### Before Submitting

1. **Test Thoroughly**: Ensure your changes work as expected
2. **Check Build**: Verify the extension builds without errors
3. **Update Documentation**: Update README.md if needed
4. **Write Clear Commit Messages**: Follow our commit guidelines

### Pull Request Process

1. **Push to Your Fork**:

   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create Pull Request**:

   - Go to the GitHub repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template

3. **PR Requirements**:
   - Clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes
   - Ensure CI checks pass

### Pull Request Template

```markdown
## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing

- [ ] Tested with small NestJS projects
- [ ] Tested with large NestJS projects
- [ ] Tested monorepo support (if applicable)
- [ ] Verified no performance regressions

## Screenshots

(If applicable, add screenshots to help explain your changes)

## Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review of the code completed
- [ ] Documentation updated if needed
- [ ] No console.log statements left in code
```

## Release Process

Releases are managed by maintainers:

1. **Version Bump**: Update version in `package.json`
2. **Update Changelog**: Add new version to `CHANGELOG.md`
3. **Create Release**: Tag and create GitHub release
4. **Marketplace**: Publish to VS Code Marketplace

## Style Guidelines

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **ESLint** configuration
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces
- Add **JSDoc comments** for public APIs

### Code Style

```typescript
// Good
class ApiTreeProvider implements vscode.TreeDataProvider<ApiNode> {
  /**
   * Gets the tree item representation of an API node
   * @param element The API node to convert
   * @returns TreeItem for VS Code
   */
  getTreeItem(element: ApiNode): vscode.TreeItem {
    // Implementation
  }
}

// Avoid
class apiTreeProvider {
  getTreeItem(element) {
    // Implementation without types
  }
}
```

### File Organization

- **One class per file** (generally)
- **Descriptive file names**: `ApiTreeProvider.ts`, not `provider.ts`
- **Group related functionality** in directories
- **Export from index files** when appropriate

### Error Handling

```typescript
// Good
try {
  const result = await parser.parseController(file);
  return result;
} catch (error) {
  console.error(`Failed to parse controller ${file}:`, error);
  vscode.window.showErrorMessage(`Error parsing controller: ${error.message}`);
  return null;
}
```

### Performance Considerations

- **Lazy load** heavy dependencies
- **Cache** expensive operations
- **Debounce** file system watchers
- **Use async/await** for I/O operations

## Troubleshooting

### Common Issues

#### Extension Not Loading

- Check VS Code Developer Console (`Help > Toggle Developer Tools`)
- Verify `package.json` syntax
- Ensure all dependencies are installed

#### Build Errors

```bash
# Clean and rebuild
npm run clean
npm install
npm run compile
```

#### Large Bundle Size

- Check esbuild configuration
- Review dependencies in `package.json`
- Use bundle analyzer: `npm run vscode:prepublish`

#### TypeScript Errors

```bash
# Check TypeScript compilation
npx tsc --noEmit
```

### Getting Help

- **GitHub Issues**: Report bugs or ask questions
- **Discussions**: Community discussions and feature requests
- **Email**: Contact maintainers for urgent issues

## Additional Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [NestJS Documentation](https://nestjs.com/)

## Recognition

All contributors will be recognized in:

- GitHub contributors list
- Project documentation
- Release notes (for significant contributions)

Thank you for contributing to NestJS Dashboard! 🚀

---

For questions about contributing, please open an issue or start a discussion on GitHub.
