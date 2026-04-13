const storage   = require('../../../utils/storage');
const datetime  = require('../../../utils/datetime');
const constants = require('../../../utils/constants');
const cloud     = require('../../../utils/cloud');

Page({
  data: {
    date: '',
    typeIndex: 0,
    types: constants.MILESTONE_TYPES,
    suggestions: constants.MILESTONE_SUGGESTIONS,
    title: '',
    description: '',
    photos: [],       // temp paths while editing; persisted paths after save
    uploading: false
  },

  onLoad() {
    this.setData({ date: datetime.todayKey() });
  },

  onDateChange(e)      { this.setData({ date:        e.detail.value }); },
  onTypeChange(e)      { this.setData({ typeIndex:   parseInt(e.detail.value) }); },
  onTitleInput(e)      { this.setData({ title:       e.detail.value }); },
  onDescriptionInput(e){ this.setData({ description: e.detail.value }); },

  onSuggestionTap(e) {
    this.setData({ title: e.currentTarget.dataset.text });
  },

  // ── Photo picker ──────────────────────────────────────────────────────────

  onChoosePhoto() {
    const remaining = 9 - this.data.photos.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多添加9张照片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ photos: [...this.data.photos, ...newPaths] });
      }
    });
  },

  onRemovePhoto(e) {
    const idx = e.currentTarget.dataset.index;
    const photos = this.data.photos.filter((_, i) => i !== idx);
    this.setData({ photos });
  },

  onPreviewPhoto(e) {
    const current = e.currentTarget.dataset.src;
    wx.previewImage({ current, urls: this.data.photos });
  },

  // ── Save ──────────────────────────────────────────────────────────────────

  async onSave() {
    const { date, types, typeIndex, title, description, photos } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请输入里程碑名称', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: photos.length > 0 ? '正在上传照片...' : '正在保存...' });

    const recordId = storage.generateId();
    const savedPhotos = await this._persistPhotos(photos, recordId);

    wx.hideLoading();
    this.setData({ uploading: false });

    const [y, m, d] = date.split('-').map(Number);
    const recordedAt = new Date(y, m - 1, d, 12, 0, 0).getTime();

    const record = {
      id: recordId,
      type: 'milestone',
      createdAt: Date.now(),
      recordedAt,
      dateKey: date,
      data: {
        milestoneType: types[typeIndex],
        title: title.trim(),
        description: description.trim(),
        photos: savedPhotos
      }
    };

    storage.addRecord(record);
    wx.showToast({ title: '🌟 里程碑记录成功！', icon: 'none', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  /**
   * Persists temp file paths.
   * - With cloud: uploads to Cloud Storage, returns fileIDs.
   * - Without cloud: saves to local persistent storage via wx.saveFile.
   */
  async _persistPhotos(tempPaths, recordId) {
    if (tempPaths.length === 0) return [];
    const results = [];
    const familyId = wx.getStorageSync('family_id') || 'local';

    for (let i = 0; i < tempPaths.length; i++) {
      const tempPath = tempPaths[i];

      if (cloud.isAvailable()) {
        const ext = (tempPath.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
        const cloudPath = `milestones/${familyId}/${recordId}/${i}.${ext}`;
        const fileId = await cloud.uploadFile(tempPath, cloudPath);
        results.push(fileId || tempPath);
      } else {
        try {
          const savedPath = await new Promise((resolve, reject) => {
            wx.saveFile({
              tempFilePath: tempPath,
              success: r => resolve(r.savedFilePath),
              fail: reject
            });
          });
          results.push(savedPath);
        } catch (e) {
          console.warn('[milestone] saveFile failed:', e);
          results.push(tempPath);
        }
      }
    }
    return results;
  }
});
