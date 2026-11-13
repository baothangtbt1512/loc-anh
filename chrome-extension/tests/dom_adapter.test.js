'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Adapter = require('../src/google_photos_adapter.js');

function createMockElement(tag, attrs = {}, textContent = '') {
  const children = [];
  const listeners = new Map();
  const attrMap = new Map(Object.entries(attrs));

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parentElement: null,
    textContent,
    style: {},
    offsetParent: {},
    getAttribute(name) {
      return attrMap.has(name) ? attrMap.get(name) : null;
    },
    setAttribute(name, val) {
      attrMap.set(name, String(val));
    },
    appendChild(child) {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      const list = listeners.get(evt.type) || [];
      for (const fn of list) fn(evt);
      return true;
    },
    scrollIntoView() {},
    getBoundingClientRect() {
      let cur = el;
      while (cur) {
        if (cur.offsetParent === null) return { top: 0, left: 0, width: 0, height: 0 };
        cur = cur.parentElement;
      }
      return { top: 100, left: 0, width: 120, height: 120 };
    },
    closest(selector) {
      if (selector === '#spc-shadow-host') return null;
      return null;
    },
    querySelectorAll(selector) {
      const results = [];
      const selectors = selector.split(',').map((s) => s.trim());
      function matchSingle(node, sel) {
        if (sel === 'a[href*="/photo/"]') {
          return node.tagName === 'A' && (node.getAttribute('href') || '').includes('/photo/');
        }
        if (sel === '[role="checkbox"]') return node.getAttribute('role') === 'checkbox';
        if (sel === 'h2') return node.tagName === 'H2';
        if (sel === 'button') return node.tagName === 'BUTTON';
        if (sel === '[role="button"]') return node.getAttribute('role') === 'button';
        if (sel === '[role="dialog"]') return node.getAttribute('role') === 'dialog';
        if (sel === '[aria-modal="true"]') return node.getAttribute('aria-modal') === 'true';
        if (sel === 'img[src]') return node.tagName === 'IMG' && Boolean(node.getAttribute('src'));
        if (sel === 'img') return node.tagName === 'IMG';
        return false;
      }
      function walk(node) {
        for (const c of node.children) {
          if (selectors.some((s) => matchSingle(c, s))) results.push(c);
          walk(c);
        }
      }
      walk(el);
      return results;
    },
    querySelector(selector) {
      return el.querySelectorAll(selector)[0] || null;
    }
  };
  return el;
}

test('Adapter extracts mediaKey, guards against /trash, and commits favorite + trash against mock DOM', async () => {
  assert.equal(Adapter.extractMediaKeyFromHref('/photo/AF1QipAbc123456'), 'AF1QipAbc123456');
  assert.equal(Adapter.extractMediaKeyFromHref('https://photos.google.com/u/0/photo/AF1QipXYZ?hl=vi'), 'AF1QipXYZ');
  assert.equal(Adapter.isTrashView({ pathname: '/trash' }), true);
  assert.equal(Adapter.isTrashView({ pathname: '/' }), false);

  // Build minimal mock DOM simulating Google Photos grid + lightbox + confirmation dialog
  const doc = {
    body: createMockElement('body'),
    documentElement: createMockElement('html'),
    activeElement: null,
    querySelectorAll(sel) {
      return doc.body.querySelectorAll(sel);
    },
    querySelector(sel) {
      return doc.body.querySelector(sel);
    }
  };
  doc.scrollingElement = doc.documentElement;
  doc.activeElement = doc.body;

  const main = createMockElement('main', { role: 'main' });
  doc.body.appendChild(main);

  const heading = createMockElement('h2', {}, '12 thg 11, 2026');
  main.appendChild(heading);

  const tile1 = createMockElement('div');
  const link1 = createMockElement('a', {
    href: '/photo/AF1QipMockTrash01',
    'aria-label': 'Ảnh - 12 thg 11, 2026',
    'data-spc-size': '2048000'
  });
  link1.appendChild(createMockElement('img', { src: 'https://lh3.googleusercontent.com/mock1=w200-h200' }));
  const cb1 = createMockElement('div', { role: 'checkbox', 'aria-checked': 'false' });
  cb1.addEventListener('click', () => cb1.setAttribute('aria-checked', 'true'));
  tile1.appendChild(link1);
  tile1.appendChild(cb1);
  main.appendChild(tile1);

  const tile2 = createMockElement('div');
  const link2 = createMockElement('a', {
    href: '/photo/AF1QipMockFav02',
    'aria-label': 'Ảnh - 12 thg 11, 2026'
  });
  link2.appendChild(createMockElement('img', { src: 'https://lh3.googleusercontent.com/mock2=w200-h200' }));
  const cb2 = createMockElement('div', { role: 'checkbox', 'aria-checked': 'false' });
  tile2.appendChild(link2);
  tile2.appendChild(cb2);
  main.appendChild(tile2);

  // Scan visible DOM
  const scanned = Adapter.scanVisibleDom(doc, new Map());
  assert.equal(scanned.length, 2);
  assert.equal(scanned[0].monthKey, '2026-11');
  assert.equal(scanned[0].sizeBytes, 2048000);

  // Wire mock lightbox & confirmation dialog
  let favBtn = null;
  let backBtn = null;
  let trashConfirmed = false;

  link2.addEventListener('click', () => {
    favBtn = createMockElement('button', { 'aria-label': 'Yêu thích', 'aria-pressed': 'false' });
    favBtn.addEventListener('click', () => {
      favBtn.setAttribute('aria-pressed', 'true');
      favBtn.setAttribute('aria-label', 'Bỏ khỏi mục yêu thích');
    });
    backBtn = createMockElement('button', { 'aria-label': 'Quay lại' });
    backBtn.addEventListener('click', () => {
      favBtn.offsetParent = null;
      backBtn.offsetParent = null;
    });
    doc.body.appendChild(favBtn);
    doc.body.appendChild(backBtn);
  });

  const toolbarTrashBtn = createMockElement('button', { 'aria-label': 'Chuyển vào thùng rác' });
  const dialog = createMockElement('div', { role: 'dialog', 'aria-modal': 'true' });
  dialog.offsetParent = null;
  const confirmBtn = createMockElement('button', {}, 'Chuyển vào thùng rác');
  dialog.appendChild(confirmBtn);
  doc.body.appendChild(toolbarTrashBtn);
  doc.body.appendChild(dialog);

  toolbarTrashBtn.addEventListener('click', () => {
    dialog.offsetParent = {};
  });
  confirmBtn.addEventListener('click', () => {
    trashConfirmed = true;
    dialog.offsetParent = null;
  });

  const result = await Adapter.commitChanges({
    doc,
    favoriteItems: [scanned[1]],
    trashItems: [scanned[0]]
  });

  assert.deepEqual(result.favoritedIds, ['AF1QipMockFav02']);
  assert.deepEqual(result.trashedIds, ['AF1QipMockTrash01']);
  assert.equal(trashConfirmed, true);
});
