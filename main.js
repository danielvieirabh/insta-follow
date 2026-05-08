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
      
      if (!window.location.href.includes(targetUser)) {
        window.location.href = 'https://www.instagram.com/' + targetUser + '/';
        await delay(5000);
      }
      
      const followersLink = document.querySelector('a[href="/' + targetUser + '/followers/"]');
      if (followersLink) {
        followersLink.click();
        await delay(4000);
      }

      let followedCount = 0;
      let lastScrollHeight = 0;
      let retryCount = 0;
      
      while (followedCount < maxFollows) {
        const dialog = document.querySelector('div[role="dialog"]');
        const searchArea = dialog ? dialog : document;

        const buttons = Array.from(searchArea.querySelectorAll('button')).filter(b => 
          (b.textContent === 'Seguir' || b.textContent === 'Follow') && !b.dataset.botClicked
        );
        
        if (buttons.length > 0) {
          const btn = buttons[0];
          
          btn.dataset.botClicked = 'true'; 
          btn.click(); 
          
          followedCount++;
          
          // Aguarda um instante para o Instagram mudar o texto do botão
          await delay(1000);
          
          const statusBotao = btn.textContent; // Lê o que o botão virou
          
          if (statusBotao === 'Seguindo' || statusBotao === 'Following') {
            console.log('[BOT] Seguiu ' + followedCount + ' de ' + maxFollows);
          } else if (statusBotao === 'Solicitado' || statusBotao === 'Requested') {
            console.log('[BOT] Solicitou ' + followedCount + ' de ' + maxFollows);
          } else {
            console.log('[BOT] Seguiu ' + followedCount + ' de ' + maxFollows);
          }
          
          retryCount = 0; 
          
          // Desconta 1 segundo do tempo de espera total, já que esperamos 1s acima
          const tempoRestante = waitTime - 1000;
          await delay(tempoRestante > 0 ? tempoRestante : 1000); 

        } else {
          console.log('[BOT] Nenhum botão novo. Rolando a lista para baixo...');
          
          if (dialog) {
            const scrollableContainer = Array.from(dialog.querySelectorAll('div')).find(div => div.scrollHeight > div.clientHeight + 10);
            
            if (scrollableContainer) {
              scrollableContainer.scrollTop = scrollableContainer.scrollHeight;
              
              if (scrollableContainer.scrollHeight === lastScrollHeight) {
                retryCount++;
                if (retryCount >= 4) {
                  console.log('[BOT] Fim da lista alcançado ou limite de carregamento.');
                  break; 
                }
              } else {
                retryCount = 0; 
              }
              lastScrollHeight = scrollableContainer.scrollHeight;
              
            } else {
              const allDivs = dialog.querySelectorAll('div');
              if (allDivs.length > 0) {
                allDivs[allDivs.length - 1].scrollIntoView(false);
              }
            }
          } else {
            window.scrollBy(0, 1000);
          }
          
          await delay(3000); 
        }
      }
      
      console.log('[BOT] Processo finalizado! ' + followedCount + ' ações executadas.');
      return 'Concluído: ' + followedCount + ' ações executadas.';
    })();
  `;

  // Executa o script dentro da janela do Instagram
  instagramWindow.webContents.executeJavaScript(script).then(result => {
    console.log(result);
  }).catch(err => {
    console.error('Erro na automação do Instagram:', err);
  });
});
