const app = getApp();
const { pinyin } = require('pinyin-pro');

Page({
  data: {
    groupedRecipes: [],
    isAdmin: false
  },

  onLoad() {
    this.setData({ isAdmin: app.globalData.isAdmin });
  },

  onShow() {
    this.fetchRecipes();
  },

  getPinyin(chinese) {
    if (!chinese) return '';
    try {
      const result = pinyin(chinese, { 
        toneType: 'none', 
        type: 'array'
      });
      if (result && result.length > 0) {
        return result[0][0].toUpperCase();
      }
    } catch (e) {
      console.error('拼音转换失败', e);
    }
    return chinese.charAt(0).toUpperCase();
  },

  groupAndSortRecipes(recipes) {
    const groups = {};
    recipes.forEach(recipe => {
      const category = recipe.category || '其他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    });

    let groupList = Object.keys(groups).map(category => {
      const recipesInGroup = groups[category].sort((a, b) => {
        const aKey = this.getPinyin(a.name);
        const bKey = this.getPinyin(b.name);
        return aKey.localeCompare(bKey);
      });
      return {
        category: category,
        recipes: recipesInGroup,
        expanded: true
      };
    });

    groupList.sort((a, b) => {
      const aKey = this.getPinyin(a.category);
      const bKey = this.getPinyin(b.category);
      return aKey.localeCompare(bKey);
    });

    return groupList;
  },

  toggleCategory(e) {
    const index = e.currentTarget.dataset.index;
    const groupedRecipes = this.data.groupedRecipes;
    groupedRecipes[index].expanded = !groupedRecipes[index].expanded;
    this.setData({ groupedRecipes: groupedRecipes });
  },

  fetchRecipes() {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    db.collection('recipes').limit(100).get().then(res => {
      const grouped = this.groupAndSortRecipes(res.data);
      this.setData({ groupedRecipes: grouped });
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
