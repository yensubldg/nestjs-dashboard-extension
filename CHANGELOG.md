# Change Log

All notable changes to the "nestjs-dashboard" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2025-06-16

### Added

- 🧪 **Test Generation**: Automatic test generation for endpoints and controllers with AI assistance
  - Beaker icons on each endpoint and controller for quick test generation
  - Both inline menu actions and clickable items for test generation
  - Support for unit tests, integration tests, and e2e tests
- 🤖 **GitHub Copilot Integration**: Intelligent test generation using GitHub Copilot models
  - Support for GPT-4o, GPT-4, and GPT-3.5 Turbo models
  - Model selection and configuration interface
  - Dedicated GitHub Copilot panel with model switching capabilities
- 📊 **Statistics Dashboard**: Comprehensive webview showing API statistics
  - Endpoint counts by HTTP method
  - Controller distribution and analysis
  - Interactive charts and visualizations
- 🏢 **Monorepo Support**: Enhanced support for monorepo project structures
  - Automatic detection of monorepo layouts
  - App selection functionality for multi-app repositories
  - Support for `apps/` and `libs/` folder structures
- 📖 **Swagger Integration**: Built-in Swagger documentation support
  - Swagger parser for enhanced endpoint metadata
  - Integration with existing Swagger setups
  - Ability to create new Swagger configurations
- 🎯 **Enhanced Configuration Management**: Centralized configuration system
  - Configuration manager for all extension settings
  - Support for workspace-specific configurations
  - Better defaults and validation
- 🔧 **Improved Hover Support**: Enhanced tooltip and hover information
  - Detailed endpoint information on hover
  - Better context and metadata display
- ⚡ **Performance Improvements**: Better parsing and caching mechanisms
  - Optimized file parsing for large projects
  - Improved startup time and responsiveness

### Changed

- Updated VSCode engine requirement to ^1.85.0 for Language Model API support
- Enhanced tree view with better icon positioning and user experience
- Improved tooltip messages and user guidance
- Better error handling and user feedback

### Fixed

- Resolved icon positioning issues in tree view
- Fixed GitHub Copilot model selection on first click
- Improved stability and error handling across all features

## [0.0.4] - 2025-06-15

### Changed

- Updated `README.md` with the latest release information and general improvements.

## [0.0.3] - 2025-06-15

### Added

- New "Entities" section in the dashboard to display TypeORM entities
- Entity detection and parsing functionality
- Property display with decorators and types for each entity
- Icons for different property types (primary keys, columns, relationships)
- Click-to-navigate functionality for entities

### Changed

- Updated extension structure to support multiple tree views
- Enhanced parser to detect both controllers and entities

## [0.0.2] - Previous

- Initial release with API endpoints detection
