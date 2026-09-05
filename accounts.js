// 账号生成公共逻辑（seed 脚本与后台"创建用户"共用）
const { pinyin } = require('pinyin-pro');

function initials(name) {
  const arr = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' });
  return (arr || []).map(s => (s ? s.toLowerCase() : '')).join('');
}

function makeUsername(name, studentId) {
  const ini = initials(name);
  if (!ini) throw new Error(`无法识别姓名拼音：${name}`);
  return ini + String(studentId);
}

module.exports = { initials, makeUsername };
