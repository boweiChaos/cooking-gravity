const app = getApp();

Page({
  data: {
    currentDateObj: null,
    currentDateStr: '', // 如：2026-03-20
    dateLabel: '今天',   // 如：今天、明天、周三
    titleText: '今晚吃什么',
    menuList: [],
    isAdmin: false
  },

  onLoad() {
    this.initDate(new Date());
    
    // 如果首页加载比云函数返回 openid 慢，直接设
    if (app.globalData.openid) {
      this.setData({ isAdmin: app.globalData.isAdmin });
    } else {
      // 否则注册回调等它返回
      app.openidCallback = (openid, isAdmin) => {
        this.setData({ isAdmin: isAdmin });
      }
    }
  },

  onShow() {
    // 每次显示时基于当前 currentDateStr 重新拉取
    if (!this.data.currentDateStr) {
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
    
    let dateLabel = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    let titleText = '当天的菜单';
    
    if (diffDays === 0) {
      dateLabel = '今天';
      titleText = '今晚的菜单';
    } else if (diffDays === 1) {
      dateLabel = '明天';
      titleText = '明天的预定菜单';
    } else if (diffDays === -1) {
      dateLabel = '昨天';
      titleText = '昨天吃的啥来着';
    } else if (diffDays > 1) {
      titleText = '未来的计划';
    } else {
      titleText = '历史回顾';
    }

    this.setData({
      currentDateObj: dateObj.getTime(), // 存时间戳方便后续计算
      currentDateStr: dateStr,
      dateLabel: dateLabel,
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

  fetchMenuData() {
    wx.showLoading({ title: '上菜中...', mask: true });
    const db = wx.cloud.database();
    
    db.collection('daily_menus')
      .where({ date: this.data.currentDateStr })
      .get()
      .then(res => {
        if (res.data.length > 0 && res.data[0].recipe_ids && res.data[0].recipe_ids.length > 0) {
          const recipeIds = res.data[0].recipe_ids;
          const _ = db.command;
          // 一次性通过 IN 查询拿到所有的菜品信息
          db.collection('recipes').where({
            _id: _.in(recipeIds)
          }).get().then(recipeRes => {
            this.setData({ menuList: recipeRes.data });
            wx.hideLoading();
          });
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
