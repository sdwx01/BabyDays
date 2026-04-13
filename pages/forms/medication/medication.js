const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');

Page({
  data: {
    date: '',
    time: '',
    name: '',
    dose: '',
    notes: ''
  },

  onLoad() {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onDoseInput(e) { this.setData({ dose: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, name, dose, notes } = this.data;
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

    storage.addRecord(record);
    wx.showToast({ title: '已记录 💊', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
