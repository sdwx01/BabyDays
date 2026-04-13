const storage = require('../../../utils/storage');
const datetime = require('../../../utils/datetime');
const constants = require('../../../utils/constants');

Page({
  data: {
    date: '',
    typeIndex: 0,
    types: constants.MILESTONE_TYPES,
    suggestions: constants.MILESTONE_SUGGESTIONS,
    title: '',
    description: '',
    photoNote: ''
  },

  onLoad() {
    this.setData({ date: datetime.todayKey() });
  },

  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTypeChange(e) { this.setData({ typeIndex: parseInt(e.detail.value) }); },
  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onDescriptionInput(e) { this.setData({ description: e.detail.value }); },
  onPhotoNoteInput(e) { this.setData({ photoNote: e.detail.value }); },

  onSuggestionTap(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ title: text });
  },

  onSave() {
    const { date, types, typeIndex, title, description, photoNote } = this.data;
    if (!title.trim()) { wx.showToast({ title: '请输入里程碑名称', icon: 'none' }); return; }

    // Use noon on the selected date as the timestamp
    const [y, m, d] = date.split('-').map(Number);
    const recordedAt = new Date(y, m - 1, d, 12, 0, 0).getTime();

    const record = {
      id: storage.generateId(),
      type: 'milestone',
      createdAt: Date.now(),
      recordedAt,
      dateKey: date,
      data: {
        milestoneType: types[typeIndex],
        title: title.trim(),
        description: description.trim(),
        photoNote: photoNote.trim()
      }
    };

    storage.addRecord(record);
    wx.showToast({ title: '🌟 里程碑记录成功！', icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  }
});
