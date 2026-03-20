const app = getApp();

Page({
  data: {
    // 基础信息
    name: '',
    categories: ['肉类', '禽类', '水产', '素菜', '凉菜', '汤羹', '主食', '甜品/零食'],
    catIndex: 0,
    
    // 图片列表（本地临时路径）
    images: [],
    
    // 动态列表：原料
    ingredients: [{ name: '', amount: '' }],
    
    // 动态列表：步骤
    steps: [{ desc: '' }],
    
    // 提示
    tips: '',
    
    // 小红书专属链接
    xhsLink: '',
    
    // 如果是编辑态，记录 id
    editId: ''
  },

  onLoad(options) {
    if (options.id) {
      wx.setNavigationBarTitle({ title: '编辑老婆的绝作' });
      this.setData({ editId: options.id });
      this.loadRecipe(options.id);
    }
  },

  loadRecipe(id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    db.collection('recipes').doc(id).get().then(res => {
      const data = res.data;
      const catIndex = this.data.categories.indexOf(data.category);
      this.setData({
        name: data.name || '',
        catIndex: catIndex !== -1 ? catIndex : 0,
        images: data.images || [],
        ingredients: data.ingredients && data.ingredients.length ? data.ingredients : [{ name: '', amount: '' }],
        steps: data.steps && data.steps.length ? data.steps : [{ desc: '' }],
        tips: data.tips || '',
        xhsLink: data.xhsLink || ''
      });
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '无法读取数据', icon: 'none' });
    });
  },

  // ---- 基础信息 ----
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onCatChange(e) {
    this.setData({ catIndex: e.detail.value });
  },
  onTipsInput(e) {
    this.setData({ tips: e.detail.value });
  },
  onXhsLinkInput(e) {
    this.setData({ xhsLink: e.detail.value });
  },

  // ---- 图片 ----
  chooseImages() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: (res) => {
        const tempPaths = res.tempFiles.map(file => file.tempFilePath);
        this.setData({ images: this.data.images.concat(tempPaths) });
      }
    });
  },
  deleteImage(e) {
    const idx = e.currentTarget.dataset.idx;
    const newImgs = [...this.data.images];
    newImgs.splice(idx, 1);
    this.setData({ images: newImgs });
  },

  // ---- 原料列表 ----
  onIngNameInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const val = e.detail.value;
    const ings = this.data.ingredients;
    ings[idx].name = val;
    this.setData({ ingredients: ings });
  },
  onIngAmountInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const val = e.detail.value;
    const ings = this.data.ingredients;
    ings[idx].amount = val;
    this.setData({ ingredients: ings });
  },
  addIngredient() {
    this.setData({ ingredients: [...this.data.ingredients, { name: '', amount: '' }] });
  },
  delIngredient(e) {
    const idx = e.currentTarget.dataset.idx;
    const ings = [...this.data.ingredients];
    ings.splice(idx, 1);
    this.setData({ ingredients: ings });
  },

  // ---- 步骤列表 ----
  onStepInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const val = e.detail.value;
    const stps = this.data.steps;
    stps[idx].desc = val;
    this.setData({ steps: stps });
  },
  addStep() {
    this.setData({ steps: [...this.data.steps, { desc: '' }] });
  },
  delStep(e) {
    const idx = e.currentTarget.dataset.idx;
    const stps = [...this.data.steps];
    stps.splice(idx, 1);
    this.setData({ steps: stps });
  },

  // ---- 核心：提交到云端 ----
  async submit() {
    if (!this.data.name.trim()) return wx.showToast({ title: '名字都没填怎么行！', icon: 'none' });
    if (this.data.ingredients.length === 0 || !this.data.ingredients[0].name) return wx.showToast({ title: '买点什么菜填一下嘛', icon: 'none' });

    wx.showLoading({ title: '正在保存...', mask: true });

    // 区分老图片（cloud://）和新图片（http://tmp/ 或 wxfile://）
    const oldCloudImages = this.data.images.filter(img => img.startsWith('cloud://'));
    const newLocalImages = this.data.images.filter(img => !img.startsWith('cloud://'));

    // 1. 批量上传新图片到云存储
    const uploadTasks = newLocalImages.map(path => {
      const ext = path.match(/\.[^.]+?$/)?.[0] || '.jpg';
      const cloudPath = `recipes/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
      return wx.cloud.uploadFile({ cloudPath, filePath: path });
    });

    try {
      const uploadResults = await Promise.all(uploadTasks);
      const newFileIDs = uploadResults.map(res => res.fileID); 
      
      // 合并旧图的 fileID 和新上传的 fileID
      const finalFileIDs = [...oldCloudImages, ...newFileIDs];

      const db = wx.cloud.database();
      const submitData = {
        name: this.data.name,
        category: this.data.categories[this.data.catIndex],
        images: finalFileIDs,
        ingredients: this.data.ingredients.filter(i => i.name.trim()), 
        steps: this.data.steps.filter(s => s.desc.trim()), 
        tips: this.data.tips,
        xhsLink: this.data.xhsLink,
        update_time: db.serverDate()
      };

      if (this.data.editId) {
        // 更新现有菜谱
        await db.collection('recipes').doc(this.data.editId).update({
          data: submitData
        });
        wx.hideLoading();
        wx.showToast({ title: '保存成功！', icon: 'success' });
      } else {
        // 新增菜谱
        submitData.create_time = db.serverDate();
        await db.collection('recipes').add({
          data: submitData
        });
        wx.hideLoading();
        wx.showToast({ title: '🚀 上架成功', icon: 'success' });
      }
      
      // 延迟返回
      setTimeout(() => {
        // wx.navigateBack() 可以返回，如果从详情页过来，可能会返回老详情，这里可以在详情页 onShow 做刷新，或者简单点返回两层
        const pages = getCurrentPages();
        if (pages.length > 2 && pages[pages.length - 2].route.includes('recipe_detail')) {
          wx.navigateBack({ delta: 2 }); // 直接退回到图鉴库或主页
        } else {
          wx.navigateBack();
        }
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error("上传错误", err);
      wx.showToast({ title: '上传失败啦', icon: 'none' });
    }
  }
});
