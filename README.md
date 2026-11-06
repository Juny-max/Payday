# Payday

A Windows payday planner for Ghana cedis. Plan salary across savings, commute/data, feeding and lifestyle accounts. No daily expense logging. Rename accounts, fund wishlist goals and record borrowing from savings.

## Run and build

Requires Node.js 22+ and Windows for the desktop installer.

```sh
npm ci
npm test
npm run dev
npm run dist
```

The installer, blockmap and `latest.yml` are written to `release/`. Generated builds, caches, test vaults and diagnostic captures are excluded from Git. Source publication uses `scripts/check-secrets.mjs` and an explicit allowlist; it never includes the local app-data directory.

## Local data and optional AI

The encrypted vault and optional Gemini key are stored in the Windows user's dedicated Payday app-data folder. The key is never included in backups or returned to the renderer. AI requests explicitly send the message, recent conversation, selected budget and limited savings/debt context to Google. Manual planning works offline. AI amounts are validated and reviewed before saving.

Backups use Windows credential protection and can only be restored under the same Windows account. The app records allocations; it does not access bank accounts or move money.

## Updates and releases

Settings > Updates checks public releases in [Juny-max/Payday](https://github.com/Juny-max/Payday/releases). Updates download only when requested. After download, choose Restart and install. Updates preserve the vault and key. Older builds without update support need one manual installation of version 1.4.7 or later.

Pushing a new version in package.json to main runs the Windows release workflow. It tests, scans the allowlisted source, builds, and publishes the installer, blockmap and latest.yml as a versioned GitHub release. Repository contents stay free of binaries. The workflow uses GitHub's short-lived GITHUB_TOKEN; no personal token belongs in source or app settings. If a version is already released, the workflow does not overwrite it; bump the version to publish again. Manual local builds never publish automatically.

The app and updater currently use unsigned Windows builds. Downloads are checked against release metadata checksums. Protect the repository and release workflow; publisher certificate signing can be added separately.

## Reset and uninstall

Settings has a confirmed reset and the installed Windows uninstall wizard. Leave Delete ALL Payday history, balances and API key selected to remove the app-owned data/cache folders. Upgrades preserve records. Downloaded installers, source checkout and external backups are separate files and are not deleted by uninstall.

## Checks

`npm test` covers budgeting, calendar calculations, vault handling and the updater state machine. Desktop UI scripts use isolated test vaults. `node scripts/verify-uninstall.mjs` exercises the shared NSIS cleanup against disposable fixtures with a locally cached NSIS compiler.
