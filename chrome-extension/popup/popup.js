'use strict';

function formatBytesLocal(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Chưa rõ';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  const dec = exp === 0 ? 0 : val >= 100 ? 0 : val >= 10 ? 1 : 2;
  return `${val.toFixed(dec)} ${units[exp]}`;
}

async function initPopup() {
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statsGrid = document.getElementById('stats-grid');
  const btnLaunch = document.getElementById('btn-launch');
  const btnSandbox = document.getElementById('btn-sandbox');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGooglePhotos = Boolean(tab && tab.url && tab.url.startsWith('https://photos.google.com/'));

  if (!isGooglePhotos) {
    dot.className = 'dot warn';
    statusText.textContent = 'Hãy mở Google Photos để dọn thư viện thật';
    btnLaunch.textContent = 'Mở photos.google.com';
    btnLaunch.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://photos.google.com/' });
      window.close();
    });
  } else {
    dot.className = 'dot online';
    statusText.textContent = 'Đã kết nối với Google Photos';

    chrome.tabs.sendMessage(tab.id, { type: 'SPC_GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        statusText.textContent = 'Đang tải trang — hãy thử tải lại Google Photos';
        return;
      }
      statsGrid.hidden = false;
      document.getElementById('stat-trash').textContent = `${res.pendingTrashCount} ảnh`;
      document.getElementById('stat-bytes').textContent = formatBytesLocal(res.pendingTrashBytes);
      document.getElementById('stat-fav').textContent = `${res.pendingFavoriteCount} ảnh`;
      document.getElementById('stat-lifetime').textContent = formatBytesLocal(res.lifetimeFreedBytes);
    });

    btnLaunch.addEventListener('click', () => {
      chrome.tabs.sendMessage(tab.id, { type: 'SPC_OPEN_OVERLAY' }, () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.reload(tab.id);
        }
        window.close();
      });
    });
  }

  btnSandbox.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('demo/sandbox.html') });
    window.close();
  });
}

initPopup();
