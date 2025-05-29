# Data Model Framework Monorepo

A monorepo containing the core framework and CLI tools for creating data-driven web applications with MATLAB integration.

## Packages

### `@data-model-framework/core`
The core framework providing data modeling, validation, and state management.

### `@data-model-framework/generator`
A CLI tool for scaffolding new applications using the framework.

## Project Structure

```
.
├── appFramework/     # Core framework package
│   ├── src/          # Source code
│   └── test/         # Tests
├── appGenerator/     # CLI tool for app generation
│   ├── src/          # Source code
│   ├── templates/    # Template files
│   └── test/         # Tests
├── test/             # Shared test utilities
└── package.json      # Root package configuration
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm (v7+ for workspaces support)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/data-model-framework.git
   cd data-model-framework
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

1. Build all packages:
   ```bash
   npm run build
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Run tests with coverage:
   ```bash
   npm run test:coverage
   ```

### Using the Generator

1. Generate a new application:
   ```bash
   npx @data-model-framework/generator create my-app
   ```

2. Navigate to the new app and install dependencies:
   ```bash
   cd my-app
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Publishing

### Publish a New Version

1. Update version numbers in the respective `package.json` files
2. Commit and push changes
3. Publish packages:
   ```bash
   # From the root directory
   npm publish -w @data-model-framework/core
   npm publish -w @data-model-framework/generator
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT
