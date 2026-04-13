const storage = require('../../utils/storage');
const datetime = require('../../utils/datetime');
const constants = require('../../utils/constants');

Page({
  data: {
    greeting: '',
    dateDisplay: '',
    babyName: '',
    babyAge: '',
    chips: [],
    categories: [],
    todayRecords: [],
    isEmpty: true,
    activeSleep: null,
    activeOuting: null
  },

  onShow() {
    this._refresh();
  },

  _refresh() {
    const meta = storage.getAppMeta();
    const today = datetime.todayKey();
    const records = storage.getRecordsByDate(today);

    // Sort records newest-first for the timeline
    const sorted = records.slice().sort((a, b) => b.recordedAt - a.recordedAt);

    const stats = this._computeStats(records);
    const chips = this._buildChips(stats);
    const categories = this._buildCategories(stats);

    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateDisplay = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;

    this.setData({
      greeting: datetime.greeting(),
      dateDisplay,
      babyName: meta.babyName || '小宝贝',
      babyAge: meta.birthDate ? datetime.babyAge(meta.birthDate) : '',
      chips,
      categories,
      todayRecords: sorted,
      isEmpty: sorted.length === 0,
      activeSleep: storage.getActiveSleep(),
      activeOuting: storage.getActiveOuting()
    });
  },

  _computeStats(records) {
    const stats = {};
    constants.CATEGORIES.forEach(cat => {
      const catRecords = records.filter(r => r.type === cat.key);
      catRecords.sort((a, b) => b.recordedAt - a.recordedAt);
      stats[cat.key] = {
        count: catRecords.length,
        lastRecord: catRecords[0] || null,
        lastAgo: catRecords.length ? datetime.timeAgo(catRecords[0].recordedAt) : null
      };
    });

    // Total sleep minutes
    const sleepRecords = records.filter(r => r.type === 'sleep' && r.data.duration);
    stats.sleep.totalMinutes = sleepRecords.reduce((s, r) => s + (r.data.duration || 0), 0);

    // Total feeding ml
    const feedingRecords = records.filter(r => r.type === 'feeding' && r.data.source === 'bottle' && r.data.amount);
    stats.feeding.totalMl = feedingRecords.reduce((s, r) => s + (r.data.amount || 0), 0);

    return stats;
  },

  _buildChips(stats) {
    const chips = [];

    // Feedings
    const f = stats.feeding;
    chips.push({
      emoji: '🍼', label: '喂奶',
      value: `${f.count}次`,
      subtext: f.totalMl > 0 ? `共${f.totalMl}ml` : (f.lastAgo || '今日暂无'),
      color: '#FFB5C8', bgColor: '#FFF0F5'
    });

    // Diapers
    const d = stats.diaper;
    chips.push({
      emoji: '👶', label: '换尿布',
      value: `${d.count}次`,
      subtext: d.lastAgo || '今日暂无',
      color: '#FFE4B5', bgColor: '#FFFBF0'
    });

    // Sleep
    const sl = stats.sleep;
    chips.push({
      emoji: '😴', label: '睡眠',
      value: sl.totalMinutes > 0 ? datetime.formatDuration(sl.totalMinutes) : `${sl.count}次`,
      subtext: sl.lastAgo || '今日暂无',
      color: '#B5F0FF', bgColor: '#F0FBFF'
    });

    return chips;
  },

  _buildCategories(stats) {
    return constants.CATEGORIES.map(cat => {
      const s = stats[cat.key] || { count: 0, lastAgo: null };
      return {
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        color: cat.color,
        bgColor: cat.bgColor,
        count: s.count,
        lastAgo: s.lastAgo || '暂无记录'
      };
    });
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: `/pages/forms/${key}/${key}` });
  },

  onCardTap(e) {
    const record = e.detail.record;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${record.id}&dateKey=${record.dateKey}`
    });
  },

  onLogTap() {
    wx.switchTab({ url: '/pages/log/log' });
  },

  goToSleep() {
    wx.navigateTo({ url: '/pages/forms/sleep/sleep' });
  },

  goToOuting() {
    wx.navigateTo({ url: '/pages/forms/outing/outing' });
  }
});
