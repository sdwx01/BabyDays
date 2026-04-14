// All wx.Storage* operations for BabyDays
// Cloud sync: every write (add/update/delete) also fires an async cloud push
// via cloud.js. The local write is always synchronous and completes first so
// the UI is never blocked. Cloud failures are silently ignored (offline-safe).

const cloud = require('./cloud');

/**
 * Generates a unique ID for records
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Gets all records for a specific date key "YYYY-MM-DD"
 * Returns an empty array if none found
 */
function getRecordsByDate(dateKey) {
  try {
    const records = wx.getStorageSync(`records_${dateKey}`);
    return Array.isArray(records) ? records : [];
  } catch (e) {
    console.error('[storage] getRecordsByDate error:', e);
    return [];
  }
}

/**
 * Saves a new record. Handles day index maintenance.
 * record must have: { id, type, createdAt, recordedAt, dateKey, data }
 * Automatically attaches creatorName from user_meta.
 * Fire-and-forget cloud push runs in the background.
 */
function addRecord(record) {
  // Attach creator info (used to show "who logged this" in multi-caregiver mode)
  if (!record.creatorName) {
    try {
      const userMeta = wx.getStorageSync('user_meta') || {};
      record.creatorName = userMeta.nickname || '家长';
    } catch (e) {}
  }

  try {
    const dateKey = record.dateKey;
    const records = getRecordsByDate(dateKey);
    records.push(record);
    wx.setStorageSync(`records_${dateKey}`, records);
    _ensureDateInIndex(dateKey);
  } catch (e) {
    console.error('[storage] addRecord error:', e);
    return false;
  }

  // Cloud push — enqueue for retry on failure so records aren't lost offline.
  if (cloud.isAvailable()) {
    cloud.addRecord(record).then(ok => {
      if (!ok) cloud.enqueuePending('add', record.id, record.dateKey, record);
    }).catch(() => {
      cloud.enqueuePending('add', record.id, record.dateKey, record);
    });
  } else {
    // Offline / not joined to a family yet — queue for later.
    cloud.enqueuePending('add', record.id, record.dateKey, record);
  }
  return true;
}

/**
 * Updates the data field of an existing record by id.
 * Fire-and-forget cloud update runs in the background.
 */
function updateRecord(id, dateKey, updatedData) {
  try {
    const records = getRecordsByDate(dateKey);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    records[idx].data = Object.assign({}, records[idx].data, updatedData);
    wx.setStorageSync(`records_${dateKey}`, records);
  } catch (e) {
    console.error('[storage] updateRecord error:', e);
    return false;
  }

  if (cloud.isAvailable()) {
    cloud.updateRecord(id, updatedData, dateKey).then(ok => {
      if (!ok) cloud.enqueuePending('update', id, dateKey, updatedData);
    }).catch(() => {
      cloud.enqueuePending('update', id, dateKey, updatedData);
    });
  } else {
    cloud.enqueuePending('update', id, dateKey, updatedData);
  }
  return true;
}

/**
 * Deletes a record by id from a specific date.
 * Fire-and-forget cloud delete runs in the background.
 */
function deleteRecord(id, dateKey) {
  try {
    const records = getRecordsByDate(dateKey);
    const filtered = records.filter(r => r.id !== id);
    wx.setStorageSync(`records_${dateKey}`, filtered);
  } catch (e) {
    console.error('[storage] deleteRecord error:', e);
    return false;
  }

  if (cloud.isAvailable()) {
    cloud.deleteRecord(id, dateKey).then(ok => {
      if (!ok) cloud.enqueuePending('delete', id, dateKey, null);
    }).catch(() => {
      cloud.enqueuePending('delete', id, dateKey, null);
    });
  } else {
    cloud.enqueuePending('delete', id, dateKey, null);
  }
  return true;
}

/**
 * Replaces an existing record entirely.
 *
 * If the new dateKey differs from the old one the record is moved between
 * day buckets (removed from old, inserted into new). The record id is
 * preserved so cloud documents stay addressable by the same _id.
 *
 * `newRecord` should carry the same `id` as the original.
 */
