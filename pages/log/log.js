const storage = require('../../utils/storage');
const datetime = require('../../utils/datetime');
const constants = require('../../utils/constants');

Page({
  data: {
    categories: []
  },

  onShow() {
    this._buildCategories();
  },

  _buildCategories() {
    const activeSleep = storage.getActiveSleep();
    const activeOuting = storage.getActiveOuting();

    const categories = constants.CATEGORIES.map(cat => {
      const last = storage.getLastRecordOfType(cat.key);
      let lastAgo = last ? datetime.timeAgo(last.recordedAt) : '暂无记录';
      let badge = '';

      if (cat.key === 'sleep' && activeSleep) {
        badge = '进行中';
      } else if (cat.key === 'outing' && activeOuting) {
        badge = '进行中';
      }

      return {
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        bgColor: cat.bgColor,
        lastAgo,
        badge
      };
    });

    this.setData({ categories });
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: `/pages/forms/${key}/${key}` });
  }
});
