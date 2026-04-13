App({
  onLaunch() {
    // Initialize app metadata on first launch
    const meta = wx.getStorageSync('app_meta');
    if (!meta) {
      wx.setStorageSync('app_meta', {
        babyName: '小宝贝',
        birthDate: '',
        version: '1.0.0'
      });
    }

    // Initialize days index if missing
    if (!wx.getStorageSync('days_index')) {
      wx.setStorageSync('days_index', []);
    }
  },

  globalData: {
    babyName: '小宝贝',
    birthDate: ''
  }
});
