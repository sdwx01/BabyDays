// All wx.Storage* operations for BabyDays

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
 */
function addRecord(record) {
  try {
    const dateKey = record.dateKey;
    const records = getRecordsByDate(dateKey);
    records.push(record);
    wx.setStorageSync(`records_${dateKey}`, records);
    _ensureDateInIndex(dateKey);
    return true;
  } catch (e) {
    console.error('[storage] addRecord error:', e);
    return false;
  }
}

/**
 * Updates the data field of an existing record by id
 */
function updateRecord(id, dateKey, updatedData) {
  try {
    const records = getRecordsByDate(dateKey);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    records[idx].data = Object.assign({}, records[idx].data, updatedData);
    wx.setStorageSync(`records_${dateKey}`, records);
    return true;
  } catch (e) {
    console.error('[storage] updateRecord error:', e);
    return false;
  }
}

/**
 * Deletes a record by id from a specific date
 */
function deleteRecord(id, dateKey) {
  try {
    const records = getRecordsByDate(dateKey);
    const filtered = records.filter(r => r.id !== id);
    wx.setStorageSync(`records_${dateKey}`, filtered);
    return true;
  } catch (e) {
    console.error('[storage] deleteRecord error:', e);
    return false;
  }
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
