const storage   = require('../../../utils/storage');
const datetime  = require('../../../utils/datetime');
const constants = require('../../../utils/constants');
const formedit  = require('../../../utils/formedit');

Page({
  data: {
    date: '',
    time: '',
    diaperType: 'wet',
    diaperTypes: constants.DIAPER_TYPES,
    colorIndex: 0,
    colors: constants.DIAPER_COLORS,
    consistencyIndex: 0,
    consistencies: constants.DIAPER_CONSISTENCY,
    hasRash: false,
    notes: '',
    showBowelFields: false,
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
      const colorIdx = Math.max(0, this.data.colors.indexOf(d.color));
      const consIdx  = Math.max(0, this.data.consistencies.indexOf(d.consistency));
      this.setData({
        date: rec.dateKey,
        time: datetime.formatTime(rec.recordedAt),
        diaperType: d.diaperType || 'wet',
        colorIndex: colorIdx,
        consistencyIndex: consIdx,
        hasRash: !!d.hasRash,
        notes: d.notes || '',
        showBowelFields: d.diaperType === 'dirty' || d.diaperType === 'both'
      });
    }
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },

  onTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      diaperType: type,
      showBowelFields: type === 'dirty' || type === 'both'
    });
  },

  onColorChange(e) { this.setData({ colorIndex: parseInt(e.detail.value) }); },
  onConsistencyChange(e) { this.setData({ consistencyIndex: parseInt(e.detail.value) }); },

  onRashChange(e) { this.setData({ hasRash: e.detail.value }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, diaperType, colors, colorIndex, consistencies, consistencyIndex, hasRash, notes, showBowelFields, isEdit } = this.data;

    const recordedAt = datetime.parseDateTime(date, time);
    const record = {
      id: storage.generateId(),
      type: 'diaper',
      createdAt: Date.now(),
      recordedAt,
      dateKey: date,
      data: {
        diaperType,
        color: showBowelFields ? colors[colorIndex] : '',
        consistency: showBowelFields ? consistencies[consistencyIndex] : '',
        hasRash,
        notes: notes.trim()
      }
    };

    formedit.commitSave(this, record);
    wx.showToast({ title: isEdit ? '已更新 ✓' : '已记录 👶', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
