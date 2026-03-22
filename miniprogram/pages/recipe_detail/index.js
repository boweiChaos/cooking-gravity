const app = getApp();

Page({
  data: {
    recipe: null,
    recipeId: '',
    isAdmin: false,
    isInTonightMenu: false,
    todayMenuId: '',
    isGrouped: false,
    hasSteps: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ 
        recipeId: options.id,
        isAdmin: app.globalData.isAdmin
      });
      this.fetchDetail(options.id);
      this.checkIfInMenu();
    }
  },

  fetchDetail(id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    db.collection('recipes').doc(id).get().then(res => {
      const data = res.data;
      const isGrouped = !!(data.stepGroups && data.stepGroups.length);
      const hasSteps = isGrouped || (data.steps && data.steps.length);
      this.setData({ 
        recipe: data,
        isGrouped: isGrouped,
        hasSteps: hasSteps
      });
      wx.hideLoading();
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '找不到这道菜', icon: 'none' });
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({
      current: current,
      urls: this.data.recipe.images
    });
  },

  editRecipe() {
    wx.navigateTo({
      url: `/pages/recipe_edit/index?id=${this.data.recipeId}`
    });
  },

  deleteRecipe() {
    if (!this.data.isAdmin) return;
    wx.showModal({
      title: '要狠心删掉吗？',
      content: '删除后无法恢复，确定要删除这道心血之作吗？',
      confirmColor: '#FF2442',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.database().collection('recipes').doc(this.data.recipeId).remove().then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已彻底删除', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          }).catch(err => {
            wx.hideLoading();
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  jumpToXhs() {
    if (!this.data.recipe.xhsLink) return;
    wx.setClipboardData({
      data: this.data.recipe.xhsLink,
      success: () => {
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

  checkIfInMenu() {
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const db = wx.cloud.database();
    
    db.collection('daily_menus').where({ date: dateStr }).get().then(res => {
      if (res.data.length > 0) {
        const menu = res.data[0];
        let isIn = false;
        if (menu.items && menu.items && menu.items.length > 0) {
          isIn = menu.items.some(item => item.recipe_id === this.data.recipeId);
        } else if (menu.recipe_ids && menu.recipe_ids.includes(this.data.recipeId)) {
          isIn = true;
        }
        this.setData({ 
          isInTonightMenu: isIn,
          todayMenuId: menu._id
        });
      }
    });
  },

  addToTonightMenu() {
    if (!this.data.isAdmin) return;
    wx.showLoading({ title: '上菜中...', mask: true });
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const db = wx.cloud.database();
    const _ = db.command;

    const newItem = {
      recipe_id: this.data.recipeId,
      added_by: app.globalData.role,
      added_by_name: app.globalData.roleName,
      add_time: db.serverDate()
    };

    db.collection('daily_menus')
      .where({ date: dateStr })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const menuId = res.data[0]._id;
          const menu = res.data[0];
          
          let isAlreadyIn = false;
          if (menu.items && menu.items.length > 0) {
            isAlreadyIn = menu.items.some(item => item.recipe_id === this.data.recipeId);
          } else if (menu.recipe_ids && menu.recipe_ids.includes(this.data.recipeId)) {
            isAlreadyIn = true;
          }
          
          if (isAlreadyIn) {
            wx.hideLoading();
            return wx.showToast({ title: '已经在今晚菜单啦', icon: 'none' });
          }

          db.collection('daily_menus').doc(menuId).update({
            data: { items: _.push(newItem) }
          }).then(() => {
            wx.hideLoading();
            this.setData({ isInTonightMenu: true });
            wx.showToast({ title: '已添加到菜单!', icon: 'success' });
          });
        } else {
          db.collection('daily_menus').add({
            data: {
              date: dateStr,
              items: [newItem],
              recipe_ids: [],
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

  removeFromTonightMenu() {
    if (!this.data.isAdmin || !this.data.todayMenuId) return;
    
    wx.showModal({
      title: '要撤回吗？',
      content: '确定要把这道菜从今晚菜单中移除吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在移除...' });
          const db = wx.cloud.database();
          const _ = db.command;
          
          db.collection('daily_menus').doc(this.data.todayMenuId).get().then(menuRes => {
            const menu = menuRes.data;
            const items = menu.items || [];
            const newItems = items.filter(item => item.recipe_id !== this.data.recipeId);
            
            db.collection('daily_menus').doc(this.data.todayMenuId).update({
              data: { items: newItems }
            }).then(() => {
              wx.hideLoading();
              this.setData({ isInTonightMenu: false });
              wx.showToast({ title: '已移除', icon: 'success' });
            }).catch(err => {
              wx.hideLoading();
              console.error(err);
            });
          });
        }
      }
    });
  }
});
