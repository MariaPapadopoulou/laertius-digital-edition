# Security policy

Please do not open a public issue containing an API key, password, evaluation
token, private key, server address, private dataset, or vulnerability details.

## Before publishing a change

1. Keep production configuration outside the repository.
2. Confirm that `.env`, model caches, and live evaluation state remain ignored.
3. Run the repository's validation and type-checking commands.
4. Review staged files with `git diff --cached` before pushing.
5. Rotate any credential immediately if it is accidentally disclosed.

## Supported versions

The current `main` branch is the only actively maintained version of this
repository. Older commits and unpublished versions are not formally supported.

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues or
pull requests.

Once private vulnerability reporting is enabled, please use the **Report a
vulnerability** button under **Security and quality → Advisories**.

If private reporting is unavailable, contact the repository owner privately
through GitHub.

A report should include:

- A clear description of the issue
- The affected file, URL, or component
- Steps to reproduce the problem
- The possible impact
- Relevant screenshots, logs, or proof-of-concept material

Please remove passwords, API keys, tokens, and other sensitive information
before submitting a report.

Security reports will be reviewed confidentially.
