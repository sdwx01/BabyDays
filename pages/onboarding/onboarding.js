const cloud = require('../../utils/cloud');
const storage = require('../../utils/storage');

Page({
  data: {
    step: 'choose',   // 'choose' | 'create' | 'join'
    loading: false,

    // Create-family form
    babyName:  '',
    birthDate: '',
    nickname:  '',

    // Join-family form
    inviteCode: '',
    joinNickname: ''
  },

  // ── Navigation between steps ──────────────────────────────────────────────

  goCreate() { this.setData({ step: 'create' }); },
  goJoin()   { this.setData({ step: 'join' });   },
  goBack()   { this.setData({ step: 'choose' }); },

  // ── Field handlers ────────────────────────────────────────────────────────

  onBabyNameInput(e)    { this.setData({ babyName:     e.detail.value }); },
  onBirthDateChange(e)  { this.setData({ birthDate:    e.detail.value }); },
  onNicknameInput(e)    { this.setData({ nickname:     e.detail.value }); },
  onInviteCodeInput(e)  { this.setData({ inviteCode:   e.detail.value }); },
  onJoinNicknameInput(e){ this.setData({ joinNickname: e.detail.value }); },

  // ── Create family ─────────────────────────────────────────────────────────

  async onCreateFamily() {
    const { babyName, birthDate, nickname } = this.data;

    if (!babyName.trim()) { wx.showToast({ title: '请输入宝宝的名字', icon: 'none' }); return; }
    if (!nickname.trim()) { wx.showToast({ title: '请输入你的昵称', icon: 'none' }); return; }

    this.setData({ loading: true });
    wx.showLoading({ title: '正在创建...' });

    const res = await cloud.createFamily(babyName.trim(), birthDate, nickname.trim());

    wx.hideLoading();
    this.setData({ loading: false });

    if (!res.success) {
      wx.showToast({ title: res.error || '创建失败', icon: 'none' }); return;
    }

    this._completeSetup(res.familyId, babyName.trim(), birthDate, nickname.trim(), true);
  },

  // ── Join family ───────────────────────────────────────────────────────────

  async onJoinFamily() {
    const { inviteCode, joinNickname } = this.data;

    if (inviteCode.trim().length !== 6) {
      wx.showToast({ title: '邀请码为6位字符', icon: 'none' }); return;
    }
    if (!joinNickname.trim()) {
      wx.showToast({ title: '请输入你的昵称', icon: 'none' }); return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '正在加入...' });

    const res = await cloud.joinFamily(inviteCode.trim(), joinNickname.trim());

    wx.hideLoading();
    this.setData({ loading: false });

    if (!res.success) {
      wx.showToast({ title: res.error || '加入失败', icon: 'none' }); return;
    }

    this._completeSetup(res.familyId, res.babyName, res.birthDate, joinNickname.trim(), false);
  },

  // ── Shared post-setup logic ───────────────────────────────────────────────

  async _completeSetup(familyId, babyName, birthDate, nickname, isCreator) {
    // Persist family membership
    wx.setStorageSync('family_id', familyId);
    wx.setStorageSync('user_meta', { nickname });

    // Update app_meta with baby info
    storage.setAppMeta({ babyName, birthDate, version: '1.0.0' });

    // Update globalData
    const app = getApp();
    app.globalData.needsOnboarding = false;
    app.globalData.babyName  = babyName;
    app.globalData.birthDate = birthDate;
    app.globalData.nickName  = nickname;

    if (isCreator) {
      // Migrate any existing local records to cloud
      wx.showLoading({ title: '正在同步数据...' });
      await cloud.migrateLocalToCloud().catch(() => {});
      wx.hideLoading();
    }

    wx.showToast({
      title: isCreator ? '家庭创建成功 🎉' : '加入成功 🎉',
      icon: 'none',
      duration: 1500
    });
    setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1200);
  }
});
