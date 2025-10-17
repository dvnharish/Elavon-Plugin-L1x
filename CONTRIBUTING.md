# Contributing to L1X ElavonX Migrator

Thank you for your interest in contributing to the L1X ElavonX Migrator! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues
- Use the [GitHub Issues](https://github.com/dvnharish/Elavon-Plugin-L1x/issues) page
- Search existing issues before creating a new one
- Provide detailed information including:
  - VS Code version
  - Extension version
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshots if applicable

### Suggesting Features
- Open a [Feature Request](https://github.com/dvnharish/Elavon-Plugin-L1x/issues/new?template=feature_request.md)
- Describe the use case and benefits
- Consider the phase-based development approach

### Code Contributions

#### Prerequisites
- Node.js 16.x or higher
- VS Code 1.74.0 or higher
- Git knowledge
- TypeScript experience

#### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/Elavon-Plugin-L1x.git
cd Elavon-Plugin-L1x

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Start development
npm run watch
```

#### Development Workflow
1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make changes** following our coding standards
3. **Add tests** for new functionality
4. **Run tests**: `npm test`
5. **Run linting**: `npm run lint`
6. **Commit changes**: Use conventional commit format
7. **Push and create PR**

## 📝 Coding Standards

### TypeScript Guidelines
- Use strict TypeScript configuration
- Add JSDoc comments for public APIs
- Follow existing naming conventions
- Use proper type annotations

### Code Style
- Follow ESLint configuration
- Use 2-space indentation
- Add trailing commas in multiline structures
- Use single quotes for strings

### Testing Requirements
- Maintain test coverage above 90%
- Write unit tests for new functions
- Add integration tests for panel interactions
- Use descriptive test names

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(scan): add regex pattern for Java Spring annotations`
- `fix(credentials): resolve SecretStorage race condition`
- `docs(readme): update installation instructions`

## 🏗️ Architecture Guidelines

### Panel Development
- Use TreeDataProvider pattern for consistency
- Implement proper refresh mechanisms
- Add appropriate context menu items
- Include toolbar buttons with icons

### Command Implementation
- Register commands in CommandRegistry
- Use proper logging with Logger utility
- Handle errors gracefully
- Provide user feedback

### Testing Patterns
- Mock VS Code APIs using test utilities
- Test both success and error scenarios
- Use descriptive test descriptions
- Group related tests in describe blocks

## 📋 Phase-Based Development

### Current Phase: Phase 1 ✅
- Professional UI with tree-based panels
- Interactive toolbar buttons
- Mock data and skeleton functionality

### Upcoming Phases
- **Phase 2**: Real code scanning with AST parsing
- **Phase 3**: Credential management with API integration
- **Phase 4**: OpenAPI specification processing
- **Phase 5**: AI-powered code generation

### Contributing to Future Phases
- Check the [tasks.md](.kiro/specs/l1x-elavonx-migrator/tasks.md) for specific tasks
- Focus on one phase at a time
- Ensure backward compatibility
- Update tests and documentation

## 🔍 Code Review Process

### What We Look For
- **Functionality**: Does it work as intended?
- **Tests**: Are there adequate tests?
- **Documentation**: Is it properly documented?
- **Performance**: Does it impact extension startup time?
- **Security**: Are credentials handled securely?

### Review Checklist
- [ ] Code follows TypeScript best practices
- [ ] Tests pass and coverage is maintained
- [ ] ESLint passes without warnings
- [ ] Documentation is updated
- [ ] No breaking changes without discussion
- [ ] Performance impact is minimal

## 🚀 Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Extension packaged and tested
- [ ] GitHub release created

## 🎯 Areas for Contribution

### High Priority
- Code scanning algorithms for different languages
- OpenAPI specification parsing
- AI integration improvements
- Performance optimizations

### Medium Priority
- Additional language support
- UI/UX improvements
- Documentation enhancements
- Test coverage improvements

### Low Priority
- Code refactoring
- Build system improvements
- Development tooling

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Code Reviews**: Direct feedback on pull requests

### Response Times
- **Issues**: We aim to respond within 48 hours
- **Pull Requests**: Initial review within 72 hours
- **Security Issues**: Immediate attention (email maintainers)

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

## 📄 Legal

By contributing to this project, you agree that your contributions will be licensed under the MIT License. You also confirm that you have the right to submit your contributions under this license.

---

Thank you for contributing to the L1X ElavonX Migrator! Your efforts help make API migration easier for developers worldwide. 🚀