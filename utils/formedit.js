// Shared helpers for form pages that support edit-in-place.
//
// Each form calls `beginEdit(page, options)` in its onLoad. If options
// includes `recordId` and `dateKey` and a matching record exists, the
// helper returns the record and sets `page.data.editingId` /
// `page.data.editingDateKey` / `page.data.isEdit` so the WXML can swap
// titles/buttons ("保存记录" → "更新记录"). Otherwise returns null.
//
// On save, forms call `commitSave(page, record)` which routes to
// `storage.replaceRecord` when editing, or `storage.addRecord` otherwise.

const storage = require('./storage');

/**
 * Loads an existing record for editing if options carries a recordId.
 * Returns the record object, or null if not in edit mode.
 * Side effect: sets page.data.editingId, editingDateKey, isEdit.
 */
function beginEdit(page, options) {
  if (!options || !options.recordId || !options.dateKey) return null;
  const list = storage.getRecordsByDate(options.dateKey);
  const rec = list.find(r => r.id === options.recordId);
  if (!rec) return null;
  page.setData({
    editingId: rec.id,
    editingDateKey: options.dateKey,
    isEdit: true
  });
  // Update navigation title to indicate edit mode
  wx.setNavigationBarTitle({ title: '编辑记录' });
  return rec;
}

/**
 * Writes the final record to storage. When in edit mode, uses replaceRecord
 * so cross-date moves and top-level field changes propagate correctly.
 */
function commitSave(page, record) {
  const { editingId, editingDateKey } = page.data;
  if (editingId && editingDateKey) {
    record.id = editingId;
    return storage.replaceRecord(editingId, editingDateKey, record);
  }
  return storage.addRecord(record);
}

module.exports = { beginEdit, commitSave };
