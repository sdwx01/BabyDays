const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const constants = require('../../../utils/constants');

Page({
  data: {
    mode: 'start',   // 'start' | 'end'
    date: '',
    time: '',
    locationIndex: 0,
    locations: constants.SLEEP_LOCATIONS,
    notes: '',
    // End mode data
    activeSleep: null,
    activeRecord: null,
    elapsedDisplay: '',
    endDate: '',
    endTime: ''
  },

  _timer: null,

  onLoad() {
    const now = datetime.todayKey();
    const active = storage.getActiveSleep();
    if (active) {
      const records = storage.getRecordsByDate(active.dateKey);
      const rec = records.find(r => r.id === active.id) || null;
      this.setData({
        mode: 'end',
        activeSleep: active,
        activeRecord: rec,
        endDate: datetime.todayKey(),
        endTime: datetime.currentTime()
      });
      this._startElapsedTimer(rec);
    } else {
      this.setData({
        mode: 'start',
        date: now,
        time: datetime.currentTime()
      });
    }
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  _startElapsedTimer(rec) {
    if (!rec) return;
    const update = () => {
      const mins = datetime.durationMinutes(rec.data.startTime, Date.now());
      this.setData({ elapsedDisplay: datetime.formatDuration(mins) });
    };
    update();
    this._timer = setInterval(update, 30000);
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onLocationChange(e) { this.setData({ locationIndex: parseInt(e.detail.value) }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }); },

  onStartSleep() {
    const { date, time, locations, locationIndex, notes } = this.data;
    const startTime = datetime.parseDateTime(date, time);

    const record = {
      id: storage.generateId(),
      type: 'sleep',
      createdAt: Date.now(),
      recordedAt: startTime,
      dateKey: date,
      data: {
        startTime,
        endTime: null,
        duration: null,
        location: locations[locationIndex],
        notes: notes.trim()
      }
    };

    storage.addRecord(record);
    storage.setActiveSleep({ id: record.id, dateKey: date });

    wx.showToast({ title: '开始记录睡眠 😴', icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  onEndSleep() {
    const { activeSleep, activeRecord, endDate, endTime } = this.data;
    if (!activeSleep || !activeRecord) return;

    const endTs = datetime.parseDateTime(endDate, endTime);
    const startTs = activeRecord.data.startTime;
    const duration = datetime.durationMinutes(startTs, endTs);

    if (endTs <= startTs) {
      wx.showToast({ title: '结束时间须晚于开始时间', icon: 'none' }); return;
    }

    storage.updateRecord(activeSleep.id, activeSleep.dateKey, {
      endTime: endTs,
      duration
    });
    storage.clearActiveSleep();

    wx.showToast({ title: `睡了${datetime.formatDuration(duration)} 💤`, icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  onCancelActive() {
    wx.showModal({
      title: '取消睡眠记录',
      content: '确定要取消当前睡眠记录吗？',
      confirmColor: '#FF8FAB',
      success: (res) => {
        if (res.confirm) {
          const { activeSleep } = this.data;
          if (activeSleep) {
            storage.deleteRecord(activeSleep.id, activeSleep.dateKey);
            storage.clearActiveSleep();
          }
          wx.navigateBack();
        }
      }
    });
  }
});
