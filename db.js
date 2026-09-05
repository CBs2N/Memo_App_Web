// 数据访问已迁移到纯 JS 的 ./store（无原生依赖）。
// 本文件仅作兼容入口保留：任何仍 require('./db') 的旧引用会自动转发到 store。
module.exports = require('./store');
