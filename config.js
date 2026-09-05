// 全局配置 —— 环境变量优先，便于服务器部署时用 PORT/DB_PATH 等覆盖
module.exports = {
  // 服务监听端口，部署时用 PORT=80 等覆盖
  PORT: parseInt(process.env.PORT, 10) || 3000,
  // 会话签名密钥，生产环境务必用环境变量覆盖成随机串
  SESSION_SECRET: process.env.SESSION_SECRET || 'cb2n-memo-dev-secret-please-change',
  // SQLite 数据库文件路径
  DB_PATH: process.env.DB_PATH || './data/memo.db',
  // 应用版本号（显示在页脚）
  VERSION: 'v1.2',
  // 每天 8:00 为切换点：8点前显示前一天/上周五，8点后当天
  DAILY_RESET_HOUR: 8,
  // 会话有效期（天）
  SESSION_DAYS: 7,
};
