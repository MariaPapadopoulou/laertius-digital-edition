# Security policy

Please do not open a public issue containing an API key, password, evaluation
token, private key, server address, private dataset, or vulnerability details.

Before publishing a change:

1. Keep production configuration outside the repository.
2. Confirm that `.env`, model caches, and live evaluation state remain ignored.
3. Run the repository's validation and type-checking commands.
4. Review staged files with `git diff --cached` before pushing.
5. Rotate any credential immediately if it is accidentally disclosed.

Security reports should be sent privately to the repository owner through a
private contact channel rather than a public GitHub issue.

