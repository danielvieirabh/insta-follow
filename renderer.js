document.getElementById('btnInstagram').addEventListener('click', () => {
  window.botAPI.openInstagram();
});

document.getElementById('btnStartBot').addEventListener('click', () => {
  const targetUser = document.getElementById('targetUser').value;
  const followerCount = document.getElementById('followerCount').value;
  const delaySeconds = document.getElementById('delaySeconds').value;

  window.botAPI.startBot({
    targetUsername: targetUser,
    followerCount: parseInt(followerCount),
    delaySeconds: parseInt(delaySeconds)
  });

  document.getElementById('statusText').innerText = "Iniciando...";
});

window.botAPI.onBotLog((msg) => {
  document.getElementById('statusText').innerText = msg;
});
