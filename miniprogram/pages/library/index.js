const app = getApp();

Page({
  data: {
    recipes: [],
    isAdmin: false
  },

  onLoad() {
    this.setData({ isAdmin: app.globalData.isAdmin });
  },

  onShow() {
    this.fetchRecipes();
  },

  fetchRecipes() {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    // todo: 做分页，先请求 20 条
    db.collection('recipes').orderBy('create_time', 'desc').limit(50).get().then(res => {
      this.setData({ recipes: res.data });
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '获取失败', icon: 'none' });
    });
  },

  goToAdd() {
    wx.navigateTo({ url: '/pages/recipe_edit/index' });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/recipe_detail/index?id=${id}` });
  }
});
