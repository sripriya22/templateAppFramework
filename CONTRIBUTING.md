# Contributing to Data Model Framework

We're excited that you're interested in contributing to the Data Model Framework! Here's how you can help.

## Code of Conduct

This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/version/2/0/code_of_conduct/).
By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature`

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

### Testing

Run tests for all packages:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Linting

We use ESLint for code quality. Run the linter with:

```bash
npm run lint
```

## Pull Requests

1. Keep your PRs focused on a single feature or bug fix
2. Update documentation as needed
3. Ensure all tests pass
4. Follow the existing code style
5. Reference any related issues in your PR

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Example:

```
feat(core): add support for custom validators

Add ability to register custom validation functions that can be used in model definitions.

Closes #123
```

## Releasing

Maintainers handle releases. To prepare a new release:

1. Update version numbers in package.json files
2. Update CHANGELOG.md
3. Create a release tag
4. Publish to npm

## Questions?

Open an issue or join our community chat for help.