function replaceRecord(oldId, oldDateKey, newRecord) {
  try {
    const oldList = getRecordsByDate(oldDateKey);
    const oldIdx = oldList.findIndex(r => r.id === oldId);

    // Preserve audit fields from the original record
    if (oldIdx !== -1) {
      const orig = oldList[oldIdx];
      if (!newRecord.createdAt)   newRecord.createdAt   = orig.createdAt;
      if (!newRecord.creatorName) newRecord.creatorName = orig.creatorName;
    }

    if (oldDateKey === newRecord.dateKey) {
      if (oldIdx === -1) return false;
      oldList[oldIdx] = newRecord;
      wx.setStorageSync(`records_${oldDateKey}`, oldList);
    } else {
      // Cross-date move
      if (oldIdx !== -1) {
        oldList.splice(oldIdx, 1);
        wx.setStorageSync(`records_${oldDateKey}`, oldList);
      }
      const newList = getRecordsByDate(newRecord.dateKey);
      newList.push(newRecord);
      wx.setStorageSync(`records_${newRecord.dateKey}`, newList);
      _ensureDateInIndex(newRecord.dateKey);
    }
  } catch (e) {
    console.error('[storage] replaceRecord error:', e);
    return false;
  }

  if (cloud.isAvailable()) {
    cloud.replaceRecord(newRecord, oldId, oldDateKey).then(ok => {
      if (!ok) cloud.enqueuePending('replace', newRecord.id, newRecord.dateKey, { record: newRecord, oldId, oldDateKey });
    }).catch(() => {
      cloud.enqueuePending('replace', newRecord.id, newRecord.dateKey, { record: newRecord, oldId, oldDateKey });
    });
  } else {
    cloud.enqueuePending('replace', newRecord.id, newRecord.dateKey, { record: newRecord, oldId, oldDateKey });
  }
  return true;
}

/**
 * Gets the sorted (desc) days index
 */
function getDaysIndex() {
  try {
    const index = wx.getStorageSync('days_index');
    return Array.isArray(index) ? index : [];
  } catch (e) {
    return [];
  }
}

/**
 * Ensures a dateKey is in the days index, maintains sorted desc order
 */
function _ensureDateInIndex(dateKey) {
  const index = getDaysIndex();
  if (index.includes(dateKey)) return;
  index.push(dateKey);
  index.sort((a, b) => b.localeCompare(a)); // desc
  wx.setStorageSync('days_index', index);
}

/**
 * Gets the most recent record of a specific type across stored days
 * Checks up to maxDays days back
 */
function getLastRecordOfType(type, maxDays) {
  maxDays = maxDays || 14;
  const index = getDaysIndex();
  const daysToCheck = index.slice(0, maxDays);
  for (let i = 0; i < daysToCheck.length; i++) {
    const records = getRecordsByDate(daysToCheck[i]);
    const typeRecords = records.filter(r => r.type === type);
    if (typeRecords.length > 0) {
      // Return the latest one for this day
      typeRecords.sort((a, b) => b.recordedAt - a.recordedAt);
      return typeRecords[0];
    }
  }
  return null;
}

// ─── Active Sleep ─────────────────────────────────────────────────────────────

function getActiveSleep() {
  try {
    const val = wx.getStorageSync('active_sleep');
    return val || null;
  } catch (e) {
    return null;
  }
}

function setActiveSleep(ref) {
  // ref = { id, dateKey }
  wx.setStorageSync('active_sleep', ref);
}

function clearActiveSleep() {
  wx.removeStorageSync('active_sleep');
}

// ─── Active Outing ────────────────────────────────────────────────────────────

function getActiveOuting() {
  try {
    const val = wx.getStorageSync('active_outing');
    return val || null;
  } catch (e) {
    return null;
  }
}

function setActiveOuting(ref) {
  // ref = { id, dateKey }
  wx.setStorageSync('active_outing', ref);
}

function clearActiveOuting() {
  wx.removeStorageSync('active_outing');
}

// ─── App Metadata ─────────────────────────────────────────────────────────────

function getAppMeta() {
  try {
    return wx.getStorageSync('app_meta') || { babyName: '小宝贝', birthDate: '', version: '1.0.0' };
  } catch (e) {
    return { babyName: '小宝贝', birthDate: '', version: '1.0.0' };
  }
}

function setAppMeta(meta) {
  try {
    wx.setStorageSync('app_meta', meta);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  generateId,
  getRecordsByDate,
  addRecord,
  updateRecord,
  replaceRecord,
  deleteRecord,
  getDaysIndex,
  getLastRecordOfType,
  getActiveSleep,
  setActiveSleep,
  clearActiveSleep,
  getActiveOuting,
  setActiveOuting,
  clearActiveOuting,
  getAppMeta,
  setAppMeta
};
