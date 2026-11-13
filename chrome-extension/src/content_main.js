(function () {
  'use strict';

  const Formatters = window.SPCFormatters;
  const DateParser = window.SPCDateParser;
  const StoreLib = window.SPCStore;
  const Adapter = window.SPCGooglePhotosAdapter;
  const OverlayLib = window.SPCSwipeOverlay;

  if (!Formatters || !DateParser || !StoreLib || !Adapter || !OverlayLib) {
    return;
  }

  const hintsMap = new Map();
  const store = StoreLib.createStore({ storageKey: 'spc_google_photos_v1' });

  const probedIds = new Set();
  const probeQueue = [];
  let activeProbes = 0;
  const MAX_CONCURRENT_PROBES = 4;

  let deepScanRunning = false;
  let deepScanAborted = false;
  let commitAborted = false;

  function enqueueSizeProbes(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !item.mediaKey) continue;
      if (Number.isFinite(item.sizeBytes)) continue;
      if (probedIds.has(item.mediaKey)) continue;
      const urls = Formatters.buildProbeUrls(item.baseUrl || item.largeUrl || item.thumbUrl);
      if (urls.length === 0) continue;
      probedIds.add(item.mediaKey);
      probeQueue.push({ mediaKey: item.mediaKey, urls });
    }
    pumpProbeQueue();
  }

  function pumpProbeQueue() {
    while (activeProbes < MAX_CONCURRENT_PROBES && probeQueue.length > 0) {
      const task = probeQueue.shift();
      activeProbes++;
      chrome.runtime.sendMessage(
        { type: 'PROBE_FILE_SIZE', urls: task.urls },
        (res) => {
          activeProbes--;
          if (chrome.runtime.lastError) {
            pumpProbeQueue();
            return;
          }
          if (res && res.ok && Number.isFinite(res.bytes) && res.bytes > 0) {
            store.updateItemSize(task.mediaKey, res.bytes, 'cdn-head');
          }
          pumpProbeQueue();
        }
      );
    }
  }

  function refreshDomScan() {
    const items = Adapter.scanVisibleDom(document, hintsMap);
    if (items.length > 0) {
      store.upsertItems(items);
    }
    return items.length;
  }

  // Receive passive metadata hints from page_bridge.js (MAIN world)
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.__spcChannel !== 'SPC_MAIN_TO_ISO' || data.type !== 'MEDIA_HINTS') return;
    if (!Array.isArray(data.items)) return;

    const toMerge = [];
    for (const hint of data.items) {
      if (!hint || !hint.mediaKey) continue;
      hintsMap.set(hint.mediaKey, hint);
      if (store.state.itemsById.has(hint.mediaKey)) {
        const dateInfo = hint.takenAtMs ? DateParser.timestampToMonthInfo(hint.takenAtMs) : null;
        toMerge.push({
          mediaKey: hint.mediaKey,
          baseUrl: hint.baseUrl,
          largeUrl: hint.baseUrl ? Formatters.upgradeGooglePhotoUrl(hint.baseUrl, 1600) : '',
          width: hint.width,
          height: hint.height,
          takenAtMs: hint.takenAtMs,
          hasExactTimestamp: Boolean(hint.takenAtMs),
          monthKey: dateInfo ? dateInfo.monthKey : undefined,
          dateLabel: hint.takenAtMs ? Formatters.formatDateDisplay(hint.takenAtMs) : undefined,
          filename: hint.filename
        });
      }
    }
    if (toMerge.length > 0) {
      store.upsertItems(toMerge);
    }
  });

  const overlay = OverlayLib.createSwipeOverlay({
    doc: document,
    store,
    cssUrl: chrome.runtime.getURL('src/ui/swipe_styles.css'),
    isTrashViewFn: () => Adapter.isTrashView(window.location),
    onJumpToLibrary: () => {
      window.location.href = 'https://photos.google.com/';
    },
    onRefreshScan: () => {
      refreshDomScan();
      const summary = store.getSummary();
      enqueueSizeProbes(summary.pendingTrashItems);
    },
    onToggleDeepScan: async () => {
      if (deepScanRunning) {
        deepScanAborted = true;
        return;
      }
      deepScanRunning = true;
      deepScanAborted = false;
      overlay.setScanning(true, `${store.state.itemsById.size} mục`);

      try {
        await Adapter.runDeepScan({
          doc: document,
          hintsMap,
          shouldAbort: () => deepScanAborted,
          onBatch: (batch) => {
            store.upsertItems(batch);
            overlay.setScanning(true, `${store.state.itemsById.size} mục`);
          }
        });
        overlay.showToast(`Đã quét xong ${store.state.itemsById.size} ảnh/video theo từng tháng!`);
      } finally {
        deepScanRunning = false;
        deepScanAborted = false;
        overlay.setScanning(false);
      }
    },
    onNeedSizes: (visibleItems) => {
      enqueueSizeProbes(visibleItems);
      enqueueSizeProbes(store.getSummary().pendingTrashItems);
    },
    onMeasureUnknownSizes: async () => {
      const unknownItems = store
        .getSummary()
        .pendingTrashItems.filter((it) => !Number.isFinite(it.sizeBytes));
      if (unknownItems.length === 0) return;

      commitAborted = false;
      overlay.setCommitState({
        running: true,
        progress: 5,
        message: `Đang mở Info để đo ${unknownItems.length} mục chưa rõ dung lượng...`
      });

      try {
        const measured = await Adapter.measureUnknownSizesViaInfo({
          doc: document,
          items: unknownItems,
          shouldAbort: () => commitAborted,
          onProgress: ({ current, total }) => {
            overlay.setCommitState({
              running: true,
              progress: Math.round((current / total) * 100),
              message: `Đang đo dung lượng từ Google Photos Info (${current}/${total})...`
            });
          },
          onMeasured: (mediaKey, bytes) => {
            store.updateItemSize(mediaKey, bytes, 'info-panel');
          }
        });
        overlay.showToast(`Đã đo thêm dung lượng cho ${measured}/${unknownItems.length} mục.`);
      } finally {
        overlay.setCommitState({ running: false, progress: 0, message: '' });
      }
    },
    onCommit: async ({ favoriteItems, trashItems }) => {
      commitAborted = false;
      const totalOps = favoriteItems.length + trashItems.length;
      overlay.setCommitState({
        running: true,
        progress: 5,
        message: 'Đang chuẩn bị đồng bộ với Google Photos...'
      });

      try {
        const result = await Adapter.commitChanges({
          doc: document,
          favoriteItems,
          trashItems,
          shouldAbort: () => commitAborted,
          onProgress: ({ phase, current, total, message }) => {
            const done = phase === 'favorite' ? current : favoriteItems.length + current;
            const pct = totalOps > 0 ? Math.round((done / totalOps) * 100) : 100;
            overlay.setCommitState({ running: true, progress: pct, message });
          }
        });

        let freedThisRun = 0;
        for (const id of result.trashedIds) {
          const item = store.state.itemsById.get(id) || store.state.pendingSnapshots.get(id);
          if (item && Number.isFinite(item.sizeBytes)) freedThisRun += item.sizeBytes;
        }

        store.markCommitted({
          trashedIds: result.trashedIds,
          favoritedIds: result.favoritedIds
        });

        const failCount = result.failedFavoriteIds.length + result.failedTrashIds.length;
        const freedLabel = Formatters.formatBytes(freedThisRun);
        if (failCount === 0) {
          overlay.showToast(
            `Hoàn tất! Đã chuyển ${result.trashedIds.length} ảnh vào Thùng rác (${freedLabel}) & lưu ${result.favoritedIds.length} Yêu thích.`,
            5000
          );
        } else {
          overlay.showToast(
            `Đã lưu ${result.trashedIds.length} xóa / ${result.favoritedIds.length} thích. Còn ${failCount} mục chưa tìm thấy trên lưới hiện tại — bạn có thể Quét thêm rồi thử lại.`,
            6000
          );
        }
      } catch (err) {
        overlay.showToast(err && err.message ? err.message : 'Có lỗi khi lưu vào Google Photos.', 5000);
      } finally {
        overlay.setCommitState({ running: false, progress: 0, message: '' });
      }
    },
    onAbortCommit: () => {
      commitAborted = true;
    }
  });

  // Load persisted queues & decisions, then do an initial scan
  store.load().then(() => {
    setTimeout(refreshDomScan, 600);
  });

  // Listen to popup & command triggers
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    if (message.type === 'SPC_TOGGLE_OVERLAY') {
      overlay.toggle();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'SPC_OPEN_OVERLAY') {
      overlay.open();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'SPC_GET_STATUS') {
      refreshDomScan();
      const summary = store.getSummary();
      sendResponse({
        ok: true,
        totalKnownItems: summary.totalKnownItems,
        pendingTrashCount: summary.pendingTrashCount,
        pendingTrashBytes: summary.pendingTrashBytes,
        pendingFavoriteCount: summary.pendingFavoriteCount,
        lifetimeFreedBytes: summary.lifetimeFreedBytes,
        isTrashView: Adapter.isTrashView(window.location)
      });
      return false;
    }
    return false;
  });
})();
