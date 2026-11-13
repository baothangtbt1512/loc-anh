'use strict';

const sizeCache = new Map();
const inflightProbes = new Map();

function parseContentRangeTotal(headerValue) {
  if (!headerValue) return null;
  const match = headerValue.match(/\/(\d+)\s*$/);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

async function probeSingleUrl(url) {
  // 1. Try lightweight HEAD request first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'HEAD',
      credentials: 'include',
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const lenHeader = res.headers.get('content-length');
      const len = lenHeader ? Number(lenHeader) : NaN;
      if (Number.isFinite(len) && len > 0) {
        return len;
      }
    }
  } catch (_) {
    // Fall through to Range probe
  }

  // 2. Fallback: GET with Range: bytes=0-0 and immediately abort body transfer
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal
    });
    clearTimeout(timer);

    const rangeTotal = parseContentRangeTotal(res.headers.get('content-range'));
    const lenHeader = res.headers.get('content-length');
    const len = lenHeader ? Number(lenHeader) : NaN;
    controller.abort();

    if (rangeTotal) return rangeTotal;
    if (res.status === 200 && Number.isFinite(len) && len > 0) return len;
  } catch (_) {
    clearTimeout(timer);
    controller.abort();
  }
  return null;
}

async function probeCandidateUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const cacheKey = urls[0];
  if (sizeCache.has(cacheKey)) {
    return sizeCache.get(cacheKey);
  }
  if (inflightProbes.has(cacheKey)) {
    return inflightProbes.get(cacheKey);
  }

  const task = (async () => {
    for (const url of urls) {
      if (!url || !/^https:\/\/[^/]*googleusercontent\.com\//i.test(url)) continue;
      const bytes = await probeSingleUrl(url);
      if (Number.isFinite(bytes) && bytes > 0) {
        if (sizeCache.size > 4000) sizeCache.clear();
        sizeCache.set(cacheKey, bytes);
        return bytes;
      }
    }
    return null;
  })();

  inflightProbes.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inflightProbes.delete(cacheKey);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'PROBE_FILE_SIZE') {
    probeCandidateUrls(message.urls)
      .then((bytes) => sendResponse({ ok: true, bytes }))
      .catch(() => sendResponse({ ok: false, bytes: null }));
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-swipe-cleaner') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url && tab.url.startsWith('https://photos.google.com/')) {
      await chrome.tabs.sendMessage(tab.id, { type: 'SPC_TOGGLE_OVERLAY' });
    }
  } catch (_) {
    // Ignore if content script isn't ready on the current tab
  }
});
