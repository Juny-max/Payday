# Contributing to Payday

Bug reports and focused improvements are welcome. Discuss substantial changes in an issue before implementing them. For suspected vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of posting technical details publicly.

## Development and verification

Use Node.js 22+; Windows is required to build the Windows installer.

```sh
npm ci
npm run dev
npm test
npm run check:secrets
npm run build
```

Desktop verification scripts use isolated test vaults in the ignored artifacts directory. Use fictional amounts and test API keys. Do not run live credential diagnostics as part of normal contribution checks.

## Protect credentials and personal records

Never commit Gemini keys, GitHub tokens, environment files, private signing keys, live vaults, exported backups, diagnostic dumps or personal screenshots. Do not put credentials in repository URLs.

The publication allowlist is defined in scripts/check-secrets.mjs. When adding a new source or documentation location, review it and update that allowlist deliberately. The scanner checks selected credential patterns; it cannot prove arbitrary files contain no secrets.

Before committing, run the scanner and review the staged file list and diff. Keep generated builds, node_modules, caches and local test captures out of Git. Do not include real secrets in test fixtures or examples.

## Maintainer release process

1. Review and test the change. Bump package.json to a new version and update package-lock.json.
2. Run unit tests, the secret scan, the production build and desktop checks appropriate to the change.
3. Push the reviewed version change to main. This triggers the Windows release workflow. Documentation-only changes do not require an installer release.
4. GitHub Actions installs dependencies, scans the source, tests and packages the app, then publishes a versioned GitHub release. It uses GitHub's temporary GITHUB_TOKEN in the publishing step; no personal publishing token belongs in source or the installer.
5. Confirm that the installer, its blockmap and latest.yml are present. Asset names and hashes must match the update metadata. Verify discovery through the real updater with automatic downloading disabled.

An existing published version is not overwritten by the workflow. Increment the version for a new release. Local npm run dist builds into release/ and does not publish automatically.

## Protect the release pipeline

Maintainers should use passkeys/security keys or strong two-factor authentication, restrict write access, and review collaborator access and third-party integrations. Protect main and release-workflow changes with appropriate review rules. Review dependency changes and keep Electron and its security-sensitive dependencies maintained.

Publisher signing and stronger release hardening remain priorities. Protect any future signing keys independently from ordinary repository credentials. Never disable updater integrity checks to work around a failed download.

## Licence

Contributions must be compatible with the project's [MIT licence](LICENSE). Retain third-party licence notices and only contribute assets you have permission to distribute.
