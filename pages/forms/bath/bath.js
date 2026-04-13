const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');

Page({
  data: {
    date: '',
    time: '',
    waterTemp: 38,
    duration: '',
    usedProducts: '',
    notes: ''
  },

  onLoad() {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onTempChange(e) { this.setData({ waterTemp: parseFloat(e.detail.value) }); },
  onDurationInput(e) { this.setData({ duration: e.detail.value }); },
  onProductsInput(e) { this.setData({ usedProducts: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, waterTemp, duration, usedProducts, notes } = this.data;

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

    storage.addRecord(record);
    wx.showToast({ title: '已记录 🛁', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
