const app = getApp();

Page({
  data: {
    currentDateObj: null,
    currentDateStr: '', // 如：2026-03-20
    dateLabel: '今天',   // 如：今天、明天、周三
    titleText: '今晚吃什么',
    menuList: [],
    isAdmin: false,
    roleName: ''
  },

  onLoad() {
    this.initDate(new Date());
    
    // 如果首页加载比云函数返回 openid 慢，直接设
    if (app.globalData.openid) {
      this.setData({ 
        isAdmin: app.globalData.isAdmin,
        roleName: app.globalData.roleName
      });
    } else {
      // 否则注册回调等它返回
      app.openidCallback = (openid, isAdmin, roleName) => {
        this.setData({ 
          isAdmin: isAdmin,
          roleName: roleName
        });
      }
    }
  },

  onShow() {
    // 如果不是管理员，强制只看今天
    if (!app.globalData.isAdmin || !this.data.currentDateStr) {
      this.initDate(new Date());
    }
    this.fetchMenuData();
  },

  initDate(dateObj) {
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    // 计算相对标签（今天、明天、昨天）
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateObj);
    target.setHours(0,0,0,0);
    
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    
    let relativeLabel = '';
    let titleText = '当天的菜单';
    
    if (diffDays === 0) {
      relativeLabel = '今天';
      titleText = '今晚的菜单';
    } else if (diffDays === 1) {
      relativeLabel = '明天';
      titleText = '明天的预定菜单';
    } else if (diffDays === -1) {
      relativeLabel = '昨天';
      titleText = '昨天吃的啥来着';
    } else if (diffDays > 1) {
      relativeLabel = `${diffDays}天后`;
      titleText = '未来的预定菜单';
    } else {
      relativeLabel = `${Math.abs(diffDays)}天前`;
      titleText = '历史回顾';
    }

    // 例如：2026年3月20日 (今天)
    let fullDateLabel = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    if (relativeLabel) {
      fullDateLabel += ` · ${relativeLabel}`;
    }

    this.setData({
      currentDateObj: dateObj.getTime(), // 存时间戳方便后续计算
      currentDateStr: dateStr,
      dateLabel: fullDateLabel,
      titleText: titleText
    });
    
    // 触发完日期改变后就去拉取
    this.fetchMenuData();
  },

  prevDay() {
    const newDate = new Date(this.data.currentDateObj);
    newDate.setDate(newDate.getDate() - 1);
    this.initDate(newDate);
  },

  nextDay() {
    const newDate = new Date(this.data.currentDateObj);
    newDate.setDate(newDate.getDate() + 1);
    this.initDate(newDate);
  },

  onDatePick(e) {
    // e.detail.value 是 "YYYY-MM-DD"
    // iOS/Safari 的 Date 强行需要 YYYY/MM/DD
    const dateStr = e.detail.value.replace(/-/g, '/');
    this.initDate(new Date(dateStr));
  },

  fetchMenuData() {
    wx.showLoading({ title: '上菜中...', mask: true });
    const db = wx.cloud.database();
    
    db.collection('daily_menus')
      .where({ date: this.data.currentDateStr })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const menu = res.data[0];
          let recipeIds = [];
          let itemMap = {};
          
          if (menu.items && menu.items.length > 0) {
            recipeIds = menu.items.map(item => item.recipe_id);
            menu.items.forEach(item => {
              itemMap[item.recipe_id] = item;
            });
          } else if (menu.recipe_ids && menu.recipe_ids.length > 0) {
            recipeIds = menu.recipe_ids;
          }
          
          if (recipeIds.length > 0) {
            const _ = db.command;
            db.collection('recipes').where({
              _id: _.in(recipeIds)
            }).get().then(recipeRes => {
              const recipesWithMeta = recipeRes.data.map(recipe => {
                const item = itemMap[recipe._id];
                if (item) {
                  return {
                    ...recipe,
                    added_by: item.added_by,
                    added_by_name: item.added_by_name
                  };
                }
                return recipe;
              });
              
              const orderedRecipes = recipeIds.map(id => 
                recipesWithMeta.find(r => r._id === id)
              ).filter(Boolean);
              
              this.setData({ menuList: orderedRecipes });
              wx.hideLoading();
            });
          } else {
            this.setData({ menuList: [] });
            wx.hideLoading();
          }
        } else {
          this.setData({ menuList: [] });
          wx.hideLoading();
        }
      });
  },

  goToLibrary() {
    wx.navigateTo({ url: '/pages/library/index' });
  },
  
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/recipe_detail/index?id=${id}`,
    });
  }
});
