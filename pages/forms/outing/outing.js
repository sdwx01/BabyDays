const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const constants = require('../../../utils/constants');

Page({
  data: {
    mode: 'start',
    date: '',
    time: '',
    destination: '',
    weatherIndex: 0,
    weathers: constants.WEATHER_OPTIONS,
    notes: '',
    activeOuting: null,
    activeRecord: null,
    elapsedDisplay: '',
    endDate: '',
    endTime: ''
  },

  _timer: null,

  onLoad() {
    const active = storage.getActiveOuting();
    if (active) {
      const records = storage.getRecordsByDate(active.dateKey);
      const rec = records.find(r => r.id === active.id) || null;
      this.setData({
        mode: 'end',
        activeOuting: active,
        activeRecord: rec,
        endDate: datetime.todayKey(),
        endTime: datetime.currentTime()
      });
      this._startElapsedTimer(rec);
    } else {
      this.setData({
        mode: 'start',
        date: datetime.todayKey(),
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
  onDestinationInput(e) { this.setData({ destination: e.detail.value }); },
  onWeatherChange(e) { this.setData({ weatherIndex: parseInt(e.detail.value) }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }); },

  onStartOuting() {
    const { date, time, destination, weathers, weatherIndex, notes } = this.data;
    if (!destination.trim()) {
      wx.showToast({ title: '请输入目的地', icon: 'none' }); return;
    }

    const startTime = datetime.parseDateTime(date, time);
    const record = {
      id: storage.generateId(),
      type: 'outing',
      createdAt: Date.now(),
      recordedAt: startTime,
      dateKey: date,
      data: {
        destination: destination.trim(),
        startTime,
        endTime: null,
        duration: null,
        weather: weathers[weatherIndex],
        notes: notes.trim()
      }
    };

    storage.addRecord(record);
    storage.setActiveOuting({ id: record.id, dateKey: date });

    wx.showToast({ title: '出发啦 🌳', icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  onEndOuting() {
    const { activeOuting, activeRecord, endDate, endTime } = this.data;
    if (!activeOuting || !activeRecord) return;

    const endTs = datetime.parseDateTime(endDate, endTime);
    const startTs = activeRecord.data.startTime;
    const duration = datetime.durationMinutes(startTs, endTs);

    if (endTs <= startTs) {
      wx.showToast({ title: '返回时间须晚于出发时间', icon: 'none' }); return;
    }

    storage.updateRecord(activeOuting.id, activeOuting.dateKey, { endTime: endTs, duration });
    storage.clearActiveOuting();

    wx.showToast({ title: `外出${datetime.formatDuration(duration)} 🏠`, icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  onCancelActive() {
    wx.showModal({
      title: '取消外出记录',
      content: '确定要取消当前外出记录吗？',
      confirmColor: '#FF8FAB',
      success: (res) => {
        if (res.confirm) {
          const { activeOuting } = this.data;
          if (activeOuting) {
            storage.deleteRecord(activeOuting.id, activeOuting.dateKey);
            storage.clearActiveOuting();
          }
          wx.navigateBack();
        }
      }
    });
  }
});
