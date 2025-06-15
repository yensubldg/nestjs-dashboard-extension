# NestJS Dashboard

![NestJS Dashboard Logo](media/logo.png)

A powerful VS Code extension that provides a comprehensive dashboard view of all HTTP API endpoints in your NestJS projects. Streamline your development workflow by having instant access to your entire API structure.

## ✨ Features

### 🎯 Comprehensive API Discovery

- **Smart Parsing**: Automatically discovers controllers and HTTP methods in `src/`, `apps/`, and `libs/` folders
- **Complete Endpoint Information**: Displays HTTP method, full path, controller name, handler method, and optional summaries
- **Multi-Project Support**: Works with monorepo structures and multiple NestJS applications

### 🔄 Real-time Updates

- **Auto-refresh**: Automatically updates when TypeScript files change
- **Manual Refresh**: Use the refresh button or command palette for instant updates
- **Live Monitoring**: Keeps your dashboard synchronized with code changes

### 🎨 Clean Interface

- **Sidebar Integration**: Dedicated panel in the Activity Bar
- **Organized Display**: Clear, hierarchical view of all endpoints
- **Quick Navigation**: Click to jump directly to endpoint definitions

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "NestJS Dashboard"
4. Click Install

### Manual Installation

1. Download the `.vsix` file from [releases](https://github.com/yensubldg/nestjs-dashboard-extension/releases)
2. Open VS Code
3. Run `Extensions: Install from VSIX...` from the Command Palette
4. Select the downloaded `.vsix` file

## 🚀 Usage

### Getting Started

1. Open any NestJS project in VS Code
2. Look for the **NestJS Dashboard** icon in the Activity Bar (left sidebar)
3. Click to open the dashboard panel
4. Your API endpoints will automatically appear under "API Endpoints"

### Available Commands

- **Refresh API Endpoints**: Manually refresh the endpoint list
- **Open Endpoint**: Navigate directly to the endpoint definition

### Keyboard Shortcuts

Access commands via Command Palette (`Ctrl+Shift+P`):

- `NestJS Dashboard: Refresh API Endpoints`

## 🛠️ Requirements

- **VS Code**: Version 1.50.0 or higher
- **NestJS Project**: Works with any NestJS TypeScript project
- **File Structure**: Recognizes standard NestJS project structures

## ⚙️ Extension Settings

This extension works out of the box with default settings. Future versions may include configurable options for:

- Custom source directories
- Endpoint filtering
- Display preferences

## 📋 Supported Decorators

The extension recognizes the following NestJS HTTP decorators:

- `@Get()`
- `@Post()`
- `@Put()`
- `@Patch()`
- `@Delete()`
- `@Options()`
- `@Head()`
- `@All()`

## 🐛 Known Issues

- Large projects (500+ endpoints) may experience slower initial parsing
- Dynamic route parameters in complex inheritance scenarios might not be fully resolved
- Requires TypeScript files to be properly formatted for accurate parsing

Found a bug? [Report it here](https://github.com/yensubldg/nestjs-dashboard-extension/issues)

## 🗂️ Release Notes

### 0.0.1 (Initial Release)

- ✅ Core API endpoint discovery
- ✅ Sidebar dashboard integration
- ✅ Auto-refresh on file changes
- ✅ Manual refresh functionality
- ✅ Support for standard NestJS project structures

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/yensubldg/nestjs-dashboard-extension/blob/main/CONTRIBUTING.md) for details.

### Development Setup

1. Clone the repository
2. Run `npm install`
3. Press `F5` to launch the extension in a new VS Code window
4. Open a NestJS project to test the extension

## 📄 License

This extension is released under the [MIT License](LICENSE).

## 🔗 Links

- **GitHub Repository**: [nestjs-dashboard-extension](https://github.com/yensubldg/nestjs-dashboard-extension)
- **VS Code Marketplace**: [NestJS Dashboard](https://marketplace.visualstudio.com/items?itemName=yensubldg.nestjs-dashboard)
- **Issue Tracker**: [Report Issues](https://github.com/yensubldg/nestjs-dashboard-extension/issues)
- **Changelog**: [View Changes](CHANGELOG.md)

## 🙏 Support

If you find this extension helpful, please:

- ⭐ Star the [GitHub repository](https://github.com/yensubldg/nestjs-dashboard-extension)
- 📝 Leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=yensubldg.nestjs-dashboard)
- 🐛 Report issues or suggest features

---

Enjoy coding with NestJS Dashboard! 🚀
