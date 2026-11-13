'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore, createMemoryStorage } = require('../src/utils/store.js');

function sampleItems() {
  return [
    {
      mediaKey: 'K_NOV_1',
      monthKey: '2026-11',
      takenAtMs: new Date(2026, 10, 12, 10, 0).getTime(),
      filename: 'Screenshot_01.png',
      mediaType: 'photo',
      sizeBytes: 400000000
    },
    {
      mediaKey: 'K_NOV_2',
      monthKey: '2026-11',
      takenAtMs: new Date(2026, 10, 10, 10, 0).getTime(),
      filename: 'IMG_02.jpg',
      mediaType: 'photo',
      sizeBytes: 5000000
    },
    {
      mediaKey: 'K_OCT_1',
      monthKey: '2026-10',
      takenAtMs: new Date(2026, 9, 20, 10, 0).getTime(),
      filename: 'VID_03.mp4',
      mediaType: 'video',
      sizeBytes: 1100000000
    }
  ];
}

test('store groups items by month, filters cleanly, tracks pending bytes, and supports undo/rescue', async () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, storageKey: 'test_key' });
  store.upsertItems(sampleItems());

  const buckets = store.getMonthBuckets();
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].monthKey, '2026-11');
  assert.equal(buckets[0].totalCount, 2);
  assert.equal(buckets[1].monthKey, '2026-10');

  // Filter screenshots only
  store.setActiveFilter('screenshot');
  assert.deepEqual(
    store.getDeckItems().map((x) => x.mediaKey),
    ['K_NOV_1']
  );

  store.setActiveFilter('all');
  store.setSelectedMonth('2026-11');
  assert.deepEqual(
    store.getDeckItems().map((x) => x.mediaKey),
    ['K_NOV_1', 'K_NOV_2']
  );

  // Swipe left (trash), swipe up (favorite), swipe right (keep)
  store.decide('K_NOV_1', 'trash');
  store.decide('K_NOV_2', 'favorite');
  store.setSelectedMonth('all');
  store.decide('K_OCT_1', 'trash');

  let summary = store.getSummary();
  assert.equal(summary.pendingTrashCount, 2);
  assert.equal(summary.pendingTrashBytes, 1500000000);
  assert.equal(summary.pendingFavoriteCount, 1);

  // Rescue K_NOV_1 from trash in review modal
  store.rescueFromTrash('K_NOV_1');
  summary = store.getSummary();
  assert.equal(summary.pendingTrashCount, 1);
  assert.equal(summary.pendingTrashBytes, 1100000000);
  assert.equal(summary.keptCount, 1);

  // Undo rescue restores K_NOV_1 back to trash
  const undone = store.undo();
  assert.equal(undone.mediaKey, 'K_NOV_1');
  assert.equal(store.getSummary().pendingTrashCount, 2);

  // Commit changes and verify persistence reload
  store.markCommitted({ trashedIds: ['K_NOV_1', 'K_OCT_1'], favoritedIds: ['K_NOV_2'] });
  assert.equal(store.getSummary().lifetimeFreedBytes, 1500000000);
  assert.equal(store.getSummary().pendingTrashCount, 0);
  assert.equal(store.getSummary().pendingFavoriteCount, 0);

  await store.persistNow();

  const reloaded = createStore({ storage, storageKey: 'test_key' });
  await reloaded.load();
  assert.equal(reloaded.getSummary().lifetimeFreedBytes, 1500000000);
  assert.equal(reloaded.state.committedTrash.has('K_NOV_1'), true);
});
