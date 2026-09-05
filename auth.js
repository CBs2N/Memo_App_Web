// 认证、会话、密码、操作日志（基于纯 JS 存储）
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const store = require('./store');
const config = require('./config');

// 生成随机密码：8位，去除易混淆字符(0/O/o/1/l/I)
const PW_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genPassword(len = 8) {
  const buf = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += PW_CHARS[buf[i] % PW_CHARS.length];
  return s;
}

function hashPwd(p) { return bcrypt.hashSync(p, 10); }
function verifyPwd(p, h) { return !!h && bcrypt.compareSync(p, h); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

function nowStr() { return new Date().toLocaleString('zh-CN', { hour12: false }); }

function createSession(user) {
  const token = genToken();
  const expires = new Date(Date.now() + config.SESSION_DAYS * 86400000).toISOString();
  store.insertSession({ token, user_id: user.id, created_at: nowStr(), expires_at: expires });
  return token;
}

function getUserByToken(token) {
  if (!token) return null;
  const s = store.getSession(token);
  if (!s) return null;
  if (s.expires_at && new Date(s.expires_at) < new Date()) { store.deleteSession(token); return null; }
  return store.getUserById(s.user_id);
}
function destroySession(token) { if (token) store.deleteSession(token); }
function destroyUserSessions(userId) { store.deleteUserSessions(userId); }

function log(actor, action, target, detail) {
  try {
    store.addLog({ actor: actor || 'system', action, target: target || '', detail: detail || '' });
  } catch (_) { /* 日志失败不应阻断主流程 */ }
}

module.exports = {
  genPassword, hashPwd, verifyPwd, genToken,
  createSession, getUserByToken, destroySession, destroyUserSessions, log,
};
