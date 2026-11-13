(function (root) {
  'use strict';

  const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

  /**
   * Format byte count into human-readable storage string (e.g. "1.42 GB").
   */
  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
      return 'Chưa rõ';
    }
    if (bytes === 0) return '0 B';
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    const decimals = exponent === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${BYTE_UNITS[exponent]}`;
  }

  /**
   * Parse localized size strings from Google Photos Info panel (e.g., "14,2 MB", "1.4 GB", "850 KB").
   */
  function parseHumanFileSize(text) {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(TB|TiB|GB|GiB|MB|MiB|KB|KiB|B|bytes?)\b/i);
    if (!match) return null;

    const numeric = parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric < 0) return null;

    const unit = match[2].toUpperCase();
    const multipliers = {
      B: 1,
      BYTE: 1,
      BYTES: 1,
      KB: 1024,
      KIB: 1024,
      MB: 1024 * 1024,
      MIB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      GIB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
      TIB: 1024 * 1024 * 1024 * 1024
    };
    const multiplier = multipliers[unit];
    if (!multiplier) return null;
    return Math.round(numeric * multiplier);
  }

  /**
   * Strip Google Photos CDN sizing flags (e.g. =w240-h240-no) to retrieve base URL.
   */
  function extractGoogleBaseUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (!/googleusercontent\.com/i.test(url)) return url;
    const slashIdx = url.lastIndexOf('/');
    const eqIdx = url.indexOf('=', slashIdx + 1);
    return eqIdx === -1 ? url : url.slice(0, eqIdx);
  }

  /**
   * Upgrade a Google Photos thumbnail URL to crisp card display resolution.
   */
  function upgradeGooglePhotoUrl(url, maxDim = 1600) {
    if (!url || typeof url !== 'string') return '';
    if (!/googleusercontent\.com/i.test(url)) return url;
    const base = extractGoogleBaseUrl(url);
    return `${base}=w${maxDim}-h${maxDim}`;
  }

  /**
   * Build candidate original-asset URLs for HEAD / Range byte probing.
   */
  function buildProbeUrls(url) {
    if (!url || typeof url !== 'string' || !/googleusercontent\.com/i.test(url)) {
      return [];
    }
    const base = extractGoogleBaseUrl(url);
    return [`${base}=d`, `${base}=s0`];
  }

  /**
   * Convert "YYYY-MM" into Vietnamese month header label.
   */
  function formatMonthLabel(monthKey) {
    if (!monthKey || monthKey === 'unknown') return 'Không rõ tháng';
    if (monthKey === 'all') return 'Tất cả tháng';
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
    if (!match) return monthKey;
    return `Tháng ${Number(match[2])}/${match[1]}`;
  }

  /**
   * Format timestamp (ms) for card badge display.
   */
  function formatDateDisplay(timestampMs, fallbackLabel) {
    if (Number.isFinite(timestampMs) && timestampMs > 0) {
      const d = new Date(timestampMs);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} • ${hours}:${mins}`;
    }
    return fallbackLabel || 'Chưa rõ ngày';
  }

  /**
   * Detect whether a media item is likely a screenshot using filename, labels, or screen aspect ratio.
   */
  function detectScreenshotClue(item) {
    const filename = (item.filename || '').toLowerCase();
    const aria = (item.ariaLabel || '').toLowerCase();

    if (/screenshot|screen[_\s-]?shot|ảnh chụp màn hình|chup man hinh|screencap|snip/.test(filename)) {
      return { isScreenshot: true, reason: 'Tên tệp Screenshot' };
    }
    if (/screenshot|ảnh chụp màn hình/.test(aria)) {
      return { isScreenshot: true, reason: 'Nhãn Screenshot' };
    }
    if (/\.png$/i.test(filename) && item.width && item.height) {
      const ratio = Math.max(item.width, item.height) / Math.min(item.width, item.height);
      if (ratio >= 1.7 && ratio <= 2.35) {
        return { isScreenshot: true, reason: 'PNG tỉ lệ màn hình' };
      }
    }
    return { isScreenshot: false, reason: null };
  }

  /**
   * Escape HTML special characters before interpolating user/DOM text into templates.
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = {
    formatBytes,
    parseHumanFileSize,
    extractGoogleBaseUrl,
    upgradeGooglePhotoUrl,
    buildProbeUrls,
    formatMonthLabel,
    formatDateDisplay,
    detectScreenshotClue,
    escapeHtml
  };

  root.SPCFormatters = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
