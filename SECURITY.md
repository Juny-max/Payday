# Security and release handling

Never commit Gemini API keys, GitHub personal tokens, environment files, private signing keys, app vaults, exported backups, test captures or local diagnostic dumps. Do not put credentials in a repository URL.

Run `npm run check:secrets` before publishing. Only files returned by `reviewFiles()` are part of the reviewed source allowlist; ignored/private files and live diagnostic scripts are excluded. Pattern scanning is a safeguard, not a proof that arbitrary text contains no secret. Review changes and do not add personal records to tests.

GitHub Actions receives a short-lived token through the secrets context, solely for publishing releases. No token is embedded in the installer or needed by users of the public update feed. Runtime Gemini credentials remain protected by Windows safeStorage. Encryption protects stored records, not a compromised logged-in Windows session.

Updates are checked and downloaded explicitly. The updater validates release checksums and refuses downgrades. Current builds are unsigned; do not disable validation or add arbitrary user-supplied update URLs. Restrict repository write access and enable GitHub account two-factor authentication.
