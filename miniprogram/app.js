// app.js
App({
  globalData: {
    env: 'cloud1-0g65hyz8b91894f3',
    
    // 👇 1. 【你需要操作的地方】：配置老婆大人的专属 ID（目前暂留空，等你老婆扫码后在控制台拿到她的复制补在这里）
    WIFE_OPENID: "oQVJx3ZG20jRC_OLd9ag7_DiZYm4", 
    
    // 👇 2. 你的专属 ID（勤劳长工/老公）
    HUSBAND_OPENID: "oQVJx3crJ4zxvah3gKxryAE6OpQ4",
    
    openid: "",
    isAdmin: false, // 老公或老婆都会变成 true
    role: "guest", // "wife" | "husband" | "guest"
    roleName: "🍲 客人" 
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
      
      // 核心角色鉴别逻辑：老婆 和 老公 都具有管理员权限
      this.globalData.openid = openid;
      if (openid === this.globalData.WIFE_OPENID) {
        this.globalData.isAdmin = true;
        this.globalData.role = 'wife';
        this.globalData.roleName = '👸 老婆大人';
      } else if (openid === this.globalData.HUSBAND_OPENID) {
        this.globalData.isAdmin = true;
        this.globalData.role = 'husband';
        this.globalData.roleName = '🤵‍♂️ 长工老公';
      } else {
        this.globalData.isAdmin = false;
        this.globalData.role = 'guest';
        this.globalData.roleName = '🍲 蹭饭吃客';
      }
      
      console.log("==================================================");
      console.log("✅ 【当前扫码人的 OpenID 是】👉:", openid);
      console.log("（如果你老婆拿微信扫码，控制台弹出了这个新 ID，请把它复制粘贴到 app.js 的 WIFE_OPENID 里！）");
      console.log(`目前登录状态: ${this.globalData.roleName} | Admin权限: ${this.globalData.isAdmin}`);
      console.log("==================================================");

      // 防止页面加载比云函数返回快，给页面的回调
      if (this.openidCallback) {
        this.openidCallback(openid, this.globalData.isAdmin, this.globalData.roleName);
      }
    }).catch(err => {
      console.error("无感获取 OpenID 失败（是否已上传云函数?）", err);
    });
  }
});
