// utils/cloud.js — WeChat Cloud Development operations for BabyDays
//
// DATABASE COLLECTIONS (create in WeChat Cloud console):
//   families  — permission: 仅创建者可读写
//   members   — permission: 所有用户可读，仅创建者可写 (cloud functions write)
//   records   — permission: 所有用户可读写
//
// Each collection is queried by familyId. The familyId acts as a shared secret
// so only caregivers who know it (via invite code flow) can access records.

const COLL_RECORDS  = 'records';
const COLL_FAMILIES = 'families';
const COLL_MEMBERS  = 'members';

// Per-dateKey TTL cache for syncDateFromCloud. Prevents redundant cloud calls
// when the user rapidly swaps tabs. TTL is short enough that multi-caregiver
// writes still become visible promptly.
const SYNC_TTL_MS = 30 * 1000;
const _syncCache    = Object.create(null); // dateKey -> { merged, ts }
const _syncInFlight = Object.create(null); // dateKey -> Promise

// Typed error codes so callers can render the right UI.
const SYNC_ERR_UNAVAILABLE = 'UNAVAILABLE';
const SYNC_ERR_NETWORK     = 'NETWORK';

/** Returns true if cloud is initialised AND the user belongs to a family */
function isAvailable() {
  try {
    return typeof wx.cloud !== 'undefined' && !!wx.getStorageSync('family_id');
  } catch (e) {
    return false;
  }
}

function _db() {
  return wx.cloud.database();
}

function _familyId() {
  return wx.getStorageSync('family_id') || '';
}

// ─── Record operations ────────────────────────────────────────────────────────

/**
 * Adds a record to the cloud records collection.
 * Uses the local `record.id` as the cloud _id for easy cross-device lookup.
 */
async function addRecord(record) {
  if (!isAvailable()) return false;
  const familyId = _familyId();
  try {
    await _db().collection(COLL_RECORDS).add({
      data: {
        _id: record.id,   // local id → cloud _id (idempotent re-push)
        ...record,
        familyId
      }
    });
    _invalidateSyncCache(record.dateKey);
    return true;
  } catch (e) {
    // Ignore "already exists" duplicate errors (code -502005)
    if (e && e.errCode !== -502005) {
      console.error('[cloud] addRecord error:', e);
    }
    return false;
  }
}

/**
 * Deletes a record from cloud by its local id.
 * Falls back gracefully if not found (record may never have synced).
 */
async function deleteRecord(localId, dateKey) {
  if (!isAvailable()) return false;
  try {
    await _db().collection(COLL_RECORDS).doc(localId).remove();
    if (dateKey) _invalidateSyncCache(dateKey);
    return true;
  } catch (e) {
    if (e && e.errCode !== -502005) {
      console.error('[cloud] deleteRecord error:', e);
    }
    return false;
  }
}

/**
 * Updates nested data fields of a record in cloud.
 * `dataFields` is a flat object like { endTime: 123, duration: 60 }
 * which gets written as { 'data.endTime': 123, 'data.duration': 60 }.
 */
async function updateRecord(localId, dataFields, dateKey) {
  if (!isAvailable()) return false;
  const updateObj = {};
  Object.keys(dataFields).forEach(k => {
    updateObj[`data.${k}`] = dataFields[k];
  });
  try {
    await _db().collection(COLL_RECORDS).doc(localId).update({ data: updateObj });
    if (dateKey) _invalidateSyncCache(dateKey);
    return true;
  } catch (e) {
    console.error('[cloud] updateRecord error:', e);
    return false;
  }
}

/**
 * Replaces an entire record document in cloud.
 *
 * Since the local record id is used as the cloud _id and ids are preserved
 * across edits, we use `doc(id).set({data})` which replaces the whole doc
 * (creating it if missing). This covers same-date edits cleanly.
 *
 * For cross-date edits the record's dateKey field changes but _id stays
 * the same, so a `set` is still correct — the dateKey on the doc simply
 * updates, and future syncDateFromCloud calls pull it under the new date.
 */
async function replaceRecord(record, oldId, oldDateKey) {
  if (!isAvailable()) return false;
  const familyId = _familyId();
  try {
    await _db().collection(COLL_RECORDS).doc(record.id).set({
      data: { ...record, familyId }
    });
    if (oldDateKey)      _invalidateSyncCache(oldDateKey);
    if (record.dateKey)  _invalidateSyncCache(record.dateKey);
    return true;
  } catch (e) {
    console.error('[cloud] replaceRecord error:', e);
    return false;
  }
}

