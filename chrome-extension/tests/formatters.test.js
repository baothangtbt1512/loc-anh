'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatBytes,
  parseHumanFileSize,
  extractGoogleBaseUrl,
  upgradeGooglePhotoUrl,
  buildProbeUrls,
  formatMonthLabel,
  detectScreenshotClue,
  escapeHtml
} = require('../src/utils/formatters.js');

test('formatBytes formats bytes cleanly across B, KB, MB, GB', () => {
  assert.equal(formatBytes(null), 'Chưa rõ');
  assert.equal(formatBytes(undefined), 'Chưa rõ');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(840 * 1024), '840 KB');
  assert.equal(formatBytes(3.42 * 1024 * 1024), '3.42 MB');
  assert.equal(formatBytes(1.42 * 1024 * 1024 * 1024), '1.42 GB');
});

test('parseHumanFileSize parses English and Vietnamese size strings', () => {
  assert.equal(parseHumanFileSize('3.4 MB'), Math.round(3.4 * 1024 * 1024));
  assert.equal(parseHumanFileSize('14,2 MB'), Math.round(14.2 * 1024 * 1024));
  assert.equal(parseHumanFileSize('1.5 GB'), Math.round(1.5 * 1024 * 1024 * 1024));
  assert.equal(parseHumanFileSize('850 KB'), 850 * 1024);
  assert.equal(parseHumanFileSize('not a size'), null);
});

test('Google Photos URL helpers upgrade size safely and preserve non-Google URLs', () => {
  const thumb = 'https://lh3.googleusercontent.com/pw/AB12345=w240-h240-no';
  assert.equal(extractGoogleBaseUrl(thumb), 'https://lh3.googleusercontent.com/pw/AB12345');
  assert.equal(upgradeGooglePhotoUrl(thumb, 1600), 'https://lh3.googleusercontent.com/pw/AB12345=w1600-h1600');
  assert.deepEqual(buildProbeUrls(thumb), [
    'https://lh3.googleusercontent.com/pw/AB12345=d',
    'https://lh3.googleusercontent.com/pw/AB12345=s0'
  ]);

  const dataUri = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E';
  assert.equal(upgradeGooglePhotoUrl(dataUri, 1600), dataUri);
  assert.deepEqual(buildProbeUrls(dataUri), []);
});

test('formatMonthLabel and detectScreenshotClue work properly', () => {
  assert.equal(formatMonthLabel('2026-11'), 'Tháng 11/2026');
  assert.equal(formatMonthLabel('2026-03'), 'Tháng 3/2026');
  assert.equal(formatMonthLabel('unknown'), 'Không rõ tháng');

  assert.deepEqual(detectScreenshotClue({ filename: 'Screenshot_20261112.png' }), {
    isScreenshot: true,
    reason: 'Tên tệp Screenshot'
  });
  assert.deepEqual(detectScreenshotClue({ filename: 'IMG_1020.png', width: 1170, height: 2532 }), {
    isScreenshot: true,
    reason: 'PNG tỉ lệ màn hình'
  });
  assert.deepEqual(detectScreenshotClue({ filename: 'DSC_0001.jpg', width: 4000, height: 3000 }), {
    isScreenshot: false,
    reason: null
  });
});

test('escapeHtml escapes dangerous HTML characters', () => {
  assert.equal(escapeHtml('<script>"alert(\'1\')&"</script>'), '&lt;script&gt;&quot;alert(&#39;1&#39;)&amp;&quot;&lt;/script&gt;');
});
