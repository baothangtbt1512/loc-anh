(function (root) {
  'use strict';

  const Formatters =
    root.SPCFormatters ||
    (typeof require === 'function' ? require('./formatters.js') : null);

  const VALID_DECISIONS = new Set(['keep', 'trash', 'favorite']);

  function createMemoryStorage() {
    const bag = Object.create(null);
    return {
      async get(key) {
        return { [key]: bag[key] };
      },
      async set(obj) {
        Object.assign(bag, obj);
      }
    };
  }

  function createChromeStorageAdapter() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return {
        get(key) {
          return new Promise((resolve) => {
            chrome.storage.local.get([key], (res) => resolve(res || {}));
          });
        },
        set(obj) {
          return new Promise((resolve) => {
            chrome.storage.local.set(obj, () => resolve());
          });
        }
      };
    }
    return createMemoryStorage();
  }

  function mergeItemRecord(existing, incoming) {
    if (!existing) {
      const base = Object.assign(
        {
          mediaKey: '',
          thumbUrl: '',
          largeUrl: '',
          baseUrl: '',
          monthKey: 'unknown',
          takenAtMs: null,
          dateLabel: '',
          ariaLabel: '',
          mediaType: 'photo',
          durationText: '',
          isAlreadyFavorite: false,
          filename: '',
          width: null,
          height: null,
          sizeBytes: null,
          sizeSource: null,
          approxScrollY: 0,
          domOrder: 0,
          isScreenshot: false,
          screenshotReason: null
        },
        incoming
      );
      if (Formatters) {
        const clue = Formatters.detectScreenshotClue(base);
        base.isScreenshot = base.isScreenshot || clue.isScreenshot;
        base.screenshotReason = base.screenshotReason || clue.reason;
      }
      return base;
    }

    const merged = Object.assign({}, existing);
    const stringFields = ['thumbUrl', 'largeUrl', 'baseUrl', 'dateLabel', 'ariaLabel', 'durationText', 'filename'];
    for (const field of stringFields) {
      if (incoming[field] && (!merged[field] || incoming[field].length > merged[field].length)) {
        merged[field] = incoming[field];
      }
    }
    if (incoming.monthKey && incoming.monthKey !== 'unknown') {
      merged.monthKey = incoming.monthKey;
    }
    if (Number.isFinite(incoming.takenAtMs) && incoming.takenAtMs > 0) {
      // Prefer exact metadata timestamp over header-inferred timestamp
      if (!merged.takenAtMs || incoming.hasExactTimestamp) {
        merged.takenAtMs = incoming.takenAtMs;
      }
    }
    if (incoming.mediaType === 'video') merged.mediaType = 'video';
    if (incoming.isAlreadyFavorite) merged.isAlreadyFavorite = true;
    if (Number.isFinite(incoming.width) && incoming.width > 0) merged.width = incoming.width;
    if (Number.isFinite(incoming.height) && incoming.height > 0) merged.height = incoming.height;
    if (Number.isFinite(incoming.sizeBytes) && incoming.sizeBytes >= 0) {
      merged.sizeBytes = incoming.sizeBytes;
      merged.sizeSource = incoming.sizeSource || merged.sizeSource || 'probe';
    }
    if (Number.isFinite(incoming.approxScrollY) && incoming.approxScrollY >= 0) {
      merged.approxScrollY = incoming.approxScrollY;
    }
    if (Number.isFinite(incoming.domOrder)) {
      merged.domOrder = incoming.domOrder;
    }
    if (Formatters) {
      const clue = Formatters.detectScreenshotClue(merged);
      merged.isScreenshot = merged.isScreenshot || clue.isScreenshot;
      merged.screenshotReason = merged.screenshotReason || clue.reason;
    }
    return merged;
  }

  /**
   * Create state store for Swipe Photo Cleaner.
   */
  function createStore(options = {}) {
    const storageKey = options.storageKey || 'spc_state_v1';
    const storage = options.storage || createChromeStorageAdapter();

    const state = {
      itemsById: new Map(),
      decisions: new Map(),
      pendingSnapshots: new Map(), // Preserves thumbnail/size/month for pending items even across reloads
      committedTrash: new Set(),
      committedFavorite: new Set(),
      undoStack: [],
      selectedMonth: 'all',
      activeFilter: 'all', // 'all' | 'screenshot' | 'video'
      lifetimeFreedBytes: 0,
      lifetimeTrashedCount: 0,
      lifetimeFavoritedCount: 0
    };

    const listeners = new Set();
    let persistTimer = null;

    function emit() {
      for (const fn of listeners) {
        try {
          fn(state);
        } catch (_) {
          // Keep store resilient if a subscriber throws
        }
      }
    }

    function schedulePersist() {
      if (options.disablePersist) return;
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        persistNow().catch(() => {});
      }, 150);
    }

    async function persistNow() {
      if (options.disablePersist) return;
      const pendingSnapshotsObj = {};
      for (const [id, decision] of state.decisions.entries()) {
        if (decision === 'trash' || decision === 'favorite') {
          const item = state.itemsById.get(id) || state.pendingSnapshots.get(id);
          if (item) {
            pendingSnapshotsObj[id] = {
              mediaKey: item.mediaKey,
              thumbUrl: item.thumbUrl,
              largeUrl: item.largeUrl,
              monthKey: item.monthKey,
              takenAtMs: item.takenAtMs,
              dateLabel: item.dateLabel,
              filename: item.filename,
              mediaType: item.mediaType,
              sizeBytes: item.sizeBytes,
              sizeSource: item.sizeSource,
              approxScrollY: item.approxScrollY,
              isScreenshot: item.isScreenshot
            };
          }
        }
      }

      const payload = {
        decisions: Object.fromEntries(state.decisions.entries()),
        pendingSnapshots: pendingSnapshotsObj,
        committedTrash: Array.from(state.committedTrash).slice(-5000),
        committedFavorite: Array.from(state.committedFavorite).slice(-5000),
        lifetimeFreedBytes: state.lifetimeFreedBytes,
        lifetimeTrashedCount: state.lifetimeTrashedCount,
        lifetimeFavoritedCount: state.lifetimeFavoritedCount
      };
      await storage.set({ [storageKey]: payload });
    }

    async function load() {
      const res = await storage.get(storageKey);
      const saved = res && res[storageKey];
      if (!saved) return;

      if (saved.decisions && typeof saved.decisions === 'object') {
        state.decisions = new Map(
          Object.entries(saved.decisions).filter(([, v]) => VALID_DECISIONS.has(v))
        );
      }
      if (saved.pendingSnapshots && typeof saved.pendingSnapshots === 'object') {
        state.pendingSnapshots = new Map(Object.entries(saved.pendingSnapshots));
        for (const [id, snap] of state.pendingSnapshots.entries()) {
          if (!state.itemsById.has(id)) {
            state.itemsById.set(id, mergeItemRecord(null, snap));
          }
        }
      }
      if (Array.isArray(saved.committedTrash)) {
        state.committedTrash = new Set(saved.committedTrash);
      }
      if (Array.isArray(saved.committedFavorite)) {
        state.committedFavorite = new Set(saved.committedFavorite);
      }
      if (Number.isFinite(saved.lifetimeFreedBytes)) {
        state.lifetimeFreedBytes = saved.lifetimeFreedBytes;
      }
      if (Number.isFinite(saved.lifetimeTrashedCount)) {
        state.lifetimeTrashedCount = saved.lifetimeTrashedCount;
      }
      if (Number.isFinite(saved.lifetimeFavoritedCount)) {
        state.lifetimeFavoritedCount = saved.lifetimeFavoritedCount;
      }
      emit();
    }

    function subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    function upsertItems(items) {
      if (!Array.isArray(items) || items.length === 0) return 0;
      let addedOrUpdated = 0;
      for (const raw of items) {
        if (!raw || !raw.mediaKey) continue;
        if (state.committedTrash.has(raw.mediaKey)) continue;
        const existing = state.itemsById.get(raw.mediaKey);
        const merged = mergeItemRecord(existing, raw);
        state.itemsById.set(raw.mediaKey, merged);
        if (!existing) addedOrUpdated++;
      }
      if (addedOrUpdated > 0) emit();
      return addedOrUpdated;
    }

    function updateItemSize(mediaKey, sizeBytes, sizeSource) {
      const item = state.itemsById.get(mediaKey);
      if (!item) return false;
      if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return false;
      if (item.sizeBytes === sizeBytes && item.sizeSource === sizeSource) return false;
      item.sizeBytes = sizeBytes;
      item.sizeSource = sizeSource || 'probe';
      if (state.pendingSnapshots.has(mediaKey)) {
        const snap = state.pendingSnapshots.get(mediaKey);
        snap.sizeBytes = sizeBytes;
        snap.sizeSource = item.sizeSource;
      }
      schedulePersist();
      emit();
      return true;
    }

    function matchesFilter(item, filter) {
      if (filter === 'screenshot') return Boolean(item.isScreenshot);
      if (filter === 'video') return item.mediaType === 'video';
      return true;
    }

    function setSelectedMonth(monthKey) {
      state.selectedMonth = monthKey || 'all';
      emit();
    }

    function setActiveFilter(filter) {
      state.activeFilter = filter || 'all';
      emit();
    }

    function decide(mediaKey, action) {
      if (!VALID_DECISIONS.has(action)) return false;
      if (!state.itemsById.has(mediaKey)) return false;
      const prevDecision = state.decisions.get(mediaKey) || null;
      state.decisions.set(mediaKey, action);
      state.undoStack.push({ mediaKey, prevDecision });
      if (state.undoStack.length > 500) {
        state.undoStack.shift();
      }
      schedulePersist();
      emit();
      return true;
    }

    function undo() {
      const last = state.undoStack.pop();
      if (!last) return null;
      if (last.prevDecision) {
        state.decisions.set(last.prevDecision ? last.mediaKey : last.mediaKey, last.prevDecision);
      } else {
        state.decisions.delete(last.mediaKey);
      }
      schedulePersist();
      emit();
      return last;
    }

    function rescueFromTrash(mediaKey) {
      if (state.decisions.get(mediaKey) !== 'trash') return false;
      state.decisions.set(mediaKey, 'keep');
      state.undoStack.push({ mediaKey, prevDecision: 'trash' });
      schedulePersist();
      emit();
      return true;
    }

    function removeFavoritePending(mediaKey) {
      if (state.decisions.get(mediaKey) !== 'favorite') return false;
      state.decisions.set(mediaKey, 'keep');
      schedulePersist();
      emit();
      return true;
    }

    function resetKeptDecisions() {
      let count = 0;
      for (const [id, decision] of state.decisions.entries()) {
        if (decision === 'keep') {
          state.decisions.delete(id);
          count++;
        }
      }
      state.undoStack = state.undoStack.filter((u) => state.decisions.has(u.mediaKey));
      if (count > 0) {
        schedulePersist();
        emit();
      }
      return count;
    }

    function compareItemsDesc(a, b) {
      const tsA = Number.isFinite(a.takenAtMs) ? a.takenAtMs : 0;
      const tsB = Number.isFinite(b.takenAtMs) ? b.takenAtMs : 0;
      if (tsA !== tsB) return tsB - tsA;
      return (a.domOrder || 0) - (b.domOrder || 0);
    }

    function getDeckItems() {
      const list = [];
      for (const item of state.itemsById.values()) {
        if (state.committedTrash.has(item.mediaKey)) continue;
        if (state.decisions.has(item.mediaKey)) continue;
        if (state.selectedMonth !== 'all' && item.monthKey !== state.selectedMonth) continue;
        if (!matchesFilter(item, state.activeFilter)) continue;
        list.push(item);
      }
      list.sort(compareItemsDesc);
      return list;
    }

    function getMonthBuckets() {
      const map = new Map();
      for (const item of state.itemsById.values()) {
        if (state.committedTrash.has(item.mediaKey)) continue;
        if (!matchesFilter(item, state.activeFilter)) continue;

        const key = item.monthKey || 'unknown';
        let bucket = map.get(key);
        if (!bucket) {
          bucket = {
            monthKey: key,
            label: Formatters ? Formatters.formatMonthLabel(key) : key,
            totalCount: 0,
            remainingCount: 0,
            trashCount: 0,
            trashBytes: 0,
            favoriteCount: 0,
            keptCount: 0,
            totalBytes: 0
          };
          map.set(key, bucket);
        }

        bucket.totalCount += 1;
        if (Number.isFinite(item.sizeBytes)) bucket.totalBytes += item.sizeBytes;

        const decision = state.decisions.get(item.mediaKey);
        if (!decision) {
          bucket.remainingCount += 1;
        } else if (decision === 'trash') {
          bucket.trashCount += 1;
          if (Number.isFinite(item.sizeBytes)) bucket.trashBytes += item.sizeBytes;
        } else if (decision === 'favorite') {
          bucket.favoriteCount += 1;
        } else if (decision === 'keep') {
          bucket.keptCount += 1;
        }
      }

      const buckets = Array.from(map.values());
      buckets.sort((a, b) => {
        if (a.monthKey === 'unknown') return 1;
        if (b.monthKey === 'unknown') return -1;
        return b.monthKey.localeCompare(a.monthKey);
      });
      return buckets;
    }

    function getSummary() {
      const pendingTrashItems = [];
      const pendingFavoriteItems = [];
      let pendingTrashBytes = 0;
      let unknownSizeTrashCount = 0;
      let keptCount = 0;
      const byMonthMap = new Map();

      for (const [id, decision] of state.decisions.entries()) {
        if (decision === 'keep') {
          keptCount++;
          continue;
        }
        const item = state.itemsById.get(id) || state.pendingSnapshots.get(id);
        if (!item) continue;

        if (decision === 'trash' && !state.committedTrash.has(id)) {
          pendingTrashItems.push(item);
          if (Number.isFinite(item.sizeBytes)) {
            pendingTrashBytes += item.sizeBytes;
          } else {
            unknownSizeTrashCount++;
          }
          const mKey = item.monthKey || 'unknown';
          const mEntry = byMonthMap.get(mKey) || {
            monthKey: mKey,
            label: Formatters ? Formatters.formatMonthLabel(mKey) : mKey,
            count: 0,
            bytes: 0
          };
          mEntry.count += 1;
          if (Number.isFinite(item.sizeBytes)) mEntry.bytes += item.sizeBytes;
          byMonthMap.set(mKey, mEntry);
        } else if (decision === 'favorite' && !state.committedFavorite.has(id)) {
          pendingFavoriteItems.push(item);
        }
      }

      pendingTrashItems.sort(compareItemsDesc);
      pendingFavoriteItems.sort(compareItemsDesc);

      const byMonthTrashBreakdown = Array.from(byMonthMap.values()).sort((a, b) => {
        if (a.monthKey === 'unknown') return 1;
        if (b.monthKey === 'unknown') return -1;
        return b.monthKey.localeCompare(a.monthKey);
      });

      return {
        totalKnownItems: state.itemsById.size,
        pendingTrashItems,
        pendingTrashCount: pendingTrashItems.length,
        pendingTrashBytes,
        unknownSizeTrashCount,
        pendingFavoriteItems,
        pendingFavoriteCount: pendingFavoriteItems.length,
        keptCount,
        undoCount: state.undoStack.length,
        byMonthTrashBreakdown,
        lifetimeFreedBytes: state.lifetimeFreedBytes,
        lifetimeTrashedCount: state.lifetimeTrashedCount,
        lifetimeFavoritedCount: state.lifetimeFavoritedCount
      };
    }

    function markCommitted({ trashedIds = [], favoritedIds = [] }) {
      for (const id of trashedIds) {
        const item = state.itemsById.get(id) || state.pendingSnapshots.get(id);
        if (item && Number.isFinite(item.sizeBytes)) {
          state.lifetimeFreedBytes += item.sizeBytes;
        }
        state.lifetimeTrashedCount += 1;
        state.committedTrash.add(id);
        state.decisions.delete(id);
        state.pendingSnapshots.delete(id);
        state.itemsById.delete(id);
      }

      for (const id of favoritedIds) {
        state.lifetimeFavoritedCount += 1;
        state.committedFavorite.add(id);
        // Once favorited in Google Photos, keep it safely marked as 'keep' so it won't reappear as pending
        state.decisions.set(id, 'keep');
        state.pendingSnapshots.delete(id);
        const item = state.itemsById.get(id);
        if (item) item.isAlreadyFavorite = true;
      }

      state.undoStack = state.undoStack.filter(
        (u) => !trashedIds.includes(u.mediaKey) && !favoritedIds.includes(u.mediaKey)
      );
      schedulePersist();
      emit();
    }

    return {
      state,
      load,
      persistNow,
      subscribe,
      upsertItems,
      updateItemSize,
      setSelectedMonth,
      setActiveFilter,
      decide,
      undo,
      rescueFromTrash,
      removeFavoritePending,
      resetKeptDecisions,
      getDeckItems,
      getMonthBuckets,
      getSummary,
      markCommitted
    };
  }

  const api = {
    createStore,
    createMemoryStorage
  };

  root.SPCStore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
