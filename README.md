# L1X ElavonX Migrator

A VS Code extension designed to assist developers in migrating legacy Converge API integrations to modern Elavon L1 APIs.

## Features

- **Project Scan**: Discover Converge API integration points across multiple programming languages
- **Credentials Management**: Securely manage Elavon L1 API credentials with connectivity testing
- **Documentation**: Side-by-side OpenAPI specification viewer with automated field mapping
- **Migration**: AI-assisted code transformation with Monaco diff editor and audit trails

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Compile the extension: `npm run compile`
4. Package the extension: `npm run package`
5. Install the generated `.vsix` file in VS Code

### Development

1. Open this project in VS Code
2. Press `F5` to run the extension in a new Extension Development Host window
3. The L1X icon will appear in the Activity Bar

## Usage

1. Click the L1X icon in the Activity Bar to open the migrator panels
2. Use the **Project Scan** panel to discover Converge API integrations
3. Configure your Elavon L1 credentials in the **Credentials** panel
4. Load API specifications in the **Documentation** panel for mapping
5. Generate and apply migrations using the **Migration** panel

## Development Scripts

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch for changes and compile
- `npm run package` - Package for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Requirements

- VS Code 1.74.0 or higher
- Node.js 16.x or higher

## License

Copyright © Elavon. All rights reserved.