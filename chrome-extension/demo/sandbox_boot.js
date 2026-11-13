(function () {
  'use strict';

  const Formatters = window.SPCFormatters;
  const StoreLib = window.SPCStore;
  const Adapter = window.SPCGooglePhotosAdapter;
  const OverlayLib = window.SPCSwipeOverlay;

  function makeSvgCard(title, subtitle, c1, c2, emoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="680" viewBox="0 0 900 680">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="900" height="680" fill="url(#g)"/>
      <circle cx="720" cy="140" r="110" fill="rgba(255,255,255,0.12)"/>
      <circle cx="170" cy="540" r="150" fill="rgba(0,0,0,0.14)"/>
      <text x="450" y="290" text-anchor="middle" font-size="110">${emoji}</text>
      <text x="450" y="395" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="38" font-weight="700">${title}</text>
      <text x="450" y="445" text-anchor="middle" fill="rgba(255,255,255,0.84)" font-family="sans-serif" font-size="24">${subtitle}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function buildInitialMockPhotos() {
    return [
      {
        id: 'AF1QipDemoNov01',
        section: '12 thg 11, 2026',
        aria: 'Ảnh - 12 thg 11, 2026, 14:22',
        filename: 'Screenshot_20261112_Shopee_Sale.png',
        sizeBytes: 3420000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Screenshot Đơn Hàng', 'Ảnh chụp màn hình cũ tháng 11', '#334155', '#0f172a', '📱')
      },
      {
        id: 'AF1QipDemoNov02',
        section: '12 thg 11, 2026',
        aria: 'Ảnh - 12 thg 11, 2026, 09:10',
        filename: 'IMG_20261112_Blurred_Test.jpg',
        sizeBytes: 4850000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Ảnh Chụp Thử Bị Mờ', 'Rung tay trong quán cà phê', '#7f1d1d', '#450a0a', '📷')
      },
      {
        id: 'AF1QipDemoNov03',
        section: '10 thg 11, 2026',
        aria: 'Ảnh - 10 thg 11, 2026, 17:45',
        filename: 'PXL_20261110_Sunset_Dalat.jpg',
        sizeBytes: 6150000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Hoàng Hôn Đà Lạt', 'Tấm ảnh đẹp đáng giữ & yêu thích', '#c2410c', '#7c2d12', '🌅')
      },
      {
        id: 'AF1QipDemoNov04',
        section: '10 thg 11, 2026',
        aria: 'Video - 10 thg 11, 2026, 16:00',
        filename: 'VID_20261110_ScreenRecord.mp4',
        sizeBytes: 520000000,
        type: 'video',
        duration: '01:42',
        fav: false,
        trashed: false,
        img: makeSvgCard('Quay Màn Hình Lỗi App', 'Video nặng 520 MB nên dọn', '#4c1d95', '#1e1b4b', '🎬')
      },
      {
        id: 'AF1QipDemoOct01',
        section: '24 thg 10, 2026',
        aria: 'Ảnh - 24 thg 10, 2026, 21:15',
        filename: 'Screenshot_20261024_OTP.png',
        sizeBytes: 1850000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Screenshot Mã OTP Cũ', 'Hết hạn từ tháng 10', '#1e293b', '#020617', '🧾')
      },
      {
        id: 'AF1QipDemoOct02',
        section: '18 thg 10, 2026',
        aria: 'Video - 18 thg 10, 2026, 11:30',
        filename: 'VID_20261018_Pocket_Accident.mp4',
        sizeBytes: 910000000,
        type: 'video',
        duration: '02:18',
        fav: false,
        trashed: false,
        img: makeSvgCard('Video Bấm Nhầm Trong Túi', 'Tối đen hoàn toàn • 910 MB', '#3f3f46', '#18181b', '🎥')
      },
      {
        id: 'AF1QipDemoOct03',
        section: '15 thg 10, 2026',
        aria: 'Ảnh - 15 thg 10, 2026, 19:20',
        filename: 'IMG_20261015_Family_Dinner.jpg',
        sizeBytes: 5200000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Bữa Tối Gia Đình', 'Khoảnh khắc đẹp tháng 10', '#065f46', '#064e3b', '🍲')
      },
      {
        id: 'AF1QipDemoSep01',
        section: '08 thg 9, 2026',
        aria: 'Ảnh - 8 thg 9, 2026, 10:05',
        filename: 'Screenshot_20260908_Map.png',
        sizeBytes: 2400000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Screenshot Chỉ Đường Cũ', 'Tháng 9/2026', '#0369a1', '#0c4a6e', '🗺️')
      },
      {
        id: 'AF1QipDemoSep02',
        section: '03 thg 9, 2026',
        aria: 'Ảnh - 3 thg 9, 2026, 08:40',
        filename: 'IMG_20260903_Beach_Trip.jpg',
        sizeBytes: 7400000,
        type: 'photo',
        fav: false,
        trashed: false,
        img: makeSvgCard('Biển Sáng Sớm', 'Ảnh du lịch tháng 9', '#0f766e', '#134e4a', '🏖️')
      }
    ];
  }

  let mockPhotos = buildInitialMockPhotos();
  const selectedIds = new Set();
  let activeLightboxId = null;

  const mainGrid = document.getElementById('gp-main-grid');
  const statsBadge = document.getElementById('gp-stats-badge');
  const selectionBar = document.getElementById('gp-selection-bar');
  const selectionCount = document.getElementById('gp-selection-count');
  const lightbox = document.getElementById('gp-lightbox');
  const lbImg = document.getElementById('gp-lb-img');
  const lbFavBtn = document.getElementById('gp-lb-fav-btn');
  const lbInfoPanel = document.getElementById('gp-lb-info-panel');
  const dialogBackdrop = document.getElementById('gp-dialog-backdrop');
  const dialogDesc = document.getElementById('gp-dialog-desc');

  function updateSelectionBar() {
    selectionCount.textContent = `Đã chọn ${selectedIds.size}`;
    selectionBar.classList.toggle('active', selectedIds.size > 0);
  }

  function renderMockGrid() {
    const active = mockPhotos.filter((p) => !p.trashed);
    const trashed = mockPhotos.filter((p) => p.trashed);
    statsBadge.textContent = `${active.length} mục • ${trashed.length} trong Thùng rác`;

    const grouped = new Map();
    for (const p of active) {
      if (!grouped.has(p.section)) grouped.set(p.section, []);
      grouped.get(p.section).push(p);
    }

    mainGrid.innerHTML = '';
    for (const [section, list] of grouped.entries()) {
      const h2 = document.createElement('h2');
      h2.className = 'gp-section-head';
      h2.textContent = section;
      mainGrid.appendChild(h2);

      const grid = document.createElement('div');
      grid.className = 'gp-grid';
      for (const item of list) {
        const tile = document.createElement('div');
        tile.className = `gp-tile${selectedIds.has(item.id) ? ' selected' : ''}`;
        tile.setAttribute('data-spc-size', String(item.sizeBytes));

        const link = document.createElement('a');
        link.href = `#/photo/${item.id}`;
        link.setAttribute('aria-label', item.aria);
        link.setAttribute('data-spc-size', String(item.sizeBytes));
        link.setAttribute('data-spc-filename', item.filename);
        link.setAttribute('data-spc-type', item.type);
        if (item.fav) link.setAttribute('data-spc-favorite', 'true');

        const img = document.createElement('img');
        img.src = item.img;
        img.alt = item.aria;
        link.appendChild(img);

        link.addEventListener('click', (e) => {
          e.preventDefault();
          openLightbox(item.id);
        });

        const cb = document.createElement('div');
        cb.className = 'gp-checkbox';
        cb.setAttribute('role', 'checkbox');
        cb.setAttribute('aria-label', `Chọn ${item.aria}`);
        cb.setAttribute('aria-checked', selectedIds.has(item.id) ? 'true' : 'false');
        cb.textContent = selectedIds.has(item.id) ? '✓' : '';
        cb.addEventListener('click', (e) => {
          e.stopPropagation();
          if (selectedIds.has(item.id)) selectedIds.delete(item.id);
          else selectedIds.add(item.id);
          renderMockGrid();
        });

        tile.appendChild(link);
        tile.appendChild(cb);

        if (item.duration) {
          const dur = document.createElement('span');
          dur.className = 'gp-duration';
          dur.textContent = item.duration;
          tile.appendChild(dur);
        }
        if (item.fav) {
          const fav = document.createElement('span');
          fav.className = 'gp-fav-mark';
          fav.setAttribute('aria-label', 'Yêu thích');
          fav.textContent = '♥';
          tile.appendChild(fav);
        }

        grid.appendChild(tile);
      }
      mainGrid.appendChild(grid);
    }

    updateSelectionBar();
  }

  function openLightbox(id) {
    const item = mockPhotos.find((p) => p.id === id);
    if (!item) return;
    activeLightboxId = id;
    lbImg.src = item.img;
    lbFavBtn.setAttribute('aria-pressed', item.fav ? 'true' : 'false');
    lbFavBtn.setAttribute('aria-label', item.fav ? 'Bỏ khỏi mục yêu thích' : 'Yêu thích');
    lbFavBtn.textContent = item.fav ? '♥ Đã yêu thích' : '♡ Yêu thích';
    lbInfoPanel.innerHTML = `
      <h3>Thông tin ảnh</h3>
      <div><strong>Tệp:</strong> ${Formatters.escapeHtml(item.filename)}</div>
      <div><strong>Ngày:</strong> ${Formatters.escapeHtml(item.section)}</div>
      <div><strong>Dung lượng:</strong> ${Formatters.formatBytes(item.sizeBytes)}</div>
    `;
    lightbox.classList.add('open');
  }

  function closeLightbox() {
    activeLightboxId = null;
    lightbox.classList.remove('open');
    lbInfoPanel.classList.remove('open');
  }

  document.getElementById('gp-lb-back').addEventListener('click', closeLightbox);
  document.getElementById('gp-lb-info-btn').addEventListener('click', () => {
    lbInfoPanel.classList.toggle('open');
  });
  lbFavBtn.addEventListener('click', () => {
    const item = mockPhotos.find((p) => p.id === activeLightboxId);
    if (!item) return;
    item.fav = !item.fav;
    openLightbox(item.id);
    renderMockGrid();
  });

  document.getElementById('gp-clear-selection').addEventListener('click', () => {
    selectedIds.clear();
    renderMockGrid();
  });

  document.getElementById('gp-toolbar-trash').addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    dialogDesc.textContent = `Chuyển ${selectedIds.size} mục đã chọn vào Thùng rác mô phỏng?`;
    dialogBackdrop.classList.add('open');
  });

  document.getElementById('gp-dialog-cancel').addEventListener('click', () => {
    dialogBackdrop.classList.remove('open');
  });

  document.getElementById('gp-dialog-confirm').addEventListener('click', () => {
    for (const p of mockPhotos) {
      if (selectedIds.has(p.id)) p.trashed = true;
    }
    selectedIds.clear();
    dialogBackdrop.classList.remove('open');
    renderMockGrid();
  });

  renderMockGrid();

  async function bootOverlay() {
    let cssText = '';
    try {
      const res = await fetch('../src/ui/swipe_styles.css');
      cssText = await res.text();
    } catch (_) {}

    const store = StoreLib.createStore({
      storage: StoreLib.createMemoryStorage(),
      disablePersist: true
    });

    let commitAborted = false;

    const overlay = OverlayLib.createSwipeOverlay({
      doc: document,
      store,
      cssText,
      isTrashViewFn: () => false,
      onRefreshScan: () => {
        store.upsertItems(Adapter.scanVisibleDom(document, new Map()));
      },
      onToggleDeepScan: () => {
        store.upsertItems(Adapter.scanVisibleDom(document, new Map()));
        overlay.showToast(`Đã quét ${store.state.itemsById.size} ảnh mẫu theo từng tháng!`);
      },
      onCommit: async ({ favoriteItems, trashItems }) => {
        commitAborted = false;
        const total = favoriteItems.length + trashItems.length;
        overlay.setCommitState({
          running: true,
          progress: 5,
          message: 'Đang đồng bộ lên Google Photos (Sandbox)...'
        });

        try {
          const result = await Adapter.commitChanges({
            doc: document,
            favoriteItems,
            trashItems,
            shouldAbort: () => commitAborted,
            onProgress: ({ phase, current, message }) => {
              const done = phase === 'favorite' ? current : favoriteItems.length + current;
              const pct = total > 0 ? Math.round((done / total) * 100) : 100;
              overlay.setCommitState({ running: true, progress: pct, message });
            }
          });

          let freed = 0;
          for (const id of result.trashedIds) {
            const it = store.state.itemsById.get(id) || store.state.pendingSnapshots.get(id);
            if (it && Number.isFinite(it.sizeBytes)) freed += it.sizeBytes;
          }

          store.markCommitted({
            trashedIds: result.trashedIds,
            favoritedIds: result.favoritedIds
          });
          overlay.showToast(
            `Sandbox hoàn tất: Đã chuyển ${result.trashedIds.length} mục vào Thùng rác (${Formatters.formatBytes(
              freed
            )}) & lưu ${result.favoritedIds.length} Yêu thích!`
          );
        } finally {
          overlay.setCommitState({ running: false, progress: 0, message: '' });
        }
      },
      onAbortCommit: () => {
        commitAborted = true;
      }
    });

    store.upsertItems(Adapter.scanVisibleDom(document, new Map()));
    overlay.open();

    document.getElementById('gp-open-cleaner-btn').addEventListener('click', () => overlay.open());
    document.getElementById('gp-reset-sandbox-btn').addEventListener('click', () => {
      mockPhotos = buildInitialMockPhotos();
      selectedIds.clear();
      store.state.itemsById.clear();
      store.state.decisions.clear();
      store.state.committedTrash.clear();
      store.state.committedFavorite.clear();
      store.state.undoStack = [];
      renderMockGrid();
      store.upsertItems(Adapter.scanVisibleDom(document, new Map()));
      overlay.showToast('Đã khôi phục lại toàn bộ dữ liệu mẫu!');
    });
  }

  bootOverlay();
})();
