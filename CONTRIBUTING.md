# Contributing to Dosh

Thank you for your interest in contributing to Dosh. This document outlines how you can participate in the project.

## Getting Started

- Read the [README](README.md) for an overview of the product and deployment instructions.
- Review the [Documentation Framework](docs/DOCUMENTATION_FRAMEWORK.md) to understand how project documents are structured and maintained.
- Check the [Roadmap](docs/ROADMAP.md) and [Development Activities](docs/DEVELOPMENT_ACTIVITIES.md) to see what is currently being worked on.

## How to Contribute

### Reporting Bugs

- Use the [GitHub Issues](https://github.com/mixednutts/dosh/issues) page to report bugs.
- Include a clear description, steps to reproduce, expected behaviour, and actual behaviour.
- Mention your environment (browser, OS, Docker version if relevant).

### Suggesting Features

- Open a GitHub Issue with the `enhancement` label.
- Describe the problem or opportunity the feature addresses.
- Explain the proposed solution and any alternatives considered.

### Contributing Code

1. Fork the repository and create a branch from `main`.
2. Make your changes with clear, focused commits.
3. Add or update tests to cover your changes.
4. Run the test suites locally:
   - Backend: `cd backend && source .venv/bin/activate && python -m pytest tests/ -q`
   - Frontend: `cd frontend && npm test`
5. Ensure the application builds and runs in Docker:
   - `docker compose up --build -d`
6. Open a Pull Request with a concise description of what changed and why.

## Development Guidelines

- Follow the existing code style and naming conventions.
- Keep changes focused. If a change is large, consider breaking it into smaller, reviewable pieces.
- Update relevant documentation if your change affects user-facing behaviour, API contracts, or deployment steps.
- Do not commit directly to `main`. All changes should go through Pull Request review.

## Code of Conduct

Be respectful and constructive. Harassment or discriminatory behaviour will not be tolerated.

## Questions

For general questions, open a GitHub Discussion or Issue. For security concerns, please contact the maintainers directly rather than opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
