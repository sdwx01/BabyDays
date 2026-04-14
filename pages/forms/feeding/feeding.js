const storage  = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const formedit = require('../../../utils/formedit');

Page({
  data: {
    date: '',
    time: '',
    sourceIndex: 0,
    sources: ['奶瓶', '左侧母乳', '右侧母乳'],
    sourceValues: ['bottle', 'left', 'right'],
    amount: '',
    duration: '',
    notes: '',
    isBottle: true,
    // Edit mode state
    isEdit: false,
    editingId: null,
    editingDateKey: null
  },

  onLoad(options) {
    this.setData({
      date: datetime.todayKey(),
      time: datetime.currentTime()
    });

    const rec = formedit.beginEdit(this, options);
    if (rec) {
      const d = rec.data || {};
      const idx = Math.max(0, this.data.sourceValues.indexOf(d.source));
      this.setData({
        date: rec.dateKey,
        time: datetime.formatTime(rec.recordedAt),
        sourceIndex: idx,
        isBottle: idx === 0,
        amount: d.amount != null ? String(d.amount) : '',
        duration: d.duration != null ? String(d.duration) : '',
        notes: d.notes || ''
      });
    }
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },

  onSourceChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({
      sourceIndex: idx,
      isBottle: idx === 0
    });
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }); },
  onDurationInput(e) { this.setData({ duration: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, sourceIndex, sourceValues, amount, duration, notes, isBottle, isEdit } = this.data;

    if (isBottle && !amount) {
      wx.showToast({ title: '请输入奶量', icon: 'none' }); return;
    }
    if (!isBottle && !duration) {
      wx.showToast({ title: '请输入哺乳时长', icon: 'none' }); return;
    }

    const recordedAt = datetime.parseDateTime(date, time);
    const record = {
      id: storage.generateId(),
      type: 'feeding',
      createdAt: Date.now(),
      recordedAt,
      dateKey: date,
      data: {
        source: sourceValues[sourceIndex],
        amount: isBottle ? parseInt(amount) : null,
        duration: !isBottle ? parseInt(duration) : null,
        notes: notes.trim()
      }
    };

    formedit.commitSave(this, record);
    wx.showToast({ title: isEdit ? '已更新 ✓' : '已记录 🍼', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
