function createUpdateService({app, updater, notify, beforeInstall = async () => {}}) {
  let state = { status: app.isPackaged ? "idle" : "unavailable", currentVersion: app.isPackaged ? app.getVersion() : require("../package.json").version, version: "", percent: 0, message: app.isPackaged ? "Check for a new version when you are ready." : "Updates are available in the installed Windows app." };
  let checking = false, downloading = false, quietCheck = false, beforeCheck = null;
  // Revalidate GitHub metadata: cached /releases/latest replies can hide a new build.
  updater.requestHeaders = {...updater.requestHeaders,"Cache-Control":"no-cache","Pragma":"no-cache"};
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.logger = null;
  const set = (value) => { state = {...state, ...value}; notify({...state}); };
  const fail = (error) => {
    if(checking && quietCheck) { set(beforeCheck); return; }
    const text = String(error?.message || "");
    const message = /404|No published versions|latest.yml|No releases|Unable to find latest version/i.test(text) ? "No published Payday update was found. Please try again later." : /sha512|checksum|signature|ERR_UPDATER_INVALID/i.test(text) ? "The update could not be verified. It was not installed. Please try again later." : "Could not reach or download the Payday update. Check your connection and try again.";
    set({status:"error", message, percent:0});
  };
  updater.on("checking-for-update", () => { if(!quietCheck) set({status:"checking",message:"Checking GitHub Releases..."}); });
  updater.on("update-available", info => set({status:"available",version:info.version,percent:0,message:`Payday ${info.version} is available.`}));
  updater.on("update-not-available", () => set({status:"current",version:"",percent:0,message:"You are using the latest published Payday version."}));
  updater.on("download-progress", progress => set({status:"downloading",percent:Math.max(0, Math.min(100, Number(progress.percent)||0)),message:"Downloading your update..."}));
  updater.on("update-downloaded", info => set({status:"ready",version:info.version,percent:100,message:"Your update is ready. Restart when you are ready to install."}));
  updater.on("error", fail);
  return {
    get: () => ({...state}),
    async check({quiet = false} = {}) {
      // Keep an offered update stable; manual checks can refresh it.
      if(quiet && state.version) return {...state};
      if(!app.isPackaged || checking || downloading || ["ready","installing"].includes(state.status)) return {...state};
      checking=true;quietCheck=quiet;beforeCheck={...state};
      if(!quiet) set({status:"checking",message:"Checking GitHub Releases..."});
      try { await updater.checkForUpdates(); } catch(error) { fail(error); } finally {checking=false;quietCheck=false;beforeCheck=null;}
      return {...state};
    },
    async download() {
      if(!app.isPackaged || downloading || state.status!=="available") throw new Error("Check for an available update first.");
      downloading=true;set({status:"downloading",percent:0,message:"Downloading your update..."});
      try { await updater.downloadUpdate(); } catch(error) {fail(error);} finally {downloading=false;}
      return {...state};
    },
    async install() {
      if(!app.isPackaged || state.status!=="ready") throw new Error("Download and verify an update before installing.");
      await beforeInstall();
      set({status:"installing",message:"Restarting to install your update..."});
      updater.quitAndInstall(true,true);
      return {...state};
    }
  };
}
module.exports={createUpdateService};
