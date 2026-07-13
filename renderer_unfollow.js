document.getElementById('btnInstagram').addEventListener('click', () => {
  window.botAPI.openInstagram();
});

document.getElementById('btnStartBot').addEventListener('click', () => {
  const targetUser = document.getElementById('targetUser').value;
  const unfollowerCount = document.getElementById('unfollowerCount').value;
  const delaySeconds = document.getElementById('delaySeconds').value;

  if(!targetUser || !unfollowerCount || !delaySeconds) {
    document.getElementById('statusText').innerText = "Preencha todos os campos!";
    return;
  }

  window.botAPI.startUnfollowBot({
    targetUsername: targetUser,
    unfollowerCount: parseInt(unfollowerCount),
    delaySeconds: parseInt(delaySeconds)
  });

  document.getElementById('statusText').innerText = "Iniciando Unfollow...";
});

window.botAPI.onBotLog((msg) => {
  document.getElementById('statusText').innerText = msg;
});