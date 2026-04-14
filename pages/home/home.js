const storage   = require('../../utils/storage');
const datetime  = require('../../utils/datetime');
const constants = require('../../utils/constants');
const cloud     = require('../../utils/cloud');

Page({
  data: {
    greeting: '',
    dateDisplay: '',
    babyName: '',
    babyAge: '',
    chips: [],
    todayRecords: [],
    isEmpty: true,
    activeSleep: null,
    activeOuting: null,
    isSyncing: false,
    isLoading: true,
    syncError: false,
    pendingCount: 0,
    // Family entry card
    familyLinked: false,
    familyMemberCount: 0,
    familyInviteCode: ''
  },

  // Memoization: skip _computeStats + _buildChips when the input hasn't changed.
  // Keyed on (dateKey, records length, latest recordedAt). Cheap to compare,
  // sufficient because every mutation changes length or latest timestamp.
  _statsCacheKey: '',
  _statsCache: null,

  onShow() {
    // Gate: redirect to onboarding on first launch
    const app = getApp();
    if (app.globalData.needsOnboarding) {
      wx.navigateTo({ url: '/pages/onboarding/onboarding' });
      return;
    }

    this._refresh();
    this._syncFromCloud();
  },

  onPullDownRefresh() {
    this._syncFromCloud(true).finally(() => wx.stopPullDownRefresh());
  },

  /** Pulls today's records from cloud, then re-renders if new data arrived */
  _syncFromCloud(force) {
    if (!cloud.isAvailable()) {
      this.setData({ isLoading: false });
      return Promise.resolve();
    }
    this.setData({ isSyncing: true, syncError: false });
    return cloud.syncDateFromCloud(datetime.todayKey(), { force: !!force }).then(res => {
      this.setData({ isSyncing: false, isLoading: false });
      if (res.ok && res.merged) {
        this._refresh();  // new records came in from another caregiver
      } else if (!res.ok && res.error === cloud.SYNC_ERR_NETWORK) {
        this.setData({ syncError: true });
      }
    }).catch(() => {
      this.setData({ isSyncing: false, isLoading: false, syncError: true });
    });
  },

  onRetrySync() {
    this._syncFromCloud(true);
  },

  _refresh() {
    const meta = storage.getAppMeta();
    const today = datetime.todayKey();
    const records = storage.getRecordsByDate(today);

    // Memoization key: cheap O(n) scan for max recordedAt.
    let maxRecordedAt = 0;
    for (let i = 0; i < records.length; i++) {
      if (records[i].recordedAt > maxRecordedAt) maxRecordedAt = records[i].recordedAt;
    }
    const cacheKey = `${today}|${records.length}|${maxRecordedAt}`;

    let chips;
    if (this._statsCacheKey === cacheKey && this._statsCache) {
      chips = this._statsCache;
    } else {
      const stats = this._computeStats(records);
      chips = this._buildChips(stats);
      this._statsCacheKey = cacheKey;
      this._statsCache = chips;
    }

    // Sort records newest-first for the timeline (shallow copy to avoid mutating storage).
    const sorted = records.slice().sort((a, b) => b.recordedAt - a.recordedAt);

    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateDisplay = `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;

    // Family entry-card summary. Populated from a local cache written by
    // the family page on its own cloud load — so Home doesn't need to hit
    // cloud for this, and we still always render something informative.
    const familyLinked = !!wx.getStorageSync('family_id');
    let familySummary  = {};
    try { familySummary = wx.getStorageSync('family_summary_cache') || {}; } catch (e) {}

    this.setData({
      greeting: datetime.greeting(),
      dateDisplay,
      babyName: meta.babyName || '小宝贝',
      babyAge: meta.birthDate ? datetime.babyAge(meta.birthDate) : '',
      chips,
      todayRecords: sorted,
      isEmpty: sorted.length === 0,
      activeSleep: storage.getActiveSleep(),
      activeOuting: storage.getActiveOuting(),
      pendingCount: cloud.pendingCount(),
      familyLinked,
      familyMemberCount: familySummary.memberCount || 0,
      familyInviteCode:  familySummary.inviteCode  || wx.getStorageSync('cached_invite_code') || ''
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
  },

  goToFamily() {
    wx.navigateTo({ url: '/pages/family/family' });
  },

  goToMilestones() {
    wx.navigateTo({ url: '/pages/milestones/milestones' });
  }
});
