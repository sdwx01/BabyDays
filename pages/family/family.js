const cloud  = require('../../utils/cloud');
const storage = require('../../utils/storage');
const datetime = require('../../utils/datetime');

Page({
  data: {
    babyName:    '',
    birthDate:   '',
    babyAge:     '',
    inviteCode:  '',
    members:     [],
    myNickname:  '',
    familyId:    '',
    loading:     true,
    cloudLinked: false
  },

  onShow() {
    this._loadLocal();
    if (cloud.isAvailable()) {
      this._loadFromCloud();
    }
  },

  _loadLocal() {
    const meta      = storage.getAppMeta();
    const userMeta  = wx.getStorageSync('user_meta') || {};
    const familyId  = wx.getStorageSync('family_id') || '';

    this.setData({
      babyName:    meta.babyName  || '小宝贝',
      birthDate:   meta.birthDate || '',
      babyAge:     meta.birthDate ? datetime.babyAge(meta.birthDate) : '',
      myNickname:  userMeta.nickname || '家长',
      familyId,
      cloudLinked: !!familyId
    });
  },

  async _loadFromCloud() {
    this.setData({ loading: true });
    const [familyInfo, members] = await Promise.all([
      cloud.getFamilyInfo(),
      cloud.getFamilyMembers()
    ]);

    const updates = { loading: false };
    if (familyInfo) {
      updates.inviteCode = familyInfo.inviteCode || '';
      updates.babyName   = familyInfo.babyName   || this.data.babyName;
      updates.birthDate  = familyInfo.birthDate  || this.data.birthDate;
      updates.babyAge    = updates.birthDate ? datetime.babyAge(updates.birthDate) : '';
    }
    if (members && members.length > 0) {
      updates.members = members.map(m => ({
        nickname: m.nickname || '家长',
        role:     m.role === 'admin' ? '管理员' : '成员',
        joinedAt: m.joinedAt ? datetime.formatDate(new Date(m.joinedAt).getTime()) : ''
      }));
    }

    this.setData(updates);
  },

  // ── Copy invite code ──────────────────────────────────────────────────────

  onCopyCode() {
    const code = this.data.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制邀请码', icon: 'none' })
    });
  },

  // ── Regenerate invite code ────────────────────────────────────────────────

  async onRefreshCode() {
    wx.showModal({
      title: '刷新邀请码',
      content: '旧邀请码将立即失效，确定继续？',
      confirmColor: '#FF8FAB',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '正在刷新...' });
        const newCode = await cloud.regenerateInviteCode();
        wx.hideLoading();
        if (newCode) {
          this.setData({ inviteCode: newCode });
          wx.showToast({ title: '邀请码已刷新', icon: 'none' });
        } else {
          wx.showToast({ title: '刷新失败，无权限', icon: 'none' });
        }
      }
    });
  },

  // ── Edit nickname ─────────────────────────────────────────────────────────

  onEditNickname() {
    wx.showModal({
      title: '修改我的昵称',
      editable: true,
      placeholderText: this.data.myNickname,
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const nickname = res.content.trim();
          wx.setStorageSync('user_meta', { nickname });
          getApp().globalData.nickName = nickname;
          this.setData({ myNickname: nickname });
          wx.showToast({ title: '昵称已更新', icon: 'none' });
        }
      }
    });
  },

  // ── Go to onboarding (leave family / setup new) ───────────────────────────

  onLeaveFamily() {
    wx.showModal({
      title: '退出家庭',
      content: '退出后本机数据不会删除，但无法与家人同步。确定退出？',
      confirmText:  '退出',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('family_id');
          getApp().globalData.needsOnboarding = true;
          wx.showToast({ title: '已退出家庭', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  }
});
