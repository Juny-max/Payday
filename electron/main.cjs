const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
  nativeTheme,
  powerMonitor,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { z } = require("zod");
let win,
  writeQueue = Promise.resolve();
const dev = process.argv.includes("--dev") && !app.isPackaged;
if (dev) {
  app.setName("Payday Development");
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), "Payday Development"),
  );
}
if (process.platform === "win32")
  app.setAppUserModelId(dev ? "com.payday.desktop.dev" : "com.payday.desktop");
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
function relevantMemoryNotes(notes, request) {
  if (!Array.isArray(notes) || !request.trim()) return [];
  const stop = new Set("about after again also and are can did do does for from have how into just like more most my what when where which with would you your tell said say remember work job employer shift pay change changed happened last this that month day ago on the the".split(" "));
  const tokens = (text) => String(text).toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((word) => !stop.has(word)) || [];
  const query = new Set(tokens(request));
  const ranked = notes.map((note, index) => {
    const searchable = `${note.summary} ${note.createdAt} ${new Date(note.createdAt).toLocaleDateString("en-GH", { month: "long", year: "numeric" })}`;
    const words = new Set(tokens(searchable));
    let score = 0;
    for (const token of query) if (words.has(token)) score++;
    return { note, index, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || b.note.createdAt.localeCompare(a.note.createdAt));
  const selected = ranked.length ? ranked.slice(0, 12).map((entry) => entry.note) : [...notes].slice(0, 4);
  return selected.map(({ summary, createdAt }) => ({ summary, createdAt }));
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
    const updateSchedule = require("./update-scheduler.cjs").createUpdateScheduler({enabled:app.isPackaged,updates});
    powerMonitor.on("resume",updateSchedule.wake);
    app.once("before-quit",()=>{updateSchedule.stop();powerMonitor.removeListener("resume",updateSchedule.wake);});
    ipcMain.handle("currency:rates", async e => { trusted(e); try { return await require("./exchange.cjs").fetchRates(); } catch { throw new Error("Could not refresh exchange rates. Keep your saved rates or enter rates manually."); } });
    ipcMain.handle("updates:get", e => {trusted(e); return updates.get();});
    ipcMain.handle("updates:check", e => {trusted(e); return updates.check();});
    ipcMain.handle("updates:download", e => {trusted(e); return updates.download();});
    ipcMain.handle("updates:install", e => {trusted(e); return updates.install();});
    ipcMain.handle("vault:load", async (e) => {
      trusted(e);
      const v = await enqueue(() => vaultStorage.read());
      const k = await read("payday-key.json");
      const onboarding=await read("payday-onboarding.json").catch(()=>({seen:true}));
      return { vault: v ? vault.parse(v) : null, hasKey: !!k?.encrypted, showTour: !v && !k?.encrypted && !onboarding?.seen };
    });
    ipcMain.handle("tour:seen", async e => {trusted(e);await enqueue(()=>atomic("payday-onboarding.json",{seen:true}));});
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
    ipcMain.handle("ai:plan", async (e, prompt, current, userMessage) => {
      trusted(e);
      const latestUserMessage = z.string().max(6000).catch("").parse(userMessage ?? "");
      const saved = await enqueue(() => vaultStorage.read());
      return require("./gemini.cjs").generatePlan({
        appContext: { ...(saved ? { savingsBalance: saved.savingsBalance, selfDebt: saved.debt, savedPaydayMonth: saved.plan.month, savedSalary: saved.plan.salary, displayCurrency: saved.displayCurrency ?? "GHS", exchangeRates: saved.exchangeRates ?? null, currentMonth: new Date().toLocaleDateString("en-CA", {timeZone:"Africa/Accra",year:"numeric",month:"2-digit"}) } : {}), memoryEnabled: saved?.memoryEnabled !== false, memoryNotes: saved?.memoryEnabled === false ? [] : relevantMemoryNotes(saved?.memory, latestUserMessage) },
        conversation: true,
        apiKey: await savedGeminiKey(),
        prompt,
        current,
        latestUserMessage,
      });
    });
    ipcMain.handle("ai:transcribe", async (e, audio, mimeType) => {
      trusted(e);
      if (!(audio instanceof Uint8Array) || audio.byteLength > 10 * 1024 * 1024)
        throw new Error("The recording is empty or too large. Try a shorter voice message.");
      if (typeof mimeType !== "string" || mimeType.length > 100)
        throw new Error("This recording format is not supported.");
      return require("./gemini.cjs").transcribeAudio({
        apiKey: await savedGeminiKey(),
        audio,
        mimeType,
      });
    });
    const create = () => {
      win = new BrowserWindow({
        width: 1440,
        height: 1000,
        minWidth: 1000,
        minHeight: 740,
        backgroundColor: "#F8FAFC",
        title: dev ? "Payday Development" : "Payday",
        autoHideMenuBar: true,
        icon: path.join(__dirname, "../public", process.platform === "win32" ? "icon.ico" : "icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      win.on("focus",updateSchedule.wake);
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.once("ready-to-show", () => win.show());
      win.webContents.on("will-navigate", (e, url) => {
        if (url !== win.webContents.getURL()) e.preventDefault();
      });
      const session = win.webContents.session;
      const allowedOrigin = (origin) => {
        try {
          const parsed = new URL(origin);
          return dev ? parsed.origin === "http://127.0.0.1:5173" : parsed.protocol === "file:";
        } catch { return false; }
      };
      session.setPermissionCheckHandler((contents, permission, origin) =>
        permission === "media" && contents === win.webContents && allowedOrigin(origin),
      );
      session.setPermissionRequestHandler((contents, permission, cb, details) => {
        const media = details?.mediaTypes;
        const audioOnly = Array.isArray(media) && media.includes("audio") && !media.includes("video");
        cb(permission === "media" && contents === win.webContents && allowedOrigin(details?.securityOrigin || "") && audioOnly);
      });
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
    updateSchedule.start();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) create();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
