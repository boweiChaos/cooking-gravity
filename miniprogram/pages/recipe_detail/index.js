const app = getApp();

Page({
  data: {
    recipe: null,
    recipeId: '',
    isAdmin: false,
    isInTonightMenu: false, // 是否已经在今晚菜单
    todayMenuId: '' // 保存今晚菜单的文档 ID 便于操作
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ 
        recipeId: options.id,
        isAdmin: app.globalData.isAdmin
      });
      this.fetchDetail(options.id);
      this.checkIfInMenu(); // 进入页面即检查
    }
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    db.collection('recipes').doc(id).get().then(res => {
      this.setData({ recipe: res.data });
      wx.hideLoading();
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '找不到这道菜', icon: 'none' });
    });
  },

  // 点击放大图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({
      current: current,
      urls: this.data.recipe.images
    });
  },

  // 跳转去编辑
  editRecipe() {
    wx.navigateTo({
      url: `/pages/recipe_edit/index?id=${this.data.recipeId}`
    });
  },

  // 跳转小红书逻辑（由于微信限制，采用行业标准的剪贴板方案）
  jumpToXhs() {
    if (!this.data.recipe.xhsLink) return;
    
    // 复制链接到系统剪贴板
    wx.setClipboardData({
      data: this.data.recipe.xhsLink,
      success: () => {
        // 覆盖系统默认的 '内容已复制' 提示，给出更友好的引导
        wx.hideToast();
        wx.showModal({
          title: '链接已复制',
          content: '由于微信无法直接跳转小红书，我已帮你复制了链接。现在只需打开小红书 App 即可自动跳转到原帖！',
          confirmText: '去打开',
          showCancel: false,
          confirmColor: '#FF2442'
        });
      }
    });
  },

  // 检查是否在今晚菜单
  checkIfInMenu() {
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const db = wx.cloud.database();
    
    db.collection('daily_menus').where({ date: dateStr }).get().then(res => {
      if (res.data.length > 0) {
        const menu = res.data[0];
        const isIn = menu.recipe_ids && menu.recipe_ids.includes(this.data.recipeId);
        this.setData({ 
          isInTonightMenu: isIn,
          todayMenuId: menu._id
        });
      }
    });
  },

  // 加入今晚菜单的核心逻辑
  addToTonightMenu() {
    wx.showLoading({ title: '上菜中...', mask: true });
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const db = wx.cloud.database();
    const _ = db.command;

    db.collection('daily_menus')
      .where({ date: dateStr })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const menuId = res.data[0]._id;
          if (res.data[0].recipe_ids && res.data[0].recipe_ids.includes(this.data.recipeId)) {
            wx.hideLoading();
            return wx.showToast({ title: '已经在今晚菜单啦', icon: 'none' });
          }
          db.collection('daily_menus').doc(menuId).update({
            data: { recipe_ids: _.push(this.data.recipeId) }
          }).then(() => {
            wx.hideLoading();
            this.setData({ isInTonightMenu: true });
            wx.showToast({ title: '已添加到菜单!', icon: 'success' });
          });
        } else {
          db.collection('daily_menus').add({
            data: {
              date: dateStr,
              recipe_ids: [this.data.recipeId],
              create_time: db.serverDate()
            }
          }).then(addRes => {
            wx.hideLoading();
            this.setData({ isInTonightMenu: true, todayMenuId: addRes._id });
            wx.showToast({ title: '钦定成功!', icon: 'success' });
          });
        }
      });
  },

  // 从今晚菜单移除
  removeFromTonightMenu() {
    if (!this.data.todayMenuId) return;
    
    wx.showModal({
      title: '要撤回吗？',
      content: '确定要把这道菜从今晚菜单中移除吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在移除...' });
          const db = wx.cloud.database();
          const _ = db.command;
          
          db.collection('daily_menus').doc(this.data.todayMenuId).update({
            data: {
              recipe_ids: _.pull(this.data.recipeId) // 使用 _.pull 原子操作移除特定元素
            }
          }).then(() => {
            wx.hideLoading();
            this.setData({ isInTonightMenu: false });
            wx.showToast({ title: '已移除', icon: 'success' });
          }).catch(err => {
            wx.hideLoading();
            console.error(err);
          });
        }
      }
    });
  }
});
