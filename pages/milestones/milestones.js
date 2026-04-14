// Standalone "成长相册" (milestone recap) page.
//
// Why a separate module:
//   Milestones are fundamentally different from daily care records
//   (feeding, diaper, sleep...). They're permanent memories rather than
//   repeating events — a photo album / timeline is a better UX than
//   mixing them into the per-day list.
//
// The page aggregates every record of type === 'milestone' across the
// whole days_index, groups by year+month, and renders a chronological
// timeline with cover photo / video thumbnail + title.

const storage  = require('../../utils/storage');
const datetime = require('../../utils/datetime');
const cloud    = require('../../utils/cloud');

Page({
  data: {
    groups: [],     // [{ monthKey, monthLabel, items: [...] }]
    totalCount: 0,
    firstsCount: 0, // count of titles starting with "第一次"
    isEmpty: true,
    isLoading: true
  },

  onShow() {
    // Render immediately from local storage — avoid firing 60 cloud calls
    // on every navigation. Users can pull-to-refresh to force a sync.
    this._rebuild();
  },

  onPullDownRefresh() {
    this._backgroundSync(true).finally(() => {
      this._rebuild();
      wx.stopPullDownRefresh();
    });
  },

  async _backgroundSync(force) {
    if (!cloud.isAvailable()) return;
    const recent = datetime.recentDateKeys(60);
    // Run sequentially to avoid hitting cloud function rate limits.
    for (const dk of recent) {
      try { await cloud.syncDateFromCloud(dk, { force: !!force }); } catch (e) {}
    }
    this._rebuild();
  },

  _rebuild() {
    const index = storage.getDaysIndex();
    const milestones = [];

    for (const dateKey of index) {
      const records = storage.getRecordsByDate(dateKey);
      for (const r of records) {
        if (r.type !== 'milestone') continue;
        const d = r.data || {};
        const photos = Array.isArray(d.photos) ? d.photos : [];
        const videos = Array.isArray(d.videos) ? d.videos : [];

        milestones.push({
          id: r.id,
          dateKey: r.dateKey,
          recordedAt: r.recordedAt,
          dateDisplay: datetime.dateKeyToDisplay(r.dateKey),
          monthKey: _monthKey(r.dateKey),
          milestoneType: d.milestoneType || '',
          title: d.title || '里程碑',
          description: d.description || '',
          cover: photos[0] || null,
          coverIsVideo: !photos.length && videos.length > 0,
          coverVideo: videos[0] || null,
          photoCount: photos.length,
          videoCount: videos.length,
          isFirst: (d.title || '').indexOf('第一次') === 0
        });
      }
    }

    // Sort newest first
    milestones.sort((a, b) => b.recordedAt - a.recordedAt);

    // Group by month
    const groupMap = {};
    for (const m of milestones) {
      if (!groupMap[m.monthKey]) {
        groupMap[m.monthKey] = {
          monthKey: m.monthKey,
          monthLabel: _monthLabel(m.monthKey),
          items: []
        };
      }
      groupMap[m.monthKey].items.push(m);
    }
    const groups = Object.keys(groupMap)
      .sort((a, b) => b.localeCompare(a))
      .map(k => groupMap[k]);

    this.setData({
      groups,
      totalCount: milestones.length,
      firstsCount: milestones.filter(m => m.isFirst).length,
      isEmpty: milestones.length === 0,
      isLoading: false
    });
  },

  onItemTap(e) {
    const { id, dateKey } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}&dateKey=${dateKey}` });
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/forms/milestone/milestone' });
  }
});

function _monthKey(dateKey) {
  // "YYYY-MM-DD" → "YYYY-MM"
  return (dateKey || '').slice(0, 7);
}

function _monthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}年${m}月`;
}
