# Security Policy

Payday is a local-first Windows budgeting app. This policy explains how to report security concerns, what the app protects, and practical steps users can take.

## Reporting a vulnerability

Please report suspected vulnerabilities privately before sharing technical details publicly.

1. Open the [repository's Security tab](https://github.com/Juny-max/Payday/security). If **Report a vulnerability** is available, use it to submit a private report.
2. If that option is unavailable, [open an issue](https://github.com/Juny-max/Payday/issues) asking the maintainer for a private reporting channel. Include no exploit details or sensitive information in that issue.

A useful private report includes the affected version, Windows version, steps to reproduce, expected impact and a minimal example using fictional data. Never attach your real vault, backups, API key, access tokens or financial screenshots. No response-time guarantee or bug bounty is currently offered.

## Supported versions

Security fixes target the latest stable Windows release. Backports to older versions are not guaranteed. Check [official releases](https://github.com/Juny-max/Payday/releases) or **Settings > Updates** and keep the app current.

## Data and network boundaries

- Financial records and the optional Gemini API key are stored locally, encrypted using Windows-backed Electron safeStorage. The key is not returned to the interface or included in exported backups.
- Manual budgeting works offline. Payday has no central account database and does not connect to your bank accounts or transfer money.
- When you send an AI message, your message, recent conversation, selected budget and limited savings/debt context are sent to Google. Avoid including information you do not want to share with that provider.
- Update checks contact GitHub for release metadata. Exchange-rate refreshes request currency codes from the rate provider. These requests do not include your financial records or Gemini key.
- The interface runs with sandboxing and context isolation, with direct Node.js access disabled. Privileged actions use restricted IPC functions with sender and input checks.

## Important limitations

**Device access:** Windows-backed encryption does not protect against malware running under your Windows account or someone using your unlocked session. Payday does not have a separate app password or user login.

**Installer authenticity:** Current Windows releases are unsigned. The updater checks release checksums, but checksums alone cannot authenticate a publisher if the release source is compromised. Publisher signing remains a hardening priority.

**Backup recovery:** Encrypted backups depend on the original Windows account and its encryption context. They are not portable recovery files. Do not assume they will restore after changing Windows profiles, reinstalling Windows or clearing application data. Verify a backup's restorability before relying on it for a destructive change.

**Data integrity and loss:** Encryption and validation cannot prevent every deletion, damaged file, incorrect entry or malicious change by someone controlling the device. Older plaintext records are accepted for migration. Review imported records and AI suggestions before using them.

These are security boundaries and recovery limitations; they do not assert that a particular attack has occurred. Automated checks do not replace an independent security assessment.

## Practical precautions for users

- Download installers and updates from the [official Payday releases](https://github.com/Juny-max/Payday/releases). Treat copies shared by unknown accounts as unverified.
- Keep Windows and Payday updated. Lock your screen when away, use a separate Windows account on shared machines, and enable device encryption where available.
- Keep your Gemini key private. Restrict it to the intended API, monitor usage and revoke it if exposed.
- Use fictional data in public bug reports. Check screenshots for financial details, filenames and credentials before sharing them.
- Store backups carefully, verify recovery, and read reset/uninstall confirmations before deleting data.

## Contributing and publishing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development checks, credential handling and the release process. Please coordinate new vulnerability reports privately; fixes and advisories can then be published with appropriate guidance for users.
