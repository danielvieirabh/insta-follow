const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('botAPI', {
  openInstagram: () => ipcRenderer.send('open-instagram-window'),
  startBot: (config) => ipcRenderer.send('start-bot', config),
  startUnfollowBot: (config) => ipcRenderer.send('start-unfollow-bot', config), // NOVA LINHA
  onBotLog: (callback) => ipcRenderer.on('bot-log', (event, msg) => callback(msg))
});