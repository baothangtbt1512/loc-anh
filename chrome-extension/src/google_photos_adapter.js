(function (root) {
  'use strict';

  const Formatters =
    root.SPCFormatters ||
    (typeof require === 'function' ? require('./utils/formatters.js') : null);
  const DateParser =
    root.SPCDateParser ||
    (typeof require === 'function' ? require('./utils/date_parser.js') : null);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isExtensionNode(el) {
    return Boolean(el && el.closest && el.closest('#spc-shadow-host'));
  }

  function isTrashView(loc = root.location) {
    return Boolean(loc && typeof loc.pathname === 'string' && /\/trash\b/i.test(loc.pathname));
  }

  function extractMediaKeyFromHref(href) {
    if (!href || typeof href !== 'string') return '';
    const match = href.match(/\/photo\/([^/?#]+)/);
    return match ? match[1] : '';
  }

  function getScrollContainer(doc = document) {
    const firstLink = doc.querySelector('a[href*="/photo/"]');
    let cur = firstLink ? firstLink.parentElement : null;
    while (cur && cur !== doc.body && cur !== doc.documentElement) {
      try {
        const style = root.getComputedStyle ? root.getComputedStyle(cur) : null;
        const overflowY = style ? style.overflowY : cur.style.overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          cur.scrollHeight > cur.clientHeight + 40
        ) {
          return cur;
        }
      } catch (_) {}
      cur = cur.parentElement;
    }
    return doc.scrollingElement || doc.documentElement || doc.body;
  }

  function getScrollTop(container, doc = typeof document !== 'undefined' ? document : null) {
    if (!container) return 0;
    if (doc && (container === doc.documentElement || container === doc.body)) {
      return (typeof window !== 'undefined' ? window.scrollY : 0) || container.scrollTop || 0;
    }
    return container.scrollTop || 0;
  }

  function setScrollTop(container, y, doc = typeof document !== 'undefined' ? document : null) {
    const target = Math.max(0, y);
    if (!container || (doc && (container === doc.documentElement || container === doc.body))) {
      if (typeof window !== 'undefined' && window.scrollTo) {
        window.scrollTo({ top: target, behavior: 'auto' });
      } else if (container) {
        container.scrollTop = target;
      }
      return;
    }
    container.scrollTop = target;
  }

  function findTileContainer(link) {
    if (!link) return null;
    // Walk up up to 4 levels to find the enclosing grid tile containing both the link and its checkbox
    let cur = link;
    for (let i = 0; i < 4 && cur && cur.parentElement; i++) {
      if (cur.querySelector && cur.querySelector('[role="checkbox"]')) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return link.parentElement || link;
  }

  function findCheckboxForLink(link) {
    const tile = findTileContainer(link);
    if (!tile) return null;
    return tile.querySelector('[role="checkbox"]');
  }

  function extractThumbUrl(link, tile) {
    const searchRoot = tile || link;
    const img = searchRoot.querySelector('img[src]');
    if (img && img.getAttribute('src')) {
      return img.getAttribute('src');
    }
    const bgEl = searchRoot.querySelector('[style*="background-image"]');
    const target = bgEl || link;
    const bg = target && target.style ? target.style.backgroundImage : '';
    const match = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : '';
  }

  function looksLikeDateHeading(el) {
    if (!el || isExtensionNode(el)) return false;
    if (el.closest('a[href*="/photo/"]')) return false;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 80) return false;
    return Boolean(DateParser && DateParser.parseGooglePhotosDate(text));
  }

  /**
   * Scan the currently rendered Google Photos grid DOM and merge with network hints.
   */
  function scanVisibleDom(doc = document, hintsMap = new Map()) {
    const main = doc.querySelector('main, [role="main"]') || doc.body;
    if (!main) return [];

    const scrollContainer = getScrollContainer(doc);
    const containerRect =
      scrollContainer && scrollContainer.getBoundingClientRect
        ? scrollContainer.getBoundingClientRect()
        : { top: 0 };
    const currentScrollTop = getScrollTop(scrollContainer, doc);

    const candidates = main.querySelectorAll(
      'h1, h2, h3, [role="heading"], [data-date], [data-spc-date], a[href*="/photo/"]'
    );

    let currentHeaderDate = null;
    let currentHeaderLabel = '';
    const seen = new Set();
    const results = [];
    let domOrder = 0;

    for (const el of candidates) {
      if (isExtensionNode(el)) continue;

      if (el.tagName !== 'A') {
        const rawDateAttr = el.getAttribute('data-date') || el.getAttribute('data-spc-date') || el.textContent;
        const parsed = DateParser ? DateParser.parseGooglePhotosDate(rawDateAttr) : null;
        if (parsed && looksLikeDateHeading(el)) {
          currentHeaderDate = parsed;
          currentHeaderLabel = (el.textContent || '').trim();
        }
        continue;
      }

      const href = el.getAttribute('href') || '';
      const mediaKey = extractMediaKeyFromHref(href);
      if (!mediaKey || seen.has(mediaKey)) continue;
      seen.add(mediaKey);

      const tile = findTileContainer(el);
      const checkbox = findCheckboxForLink(el);
      const img = (tile || el).querySelector('img');
      const thumbUrl = extractThumbUrl(el, tile);
      const hint = hintsMap.get(mediaKey);

      const ariaParts = [
        el.getAttribute('aria-label'),
        checkbox && checkbox.getAttribute('aria-label'),
        img && img.getAttribute('alt')
      ].filter(Boolean);
      const ariaLabel = ariaParts[0] || '';

      let dateInfo = null;
      if (hint && Number.isFinite(hint.takenAtMs)) {
        dateInfo = DateParser.timestampToMonthInfo(hint.takenAtMs);
      }
      if (!dateInfo && DateParser) {
        for (const candidateText of ariaParts) {
          dateInfo = DateParser.parseGooglePhotosDate(candidateText);
          if (dateInfo) break;
        }
      }
      if (!dateInfo && currentHeaderDate) {
        dateInfo = currentHeaderDate;
      }

      const tileText = (tile ? tile.textContent : el.textContent) || '';
      const durationMatch = tileText.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
      const isVideo =
        /\bvideo\b|phim/i.test(ariaLabel) ||
        Boolean(durationMatch) ||
        el.getAttribute('data-spc-type') === 'video';

      const isAlreadyFavorite = Boolean(
        el.getAttribute('data-spc-favorite') === 'true' ||
          (tile &&
            tile.querySelector(
              '[aria-label*="favorite" i], [aria-label*="yêu thích" i], [data-is-favorite="true"]'
            ))
      );

      const rawSizeAttr = el.getAttribute('data-spc-size') || (tile && tile.getAttribute('data-spc-size'));
      const attrSize = rawSizeAttr ? Number(rawSizeAttr) : null;
      const filename =
        (hint && hint.filename) ||
        el.getAttribute('data-spc-filename') ||
        '';

      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { top: 0 };
      const approxScrollY = Math.max(0, Math.round(rect.top - containerRect.top + currentScrollTop));

      const baseOrThumb = (hint && hint.baseUrl) || thumbUrl;
      const largeUrl = Formatters
        ? Formatters.upgradeGooglePhotoUrl(baseOrThumb, 1600)
        : baseOrThumb;

      const takenAtMs = dateInfo ? dateInfo.timestampMs : null;
      const monthKey = dateInfo ? dateInfo.monthKey : 'unknown';

      results.push({
        mediaKey,
        thumbUrl: thumbUrl || largeUrl,
        largeUrl,
        baseUrl: Formatters ? Formatters.extractGoogleBaseUrl(baseOrThumb) : baseOrThumb,
        monthKey,
        takenAtMs,
        hasExactTimestamp: Boolean(hint && hint.takenAtMs),
        dateLabel: Formatters
          ? Formatters.formatDateDisplay(takenAtMs, currentHeaderLabel || ariaLabel)
          : currentHeaderLabel || ariaLabel,
        ariaLabel,
        mediaType: isVideo ? 'video' : 'photo',
        durationText: durationMatch ? durationMatch[1] : '',
        isAlreadyFavorite,
        filename,
        width: hint ? hint.width : null,
        height: hint ? hint.height : null,
        sizeBytes: Number.isFinite(attrSize) && attrSize >= 0 ? attrSize : null,
        sizeSource: Number.isFinite(attrSize) ? 'dom' : null,
        approxScrollY,
        domOrder: domOrder++
      });
    }

    return results;
  }

  function makeSyntheticEvent(type, opts) {
    if (type.startsWith('pointer') && typeof PointerEvent === 'function') {
      return new PointerEvent(type, opts);
    }
    if (typeof MouseEvent === 'function') {
      return new MouseEvent(type, opts);
    }
    return Object.assign({ type }, opts);
  }

  function dispatchRealClick(el) {
    if (!el) return false;
    const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const type of eventTypes) {
      el.dispatchEvent(
        makeSyntheticEvent(type, {
          bubbles: true,
          cancelable: true,
          view: typeof window !== 'undefined' ? window : undefined
        })
      );
    }
    return true;
  }

  function dispatchHover(el) {
    if (!el) return;
    for (const type of ['pointerover', 'mouseover', 'mouseenter']) {
      el.dispatchEvent(makeSyntheticEvent(type, { bubbles: true, cancelable: true }));
    }
  }

  function dispatchKey(doc, key, shiftKey = false) {
    const target = doc.activeElement || doc.body;
    if (!target) return;
    const opts = {
      key,
      code: key === '#' ? 'Digit3' : key === 'Escape' ? 'Escape' : `Key${key.toUpperCase()}`,
      shiftKey,
      bubbles: true,
      cancelable: true
    };
    const makeKeyEvt = (type) =>
      typeof KeyboardEvent === 'function' ? new KeyboardEvent(type, opts) : Object.assign({ type }, opts);
    target.dispatchEvent(makeKeyEvt('keydown'));
    target.dispatchEvent(makeKeyEvt('keyup'));
  }

  async function waitForCondition(checkFn, timeoutMs = 4000, intervalMs = 80, shouldAbort = null) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (shouldAbort && shouldAbort()) return null;
      const val = checkFn();
      if (val) return val;
      await sleep(intervalMs);
    }
    return null;
  }

  function findTileLink(doc, mediaKey) {
    const links = doc.querySelectorAll('a[href*="/photo/"]');
    for (const a of links) {
      if (isExtensionNode(a)) continue;
      if (extractMediaKeyFromHref(a.getAttribute('href') || '') === mediaKey) {
        return a;
      }
    }
    return null;
  }

  async function locateTileByMediaKey(doc, mediaKey, approxScrollY = 0, shouldAbort = null) {
    let link = findTileLink(doc, mediaKey);
    if (link) return link;

    const container = getScrollContainer(doc);
    const viewportH = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720) || 720;

    // Jump directly near the recorded scroll position first
    if (Number.isFinite(approxScrollY) && approxScrollY > 0) {
      setScrollTop(container, Math.max(0, approxScrollY - viewportH * 0.4), doc);
      await sleep(300);
      link = findTileLink(doc, mediaKey);
      if (link) return link;

      // Probe nearby offsets in case virtualized grid heights shifted slightly
      for (const offset of [-500, 500, -1100, 1100, -1800, 1800]) {
        if (shouldAbort && shouldAbort()) return null;
        setScrollTop(container, Math.max(0, approxScrollY + offset - viewportH * 0.4), doc);
        await sleep(260);
        link = findTileLink(doc, mediaKey);
        if (link) return link;
      }
    }

    // Bounded fallback sweep from top
    setScrollTop(container, 0, doc);
    await sleep(260);
    const step = Math.max(360, Math.round(viewportH * 0.65));
    let lastScroll = -1;
    for (let i = 0; i < 40; i++) {
      if (shouldAbort && shouldAbort()) return null;
      link = findTileLink(doc, mediaKey);
      if (link) return link;
      const cur = getScrollTop(container, doc);
      if (cur === lastScroll && i > 0) break;
      lastScroll = cur;
      setScrollTop(container, cur + step, doc);
      await sleep(260);
    }

    return null;
  }

  function getAccessibleLabel(el) {
    if (!el) return '';
    return [
      el.getAttribute('aria-label'),
      el.getAttribute('data-tooltip'),
      el.getAttribute('title'),
      el.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.getBoundingClientRect) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
    } else if (el.offsetParent === null) {
      return false;
    }
    if (root.getComputedStyle) {
      try {
        const cs = root.getComputedStyle(el);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) {
          return false;
        }
      } catch (_) {}
    }
    return true;
  }

  function findTrashButton(doc) {
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isExtensionNode(btn) || !isElementVisible(btn)) continue;
      const label = getAccessibleLabel(btn);
      if (!label) continue;
      if (/permanently|vĩnh viễn|empty trash|dọn sạch/i.test(label)) continue;
      if (/move to trash|chuyển vào thùng rác|delete|xóa/i.test(label)) {
        return btn;
      }
    }
    return null;
  }

  function findConfirmTrashButton(dialog) {
    if (!dialog) return null;
    const buttons = dialog.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const label = getAccessibleLabel(btn);
      if (!label) continue;
      if (/^(cancel|hủy|huỷ|không|no)$/i.test(label.trim())) continue;
      if (/permanently|vĩnh viễn/i.test(label)) continue;
      if (/move to trash|chuyển vào thùng rác|trash|xóa|delete/i.test(label)) {
        return btn;
      }
    }
    return null;
  }

  function findActiveDialog(doc) {
    const dialogs = doc.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    for (const d of dialogs) {
      if (isExtensionNode(d) || !isElementVisible(d)) continue;
      if (findConfirmTrashButton(d)) return d;
    }
    return null;
  }

  function findClearSelectionButton(doc) {
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isExtensionNode(btn) || !isElementVisible(btn)) continue;
      const label = getAccessibleLabel(btn);
      if (/clear selection|deselect|bỏ chọn/i.test(label)) return btn;
    }
    return null;
  }

  function findFavoriteButton(doc) {
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isExtensionNode(btn) || !isElementVisible(btn)) continue;
      const label = getAccessibleLabel(btn);
      if (/favorite|yêu thích|bỏ thích|gắn sao/i.test(label)) {
        return btn;
      }
    }
    return null;
  }

  function isFavoriteButtonActive(btn) {
    if (!btn) return false;
    if (btn.getAttribute('aria-pressed') === 'true') return true;
    const label = getAccessibleLabel(btn);
    return /unfavorite|remove from favorites|bỏ thích|bỏ khỏi mục yêu thích|xóa khỏi mục yêu thích/i.test(
      label
    );
  }

  function findBackOrCloseButton(doc) {
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isExtensionNode(btn) || !isElementVisible(btn)) continue;
      const label = getAccessibleLabel(btn);
      if (/^(back|quay lại|close|đóng|thoát)$/i.test(label.trim()) || /back to|quay lại thư viện/i.test(label)) {
        return btn;
      }
    }
    return null;
  }

  function findInfoButton(doc) {
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isExtensionNode(btn) || !isElementVisible(btn)) continue;
      const label = getAccessibleLabel(btn);
      if (/\b(info|thông tin|chi tiết)\b/i.test(label)) {
        return btn;
      }
    }
    return null;
  }

  function readSizeFromInfoPanel(doc) {
    if (!Formatters) return null;
    const panels = doc.querySelectorAll('aside, [role="complementary"], [aria-label*="Info" i], [aria-label*="Thông tin" i]');
    for (const panel of panels) {
      if (isExtensionNode(panel) || !isElementVisible(panel)) continue;
      const bytes = Formatters.parseHumanFileSize(panel.textContent || '');
      if (bytes !== null) return bytes;
    }
    return null;
  }

  /**
   * Deep-scroll the Google Photos grid to discover older months into memory.
   */
  async function runDeepScan({ doc = document, hintsMap, onBatch, onStatus, shouldAbort, maxSteps = 50 }) {
    const container = getScrollContainer(doc);
    const initialScroll = getScrollTop(container, doc);
    const viewportH = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720) || 720;
    const step = Math.max(400, Math.round(viewportH * 0.72));

    let samePosStreak = 0;
    let prevScroll = -1;

    for (let i = 0; i < maxSteps; i++) {
      if (shouldAbort && shouldAbort()) break;

      const items = scanVisibleDom(doc, hintsMap);
      if (onBatch && items.length > 0) onBatch(items);
      if (onStatus) onStatus({ step: i + 1, maxSteps, scrollTop: getScrollTop(container, doc) });

      const cur = getScrollTop(container, doc);
      if (Math.abs(cur - prevScroll) < 4) {
        samePosStreak++;
        if (samePosStreak >= 2) break;
      } else {
        samePosStreak = 0;
      }
      prevScroll = cur;

      setScrollTop(container, cur + step, doc);
      await sleep(420);
    }

    // Final scan at resting position, then return near initial scroll
    const tailItems = scanVisibleDom(doc, hintsMap);
    if (onBatch && tailItems.length > 0) onBatch(tailItems);
    setScrollTop(container, initialScroll, doc);
  }

  /**
   * Read missing file sizes directly from Google Photos Info drawer for specific items.
   */
  async function measureUnknownSizesViaInfo({ doc = document, items, onMeasured, onProgress, shouldAbort }) {
    let measuredCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (shouldAbort && shouldAbort()) break;
      const item = items[i];
      if (onProgress) {
        onProgress({ current: i + 1, total: items.length, item });
      }
      const link = await locateTileByMediaKey(doc, item.mediaKey, item.approxScrollY, shouldAbort);
      if (!link) continue;

      dispatchRealClick(link);
      const viewerBtn = await waitForCondition(
        () => findInfoButton(doc) || findFavoriteButton(doc),
        4000,
        90,
        shouldAbort
      );
      if (!viewerBtn) continue;

      let bytes = readSizeFromInfoPanel(doc);
      if (bytes === null) {
        const infoBtn = findInfoButton(doc);
        if (infoBtn) {
          dispatchRealClick(infoBtn);
        } else {
          dispatchKey(doc, 'i');
        }
        bytes = await waitForCondition(() => readSizeFromInfoPanel(doc), 2500, 90, shouldAbort);
      }

      if (Number.isFinite(bytes) && bytes > 0) {
        measuredCount++;
        if (onMeasured) onMeasured(item.mediaKey, bytes);
      }

      const closeBtn = findBackOrCloseButton(doc);
      if (closeBtn) dispatchRealClick(closeBtn);
      else dispatchKey(doc, 'Escape');

      await waitForCondition(() => Boolean(findTileLink(doc, item.mediaKey)), 3000, 90, shouldAbort);
      await sleep(160);
    }
    return measuredCount;
  }

  /**
   * Commit Favorites & Pending Trash directly inside the live Google Photos DOM.
   */
  async function commitChanges({
    doc = document,
    favoriteItems = [],
    trashItems = [],
    onProgress,
    shouldAbort
  }) {
    if (isTrashView()) {
      throw new Error('Không thể chạy thao tác khi đang ở trong Thùng rác Google Photos.');
    }

    const favoritedIds = [];
    const failedFavoriteIds = [];
    const trashedIds = [];
    const failedTrashIds = [];

    // Phase 1: Save Favorites in Google Photos
    for (let i = 0; i < favoriteItems.length; i++) {
      if (shouldAbort && shouldAbort()) break;
      const item = favoriteItems[i];
      if (onProgress) {
        onProgress({
          phase: 'favorite',
          current: i + 1,
          total: favoriteItems.length,
          message: `Đang gắn Yêu thích (${i + 1}/${favoriteItems.length})...`
        });
      }

      const link = await locateTileByMediaKey(doc, item.mediaKey, item.approxScrollY, shouldAbort);
      if (!link) {
        failedFavoriteIds.push(item.mediaKey);
        continue;
      }

      if (link.scrollIntoView) link.scrollIntoView({ block: 'center' });
      dispatchRealClick(link);

      const favBtn = await waitForCondition(() => findFavoriteButton(doc), 4500, 90, shouldAbort);
      if (!favBtn) {
        failedFavoriteIds.push(item.mediaKey);
        const back = findBackOrCloseButton(doc);
        if (back) dispatchRealClick(back);
        else dispatchKey(doc, 'Escape');
        await sleep(250);
        continue;
      }

      let saved = isFavoriteButtonActive(favBtn);
      if (!saved) {
        dispatchRealClick(favBtn);
        saved = Boolean(
          await waitForCondition(() => isFavoriteButtonActive(findFavoriteButton(doc)), 2000, 80, shouldAbort)
        );
        if (!saved) {
          dispatchKey(doc, 'f');
          saved = Boolean(
            await waitForCondition(() => isFavoriteButtonActive(findFavoriteButton(doc)), 2000, 80, shouldAbort)
          );
        }
      }

      if (saved) {
        favoritedIds.push(item.mediaKey);
      } else {
        failedFavoriteIds.push(item.mediaKey);
      }

      const backBtn = findBackOrCloseButton(doc);
      if (backBtn) dispatchRealClick(backBtn);
      else dispatchKey(doc, 'Escape');

      await waitForCondition(() => Boolean(findTileLink(doc, item.mediaKey)), 3500, 80, shouldAbort);
      await sleep(180);
    }

    // Phase 2: Batch-select & Move Pending Trash items to Google Photos Trash
    const sortedTrash = [...trashItems].sort((a, b) => (a.approxScrollY || 0) - (b.approxScrollY || 0));
    const BATCH_SIZE = 25;

    for (let start = 0; start < sortedTrash.length; start += BATCH_SIZE) {
      if (shouldAbort && shouldAbort()) break;
      const batch = sortedTrash.slice(start, start + BATCH_SIZE);

      // Clear any preexisting manual selection first for safety
      const clearBtn = findClearSelectionButton(doc);
      if (clearBtn) {
        dispatchRealClick(clearBtn);
        await sleep(220);
      }

      const selectedInBatch = [];
      for (let j = 0; j < batch.length; j++) {
        if (shouldAbort && shouldAbort()) break;
        const item = batch[j];
        const doneSoFar = start + j + 1;
        if (onProgress) {
          onProgress({
            phase: 'trash',
            current: doneSoFar,
            total: sortedTrash.length,
            message: `Đang chọn ảnh chuyển vào Thùng rác (${doneSoFar}/${sortedTrash.length})...`
          });
        }

        const link = await locateTileByMediaKey(doc, item.mediaKey, item.approxScrollY, shouldAbort);
        if (!link) {
          failedTrashIds.push(item.mediaKey);
          continue;
        }

        const tile = findTileContainer(link);
        if (tile && tile.scrollIntoView) tile.scrollIntoView({ block: 'center' });
        dispatchHover(tile || link);
        await sleep(60);

        const checkbox = findCheckboxForLink(link);
        if (!checkbox) {
          failedTrashIds.push(item.mediaKey);
          continue;
        }

        if (checkbox.getAttribute('aria-checked') !== 'true') {
          dispatchRealClick(checkbox);
          const checked = await waitForCondition(
            () => checkbox.getAttribute('aria-checked') === 'true',
            1200,
            60,
            shouldAbort
          );
          if (!checked) {
            failedTrashIds.push(item.mediaKey);
            continue;
          }
        }
        selectedInBatch.push(item.mediaKey);
      }

      if (selectedInBatch.length === 0) continue;

      if (onProgress) {
        onProgress({
          phase: 'trash',
          current: Math.min(start + BATCH_SIZE, sortedTrash.length),
          total: sortedTrash.length,
          message: `Đang chuyển ${selectedInBatch.length} ảnh vào Thùng rác Google Photos...`
        });
      }

      const trashBtn = await waitForCondition(() => findTrashButton(doc), 2000, 80, shouldAbort);
      if (trashBtn) {
        dispatchRealClick(trashBtn);
      } else {
        dispatchKey(doc, '#', true);
      }

      const dialog = await waitForCondition(() => findActiveDialog(doc), 4000, 80, shouldAbort);
      if (!dialog) {
        failedTrashIds.push(...selectedInBatch);
        continue;
      }

      const confirmBtn = findConfirmTrashButton(dialog);
      if (!confirmBtn) {
        failedTrashIds.push(...selectedInBatch);
        continue;
      }

      dispatchRealClick(confirmBtn);
      const closed = await waitForCondition(() => !findActiveDialog(doc), 6000, 100, shouldAbort);
      if (closed !== null || !findActiveDialog(doc)) {
        trashedIds.push(...selectedInBatch);
      } else {
        failedTrashIds.push(...selectedInBatch);
      }
      await sleep(450);
    }

    return {
      favoritedIds,
      failedFavoriteIds,
      trashedIds,
      failedTrashIds
    };
  }

  const api = {
    isTrashView,
    extractMediaKeyFromHref,
    getScrollContainer,
    scanVisibleDom,
    runDeepScan,
    measureUnknownSizesViaInfo,
    commitChanges,
    dispatchRealClick,
    findTrashButton,
    findConfirmTrashButton,
    findFavoriteButton,
    isFavoriteButtonActive
  };

  root.SPCGooglePhotosAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
