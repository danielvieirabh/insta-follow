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

  mainWindow.loadFile('unfollow.html');
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

// Recebe os dados do painel HTML para iniciar o bot de UNFOLLOW
ipcMain.on('start-unfollow-bot', (event, config) => {
  console.log('--- Configurações de Unfollow Recebidas ---');
  console.log(`Seu @: ${config.targetUsername}`);
  console.log(`Número de Unfollows: ${config.unfollowerCount}`);
  console.log(`Tempo entre ações: ${config.delaySeconds} segundos`);

  if (!instagramWindow) {
    console.log('Erro: A janela do Instagram não está aberta. Faça login primeiro.');
    return;
  }

  const script = `
    (async () => {
      const delay = ms => new Promise(res => setTimeout(res, ms));
      const myUser = '${config.targetUsername}';
      const maxUnfollows = ${config.unfollowerCount};
      const waitTime = ${config.delaySeconds} * 1000;
      
      // 1. Navega para o perfil do usuário logado se já não estiver nele
      if (!window.location.href.includes(myUser)) {
        window.location.href = 'https://www.instagram.com/' + myUser + '/';
        await delay(5000);
      }
      
      // 2. NOVA BUSCA: Procura por texto que contenha "seguindo" ou "following"
      // Isso ignora se o Instagram mudou a estrutura da tag interna
      const allLinks = Array.from(document.querySelectorAll('a, span, div'));
      const followingLink = allLinks.find(el => {
        const text = el.textContent ? el.textContent.toLowerCase().trim() : '';
        // Procura se o texto termina com "seguindo" ou "following" (Ex: "6.272 seguindo")
        return text.endsWith('seguindo') || text.endsWith('following');
      });
      
      if (followingLink) {
        console.log('[BOT] Botão Seguindo encontrado através do texto!');
        followingLink.click();
        await delay(4000);
      } else {
        // Segunda tentativa caso a primeira falhe (busca por um seletor nativo comum)
        const backupLink = document.querySelector('a[href*="/following"]') || document.querySelector('a[href*="following"]');
        if (backupLink) {
          backupLink.click();
          await delay(4000);
        } else {
          console.log('[BOT] Não foi possível encontrar o botão Seguindo por nenhum método.');
          return 'Não foi possível encontrar o botão Seguindo. Verifique se o @ está correto.';
        }
      }

      let unfollowedCount = 0;
      let lastScrollHeight = 0;
      let retryCount = 0;
      
      while (unfollowedCount < maxUnfollows) {
        const dialog = document.querySelector('div[role="dialog"]');
        const searchArea = dialog ? dialog : document;

        // Procura botões com texto exato "Seguindo" ou "Following" dentro da lista aberta
        const buttons = Array.from(searchArea.querySelectorAll('button')).filter(b => 
          (b.textContent === 'Seguindo' || b.textContent === 'Following') && !b.dataset.botClicked
        );
        
        if (buttons.length > 0) {
          const btn = buttons[0];
          btn.dataset.botClicked = 'true'; 
          btn.click(); // Abre o modal de confirmação do Unfollow
          
          await delay(1500); 
          
          // Encontra o botão de confirmar o unfollow no pop-up pequeno
          const confirmBtns = Array.from(document.querySelectorAll('button')).filter(b => 
            b.textContent === 'Deixar de seguir' || b.textContent === 'Unfollow'
          );

          if (confirmBtns.length > 0) {
            confirmBtns[0].click();
            unfollowedCount++;
            console.log('[BOT] Deixou de seguir ' + unfollowedCount + ' de ' + maxUnfollows);
            if (window.botAPI) {
              // Notifica o console se aplicável
            }
          } else {
            console.log('[BOT] Botão de confirmação não encontrado.');
            btn.removeAttribute('data-bot-clicked'); 
          }
          
          retryCount = 0; 
          
          const tempoRestante = waitTime - 1500;
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
      
      console.log('[BOT] Processo finalizado! ' + unfollowedCount + ' unfollows executados.');
      return 'Concluído: ' + unfollowedCount + ' unfollows executados.';
    })();
  `;

  instagramWindow.webContents.executeJavaScript(script).then(result => {
    console.log(result);
    if (mainWindow) mainWindow.webContents.send('bot-log', result);
  }).catch(err => {
    console.error('Erro na automação do Instagram:', err);
  });
});