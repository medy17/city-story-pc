const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("cityStoryHost", {
  loadSave: () => ipcRenderer.invoke("save:load"),
  writeSave: (json) => ipcRenderer.invoke("save:write", json),
  pickApk: () => ipcRenderer.invoke("apk:pick"),
  importApk: (apkPath) => ipcRenderer.invoke("apk:import", apkPath),
  launchGame: () => ipcRenderer.invoke("app:launchGame"),
  openSetup: () => ipcRenderer.invoke("app:openSetup"),
  toggleFullscreen: () => ipcRenderer.invoke("app:toggleFullscreen"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onApkProgress: (cb) => {
    ipcRenderer.removeAllListeners("apk:progress");
    ipcRenderer.on("apk:progress", (_ev, data) => cb(data));
  }
});
