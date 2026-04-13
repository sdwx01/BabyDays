const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');

Page({
  data: {
    date: '',
    time: '',
    vaccineName: '',
    clinic: '',
    batchNumber: '',
    reactions: '',
    notes: ''
  },

  onLoad() {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onVaccineNameInput(e) { this.setData({ vaccineName: e.detail.value }); },
  onClinicInput(e) { this.setData({ clinic: e.detail.value }); },
  onBatchInput(e) { this.setData({ batchNumber: e.detail.value }); },
  onReactionsInput(e) { this.setData({ reactions: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, vaccineName, clinic, batchNumber, reactions, notes } = this.data;
    if (!vaccineName.trim()) { wx.showToast({ title: '请输入疫苗名称', icon: 'none' }); return; }

    const record = {
      id: storage.generateId(),
      type: 'vaccination',
      createdAt: Date.now(),
      recordedAt: datetime.parseDateTime(date, time),
      dateKey: date,
      data: {
        vaccineName: vaccineName.trim(),
        clinic: clinic.trim(),
        batchNumber: batchNumber.trim(),
        reactions: reactions.trim(),
        notes: notes.trim()
      }
    };

    storage.addRecord(record);
    wx.showToast({ title: '已记录 💉', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