/**
 * Fetches all records for a date from cloud and merges them into local storage.
 *
 * Returns an object of shape:
 *   { ok: true,  merged: Array|null, fromCache: boolean }
 *   { ok: false, error: 'UNAVAILABLE' | 'NETWORK' }
 *
 * `merged` is the new local array when cloud data changed, or null when local
 * storage was untouched. `fromCache === true` means a recent (<30s) identical
 * call was served without hitting the network.
 *
 * Concurrent calls for the same dateKey are de-duplicated via an in-flight map.
 *
 * Merge strategy:
 *   - Cloud records are authoritative (written by any caregiver)
 *   - Local-only records (pending cloud push) are preserved
 *   - Deletions propagate: if a record is in local but NOT in cloud and
 *     the cloud set is non-empty, we trust cloud and remove the local copy
 *     UNLESS it was added in the last 30 seconds (to avoid race conditions).
 */
function syncDateFromCloud(dateKey, options) {
  const opts = options || {};

  if (!isAvailable()) {
    return Promise.resolve({ ok: false, error: SYNC_ERR_UNAVAILABLE });
  }

  // Serve from TTL cache unless force-refresh
  if (!opts.force) {
    const cached = _syncCache[dateKey];
    if (cached && (Date.now() - cached.ts) < SYNC_TTL_MS) {
      return Promise.resolve({ ok: true, merged: null, fromCache: true });
    }
  }

  // De-dupe in-flight
  if (_syncInFlight[dateKey]) {
    return _syncInFlight[dateKey];
  }

  const p = _doSync(dateKey).finally(() => {
    delete _syncInFlight[dateKey];
  });
  _syncInFlight[dateKey] = p;
  return p;
}

async function _doSync(dateKey) {
  const familyId = _familyId();

  try {
    const res = await _db().collection(COLL_RECORDS)
      .where({ familyId, dateKey })
      .limit(200)
      .get();

    const cloudRecords = (res.data || []).map(r => {
      // Strip cloud-internal fields before caching locally
      const { _openid, familyId: _fid, ...record } = r;
      return record;
    });

    const localKey = `records_${dateKey}`;
    const localRecords = wx.getStorageSync(localKey) || [];

    _syncCache[dateKey] = { ts: Date.now() };

    if (cloudRecords.length === 0 && localRecords.length === 0) {
      return { ok: true, merged: null, fromCache: false };
    }

    if (cloudRecords.length === 0) {
      // Cloud empty — could be first sync for this date; keep local
      return { ok: true, merged: null, fromCache: false };
    }

    // Build id sets
    const cloudIdSet = new Set(cloudRecords.map(r => r.id || r._id));
    const now = Date.now();

    // Keep local records that are very recent (< 30s) and not yet in cloud
    const pendingLocal = localRecords.filter(
      r => !cloudIdSet.has(r.id) && (now - r.createdAt) < 30000
    );

    const merged = [...cloudRecords, ...pendingLocal]
      .sort((a, b) => a.recordedAt - b.recordedAt);

    wx.setStorageSync(localKey, merged);
    _ensureDateInIndex(dateKey);

    return { ok: true, merged, fromCache: false };
  } catch (e) {
    console.error('[cloud] syncDateFromCloud error:', e);
    return { ok: false, error: SYNC_ERR_NETWORK };
  }
}

function _invalidateSyncCache(dateKey) {
  if (dateKey) delete _syncCache[dateKey];
}

function _ensureDateInIndex(dateKey) {
  try {
    const index = wx.getStorageSync('days_index') || [];
    if (!index.includes(dateKey)) {
      index.push(dateKey);
      index.sort((a, b) => b.localeCompare(a));
      wx.setStorageSync('days_index', index);
    }
  } catch (e) {}
}

// ─── Pending sync queue (offline-first) ───────────────────────────────────────
//
// When a record is saved locally while offline (or when a cloud push fails),
// its id + dateKey are enqueued here. On app resume or when the network comes
// back, flushPendingSync() drains the queue.
//
// Queue shape: [{ id, dateKey, op: 'add' | 'update' | 'delete', payload?, enqueuedAt }]

const PENDING_KEY = 'pending_sync_queue';
const MAX_QUEUE_SIZE = 500; // cap to protect storage

// Cached set of pending ids, rebuilt lazily. Invalidated on every write.
let _pendingIdSet = null;

function _readPending() {
  try {
    const q = wx.getStorageSync(PENDING_KEY);
    return Array.isArray(q) ? q : [];
  } catch (e) { return []; }
}

function _writePending(queue) {
  try {
    // Drop oldest if exceeding cap
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
    }
    wx.setStorageSync(PENDING_KEY, queue);
    _pendingIdSet = null; // invalidate cache
  } catch (e) {
    console.error('[cloud] _writePending error:', e);
  }
}

function enqueuePending(op, id, dateKey, payload) {
  const queue = _readPending();
  queue.push({ op, id, dateKey, payload: payload || null, enqueuedAt: Date.now() });
  _writePending(queue);
}

function pendingCount() {
  return _readPending().length;
}

function _pendingIdsCached() {
  if (_pendingIdSet) return _pendingIdSet;
  _pendingIdSet = new Set(_readPending().map(i => i.id));
  return _pendingIdSet;
}

