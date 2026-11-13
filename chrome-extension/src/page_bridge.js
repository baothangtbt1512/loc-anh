(function () {
  'use strict';

  const CHANNEL = 'SPC_MAIN_TO_ISO';
  const MEDIA_KEY_RE = /^AF1Qip[A-Za-z0-9_-]{20,}$/;
  const IMAGE_URL_RE = /^https:\/\/lh\d+\.googleusercontent\.com\/.+$/;
  const FILENAME_RE = /^[^\\/:*?"<>|\r\n]{1,160}\.(?:jpe?g|png|heic|heif|webp|gif|dng|raw|mp4|mov|m4v|mkv|avi|3gp)$/i;
  const MIN_TS_MS = 946684800000; // 2000-01-01
  const MAX_TS_MS = 2524608000000; // 2050-01-01

  function postHints(items) {
    if (!items || items.length === 0) return;
    try {
      window.postMessage(
        {
          __spcChannel: CHANNEL,
          type: 'MEDIA_HINTS',
          items
        },
        window.location.origin
      );
    } catch (_) {
      // Ignore cross-origin postMessage errors
    }
  }

  function extractMediaTuple(arr) {
    if (!Array.isArray(arr) || arr.length < 3) return null;
    if (typeof arr[0] !== 'string' || !MEDIA_KEY_RE.test(arr[0])) return null;

    const mediaKey = arr[0];
    let baseUrl = '';
    let width = null;
    let height = null;
    let takenAtMs = null;
    let filename = '';

    // Inspect shallow fields of the item tuple
    for (let i = 1; i < Math.min(arr.length, 16); i++) {
      const val = arr[i];
      if (Array.isArray(val) && !baseUrl) {
        if (typeof val[0] === 'string' && IMAGE_URL_RE.test(val[0])) {
          baseUrl = val[0];
          if (Number.isInteger(val[1]) && val[1] > 0 && val[1] < 50000) width = val[1];
          if (Number.isInteger(val[2]) && val[2] > 0 && val[2] < 50000) height = val[2];
        }
      } else if (typeof val === 'number' && !takenAtMs && val >= MIN_TS_MS && val <= MAX_TS_MS) {
        takenAtMs = val;
      } else if (typeof val === 'string' && !filename && FILENAME_RE.test(val)) {
        filename = val;
      }
    }

    if (!baseUrl && !takenAtMs) return null;
    return {
      mediaKey,
      baseUrl,
      width,
      height,
      takenAtMs,
      hasExactTimestamp: Boolean(takenAtMs),
      filename
    };
  }

  function walkForMediaHints(node, outMap, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 18) return;
    if (Array.isArray(node)) {
      const candidate = extractMediaTuple(node);
      if (candidate) {
        const prev = outMap.get(candidate.mediaKey);
        if (!prev || (!prev.baseUrl && candidate.baseUrl)) {
          outMap.set(candidate.mediaKey, candidate);
        }
      }
      for (let i = 0; i < node.length; i++) {
        walkForMediaHints(node[i], outMap, depth + 1);
      }
    } else {
      const values = Object.values(node);
      for (let i = 0; i < values.length; i++) {
        walkForMediaHints(values[i], outMap, depth + 1);
      }
    }
  }

  function parseBatchexecutePayload(rawText) {
    if (!rawText || typeof rawText !== 'string') return;
    const cleaned = rawText.replace(/^\)\]\}'\s*\n?/, '');
    const outMap = new Map();

    // batchexecute returns length-prefixed chunks or JSON lines
    const lines = cleaned.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '{')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        walkForMediaHints(parsed, outMap, 0);
        // Unwrap nested JSON string inside wrb.fr envelope: ["wrb.fr", rpcId, "<json>", ...]
        if (Array.isArray(parsed)) {
          for (const frame of parsed) {
            if (Array.isArray(frame) && frame[0] === 'wrb.fr' && typeof frame[2] === 'string') {
              try {
                const inner = JSON.parse(frame[2]);
                walkForMediaHints(inner, outMap, 0);
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }

    if (outMap.size > 0) {
      postHints(Array.from(outMap.values()));
    }
  }

  function hookFetch() {
    const origFetch = window.fetch;
    if (typeof origFetch !== 'function') return;

    window.fetch = function (...args) {
      const promise = origFetch.apply(this, args);
      try {
        const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        if (reqUrl.includes('batchexecute') || reqUrl.includes('PhotosUi')) {
          promise
            .then((response) => {
              if (!response || !response.ok) return;
              const cloned = response.clone();
              cloned.text().then(parseBatchexecutePayload).catch(() => {});
            })
            .catch(() => {});
        }
      } catch (_) {}
      return promise;
    };
  }

  function hookXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__spcUrl = typeof url === 'string' ? url : '';
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      try {
        if (this.__spcUrl && (this.__spcUrl.includes('batchexecute') || this.__spcUrl.includes('PhotosUi'))) {
          this.addEventListener('load', function () {
            try {
              if (typeof this.responseText === 'string') {
                parseBatchexecutePayload(this.responseText);
              }
            } catch (_) {}
          });
        }
      } catch (_) {}
      return origSend.apply(this, args);
    };
  }

  function extractBalancedJsonArray(text, startIdx) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '[') {
        depth++;
      } else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return text.slice(startIdx, i + 1);
        }
      }
    }
    return null;
  }

  function scanInitialScriptData() {
    try {
      const scripts = document.querySelectorAll('script');
      const outMap = new Map();
      for (const s of scripts) {
        const txt = s.textContent || '';
        if (!txt.includes('AF1Qip') || !txt.includes('AF_initDataCallback')) continue;
        const dataIdx = txt.indexOf('data:');
        if (dataIdx === -1) continue;
        const startBracket = txt.indexOf('[', dataIdx);
        if (startBracket === -1) continue;
        const jsonSlice = extractBalancedJsonArray(txt, startBracket);
        if (!jsonSlice) continue;
        try {
          const parsed = JSON.parse(jsonSlice);
          walkForMediaHints(parsed, outMap, 0);
        } catch (_) {}
      }
      if (outMap.size > 0) {
        postHints(Array.from(outMap.values()));
      }
    } catch (_) {}
  }

  hookFetch();
  hookXhr();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanInitialScriptData, { once: true });
  } else {
    scanInitialScriptData();
  }
})();
