const storage   = require('../../../utils/storage');
const datetime  = require('../../../utils/datetime');
const constants = require('../../../utils/constants');
const formedit  = require('../../../utils/formedit');

Page({
  data: {
    mode: 'start',   // 'start' | 'end' | 'edit'
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
    endTime: '',
    // Edit mode state
    isEdit: false,
    editingId: null,
    editingDateKey: null
  },

  _timer: null,

  onLoad(options) {
    // If we're editing an existing (completed) sleep record, skip active-state.
    const rec = formedit.beginEdit(this, options);
    if (rec) {
      const d = rec.data || {};
      const locIdx = Math.max(0, this.data.locations.indexOf(d.location));
      const startDate = d.startTime ? datetime.dateToKey(new Date(d.startTime)) : rec.dateKey;
      const startTime = d.startTime ? datetime.formatTime(d.startTime) : datetime.formatTime(rec.recordedAt);
      const endDate   = d.endTime   ? datetime.dateToKey(new Date(d.endTime))   : startDate;
      const endTime   = d.endTime   ? datetime.formatTime(d.endTime)             : datetime.currentTime();
      this.setData({
        mode: 'edit',
        date: startDate,
        time: startTime,
        endDate,
        endTime,
        locationIndex: locIdx,
        notes: d.notes || ''
      });
      return;
    }

    const active = storage.getActiveSleep();
    if (active) {
      const records = storage.getRecordsByDate(active.dateKey);
      const activeRec = records.find(r => r.id === active.id) || null;
      this.setData({
        mode: 'end',
        activeSleep: active,
        activeRecord: activeRec,
        endDate: datetime.todayKey(),
        endTime: datetime.currentTime()
      });
      this._startElapsedTimer(activeRec);
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

  onSaveEdit() {
    const { date, time, endDate, endTime, locations, locationIndex, notes } = this.data;
    const startTs = datetime.parseDateTime(date, time);
    const endTs   = datetime.parseDateTime(endDate, endTime);

    if (endTs <= startTs) {
      wx.showToast({ title: '结束时间须晚于开始时间', icon: 'none' }); return;
    }
    const duration = datetime.durationMinutes(startTs, endTs);

    const record = {
      id: storage.generateId(),
      type: 'sleep',
      createdAt: Date.now(),
      recordedAt: startTs,
      dateKey: date,
      data: {
        startTime: startTs,
        endTime: endTs,
        duration,
        location: locations[locationIndex],
        notes: notes.trim()
      }
    };

    formedit.commitSave(this, record);
    wx.showToast({ title: '已更新 ✓', icon: 'none', duration: 1200 });
    setTimeout(() => wx.navigateBack(), 800);
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
