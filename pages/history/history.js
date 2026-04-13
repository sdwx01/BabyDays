const storage  = require('../../utils/storage');
const datetime  = require('../../utils/datetime');
const constants = require('../../utils/constants');
const cloud     = require('../../utils/cloud');

Page({
  data: {
    selectedDate: '',
    selectedDateDisplay: '',
    dateChips: [],
    records: [],
    grouped: [],
    isEmpty: true,
    pickerDate: '',
    isLoading: false,
    syncError: false
  },

  // Memoized grouping, keyed on (dateKey, records.length, max recordedAt).
  _groupCacheKey: '',
  _groupCache: null,

  onShow() {
    const today = datetime.todayKey();
    const currentSelected = this.data.selectedDate || today;
    this._buildDateChips();
    this._loadDate(currentSelected);
    this._syncSelected(currentSelected, false);
  },

  onPullDownRefresh() {
    const current = this.data.selectedDate || datetime.todayKey();
    this._syncSelected(current, true).finally(() => wx.stopPullDownRefresh());
  },

  _syncSelected(dateKey, force) {
    if (!cloud.isAvailable()) return Promise.resolve();
    this.setData({ isLoading: true, syncError: false });
    return cloud.syncDateFromCloud(dateKey, { force: !!force }).then(res => {
      this.setData({ isLoading: false });
      if (res.ok && res.merged) {
        this._buildDateChips();
        this._loadDate(dateKey);
      } else if (!res.ok && res.error === cloud.SYNC_ERR_NETWORK) {
        this.setData({ syncError: true });
      }
    }).catch(() => {
      this.setData({ isLoading: false, syncError: true });
    });
  },

  onRetrySync() {
    this._syncSelected(this.data.selectedDate || datetime.todayKey(), true);
  },

  _buildDateChips() {
    const recent = datetime.recentDateKeys(30);
    const daysIndex = storage.getDaysIndex();
    const daysSet = new Set(daysIndex);

    const dateChips = recent.map(key => ({
      key,
      short: datetime.dateKeyToShort(key),
      hasDot: daysSet.has(key),
      isSelected: key === this.data.selectedDate
    }));

    this.setData({ dateChips, pickerDate: this.data.selectedDate || datetime.todayKey() });
  },

  _loadDate(dateKey) {
    const records = storage.getRecordsByDate(dateKey);
    records.sort((a, b) => a.recordedAt - b.recordedAt);

    // Memoization key
    let maxRecordedAt = 0;
    for (let i = 0; i < records.length; i++) {
      if (records[i].recordedAt > maxRecordedAt) maxRecordedAt = records[i].recordedAt;
    }
    const cacheKey = `${dateKey}|${records.length}|${maxRecordedAt}`;

    let grouped;
    if (this._groupCacheKey === cacheKey && this._groupCache) {
      grouped = this._groupCache;
    } else {
      grouped = this._groupByCategory(records);
      this._groupCacheKey = cacheKey;
      this._groupCache = grouped;
    }

    this.setData({
      selectedDate: dateKey,
      selectedDateDisplay: datetime.dateKeyToDisplay(dateKey),
      dateChips: (this.data.dateChips || []).map(c => ({
        ...c,
        isSelected: c.key === dateKey
      })),
      records,
      grouped,
      isEmpty: records.length === 0,
      pickerDate: dateKey
    });
  },

  _groupByCategory(records) {
    const groups = {};
    constants.CATEGORIES.forEach(cat => { groups[cat.key] = []; });
    records.forEach(r => {
      if (groups[r.type]) groups[r.type].push(r);
    });

    return constants.CATEGORIES
      .filter(cat => groups[cat.key].length > 0)
      .map(cat => ({
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        records: groups[cat.key]
      }));
  },

  onDateChipTap(e) {
    const dateKey = e.currentTarget.dataset.key;
    this._loadDate(dateKey);
    this._syncSelected(dateKey, false);
  },

  onPickerChange(e) {
    const dateKey = e.detail.value;
    this._loadDate(dateKey);
    this._syncSelected(dateKey, false);
  },

  onCardTap(e) {
    const record = e.detail.record;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${record.id}&dateKey=${record.dateKey}`
    });
  }
});
