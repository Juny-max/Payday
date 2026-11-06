const { app, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const dir = path.resolve("artifacts", `desktop-vault-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
app.setPath("userData", dir);
dialog.showSaveDialog = async () => ({
  canceled: false,
  filePath: path.join(dir, "backup.json"),
});
app.on("browser-window-created", (_e, win) => win.hide());
require("../electron/main.cjs");
