const storage = require('../../utils/storage');
const datetime = require('../../utils/datetime');
const constants = require('../../utils/constants');

// Map record.type → the form page under pages/forms that edits it.
const EDIT_ROUTES = {
  feeding:     'feeding',
  diaper:      'diaper',
  sleep:       'sleep',
  medication:  'medication',
  vaccination: 'vaccination',
  outing:      'outing',
  bath:        'bath',
  food:        'food',
  milestone:   'milestone'
};

Page({
  data: {
    record: null,
    cat: null,
    fields: [],
    photos: [],
    videos: [],
    timeDisplay: '',
    dateDisplay: ''
  },

  onLoad(options) {
    this._options = options;
    this._load(options);
  },

  // When returning from the edit form, re-read the record so fresh data renders.
  onShow() {
    if (this._options && this.data.record) this._load(this._options);
  },

  _load(options) {
    const { id, dateKey } = options || {};
    if (!id || !dateKey) return;
    const records = storage.getRecordsByDate(dateKey);
    const record = records.find(r => r.id === id);

    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const cat = constants.CATEGORY_MAP[record.type] || { label: record.type, emoji: '📝', color: '#E0E0E0', bgColor: '#F5F5F5' };
    const fields = this._buildFields(record);

    const photos = (record.type === 'milestone' && record.data.photos && record.data.photos.length > 0)
      ? record.data.photos
      : [];
    const videos = (record.type === 'milestone' && record.data.videos && record.data.videos.length > 0)
      ? record.data.videos
      : [];

    this.setData({
      record,
      cat,
      fields,
      photos,
      videos,
      timeDisplay: datetime.formatTime(record.recordedAt),
      dateDisplay: datetime.dateKeyToDisplay(record.dateKey),
      createdAtDisplay: datetime.formatDateTime(record.createdAt)
    });

    wx.setNavigationBarTitle({ title: `${cat.emoji} ${cat.label}详情` });
  },

  _buildFields(record) {
    const d = record.data;
    const fields = [];

    const add = (label, value) => {
      if (value !== null && value !== undefined && value !== '') {
        fields.push({ label, value: String(value) });
      }
    };

    switch (record.type) {
      case 'feeding':
        const sourceMap = { bottle: '奶瓶', left: '左侧母乳', right: '右侧母乳' };
        add('喂养方式', sourceMap[d.source] || d.source);
        if (d.source === 'bottle') add('奶量', `${d.amount} ml`);
        if (d.source !== 'bottle' && d.duration) add('哺乳时长', `${d.duration} 分钟`);
        add('备注', d.notes);
        break;

      case 'diaper':
        const typeMap = { wet: '湿尿布', dirty: '大便', both: '湿+大便' };
        add('类型', typeMap[d.diaperType] || d.diaperType);
        add('颜色', d.color);
        add('性状', d.consistency);
        add('尿布疹', d.hasRash ? '有' : '无');
        add('备注', d.notes);
        break;

      case 'sleep':
        add('开始时间', datetime.formatDateTime(d.startTime));
        add('结束时间', d.endTime ? datetime.formatDateTime(d.endTime) : '进行中');
        add('睡眠时长', d.duration ? datetime.formatDuration(d.duration) : '--');
        add('睡眠地点', d.location);
        add('备注', d.notes);
        break;

      case 'medication':
        add('药品名称', d.name);
        add('剂量', d.dose);
        add('备注', d.notes);
        break;

      case 'vaccination':
        add('疫苗名称', d.vaccineName);
        add('接种机构', d.clinic);
        add('批次号', d.batchNumber);
        add('接种后反应', d.reactions);
        add('备注', d.notes);
        break;

      case 'outing':
        add('目的地', d.destination);
        add('出发时间', datetime.formatDateTime(d.startTime));
        add('返回时间', d.endTime ? datetime.formatDateTime(d.endTime) : '进行中');
        add('外出时长', d.duration ? datetime.formatDuration(d.duration) : '--');
        add('天气', d.weather);
        add('备注', d.notes);
        break;

      case 'bath':
        add('水温', `${d.waterTemp} °C`);
        add('时长', d.duration ? `${d.duration} 分钟` : null);
        add('使用产品', d.usedProducts);
        add('备注', d.notes);
        break;

      case 'food':
        add('食物名称', d.foodName);
        add('喂食量', d.amount);
        add('首次尝试', d.isFirstTime ? '⭐ 是' : '否');
        add('宝宝反应', d.reaction);
        add('备注', d.notes);
        break;

      case 'milestone':
        add('类型', d.milestoneType);
        add('里程碑名称', d.title);
        add('详细描述', d.description);
        break;
    }

    return fields;
  },

  onPreviewPhoto(e) {
    const current = e.currentTarget.dataset.src;
    wx.previewImage({ current, urls: this.data.photos });
  },

  onEdit() {
    const { record } = this.data;
    if (!record) return;
    const route = EDIT_ROUTES[record.type];
    if (!route) return;
    // Editing an in-progress sleep/outing makes no sense — guard.
    if ((record.type === 'sleep' || record.type === 'outing') && !record.data.endTime) {
      wx.showToast({ title: '进行中的记录请在首页结束后再编辑', icon: 'none', duration: 2000 });
      return;
    }
    wx.navigateTo({
      url: `/pages/forms/${route}/${route}?recordId=${record.id}&dateKey=${record.dateKey}`
    });
  },

  onDelete() {
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？此操作无法撤销。',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          const { record } = this.data;
          storage.deleteRecord(record.id, record.dateKey);
          wx.showToast({ title: '已删除', icon: 'none', duration: 800 });
          setTimeout(() => wx.navigateBack(), 600);
        }
      }
    });
  }
});
