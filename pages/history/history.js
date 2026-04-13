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
    pickerDate: ''
  },

  onShow() {
    const today = datetime.todayKey();
    const currentSelected = this.data.selectedDate || today;
    this._buildDateChips();
    this._loadDate(currentSelected);
    // Pull from cloud for the selected date; re-render if new records arrive
    if (cloud.isAvailable()) {
      cloud.syncDateFromCloud(currentSelected).then(merged => {
        if (merged) {
          this._buildDateChips();
          this._loadDate(currentSelected);
        }
      }).catch(() => {});
    }
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

    const grouped = this._groupByCategory(records);

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
  },

  onPickerChange(e) {
    this._loadDate(e.detail.value);
  },

  onCardTap(e) {
    const record = e.detail.record;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${record.id}&dateKey=${record.dateKey}`
    });
  }
});
