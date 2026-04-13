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
async function deleteRecord(localId) {
  if (!isAvailable()) return false;
  try {
    await _db().collection(COLL_RECORDS).doc(localId).remove();
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
async function updateRecord(localId, dataFields) {
  if (!isAvailable()) return false;
  const updateObj = {};
  Object.keys(dataFields).forEach(k => {
    updateObj[`data.${k}`] = dataFields[k];
  });
  try {
    await _db().collection(COLL_RECORDS).doc(localId).update({ data: updateObj });
    return true;
  } catch (e) {
    console.error('[cloud] updateRecord error:', e);
    return false;
  }
}

/**
 * Fetches all records for a date from cloud and merges them into local storage.
 * Returns the merged array, or null if cloud is unavailable / fetch failed.
 *
 * Merge strategy:
 *   - Cloud records are authoritative (written by any caregiver)
 *   - Local-only records (pending cloud push) are preserved
 *   - Deletions propagate: if a record is in local but NOT in cloud and
 *     the cloud set is non-empty, we trust cloud and remove the local copy
 *     UNLESS it was added in the last 30 seconds (to avoid race conditions).
 */
async function syncDateFromCloud(dateKey) {
  if (!isAvailable()) return null;
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

    if (cloudRecords.length === 0 && localRecords.length === 0) return null;

    if (cloudRecords.length === 0) {
      // Cloud empty — could be first sync for this date; keep local
      return null;
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

    return merged;
  } catch (e) {
    console.error('[cloud] syncDateFromCloud error:', e);
    return null;
  }
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

module.exports = {
  isAvailable,
  addRecord,
  deleteRecord,
  updateRecord,
  syncDateFromCloud,
  createFamily,
  joinFamily,
  getFamilyInfo,
  getFamilyMembers,
  regenerateInviteCode,
  migrateLocalToCloud
};
