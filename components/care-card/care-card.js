const datetime = require('../../utils/datetime');
const constants = require('../../utils/constants');
const cloud = require('../../utils/cloud');

Component({
  properties: {
    record: {
      type: Object,
      value: null
    },
    showDate: {
      type: Boolean,
      value: false
    }
  },

  data: {
    cat: null,
    timeLabel: '',
    summary: '',
    pending: false
  },

  observers: {
    'record': function(record) {
      if (!record) return;
      const cat = constants.CATEGORY_MAP[record.type] || { label: record.type, emoji: '📝', color: '#E0E0E0', bgColor: '#F5F5F5' };
      const timeLabel = this.properties.showDate
        ? datetime.formatDateTime(record.recordedAt)
        : datetime.formatTime(record.recordedAt);
      const summary = this._buildSummary(record);
      const pending = cloud.isPending(record.id);
      this.setData({ cat, timeLabel, summary, pending });
    }
  },

  methods: {
    _buildSummary(record) {
      const d = record.data;
      switch (record.type) {
        case 'feeding': {
          if (d.source === 'bottle') return `奶瓶 ${d.amount || 0}ml`;
          if (d.source === 'left') return `左侧母乳${d.duration ? ' ' + d.duration + '分钟' : ''}`;
          if (d.source === 'right') return `右侧母乳${d.duration ? ' ' + d.duration + '分钟' : ''}`;
          return '喂奶';
        }
        case 'diaper': {
          const typeMap = { wet: '湿尿布', dirty: '大便', both: '湿+大便' };
          const type = typeMap[d.diaperType] || '换尿布';
          return `${type}${d.color ? ' · ' + d.color : ''}${d.hasRash ? ' · 有尿布疹' : ''}`;
        }
        case 'sleep': {
          if (d.endTime) {
            return `${d.location || ''} ${datetime.formatDuration(d.duration)}`.trim();
          }
          return `${d.location || '睡眠'}进行中...`;
        }
        case 'medication':
          return `${d.name || '用药'}${d.dose ? ' ' + d.dose : ''}`;
        case 'vaccination':
          return d.vaccineName || '疫苗接种';
        case 'outing': {
          if (d.endTime) {
            return `${d.destination || '外出'} ${datetime.formatDuration(d.duration)}`.trim();
          }
          return `${d.destination || '外出'}进行中...`;
        }
        case 'bath':
          return `${d.waterTemp ? d.waterTemp + '°C' : ''}${d.duration ? ' ' + d.duration + '分钟' : ''}`.trim() || '洗澡';
        case 'food':
          return `${d.foodName || '辅食'}${d.isFirstTime ? ' ⭐首次' : ''}`;
        case 'milestone':
          return d.title || '里程碑';
        default:
          return record.type;
      }
    },

    onTap() {
      this.triggerEvent('cardtap', { record: this.properties.record });
    }
  }
});
