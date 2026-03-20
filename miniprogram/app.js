// app.js
App({
  globalData: {
    env: 'cloud1-0g65hyz8b91894f3',
    
    // 👇 1. 【你需要操作的地方】：请把下面控制台打印出的你自己的 OpenID 填到这两个引号中间！
    ADMIN_OPENID: "oQVJx3crJ4zxvah3gKxryAE6OpQ4", 
    
    openid: "",
    isAdmin: false
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      // 初始化云开发环境
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });

      // 启动时自动静默获取当前登录人的 openid
      this.getOpenId();
    }
  },

  getOpenId() {
    wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "getOpenId" }
    }).then(res => {
      const openid = res.result.openid;
      
      // 更新全局状态
      this.globalData.openid = openid;
      // 核心鉴权逻辑：如果当前扫码人的 openid 跟你设定的管理员 ID 一致，那就是老婆大人/管理员
      this.globalData.isAdmin = (openid === this.globalData.ADMIN_OPENID);
      
      console.log("==================================================");
      console.log("✅ 【你的 OpenID 是】👉:", openid);
      console.log("（你先把这个字符串复制，粘贴到 app.js 的 ADMIN_OPENID 里，你就是管理员了！）");
      console.log("目前权限状态 isAdmin:", this.globalData.isAdmin);
      console.log("==================================================");

      // 防止页面加载比云函数返回快，给页面的回调
      if (this.openidCallback) {
        this.openidCallback(openid, this.globalData.isAdmin);
      }
    }).catch(err => {
      console.error("无感获取 OpenID 失败（是否已上传云函数?）", err);
    });
  }
});
