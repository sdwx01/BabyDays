const storage   = require('../../../utils/storage');
const datetime  = require('../../../utils/datetime');
const constants = require('../../../utils/constants');
const formedit  = require('../../../utils/formedit');

Page({
  data: {
    date: '',
    time: '',
    name: '',
    dose: '',
    notes: '',
    // Suggestion chips: merged list of user-added + common medications.
    // Each entry: { name, dose, custom: bool }. `custom` chips can be
    // removed via long-press (see onChipLongPress).
    suggestions: [],
    isEdit: false,
    editingId: null,
    editingDateKey: null
  },

  onLoad(options) {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
    this._rebuildSuggestions();

    const rec = formedit.beginEdit(this, options);
    if (rec) {
      const d = rec.data || {};
      this.setData({
        date: rec.dateKey,
        time: datetime.formatTime(rec.recordedAt),
        name: d.name || '',
        dose: d.dose || '',
        notes: d.notes || ''
      });
    }
  },

  /**
   * Builds the chip list: user-added (newest first) + common defaults
   * that haven't already been used. De-duplicated by lowercase name so a
   * user's custom entry overrides the seed default when names collide.
   */
  _rebuildSuggestions() {
    const user = storage.getUserMedications().map(m => ({
      name: m.name,
      dose: m.dose || '',
      custom: true
    }));

    const usedNames = new Set(user.map(m => m.name.toLowerCase()));
    const common = constants.COMMON_MEDICATIONS
      .filter(m => !usedNames.has(m.name.toLowerCase()))
      .map(m => ({ name: m.name, dose: m.dose || '', custom: false }));

    this.setData({ suggestions: [...user, ...common] });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onNameInput(e)  { this.setData({ name: e.detail.value }); },
  onDoseInput(e)  { this.setData({ dose: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  // Tapping a chip prefills name and (if present) dose.
  onChipTap(e) {
    const idx = e.currentTarget.dataset.index;
    const s = this.data.suggestions[idx];
    if (!s) return;
    this.setData({
      name: s.name,
      dose: s.dose || this.data.dose  // keep any user-typed dose if chip has none
    });
  },

  // Long-press a user-added chip to remove it from the quick-select list.
  onChipLongPress(e) {
    const idx = e.currentTarget.dataset.index;
    const s = this.data.suggestions[idx];
    if (!s || !s.custom) return;
    wx.showModal({
      title: '从快速选择中移除',
      content: `确定不再需要快速选择「${s.name}」吗？`,
      confirmColor: '#FF8FAB',
      success: (res) => {
        if (res.confirm) {
          storage.deleteUserMedication(s.name);
          this._rebuildSuggestions();
          wx.showToast({ title: '已移除', icon: 'none', duration: 800 });
        }
      }
    });
  },

  onSave() {
    const { date, time, name, dose, notes, isEdit } = this.data;
    if (!name.trim()) { wx.showToast({ title: '请输入药品名称', icon: 'none' }); return; }
    if (!dose.trim()) { wx.showToast({ title: '请输入剂量', icon: 'none' }); return; }

    const record = {
      id: storage.generateId(),
      type: 'medication',
      createdAt: Date.now(),
      recordedAt: datetime.parseDateTime(date, time),
      dateKey: date,
      data: { name: name.trim(), dose: dose.trim(), notes: notes.trim() }
    };

    formedit.commitSave(this, record);
    // Remember this medication (and its most recent dose) for next time.
    storage.recordUserMedication(name, dose);

    wx.showToast({ title: isEdit ? '已更新 ✓' : '已记录 💊', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
