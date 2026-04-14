const storage   = require('../../../utils/storage');
const datetime  = require('../../../utils/datetime');
const constants = require('../../../utils/constants');
const cloud     = require('../../../utils/cloud');
const formedit  = require('../../../utils/formedit');

Page({
  data: {
    date: '',
    typeIndex: 0,
    types: constants.MILESTONE_TYPES,
    suggestions: constants.MILESTONE_SUGGESTIONS,
    title: '',
    description: '',
    photos: [],   // array of image paths (temp or persisted / cloud fileIDs)
    videos: [],   // array of video paths (temp or persisted / cloud fileIDs)
    uploading: false,
    isEdit: false,
    editingId: null,
    editingDateKey: null
  },

  onLoad(options) {
    this.setData({ date: datetime.todayKey() });

    const rec = formedit.beginEdit(this, options);
    if (rec) {
      const d = rec.data || {};
      const tIdx = Math.max(0, this.data.types.indexOf(d.milestoneType));
      this.setData({
        date: rec.dateKey,
        typeIndex: tIdx,
        title: d.title || '',
        description: d.description || '',
        photos: Array.isArray(d.photos) ? d.photos.slice() : [],
        videos: Array.isArray(d.videos) ? d.videos.slice() : []
      });
    }
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

  // ── Video picker ──────────────────────────────────────────────────────────

  onChooseVideo() {
    if (this.data.videos.length >= 3) {
      wx.showToast({ title: '最多添加3段视频', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,    // 60s cap keeps uploads reasonable
      camera: 'back',
      success: (res) => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ videos: [...this.data.videos, ...newPaths] });
      }
    });
  },

  onRemoveVideo(e) {
    const idx = e.currentTarget.dataset.index;
    const videos = this.data.videos.filter((_, i) => i !== idx);
    this.setData({ videos });
  },

  // ── Save ──────────────────────────────────────────────────────────────────

  async onSave() {
    const { date, types, typeIndex, title, description, photos, videos, isEdit, editingId } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请输入里程碑名称', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    const uploadingMedia = photos.length + videos.length > 0;
    wx.showLoading({ title: uploadingMedia ? '正在上传...' : '正在保存...' });

    // In edit mode we reuse the existing id as the cloud storage folder name
    // so re-uploaded media lives under a stable path. For new records,
    // generate a fresh id up front.
    const recordId = editingId || storage.generateId();
    const savedPhotos = await this._persistMedia(photos, recordId, 'photo');
    const savedVideos = await this._persistMedia(videos, recordId, 'video');

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
        photos: savedPhotos,
        videos: savedVideos
      }
    };

    formedit.commitSave(this, record);
    wx.showToast({
      title: isEdit ? '已更新 ✓' : '🌟 里程碑记录成功！',
      icon: 'none',
      duration: 1500
    });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  /**
   * Persists a list of media paths.
   * Paths that already look persisted (cloud://, http(s)://, or wxfile://usr)
   * are passed through untouched so edit-mode doesn't re-upload media.
   * Otherwise: upload to Cloud Storage if available, else wx.saveFile locally.
   */
  async _persistMedia(paths, recordId, kind) {
    if (!paths || paths.length === 0) return [];
    const results = [];
    const familyId = wx.getStorageSync('family_id') || 'local';

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];

      // Already-persisted path — don't re-upload.
      if (_isPersistedPath(p)) {
        results.push(p);
        continue;
      }

      if (cloud.isAvailable()) {
        const ext = _extFor(p, kind);
        const cloudPath = `milestones/${familyId}/${recordId}/${kind}-${Date.now()}-${i}.${ext}`;
        const fileId = await cloud.uploadFile(p, cloudPath);
        results.push(fileId || p);
      } else {
        try {
          const savedPath = await new Promise((resolve, reject) => {
            wx.saveFile({
              tempFilePath: p,
              success: r => resolve(r.savedFilePath),
              fail: reject
            });
          });
          results.push(savedPath);
        } catch (e) {
          console.warn('[milestone] saveFile failed:', e);
          results.push(p);
        }
      }
    }
    return results;
  }
});

function _isPersistedPath(p) {
  if (!p || typeof p !== 'string') return false;
  return p.indexOf('cloud://') === 0
      || p.indexOf('http://') === 0
      || p.indexOf('https://') === 0
      || p.indexOf('wxfile://usr') === 0
      || p.indexOf('store://') === 0;
}

function _extFor(path, kind) {
  const ext = (path.split('.').pop() || '').split('?')[0].toLowerCase();
  if (ext && ext.length <= 5) return ext;
  return kind === 'video' ? 'mp4' : 'jpg';
}
