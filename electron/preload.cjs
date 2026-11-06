const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("payday", {
  exchangeRates: () => ipcRenderer.invoke("currency:rates"),
  updateStatus: () => ipcRenderer.invoke("updates:get"),
  checkUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdate: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on("updates:status", listener); return () => ipcRenderer.removeListener("updates:status", listener); },
  reset: () => ipcRenderer.invoke("vault:reset", "RESET_PAYDAY"),
  uninstall: () => ipcRenderer.invoke("app:uninstall"),
  decodeBackup: (text) => ipcRenderer.invoke("vault:decode-backup", text),
  load: () => ipcRenderer.invoke("vault:load"),
  save: (v) => ipcRenderer.invoke("vault:save", v),
  checkKey: () => ipcRenderer.invoke("key:check"),
  setKey: (k) => ipcRenderer.invoke("key:set", k),
  ai: (prompt, plan) => ipcRenderer.invoke("ai:plan", prompt, plan),
  export: () => ipcRenderer.invoke("vault:export"),
});
