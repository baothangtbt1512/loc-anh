(function (root) {
  'use strict';

  const Formatters =
    root.SPCFormatters ||
    (typeof require === 'function' ? require('../utils/formatters.js') : null);

  function safeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/^(https?:|data:image\/|blob:)/i.test(url)) return url;
    return '';
  }

  /**
   * Create the Shadow DOM Swipe Photo Cleaner UI controller.
   */
  function createSwipeOverlay({
    doc = document,
    store,
    cssUrl = '',
    cssText = '',
    onRefreshScan,
    onToggleDeepScan,
    onNeedSizes,
    onMeasureUnknownSizes,
    onCommit,
    onAbortCommit,
    onJumpToLibrary,
    isTrashViewFn
  }) {
    const existingHost = doc.getElementById('spc-shadow-host');
    if (existingHost) existingHost.remove();

    const host = doc.createElement('div');
    host.id = 'spc-shadow-host';
    const shadow = host.attachShadow({ mode: 'open' });

    if (cssUrl) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      shadow.appendChild(link);
    }
    if (cssText) {
      const style = doc.createElement('style');
      style.textContent = cssText;
      shadow.appendChild(style);
    }

    const container = doc.createElement('div');
    shadow.appendChild(container);
    doc.documentElement.appendChild(host);

    const uiState = {
      isOpen: false,
      isReviewOpen: false,
      isScanning: false,
      scanCountText: '',
      isMeasuringSizes: false,
      isCommitting: false,
      commitPhase: '',
      commitProgress: 0,
      commitMessage: '',
      zoomed: false,
      isAnimating: false,
      toastText: '',
      toastTimer: null
    };

    container.innerHTML = `
      <button class="spc-launcher" id="spc-launcher-btn" type="button" title="Mở Dọn Ảnh Kiểu Quẹt (Alt+Shift+S)">
        <span class="spc-launcher-dot"></span>
        <span>Quẹt Dọn Ảnh</span>
        <span class="spc-launcher-badge spc-hidden" id="spc-launcher-badge"></span>
      </button>

      <div class="spc-overlay spc-hidden" id="spc-overlay" role="dialog" aria-modal="true" aria-label="Swipe Photo Cleaner">
        <header class="spc-topbar">
          <div class="spc-brand">
            <div class="spc-logo">⚡</div>
            <div>
              <div class="spc-brand-title">Swipe Photo Cleaner</div>
              <div class="spc-brand-sub" id="spc-brand-sub">Sẵn sàng quét thư viện Google Photos</div>
            </div>
          </div>

          <div class="spc-toolbar-group" id="spc-filters">
            <button type="button" class="spc-chip-btn active" data-filter="all">Tất cả</button>
            <button type="button" class="spc-chip-btn" data-filter="screenshot">📱 Chụp màn hình</button>
            <button type="button" class="spc-chip-btn" data-filter="video">🎬 Video</button>
            <button type="button" class="spc-chip-btn" id="spc-deep-scan-btn">🔍 Quét thêm tháng cũ</button>
            <button type="button" class="spc-chip-btn" id="spc-refresh-btn">↻ Quét lại</button>
          </div>

          <div class="spc-toolbar-group">
            <button type="button" class="spc-review-cta empty" id="spc-open-review-btn">
              <span id="spc-review-cta-text">🗑️ 0 chờ xóa • 0 B</span>
            </button>
            <button type="button" class="spc-close-btn" id="spc-close-btn" title="Đóng (Esc)">✕</button>
          </div>
        </header>

        <div class="spc-banner spc-hidden" id="spc-trash-warning">
          <span>⚠️ Bạn đang xem Thùng rác Google Photos. Hãy chuyển về Thư viện chính để dọn ảnh an toàn.</span>
          <button type="button" class="spc-chip-btn" id="spc-go-library-btn">Mở Thư viện Photos</button>
        </div>

        <nav class="spc-month-strip" id="spc-month-strip" aria-label="Gom ảnh theo từng tháng"></nav>

        <main class="spc-stage-wrap">
          <div class="spc-card-deck" id="spc-card-deck"></div>
          <div class="spc-empty-card spc-hidden" id="spc-empty-card"></div>

          <div class="spc-dock" id="spc-dock">
            <div class="spc-dock-buttons">
              <button type="button" class="spc-action-btn undo" id="spc-btn-undo" title="Hoàn tác (Z)">
                <span class="icon">↶</span>
                <span>Hoàn tác</span>
              </button>
              <button type="button" class="spc-action-btn trash" id="spc-btn-trash" title="Bỏ vào thùng chờ xóa (← hoặc A)">
                <span class="icon">🗑️</span>
                <span>Chờ xóa</span>
              </button>
              <button type="button" class="spc-action-btn fav" id="spc-btn-fav" title="Yêu thích (↑ hoặc W)">
                <span class="icon">♥</span>
                <span>Yêu thích</span>
              </button>
              <button type="button" class="spc-action-btn keep" id="spc-btn-keep" title="Giữ lại (→ hoặc D)">
                <span class="icon">✓</span>
                <span>Giữ lại</span>
              </button>
            </div>
            <div class="spc-shortcuts-hint">
              Kéo thẻ hoặc phím tắt: ← Chờ xóa • → Giữ • ↑ Yêu thích • Z Hoàn tác • Space Phóng to • R Xem lại
            </div>
          </div>
        </main>
      </div>

      <div class="spc-modal-backdrop spc-hidden" id="spc-review-backdrop">
        <section class="spc-modal" role="dialog" aria-modal="true" aria-label="Xem trước dung lượng & xác nhận">
          <div class="spc-modal-header">
            <div class="spc-modal-title">Xem trước trước khi lưu vào Google Photos</div>
            <button type="button" class="spc-close-btn" id="spc-review-close-btn">✕</button>
          </div>
          <div class="spc-modal-body" id="spc-review-body"></div>
          <div class="spc-modal-footer">
            <button type="button" class="spc-btn-secondary" id="spc-review-back-btn">← Quay lại quẹt tiếp</button>
            <button type="button" class="spc-btn-primary" id="spc-commit-btn">Lưu & Chuyển vào Thùng rác</button>
          </div>
        </section>
      </div>

      <div class="spc-commit-hud spc-hidden" id="spc-commit-hud">
        <div class="spc-hud-head">
          <span>⚡ Đang lưu vào Google Photos</span>
          <button type="button" class="spc-chip-btn" id="spc-hud-abort-btn">Dừng</button>
        </div>
        <div class="spc-progress-track">
          <div class="spc-progress-fill" id="spc-hud-progress"></div>
        </div>
        <div class="spc-hud-msg" id="spc-hud-msg">Đang chuẩn bị...</div>
      </div>

      <div class="spc-toast spc-hidden" id="spc-toast"></div>
    `;

    const els = {
      launcherBtn: shadow.getElementById('spc-launcher-btn'),
      launcherBadge: shadow.getElementById('spc-launcher-badge'),
      overlay: shadow.getElementById('spc-overlay'),
      brandSub: shadow.getElementById('spc-brand-sub'),
      filters: shadow.getElementById('spc-filters'),
      deepScanBtn: shadow.getElementById('spc-deep-scan-btn'),
      refreshBtn: shadow.getElementById('spc-refresh-btn'),
      openReviewBtn: shadow.getElementById('spc-open-review-btn'),
      reviewCtaText: shadow.getElementById('spc-review-cta-text'),
      closeBtn: shadow.getElementById('spc-close-btn'),
      trashWarning: shadow.getElementById('spc-trash-warning'),
      goLibraryBtn: shadow.getElementById('spc-go-library-btn'),
      monthStrip: shadow.getElementById('spc-month-strip'),
      cardDeck: shadow.getElementById('spc-card-deck'),
      emptyCard: shadow.getElementById('spc-empty-card'),
      dock: shadow.getElementById('spc-dock'),
      btnUndo: shadow.getElementById('spc-btn-undo'),
      btnTrash: shadow.getElementById('spc-btn-trash'),
      btnFav: shadow.getElementById('spc-btn-fav'),
      btnKeep: shadow.getElementById('spc-btn-keep'),
      reviewBackdrop: shadow.getElementById('spc-review-backdrop'),
      reviewCloseBtn: shadow.getElementById('spc-review-close-btn'),
      reviewBackBtn: shadow.getElementById('spc-review-back-btn'),
      reviewBody: shadow.getElementById('spc-review-body'),
      commitBtn: shadow.getElementById('spc-commit-btn'),
      commitHud: shadow.getElementById('spc-commit-hud'),
      hudAbortBtn: shadow.getElementById('spc-hud-abort-btn'),
      hudProgress: shadow.getElementById('spc-hud-progress'),
      hudMsg: shadow.getElementById('spc-hud-msg'),
      toast: shadow.getElementById('spc-toast')
    };

    function showToast(text, durationMs = 3500) {
      uiState.toastText = text;
      els.toast.textContent = text;
      els.toast.classList.remove('spc-hidden');
      if (uiState.toastTimer) clearTimeout(uiState.toastTimer);
      uiState.toastTimer = setTimeout(() => {
        els.toast.classList.add('spc-hidden');
      }, durationMs);
    }

    function open() {
      uiState.isOpen = true;
      els.overlay.classList.remove('spc-hidden');
      els.launcherBtn.classList.add('spc-hidden');
      if (onRefreshScan) onRefreshScan();
      render();
    }

    function close() {
      uiState.isOpen = false;
      uiState.isReviewOpen = false;
      uiState.zoomed = false;
      els.overlay.classList.add('spc-hidden');
      els.reviewBackdrop.classList.add('spc-hidden');
      if (!uiState.isCommitting) {
        els.launcherBtn.classList.remove('spc-hidden');
      }
    }

    function toggle() {
      if (uiState.isOpen) close();
      else open();
    }

    function openReview() {
      uiState.isReviewOpen = true;
      renderReview();
      els.reviewBackdrop.classList.remove('spc-hidden');
    }

    function closeReview() {
      uiState.isReviewOpen = false;
      els.reviewBackdrop.classList.add('spc-hidden');
    }

    function setScanning(scanning, countText = '') {
      uiState.isScanning = scanning;
      uiState.scanCountText = countText;
      els.deepScanBtn.classList.toggle('scanning', scanning);
      els.deepScanBtn.textContent = scanning
        ? `⏹ Dừng quét${countText ? ` (${countText})` : ''}`
        : '🔍 Quét thêm tháng cũ';
    }

    function setCommitState({ running, progress = 0, message = '' }) {
      uiState.isCommitting = running;
      uiState.commitProgress = progress;
      uiState.commitMessage = message;
      els.commitHud.classList.toggle('spc-hidden', !running);
      els.hudProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      els.hudMsg.textContent = message;
      if (running) {
        els.launcherBtn.classList.add('spc-hidden');
      } else if (!uiState.isOpen) {
        els.launcherBtn.classList.remove('spc-hidden');
      }
    }

    function triggerSwipeAction(action) {
      if (uiState.isAnimating) return;
      const deck = store.getDeckItems();
      const topItem = deck[0];
      if (!topItem) return;

      const activeCard = els.cardDeck.querySelector('.spc-card.active');
      if (!activeCard) {
        store.decide(topItem.mediaKey, action);
        return;
      }

      uiState.isAnimating = true;
      uiState.zoomed = false;
      activeCard.classList.add('animating');

      const keepStamp = activeCard.querySelector('.spc-stamp.keep');
      const trashStamp = activeCard.querySelector('.spc-stamp.trash');
      const favStamp = activeCard.querySelector('.spc-stamp.fav');

      if (action === 'keep') {
        if (keepStamp) keepStamp.style.opacity = '1';
        activeCard.style.transform = 'translate3d(520px, -20px, 0) rotate(18deg)';
      } else if (action === 'trash') {
        if (trashStamp) trashStamp.style.opacity = '1';
        activeCard.style.transform = 'translate3d(-520px, -20px, 0) rotate(-18deg)';
      } else if (action === 'favorite') {
        if (favStamp) favStamp.style.opacity = '1';
        activeCard.style.transform = 'translate3d(0, -480px, 0) scale(0.95)';
      }
      activeCard.style.opacity = '0';

      setTimeout(() => {
        uiState.isAnimating = false;
        store.decide(topItem.mediaKey, action);
      }, 220);
    }

    function attachCardDrag(cardEl, item) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dy = 0;

      const keepStamp = cardEl.querySelector('.spc-stamp.keep');
      const trashStamp = cardEl.querySelector('.spc-stamp.trash');
      const favStamp = cardEl.querySelector('.spc-stamp.fav');

      function resetStamps() {
        if (keepStamp) keepStamp.style.opacity = '0';
        if (trashStamp) trashStamp.style.opacity = '0';
        if (favStamp) favStamp.style.opacity = '0';
      }

      cardEl.addEventListener('pointerdown', (e) => {
        if (uiState.isAnimating) return;
        if (e.target && e.target.closest && e.target.closest('.spc-zoom-btn')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        dx = 0;
        dy = 0;
        cardEl.classList.remove('animating');
        cardEl.classList.add('dragging');
        if (cardEl.setPointerCapture) {
          try {
            cardEl.setPointerCapture(e.pointerId);
          } catch (_) {}
        }
      });

      cardEl.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        dx = e.clientX - startX;
        dy = e.clientY - startY;

        cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${dx * 0.04}deg)`;
        resetStamps();

        if (dy < -20 && Math.abs(dy) > Math.abs(dx) * 1.15) {
          if (favStamp) favStamp.style.opacity = String(Math.min(1, (-dy - 20) / 85));
        } else if (dx > 20) {
          if (keepStamp) keepStamp.style.opacity = String(Math.min(1, (dx - 20) / 90));
        } else if (dx < -20) {
          if (trashStamp) trashStamp.style.opacity = String(Math.min(1, (-dx - 20) / 90));
        }
      });

      function finishDrag() {
        if (!dragging) return;
        dragging = false;
        cardEl.classList.remove('dragging');

        if (dy < -95 && Math.abs(dy) > Math.abs(dx) * 1.15) {
          triggerSwipeAction('favorite');
          return;
        }
        if (dx > 105) {
          triggerSwipeAction('keep');
          return;
        }
        if (dx < -105) {
          triggerSwipeAction('trash');
          return;
        }

        // Snap smoothly back to center
        cardEl.classList.add('animating');
        cardEl.style.transform = '';
        resetStamps();
      }

      cardEl.addEventListener('pointerup', finishDrag);
      cardEl.addEventListener('pointercancel', finishDrag);
    }

    function renderMonths(buckets) {
      const selected = store.state.selectedMonth;
      const totalRemaining = buckets.reduce((acc, b) => acc + b.remainingCount, 0);
      const totalAll = buckets.reduce((acc, b) => acc + b.totalCount, 0);

      const pills = [
        `<button type="button" class="spc-month-pill ${selected === 'all' ? 'active' : ''}" data-month="all">
          <span class="spc-month-title">Tất cả tháng</span>
          <span class="spc-month-meta">Còn ${totalRemaining} / ${totalAll} mục</span>
        </button>`
      ];

      for (const b of buckets) {
        const isDone = b.remainingCount === 0;
        const trashBadge =
          b.trashCount > 0
            ? `<span class="spc-month-trash-tag">-${b.trashCount}${
                b.trashBytes > 0 ? ` • ${Formatters.formatBytes(b.trashBytes)}` : ''
              }</span>`
            : '';
        const sizeNote = b.totalBytes > 0 ? ` • ${Formatters.formatBytes(b.totalBytes)}` : '';
        pills.push(
          `<button type="button" class="spc-month-pill ${selected === b.monthKey ? 'active' : ''} ${
            isDone ? 'done' : ''
          }" data-month="${Formatters.escapeHtml(b.monthKey)}">
            <span class="spc-month-title">${Formatters.escapeHtml(b.label)} ${isDone ? '✓' : ''} ${trashBadge}</span>
            <span class="spc-month-meta">${
              isDone ? `Đã quẹt xong (${b.totalCount})` : `Còn ${b.remainingCount}/${b.totalCount}${sizeNote}`
            }</span>
          </button>`
        );
      }

      els.monthStrip.innerHTML = pills.join('');
    }

    function renderCardHtml(item, depthIndex) {
      const imgUrl = safeImageUrl(item.largeUrl || item.thumbUrl);
      const sizeText = Number.isFinite(item.sizeBytes)
        ? Formatters.formatBytes(item.sizeBytes)
        : 'Đang đo dung lượng...';
      const depthClass = depthIndex === 0 ? 'active' : depthIndex === 1 ? 'depth-1' : 'depth-2';
      const zoomClass = depthIndex === 0 && uiState.zoomed ? 'zoomed' : '';

      const badges = [];
      badges.push(`<span class="spc-badge">${Formatters.escapeHtml(Formatters.formatMonthLabel(item.monthKey))}</span>`);
      if (item.isScreenshot) {
        badges.push(`<span class="spc-badge screenshot">📱 Ảnh chụp màn hình</span>`);
      }
      if (item.mediaType === 'video') {
        badges.push(
          `<span class="spc-badge video">🎬 Video${
            item.durationText ? ` ${Formatters.escapeHtml(item.durationText)}` : ''
          }</span>`
        );
      }
      if (item.isAlreadyFavorite) {
        badges.push(`<span class="spc-badge fav">♥ Đã thích sẵn</span>`);
      }

      const subLine =
        item.filename ||
        item.ariaLabel ||
        (item.screenshotReason ? item.screenshotReason : 'Quẹt trái chờ xóa • Quẹt phải giữ • Quẹt lên yêu thích');

      return `
        <article class="spc-card ${depthClass} ${zoomClass}" data-media-key="${Formatters.escapeHtml(item.mediaKey)}">
          <div class="spc-card-media">
            ${
              imgUrl
                ? `<img class="spc-card-img" src="${Formatters.escapeHtml(imgUrl)}" alt="${Formatters.escapeHtml(
                    item.ariaLabel || 'Google Photo'
                  )}" draggable="false" />`
                : `<div class="spc-brand-sub">Không có ảnh xem trước</div>`
            }
            <div class="spc-card-top-badges">
              <div class="spc-badge-stack">${badges.join('')}</div>
              <span class="spc-badge size">${Formatters.escapeHtml(sizeText)}</span>
            </div>
            ${
              depthIndex === 0
                ? `<button type="button" class="spc-zoom-btn" id="spc-zoom-btn">${
                    uiState.zoomed ? 'Thu vừa (Space)' : '🔍 Soi nét (Space)'
                  }</button>`
                : ''
            }
            <div class="spc-stamp keep">GIỮ LẠI ✓</div>
            <div class="spc-stamp trash">CHỜ XÓA ${
              Number.isFinite(item.sizeBytes) ? `(-${Formatters.escapeHtml(Formatters.formatBytes(item.sizeBytes))})` : ''
            }</div>
            <div class="spc-stamp fav">YÊU THÍCH ♥</div>
          </div>
          <div class="spc-card-footer">
            <div class="spc-card-info-main">
              <div class="spc-card-date">${Formatters.escapeHtml(item.dateLabel || 'Chưa rõ ngày')}</div>
              <div class="spc-card-sub">${Formatters.escapeHtml(subLine)}</div>
            </div>
          </div>
        </article>
      `;
    }

    function renderDeck(deck, summary, buckets) {
      if (deck.length === 0) {
        els.cardDeck.classList.add('spc-hidden');
        els.cardDeck.innerHTML = '';
        els.emptyCard.classList.remove('spc-hidden');

        const selectedLabel = Formatters.formatMonthLabel(store.state.selectedMonth);
        const nextBucket = buckets.find((b) => b.remainingCount > 0 && b.monthKey !== store.state.selectedMonth);
        const hasPending = summary.pendingTrashCount > 0 || summary.pendingFavoriteCount > 0;

        els.emptyCard.innerHTML = `
          <div class="spc-empty-icon">${summary.totalKnownItems === 0 ? '📷' : '🎉'}</div>
          <div class="spc-empty-title">${
            summary.totalKnownItems === 0
              ? 'Chưa tìm thấy ảnh trên trang hiện tại'
              : `Đã quẹt xong: ${Formatters.escapeHtml(selectedLabel)}!`
          }</div>
          <div class="spc-empty-desc">${
            summary.totalKnownItems === 0
              ? 'Hãy đảm bảo bạn đang mở Thư viện Google Photos (hoặc Tìm kiếm), sau đó bấm "Quét lại" hoặc "Quét thêm tháng cũ".'
              : 'Bạn có thể chuyển sang tháng khác, quét thêm các tháng cũ hơn, hoặc xem lại thùng chờ xóa trước khi lưu vào Google Photos.'
          }</div>
          <div class="spc-empty-actions">
            ${
              nextBucket
                ? `<button type="button" class="spc-chip-btn active" id="spc-next-month-btn">Sang ${Formatters.escapeHtml(
                    nextBucket.label
                  )} (${nextBucket.remainingCount})</button>`
                : ''
            }
            <button type="button" class="spc-chip-btn" id="spc-empty-scan-btn">🔍 Quét thêm tháng cũ</button>
            ${
              hasPending
                ? `<button type="button" class="spc-review-cta" id="spc-empty-review-btn">Xem lại & Xác nhận (${summary.pendingTrashCount} xóa • ${Formatters.formatBytes(
                    summary.pendingTrashBytes
                  )})</button>`
                : ''
            }
            ${
              summary.keptCount > 0
                ? `<button type="button" class="spc-chip-btn" id="spc-reset-kept-btn">Quẹt lại ${summary.keptCount} ảnh đã Giữ</button>`
                : ''
            }
          </div>
        `;
        return;
      }

      els.emptyCard.classList.add('spc-hidden');
      els.cardDeck.classList.remove('spc-hidden');

      const visibleSlice = deck.slice(0, 3);
      // Render back-to-front so active card sits on top cleanly
      const htmlParts = [];
      for (let i = visibleSlice.length - 1; i >= 0; i--) {
        htmlParts.push(renderCardHtml(visibleSlice[i], i));
      }
      els.cardDeck.innerHTML = htmlParts.join('');

      const activeCard = els.cardDeck.querySelector('.spc-card.active');
      if (activeCard) {
        attachCardDrag(activeCard, visibleSlice[0]);
        const zoomBtn = activeCard.querySelector('#spc-zoom-btn');
        if (zoomBtn) {
          zoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiState.zoomed = !uiState.zoomed;
            activeCard.classList.toggle('zoomed', uiState.zoomed);
            zoomBtn.textContent = uiState.zoomed ? 'Thu vừa (Space)' : '🔍 Soi nét (Space)';
          });
        }
      }

      if (onNeedSizes) {
        onNeedSizes(deck.slice(0, 8));
      }
    }

    function renderReview() {
      const summary = store.getSummary();
      const totalPending = summary.pendingTrashCount + summary.pendingFavoriteCount;
      const freedText = Formatters.formatBytes(summary.pendingTrashBytes);

      const unknownNote =
        summary.unknownSizeTrashCount > 0
          ? ` (${summary.unknownSizeTrashCount} mục chưa đo được dung lượng — có thể đo thêm từ Info)`
          : '';

      const breakdownHtml = summary.byMonthTrashBreakdown
        .map(
          (m) =>
            `<span class="spc-breakdown-chip">${Formatters.escapeHtml(m.label)}: <strong>${m.count}</strong> mục (${Formatters.escapeHtml(
              Formatters.formatBytes(m.bytes)
            )})</span>`
        )
        .join('');

      const trashGridHtml = summary.pendingTrashItems
        .map((item) => {
          const thumb = safeImageUrl(item.thumbUrl || item.largeUrl);
          return `
            <div class="spc-review-tile">
              <div class="spc-review-thumb-wrap">
                ${
                  thumb
                    ? `<img class="spc-review-thumb" src="${Formatters.escapeHtml(thumb)}" alt="" />`
                    : ''
                }
                <span class="spc-review-size">${Formatters.escapeHtml(Formatters.formatBytes(item.sizeBytes))}</span>
              </div>
              <div class="spc-review-meta">
                <div class="spc-review-date">${Formatters.escapeHtml(item.dateLabel || item.monthKey)}</div>
                <button type="button" class="spc-rescue-btn" data-rescue-id="${Formatters.escapeHtml(
                  item.mediaKey
                )}">↩ Giữ lại</button>
              </div>
            </div>
          `;
        })
        .join('');

      const favGridHtml = summary.pendingFavoriteItems
        .map((item) => {
          const thumb = safeImageUrl(item.thumbUrl || item.largeUrl);
          return `
            <div class="spc-review-tile">
              <div class="spc-review-thumb-wrap">
                ${
                  thumb
                    ? `<img class="spc-review-thumb" src="${Formatters.escapeHtml(thumb)}" alt="" />`
                    : ''
                }
                <span class="spc-review-size">♥ Yêu thích</span>
              </div>
              <div class="spc-review-meta">
                <div class="spc-review-date">${Formatters.escapeHtml(item.dateLabel || item.monthKey)}</div>
                <button type="button" class="spc-rescue-btn" data-unfav-id="${Formatters.escapeHtml(
                  item.mediaKey
                )}">✕ Bỏ hàng đợi</button>
              </div>
            </div>
          `;
        })
        .join('');

      els.reviewBody.innerHTML = `
        <div class="spc-hero-savings">
          <div>
            <div class="spc-hero-label">TỔNG DUNG LƯỢNG DỰ KIẾN GIẢI PHÓNG</div>
            <div class="spc-hero-gb">${Formatters.escapeHtml(freedText)}</div>
            <div class="spc-hero-sub">
              🗑️ ${summary.pendingTrashCount} mục vào Thùng rác • ♥ ${summary.pendingFavoriteCount} mục gắn Yêu thích${Formatters.escapeHtml(
        unknownNote
      )}
            </div>
          </div>
          ${
            summary.unknownSizeTrashCount > 0 && onMeasureUnknownSizes
              ? `<button type="button" class="spc-chip-btn" id="spc-measure-unknown-btn" ${
                  uiState.isMeasuringSizes ? 'disabled' : ''
                }>${uiState.isMeasuringSizes ? '⏳ Đang đo từ Info...' : '📏 Đo chính xác mục chưa rõ'}</button>`
              : ''
          }
        </div>

        ${
          breakdownHtml
            ? `<div>
                <div class="spc-section-title">Phân bổ dung lượng sẽ dọn theo tháng</div>
                <div class="spc-breakdown-row" style="margin-top:8px">${breakdownHtml}</div>
              </div>`
            : ''
        }

        <div class="spc-safety-note">
          🛡️ <strong>Cơ chế an toàn:</strong> Thao tác này sẽ lưu sao <strong>Yêu thích</strong> và chuyển ảnh đã chọn vào <strong>Thùng rác (Trash)</strong> thật trên tài khoản Google Photos của bạn. Ảnh trong Thùng rác vẫn được Google giữ 60 ngày để khôi phục nếu cần.
        </div>

        ${
          summary.pendingTrashItems.length > 0
            ? `<div>
                <div class="spc-section-title">Ảnh chờ chuyển vào Thùng rác (${summary.pendingTrashItems.length})</div>
                <div class="spc-review-grid" style="margin-top:8px">${trashGridHtml}</div>
              </div>`
            : '<div class="spc-brand-sub">Chưa có ảnh nào trong thùng chờ xóa.</div>'
        }

        ${
          summary.pendingFavoriteItems.length > 0
            ? `<div>
                <div class="spc-section-title">Ảnh chờ lưu Yêu thích ♥ (${summary.pendingFavoriteItems.length})</div>
                <div class="spc-review-grid" style="margin-top:8px">${favGridHtml}</div>
              </div>`
            : ''
        }
      `;

      els.commitBtn.disabled = totalPending === 0 || (isTrashViewFn && isTrashViewFn());
      if (summary.pendingTrashCount > 0 && summary.pendingFavoriteCount > 0) {
        els.commitBtn.textContent = `Lưu ${summary.pendingFavoriteCount} ♥ & Chuyển ${summary.pendingTrashCount} ảnh vào Thùng rác (${freedText})`;
      } else if (summary.pendingTrashCount > 0) {
        els.commitBtn.textContent = `Chuyển ${summary.pendingTrashCount} ảnh vào Thùng rác Google Photos (${freedText})`;
      } else if (summary.pendingFavoriteCount > 0) {
        els.commitBtn.textContent = `Lưu ${summary.pendingFavoriteCount} ảnh Yêu thích vào Google Photos`;
      } else {
        els.commitBtn.textContent = 'Chưa có thay đổi nào để lưu';
      }
    }

    function render() {
      const summary = store.getSummary();
      const buckets = store.getMonthBuckets();
      const deck = store.getDeckItems();

      // Update floating launcher badge
      const badgeTotal = summary.pendingTrashCount + summary.pendingFavoriteCount;
      if (badgeTotal > 0) {
        els.launcherBadge.textContent = `${summary.pendingTrashCount} xóa • ${Formatters.formatBytes(
          summary.pendingTrashBytes
        )}`;
        els.launcherBadge.classList.remove('spc-hidden');
      } else {
        els.launcherBadge.classList.add('spc-hidden');
      }

      if (!uiState.isOpen) return;

      const onTrash = Boolean(isTrashViewFn && isTrashViewFn());
      els.trashWarning.classList.toggle('spc-hidden', !onTrash);

      els.brandSub.textContent = `Đã tải ${summary.totalKnownItems} mục (${buckets.length} tháng) • Đã giữ ${summary.keptCount}`;

      // Filter button active states
      const filterBtns = els.filters.querySelectorAll('[data-filter]');
      for (const btn of filterBtns) {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === store.state.activeFilter);
      }

      // Top Review CTA pill
      const freed = Formatters.formatBytes(summary.pendingTrashBytes);
      if (badgeTotal > 0) {
        els.openReviewBtn.classList.remove('empty');
        els.reviewCtaText.textContent = `🗑️ ${summary.pendingTrashCount} chờ xóa (${freed})${
          summary.pendingFavoriteCount > 0 ? ` • ♥ ${summary.pendingFavoriteCount}` : ''
        } → Xem & Xóa`;
      } else {
        els.openReviewBtn.classList.add('empty');
        els.reviewCtaText.textContent = '🗑️ 0 chờ xóa • 0 B';
      }

      // Dock button enable states
      const hasCard = deck.length > 0;
      els.btnUndo.disabled = summary.undoCount === 0;
      els.btnTrash.disabled = !hasCard;
      els.btnFav.disabled = !hasCard;
      els.btnKeep.disabled = !hasCard;

      renderMonths(buckets);
      renderDeck(deck, summary, buckets);
      if (uiState.isReviewOpen) {
        renderReview();
      }
    }

    // Event bindings
    els.launcherBtn.addEventListener('click', open);
    els.closeBtn.addEventListener('click', close);
    els.openReviewBtn.addEventListener('click', openReview);
    els.reviewCloseBtn.addEventListener('click', closeReview);
    els.reviewBackBtn.addEventListener('click', closeReview);

    els.refreshBtn.addEventListener('click', () => {
      if (onRefreshScan) onRefreshScan();
      showToast('Đã quét lại các ảnh đang hiển thị!');
    });

    els.deepScanBtn.addEventListener('click', () => {
      if (onToggleDeepScan) onToggleDeepScan();
    });

    if (els.goLibraryBtn) {
      els.goLibraryBtn.addEventListener('click', () => {
        if (onJumpToLibrary) onJumpToLibrary();
      });
    }

    els.filters.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('[data-filter]');
      if (!btn) return;
      store.setActiveFilter(btn.getAttribute('data-filter'));
    });

    els.monthStrip.addEventListener('click', (e) => {
      const pill = e.target.closest && e.target.closest('[data-month]');
      if (!pill) return;
      uiState.zoomed = false;
      store.setSelectedMonth(pill.getAttribute('data-month'));
    });

    els.emptyCard.addEventListener('click', (e) => {
      const target = e.target.closest && e.target.closest('button');
      if (!target) return;
      if (target.id === 'spc-next-month-btn') {
        const buckets = store.getMonthBuckets();
        const nextBucket = buckets.find((b) => b.remainingCount > 0 && b.monthKey !== store.state.selectedMonth);
        if (nextBucket) store.setSelectedMonth(nextBucket.monthKey);
      } else if (target.id === 'spc-empty-scan-btn') {
        if (onToggleDeepScan) onToggleDeepScan();
      } else if (target.id === 'spc-empty-review-btn') {
        openReview();
      } else if (target.id === 'spc-reset-kept-btn') {
        const count = store.resetKeptDecisions();
        showToast(`Đã khôi phục ${count} ảnh về hàng đợi để quẹt lại.`);
      }
    });

    els.btnUndo.addEventListener('click', () => {
      const undone = store.undo();
      if (undone) showToast('Đã hoàn tác thao tác vừa rồi');
    });
    els.btnTrash.addEventListener('click', () => triggerSwipeAction('trash'));
    els.btnFav.addEventListener('click', () => triggerSwipeAction('favorite'));
    els.btnKeep.addEventListener('click', () => triggerSwipeAction('keep'));

    els.reviewBody.addEventListener('click', (e) => {
      const rescueBtn = e.target.closest && e.target.closest('[data-rescue-id]');
      if (rescueBtn) {
        store.rescueFromTrash(rescueBtn.getAttribute('data-rescue-id'));
        return;
      }
      const unfavBtn = e.target.closest && e.target.closest('[data-unfav-id]');
      if (unfavBtn) {
        store.removeFavoritePending(unfavBtn.getAttribute('data-unfav-id'));
        return;
      }
      const measureBtn = e.target.closest && e.target.closest('#spc-measure-unknown-btn');
      if (measureBtn && onMeasureUnknownSizes && !uiState.isMeasuringSizes) {
        uiState.isMeasuringSizes = true;
        renderReview();
        close();
        onMeasureUnknownSizes()
          .catch(() => {})
          .finally(() => {
            uiState.isMeasuringSizes = false;
            open();
            openReview();
          });
      }
    });

    els.commitBtn.addEventListener('click', () => {
      const summary = store.getSummary();
      if (summary.pendingTrashCount === 0 && summary.pendingFavoriteCount === 0) return;
      closeReview();
      close();
      if (onCommit) {
        onCommit({
          favoriteItems: summary.pendingFavoriteItems,
          trashItems: summary.pendingTrashItems
        });
      }
    });

    els.hudAbortBtn.addEventListener('click', () => {
      if (onAbortCommit) onAbortCommit();
    });

    // Global keyboard controls only while overlay is open
    function onKeyDown(e) {
      if (!uiState.isOpen || uiState.isCommitting) return;
      const activeTag = doc.activeElement && doc.activeElement.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const key = e.key;
      const handled = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'a',
        'A',
        'd',
        'D',
        'w',
        'W',
        'f',
        'F',
        'z',
        'Z',
        'Backspace',
        'Escape',
        ' ',
        'r',
        'R'
      ];
      if (!handled.includes(key)) return;

      e.preventDefault();
      e.stopPropagation();

      if (key === 'Escape') {
        if (uiState.isReviewOpen) closeReview();
        else close();
        return;
      }

      if (uiState.isReviewOpen) return;

      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        triggerSwipeAction('keep');
      } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        triggerSwipeAction('trash');
      } else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'f' || key === 'F') {
        triggerSwipeAction('favorite');
      } else if (key === 'z' || key === 'Z' || key === 'Backspace') {
        const undone = store.undo();
        if (undone) showToast('Đã hoàn tác');
      } else if (key === ' ') {
        const activeCard = els.cardDeck.querySelector('.spc-card.active');
        if (activeCard) {
          uiState.zoomed = !uiState.zoomed;
          activeCard.classList.toggle('zoomed', uiState.zoomed);
          const zoomBtn = activeCard.querySelector('#spc-zoom-btn');
          if (zoomBtn) zoomBtn.textContent = uiState.zoomed ? 'Thu vừa (Space)' : '🔍 Soi nét (Space)';
        }
      } else if (key === 'r' || key === 'R') {
        openReview();
      }
    }

    root.addEventListener('keydown', onKeyDown, true);
    store.subscribe(render);
    render();

    return {
      host,
      shadow,
      open,
      close,
      toggle,
      openReview,
      closeReview,
      render,
      setScanning,
      setCommitState,
      showToast,
      triggerSwipeAction,
      destroy() {
        root.removeEventListener('keydown', onKeyDown, true);
        host.remove();
      }
    };
  }

  const api = { createSwipeOverlay };
  root.SPCSwipeOverlay = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
