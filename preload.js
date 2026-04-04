const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('botAPI', {
  openInstagram: () => ipcRenderer.send('open-instagram-window'),
  startBot: (config) => ipcRenderer.send('start-bot', config),
  onBotLog: (callback) => ipcRenderer.on('bot-log', (event, msg) => callback(msg))
});
