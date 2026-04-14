const storage  = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const formedit = require('../../../utils/formedit');

Page({
  data: {
    date: '',
    time: '',
    waterTemp: 38,
    duration: '',
    usedProducts: '',
    notes: '',
    isEdit: false,
    editingId: null,
    editingDateKey: null
  },

  onLoad(options) {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
    const rec = formedit.beginEdit(this, options);
    if (rec) {
      const d = rec.data || {};
      this.setData({
        date: rec.dateKey,
        time: datetime.formatTime(rec.recordedAt),
        waterTemp: d.waterTemp != null ? d.waterTemp : 38,
        duration: d.duration != null ? String(d.duration) : '',
        usedProducts: d.usedProducts || '',
        notes: d.notes || ''
      });
    }
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onTempChange(e) { this.setData({ waterTemp: parseFloat(e.detail.value) }); },
  onDurationInput(e) { this.setData({ duration: e.detail.value }); },
  onProductsInput(e) { this.setData({ usedProducts: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, waterTemp, duration, usedProducts, notes, isEdit } = this.data;

    const record = {
      id: storage.generateId(),
      type: 'bath',
      createdAt: Date.now(),
      recordedAt: datetime.parseDateTime(date, time),
      dateKey: date,
      data: {
        waterTemp,
        duration: duration ? parseInt(duration) : null,
        usedProducts: usedProducts.trim(),
        notes: notes.trim()
      }
    };

    formedit.commitSave(this, record);
    wx.showToast({ title: isEdit ? '已更新 ✓' : '已记录 🛁', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
