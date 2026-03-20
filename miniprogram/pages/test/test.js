Page({
  data: {
    recipeList: [],
    imageUrl: ''
  },

  // 1. 模拟 SQL：新增记录到集合 (类似 INSERT INTO)
  addRecord() {
    wx.showLoading({ title: '写入中...' })
    
    // 初始化数据库引用
    const db = wx.cloud.database()
    // 获取/选择 recipes 集合（表）
    const recipesCollection = db.collection('recipes')
    
    recipesCollection.add({
      data: {
        name: '测试红烧肉-' + Math.floor(Math.random() * 100), // 模拟随机菜名
        cook: '老公',
        createTime: db.serverDate() // 使用服务端标准时间
      }
    }).then(res => {
      wx.hideLoading()
      wx.showToast({ title: '新增成功', icon: 'success' })
      console.log('写入成功！你可以在控制台的 "数据库 -> recipes" 里看到这条记录:', res._id)
    }).catch(err => {
      wx.hideLoading()
      console.error('写入失败', err)
      if (err.message && err.message.includes('CollectionNotFound')) {
        wx.showModal({ title: '缺少集合', content: '你需要先去云控制台 -> 数据库 -> 点击“+”加号来创建一个名字叫 recipes 的集合（表）' })
      }
    })
  },

  // 2. 模拟 SQL：读取数据 (类似 SELECT * FROM)
  getRecords() {
    wx.showLoading({ title: '读取中...' })
    const db = wx.cloud.database()
    
    db.collection('recipes')
      .orderBy('createTime', 'desc') // 按照时间倒序 (ORDER BY)
      .limit(5)                      // 只取前5条 (LIMIT)
      .get()
      .then(res => {
        wx.hideLoading()
        this.setData({ recipeList: res.data }) // 把数据渲染到前端页面
        console.log('读取到的列表数据 (Array):', res.data)
      }).catch(err => {
        wx.hideLoading()
        console.error('读取失败', err)
      })
  },

  // 3. 模拟对象存储：将图片/文件上传到云端 (OSS/AWS S3)
  uploadImage() {
    // 拉起手机相册选图
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        
        // 提取文件后缀并生成一个基于时间的随机文件名 (防止不同文件覆盖)
        const ext = tempFilePath.match(/\.[^.]+?$/)[0] || '.jpg'
        const cloudPath = 'test-uploads/my_img_' + Date.now() + ext
        
        // 调用云存储的上传 API
        wx.cloud.uploadFile({
          cloudPath: cloudPath, // 云端存储的路径和文件名
          filePath: tempFilePath, // 本地手机的临时路径
        }).then(uploadRes => {
          wx.hideLoading()
          wx.showToast({ title: '上传成功', icon: 'success' })
          
          console.log('上传成功！云存储 FileID 用于跨平台访问文件:', uploadRes.fileID)
          
          this.setData({
            imageUrl: uploadRes.fileID // 小程序的 image 组件天生支持使用 cloud:// 开头的 FileID 渲染图片
          })
          
          wx.showModal({
            title: '上传成功', 
            content: '你可以去云控制台 -> 云存储 -> test-uploads 文件夹下看到这张真实图片'
          })
        }).catch(err => {
          console.error('上传失败', err)
          wx.hideLoading()
        })
      }
    })
  }
})
