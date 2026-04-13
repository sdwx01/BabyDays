// ⚠️  Before deploying, replace 'your-cloud-env-id' below with your actual
//     WeChat Cloud environment ID (found in the cloud console).

App({
  onLaunch() {
    // ── Cloud initialisation ────────────────────────────────────────────────
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-cloud-env-id',   // TODO: replace with your env ID
        traceUser: true
      });
    }

    // ── Local storage defaults ──────────────────────────────────────────────
    if (!wx.getStorageSync('app_meta')) {
      wx.setStorageSync('app_meta', {
        babyName:  '小宝贝',
        birthDate: '',
        version:   '1.0.0'
      });
    }
    if (!wx.getStorageSync('days_index')) {
      wx.setStorageSync('days_index', []);
    }

    // ── Onboarding gate ─────────────────────────────────────────────────────
    // If the user has no family_id they haven't gone through onboarding yet.
    const familyId = wx.getStorageSync('family_id');
    this.globalData.needsOnboarding = !familyId;

    // Load cached user meta into globalData
    const userMeta = wx.getStorageSync('user_meta') || {};
    this.globalData.nickName = userMeta.nickname || '家长';

    // Load baby info from app_meta
    const meta = wx.getStorageSync('app_meta') || {};
    this.globalData.babyName  = meta.babyName  || '小宝贝';
    this.globalData.birthDate = meta.birthDate || '';
  },

  globalData: {
    babyName:        '小宝贝',
    birthDate:       '',
    nickName:        '家长',
    needsOnboarding: false
  }
});
