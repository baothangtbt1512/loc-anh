'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseGooglePhotosDate, timestampToMonthInfo } = require('../src/utils/date_parser.js');

const REF_NOW = new Date(2026, 10, 13, 12, 0, 0); // 2026-11-13

test('parseGooglePhotosDate parses Vietnamese date formats and headers', () => {
  const r1 = parseGooglePhotosDate('Ảnh - 12 thg 11, 2026, 14:22', REF_NOW);
  assert.equal(r1.monthKey, '2026-11');
  assert.equal(r1.day, 12);

  const r2 = parseGooglePhotosDate('Tháng 10 năm 2026', REF_NOW);
  assert.equal(r2.monthKey, '2026-10');
  assert.equal(r2.hasDay, false);

  const r3 = parseGooglePhotosDate('Hôm qua', REF_NOW);
  assert.equal(r3.monthKey, '2026-11');
  assert.equal(r3.day, 12);

  const r4 = parseGooglePhotosDate('15 tháng 9, 2025', REF_NOW);
  assert.equal(r4.monthKey, '2025-09');
  assert.equal(r4.day, 15);
});

test('parseGooglePhotosDate parses English, ISO, and numeric formats', () => {
  const e1 = parseGooglePhotosDate('Photo - Portrait - Nov 8, 2026, 2:15 PM', REF_NOW);
  assert.equal(e1.monthKey, '2026-11');
  assert.equal(e1.day, 8);

  const e2 = parseGooglePhotosDate('September 2025', REF_NOW);
  assert.equal(e2.monthKey, '2025-09');

  const e3 = parseGooglePhotosDate('2026-08-19', REF_NOW);
  assert.equal(e3.monthKey, '2026-08');
  assert.equal(e3.day, 19);

  const e4 = parseGooglePhotosDate('25/07/2026', REF_NOW);
  assert.equal(e4.monthKey, '2026-07');
  assert.equal(e4.day, 25);
});

test('parseGooglePhotosDate infers previous year when omitted date is in the future', () => {
  const dec = parseGooglePhotosDate('20 thg 12', REF_NOW);
  assert.equal(dec.monthKey, '2025-12');

  const oct = parseGooglePhotosDate('Oct 5', REF_NOW);
  assert.equal(oct.monthKey, '2026-10');
});

test('timestampToMonthInfo converts epoch ms and seconds', () => {
  const tsMs = new Date(2026, 9, 21, 9, 30).getTime();
  assert.equal(timestampToMonthInfo(tsMs).monthKey, '2026-10');
  assert.equal(timestampToMonthInfo(Math.floor(tsMs / 1000)).monthKey, '2026-10');
  assert.equal(timestampToMonthInfo(-1), null);
});