function isPending(id) {
  return _pendingIdsCached().has(id);
}

/**
 * Drains the pending queue, retrying each operation against the cloud.
 * Failed items are kept in the queue for a later retry.
 * Returns { attempted, succeeded, remaining }.
 */
async function flushPendingSync() {
  if (!isAvailable()) {
    return { attempted: 0, succeeded: 0, remaining: _readPending().length };
  }
  const queue = _readPending();
  if (queue.length === 0) {
    return { attempted: 0, succeeded: 0, remaining: 0 };
  }

  const remaining = [];
  let succeeded = 0;

  for (const item of queue) {
    let ok = false;
    try {
      if (item.op === 'add' && item.payload) {
        ok = await addRecord(item.payload);
      } else if (item.op === 'update') {
        ok = await updateRecord(item.id, item.payload || {}, item.dateKey);
      } else if (item.op === 'delete') {
        ok = await deleteRecord(item.id, item.dateKey);
      } else if (item.op === 'replace' && item.payload && item.payload.record) {
        ok = await replaceRecord(item.payload.record, item.payload.oldId, item.payload.oldDateKey);
      }
    } catch (e) {
      ok = false;
    }
    if (ok) {
      succeeded++;
    } else {
      remaining.push(item);
    }
  }

  _writePending(remaining);
  return { attempted: queue.length, succeeded, remaining: remaining.length };
}

// ─── Family operations ────────────────────────────────────────────────────────

/**
 * Creates a new family via cloud function.
 * Returns { success, familyId, inviteCode } or { success: false, error }
 */
async function createFamily(babyName, birthDate, nickname) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'createFamily',
      data: { babyName, birthDate, nickname }
    });
    return res.result;
  } catch (e) {
    console.error('[cloud] createFamily error:', e);
    return { success: false, error: '创建失败，请检查网络' };
  }
}

/**
 * Joins an existing family via invite code.
 * Returns { success, familyId, babyName, birthDate } or { success: false, error }
 */
async function joinFamily(inviteCode, nickname) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'joinFamily',
      data: { inviteCode: inviteCode.toUpperCase().trim(), nickname }
    });
    return res.result;
  } catch (e) {
    console.error('[cloud] joinFamily error:', e);
    return { success: false, error: '加入失败，请检查网络' };
  }
}

/**
 * Fetches current family info from cloud.
 */
async function getFamilyInfo() {
  const familyId = _familyId();
  if (!familyId) return null;
  try {
    const res = await _db().collection(COLL_FAMILIES).doc(familyId).get();
    return res.data || null;
  } catch (e) {
    console.error('[cloud] getFamilyInfo error:', e);
    return null;
  }
}

/**
 * Fetches all members of the current family.
 */
async function getFamilyMembers() {
  const familyId = _familyId();
  if (!familyId) return [];
  try {
    const res = await _db().collection(COLL_MEMBERS)
      .where({ familyId })
      .limit(20)
      .get();
    return res.data || [];
  } catch (e) {
    console.error('[cloud] getFamilyMembers error:', e);
    return [];
  }
}

/**
 * Regenerates the invite code for the current family (admin only).
 * Returns new invite code string or null on failure.
 */
async function regenerateInviteCode() {
  const familyId = _familyId();
  if (!familyId) return null;
  try {
    const res = await wx.cloud.callFunction({
      name: 'generateInviteCode',
      data: { familyId }
    });
    return res.result && res.result.success ? res.result.inviteCode : null;
  } catch (e) {
    console.error('[cloud] regenerateInviteCode error:', e);
    return null;
  }
}

/**
 * Migrates all existing local records to cloud after first family setup.
 * Called once from onboarding after family creation/joining.
 */
async function migrateLocalToCloud() {
  if (!isAvailable()) return;
  const index = wx.getStorageSync('days_index') || [];
  for (const dateKey of index) {
    const records = wx.getStorageSync(`records_${dateKey}`) || [];
    for (const record of records) {
      await addRecord(record).catch(() => {});
    }
  }
}

/**
 * Uploads a local file to WeChat Cloud Storage.
 * Returns the cloud fileID on success, or null on failure.
 */
async function uploadFile(filePath, cloudPath) {
  try {
    const res = await wx.cloud.uploadFile({ cloudPath, filePath });
    return res.fileID;
  } catch (e) {
    console.error('[cloud] uploadFile error:', e);
    return null;
  }
}

module.exports = {
  isAvailable,
  addRecord,
  deleteRecord,
  updateRecord,
  replaceRecord,
  syncDateFromCloud,
  createFamily,
  joinFamily,
  getFamilyInfo,
  getFamilyMembers,
  regenerateInviteCode,
  migrateLocalToCloud,
  uploadFile,
  // pending-sync queue
  enqueuePending,
  pendingCount,
  isPending,
  flushPendingSync,
  // error constants
  SYNC_ERR_UNAVAILABLE,
  SYNC_ERR_NETWORK
};
