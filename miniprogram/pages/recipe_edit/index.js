const app = getApp();

Page({
  data: {
    name: '',
    categories: ['肉类', '禽类', '水产', '素菜', '凉菜', '汤羹', '主食', '甜品/零食'],
    catIndex: 0,
    images: [],
    ingredients: [{ name: '', amount: '' }],
    stepGroups: [{ title: '备菜', steps: [{ desc: '' }] }],
    tips: '',
    xhsLink: '',
    editId: ''
  },

  onLoad(options) {
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '非管理员禁止入内', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
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
      
      let stepGroups;
      if (data.stepGroups && data.stepGroups.length) {
        stepGroups = data.stepGroups;
      } else if (data.steps && data.steps.length) {
        stepGroups = [{ title: '步骤', steps: data.steps }];
      } else {
        stepGroups = [{ title: '备菜', steps: [{ desc: '' }] }];
      }
      
      this.setData({
        name: data.name || '',
        catIndex: catIndex !== -1 ? catIndex : 0,
        images: data.images || [],
        ingredients: data.ingredients && data.ingredients.length ? data.ingredients : [{ name: '', amount: '' }],
        stepGroups: stepGroups,
        tips: data.tips || '',
        xhsLink: data.xhsLink || ''
      });
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '无法读取数据', icon: 'none' });
    });
  },

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

  onGroupTitleInput(e) {
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const val = e.detail.value;
    const groups = this.data.stepGroups;
    groups[groupIdx].title = val;
    this.setData({ stepGroups: groups });
  },
  onStepInput(e) {
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const val = e.detail.value;
    const groups = this.data.stepGroups;
    groups[groupIdx].steps[stepIdx].desc = val;
    this.setData({ stepGroups: groups });
  },
  addGroup() {
    const newGroups = [...this.data.stepGroups, { title: '新分组', steps: [{ desc: '' }] }];
    this.setData({ stepGroups: newGroups });
  },
  delGroup(e) {
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const groups = [...this.data.stepGroups];
    groups.splice(groupIdx, 1);
    if (groups.length === 0) {
      groups.push({ title: '备菜', steps: [{ desc: '' }] });
    }
    this.setData({ stepGroups: groups });
  },
  addStep(e) {
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const groups = this.data.stepGroups;
    groups[groupIdx].steps.push({ desc: '' });
    this.setData({ stepGroups: groups });
  },
  delStep(e) {
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const groups = this.data.stepGroups;
    groups[groupIdx].steps.splice(stepIdx, 1);
    if (groups[groupIdx].steps.length === 0) {
      groups[groupIdx].steps.push({ desc: '' });
    }
    this.setData({ stepGroups: groups });
  },

  async submit() {
    if (!this.data.name.trim()) return wx.showToast({ title: '名字都没填怎么行！', icon: 'none' });
    if (this.data.ingredients.length === 0 || !this.data.ingredients[0].name) return wx.showToast({ title: '买点什么菜填一下嘛', icon: 'none' });

    wx.showLoading({ title: '正在保存...', mask: true });

    const oldCloudImages = this.data.images.filter(img => img.startsWith('cloud://'));
    const newLocalImages = this.data.images.filter(img => !img.startsWith('cloud://'));

    const uploadTasks = newLocalImages.map(path => {
      const ext = path.match(/\.[^.]+?$/)?.[0] || '.jpg';
      const cloudPath = `recipes/${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
      return wx.cloud.uploadFile({ cloudPath, filePath: path });
    });

    try {
      const uploadResults = await Promise.all(uploadTasks);
      const newFileIDs = uploadResults.map(res => res.fileID); 
      
      const finalFileIDs = [...oldCloudImages, ...newFileIDs];

      const db = wx.cloud.database();
      const submitData = {
        name: this.data.name,
        category: this.data.categories[this.data.catIndex],
        images: finalFileIDs,
        ingredients: this.data.ingredients.filter(i => i.name.trim()), 
        stepGroups: this.data.stepGroups.map(g => ({
          title: g.title,
          steps: g.steps.filter(s => s.desc.trim())
        })).filter(g => g.steps.length > 0),
        tips: this.data.tips,
        xhsLink: this.data.xhsLink,
        update_time: db.serverDate()
      };

      if (this.data.editId) {
        await db.collection('recipes').doc(this.data.editId).update({
          data: submitData
        });
        wx.hideLoading();
        wx.showToast({ title: '保存成功！', icon: 'success' });
      } else {
        submitData.create_time = db.serverDate();
        await db.collection('recipes').add({
          data: submitData
        });
        wx.hideLoading();
        wx.showToast({ title: '🚀 上架成功', icon: 'success' });
      }
      
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 2 && pages[pages.length - 2].route.includes('recipe_detail')) {
          wx.navigateBack({ delta: 2 });
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
