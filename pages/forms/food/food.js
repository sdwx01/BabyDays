const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const constants = require('../../../utils/constants');

Page({
  data: {
    date: '',
    time: '',
    foodName: '',
    amount: '',
    isFirstTime: false,
    reactionIndex: 0,
    reactions: constants.FOOD_REACTIONS,
    notes: ''
  },

  onLoad() {
    this.setData({ date: datetime.todayKey(), time: datetime.currentTime() });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onFoodNameInput(e) { this.setData({ foodName: e.detail.value }); },
  onAmountInput(e) { this.setData({ amount: e.detail.value }); },
  onFirstTimeChange(e) { this.setData({ isFirstTime: e.detail.value }); },
  onReactionChange(e) { this.setData({ reactionIndex: parseInt(e.detail.value) }); },
  onNotesInput(e) { this.setData({ notes: e.detail.value }); },

  onSave() {
    const { date, time, foodName, amount, isFirstTime, reactions, reactionIndex, notes } = this.data;
    if (!foodName.trim()) { wx.showToast({ title: '请输入食物名称', icon: 'none' }); return; }

    const record = {
      id: storage.generateId(),
      type: 'food',
      createdAt: Date.now(),
      recordedAt: datetime.parseDateTime(date, time),
      dateKey: date,
      data: {
        foodName: foodName.trim(),
        amount: amount.trim(),
        isFirstTime,
        reaction: reactions[reactionIndex],
        notes: notes.trim()
      }
    };

    storage.addRecord(record);
    const toast = isFirstTime ? '🌟首次记录！' : '已记录 🥕';
    wx.showToast({ title: toast, icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  }
});
