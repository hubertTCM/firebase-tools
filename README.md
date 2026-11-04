# Reference:

- graphcs.txt, dictionary.txt: https://github.com/skishore/makemeahanzi

# Releasing

Releases are automated by [semantic-release](https://semantic-release.gitbook.io) on every push to `main` (GitHub Actions). It reads [Conventional Commits](https://www.conventionalcommits.org), bumps the version, updates `CHANGELOG.md`, tags `vX.Y.Z` and creates a GitHub release.

- `fix:` / `perf:` -> patch, `feat:` -> minor, `feat!:` or a `BREAKING CHANGE:` footer -> major
- `chore:`, `docs:`, `refactor:` etc. do not release
- Consumers pin a tag, e.g. `https://git@github.com/hubertTCM/firebase-tools.git#v1.1.1`; bump that ref after a release
- Dry run locally: `GITHUB_TOKEN=<token> yarn release --dry-run --no-ci`
