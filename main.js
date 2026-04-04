const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let instagramWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Abre a janela secundária para login no Instagram
ipcMain.on('open-instagram-window', () => {
  if (!instagramWindow) {
    instagramWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        // Necessário se você quiser injetar scripts na página do Instagram depois
        contextIsolation: true, 
        nodeIntegration: false
      }
    });

    instagramWindow.loadURL('https://www.instagram.com');

    // Escuta as mensagens de log (console.log) vindas da janela do Instagram
    instagramWindow.webContents.on('console-message', (event, level, message) => {
      if (message.startsWith('[BOT]')) {
        const logMsg = message.replace('[BOT] ', '');
        console.log('Status do Bot:', logMsg); // Mostra no console do Node.js/Terminal
        if (mainWindow) mainWindow.webContents.send('bot-log', logMsg); // Envia para o Painel
      }
    });

    instagramWindow.on('closed', () => {
      instagramWindow = null;
    });
  } else {
    // Se a janela já existir, apenas traga-a para a frente
    instagramWindow.focus();
  }
});

// Recebe os dados do painel HTML para iniciar o bot
ipcMain.on('start-bot', (event, config) => {
  console.log('--- Configurações Recebidas ---');
  console.log(`Alvo (@): ${config.targetUsername}`);
  console.log(`Número de Seguidores: ${config.followerCount}`);
  console.log(`Tempo entre ações: ${config.delaySeconds} segundos`);

  if (!instagramWindow) {
    console.log('Erro: A janela do Instagram não está aberta. Faça login primeiro.');
    return;
  }

  const script = `
    (async () => {
      const delay = ms => new Promise(res => setTimeout(res, ms));
      const targetUser = '${config.targetUsername}';
      const maxFollows = ${config.followerCount};
      const waitTime = ${config.delaySeconds} * 1000;
      
      // Navega para a página do alvo, caso ainda não esteja nela
      if (!window.location.href.includes(targetUser)) {
        window.location.href = 'https://www.instagram.com/' + targetUser + '/';
        await delay(5000);
      }
      
      // Abre o pop-up de seguidores
      const followersLink = document.querySelector('a[href="/' + targetUser + '/followers/"]');
      if (followersLink) {
        followersLink.click();
        await delay(4000);
      }

      let followedCount = 0;
      
      while (followedCount < maxFollows) {
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent === 'Seguir' || b.textContent === 'Follow');
        
        if (buttons.length > 0) {
          buttons[0].click(); // Clica sempre no primeiro botão de Seguir disponível
          followedCount++;
          console.log('[BOT] Seguiu ' + followedCount + ' de ' + maxFollows);
          await delay(waitTime); // Aguarda o tempo configurado pelo usuário
        } else {
          // Se não encontrou o botão de seguir, rola a lista de seguidores para baixo
          console.log('[BOT] Procurando novas contas para seguir...');
          const dialog = document.querySelector('div[role="dialog"]');
          if (dialog) {
            const dialogButtons = dialog.querySelectorAll('button');
            if (dialogButtons.length > 0) {
              dialogButtons[dialogButtons.length - 1].scrollIntoView();
            }
          }
          await delay(2000); // Aguarda os novos seguidores carregarem
        }
      }
      console.log('[BOT] Concluído: ' + followedCount + ' contas seguidas com sucesso!');
      return 'Concluído: ' + followedCount + ' contas seguidas com sucesso!';
    })();
  `;

  // Executa o script dentro da janela do Instagram
  instagramWindow.webContents.executeJavaScript(script).then(result => {
    console.log(result);
  }).catch(err => {
    console.error('Erro na automação do Instagram:', err);
  });
});
