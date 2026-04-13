// ⚠️  Replace the two TODO values below before deploying:
//     1. CLOUD_ENV_ID  → 云开发环境 ID（云开发控制台 → 环境 → 环境ID）
//     2. project.config.json → appid（替换为你的小程序 AppID）

const CLOUD_ENV_ID = 'your-cloud-env-id';  // TODO: replace

App({
  onLaunch() {
    // ── Cloud initialisation ────────────────────────────────────────────────
    // Skip cloud init if env id is still a placeholder to avoid startup crash.
    if (wx.cloud && CLOUD_ENV_ID && CLOUD_ENV_ID !== 'your-cloud-env-id') {
      try {
        wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
      } catch (e) {
        console.warn('[app] cloud init failed:', e);
      }
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
