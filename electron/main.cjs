const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  nativeTheme,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { z } = require("zod");
let win,
  writeQueue = Promise.resolve();
const dev = process.argv.includes("--dev") && !app.isPackaged;
const file = (name) => path.join(app.getPath("userData"), name);
async function read(name) {
  try {
    return JSON.parse(await fs.readFile(file(name), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw new Error(
      "The local vault could not be read. Your file has been kept intact.",
    );
  }
}
async function atomic(name, value) {
  const tmp = file(name + ".tmp");
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file(name));
}
function enqueue(fn) {
  const next = writeQueue.then(fn);
  writeQueue = next.catch(() => {});
  return next;
}
const { initialVault, stateSchema: vault } = require("./model.cjs");
function trusted(event) {
  const u = event.senderFrame?.url || "";
  if (
    event.sender !== win?.webContents ||
    !(dev ? u.startsWith("http://127.0.0.1:5173/") : u.startsWith("file://"))
  )
    throw new Error("Untrusted sender");
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    nativeTheme.themeSource = "light";
    const vaultStorage = require("./vault-storage.cjs").createVaultStorage({
      directory: app.getPath("userData"),
      safeStorage,
      schema: vault,
    });
    const updates = require("./updates.cjs").createUpdateService({
      app,
      updater: require("electron-updater").autoUpdater,
      notify: state => { if(win && !win.isDestroyed()) win.webContents.send("updates:status", state); },
      beforeInstall: async () => { await writeQueue; },
    });
    ipcMain.handle("currency:rates", async e => { trusted(e); try { return await require("./exchange.cjs").fetchRates(); } catch { throw new Error("Could not refresh exchange rates. Keep your saved rates or enter rates manually."); } });
    ipcMain.handle("updates:get", e => {trusted(e); return updates.get();});
    ipcMain.handle("updates:check", e => {trusted(e); return updates.check();});
    ipcMain.handle("updates:download", e => {trusted(e); return updates.download();});
    ipcMain.handle("updates:install", e => {trusted(e); return updates.install();});
    ipcMain.handle("vault:load", async (e) => {
      trusted(e);
      const v = await enqueue(() => vaultStorage.read());
      const k = await read("payday-key.json");
      return { vault: v ? vault.parse(v) : null, hasKey: !!k?.encrypted };
    });
    ipcMain.handle("vault:save", async (e, v) => {
      trusted(e);
      const valid = vault.parse(v);
      await enqueue(() => vaultStorage.write(valid));
    });
    ipcMain.handle("vault:reset", async (e, confirmation) => {
      trusted(e);
      if (confirmation !== "RESET_PAYDAY")
        throw new Error("Reset confirmation is required.");
      return enqueue(async () => {
        const old = await vaultStorage.read(),
          oldKey = await read("payday-key.json"),
          fresh = initialVault();
        try {
          await atomic("payday-key.json", { encrypted: null });
          await vaultStorage.write(fresh);
        } catch (error) {
          if (oldKey) await atomic("payday-key.json", oldKey);
          if (old) await vaultStorage.write(old);
          throw error;
        }
        return fresh;
      });
    });
    ipcMain.handle("app:uninstall", async (e) => {
      trusted(e);
      if (!app.isPackaged)
        throw new Error(
          "The uninstall wizard is available after installing Payday.",
        );
      const uninstaller = path.join(
        path.dirname(process.execPath),
        "Uninstall Payday.exe",
      );
      try {
        if (!(await fs.stat(uninstaller)).isFile()) throw new Error();
      } catch {
        throw new Error(
          "Open Windows Settings > Apps > Installed apps > Payday to uninstall.",
        );
      }
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      await new Promise((resolve, reject) => {
        const child = require("node:child_process").spawn(uninstaller, [], {
          detached: true,
          stdio: "ignore",
          env,
        });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      setTimeout(() => app.quit(), 150);
      return true;
    });
    ipcMain.handle("key:set", async (e, key) => {
      trusted(e);
      if (typeof key !== "string" || key.length > 500)
        throw new Error("Invalid API key");
      if (key && !safeStorage.isEncryptionAvailable())
        throw new Error("Windows secure credential storage is unavailable.");
      await enqueue(() =>
        atomic(
          "payday-key.json",
          key
            ? {
                encrypted: safeStorage
                  .encryptString(key.trim())
                  .toString("base64"),
              }
            : { encrypted: null },
        ),
      );
    });
    ipcMain.handle("vault:export", async (e) => {
      trusted(e);
      await writeQueue;
      const v = await enqueue(() => vaultStorage.read());
      if (!v) throw new Error("Save a plan before exporting.");
      const result = await dialog.showSaveDialog(win, {
        defaultPath: "payday-backup.encrypted.json",
        filters: [{ name: "JSON backup", extensions: ["json"] }],
      });
      if (result.canceled) return false;
      await fs.writeFile(
        result.filePath,
        JSON.stringify(vaultStorage.encode(v), null, 2),
      );
      return true;
    });
    ipcMain.handle("vault:decode-backup", async (e, text) => {
      trusted(e);
      z.string().max(5000000).parse(text);
      return vaultStorage.decode(JSON.parse(text));
    });
    async function savedGeminiKey() {
      const k = await read("payday-key.json");
      if (!k?.encrypted)
        throw new Error("Add a Gemini API key in Settings first.");
      try {
        return safeStorage.decryptString(Buffer.from(k.encrypted, "base64"));
      } catch {
        throw new Error(
          "Windows could not unlock the saved Gemini key. Save it again in Settings.",
        );
      }
    }
    ipcMain.handle("key:check", async (e) => {
      trusted(e);
      return require("./gemini.cjs").checkKey(await savedGeminiKey());
    });
    ipcMain.handle("ai:plan", async (e, prompt, current) => {
      trusted(e);
      const saved = await enqueue(() => vaultStorage.read());
      return require("./gemini.cjs").generatePlan({
        appContext: saved ? { savingsBalance: saved.savingsBalance, selfDebt: saved.debt, savedPaydayMonth: saved.plan.month, savedSalary: saved.plan.salary, displayCurrency: saved.displayCurrency ?? "GHS", exchangeRates: saved.exchangeRates ?? null, currentMonth: new Date().toLocaleDateString("en-CA", {timeZone:"Africa/Accra",year:"numeric",month:"2-digit"}) } : null,
        conversation: true,
        apiKey: await savedGeminiKey(),
        prompt,
        current,
      });
    });
    const create = () => {
      win = new BrowserWindow({
        width: 1440,
        height: 1000,
        minWidth: 1000,
        minHeight: 740,
        backgroundColor: "#F8FAFC",
        title: "Payday",
        autoHideMenuBar: true,
        icon: path.join(__dirname, "../public/icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.once("ready-to-show", () => win.show());
      win.webContents.on("will-navigate", (e, url) => {
        if (url !== win.webContents.getURL()) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler((_wc, _p, cb) =>
        cb(false),
      );
      win.webContents.session.webRequest.onHeadersReceived((details, cb) =>
        cb({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              dev
                ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173; img-src 'self' data:"
                : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:",
            ],
          },
        }),
      );
      dev
        ? win.loadURL("http://127.0.0.1:5173")
        : win.loadFile(path.join(__dirname, "../dist/index.html"));
    };
    create();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) create();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
