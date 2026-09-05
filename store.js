// 纯 JS JSON 文件存储 —— 零原生依赖，Windows / Linux 均可直接运行
// 数据量小（全班账号 + 每日备忘录 + 日志），用 JSON 文件足够，且无需编译环境。
const fs = require('fs');
const path = require('path');
const config = require('./config');

const STORE_FILE = path.join(path.dirname(config.DB_PATH), 'store.json');
const dir = path.dirname(STORE_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;
function fresh() {
  return {
    users: [], memos: [], audit_log: [], sessions: [], announcements: [], finances: [], settings: {},
    seq: { users: 0, memos: 0, audit_log: 0, announcements: 0, countdowns: 0, finances: 0 },
  };
}
function load() {
  if (fs.existsSync(STORE_FILE)) {
    try { db = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
    catch (_) { db = fresh(); }
  } else { db = fresh(); }
  for (const k of ['users', 'memos', 'audit_log', 'sessions', 'announcements', 'finances']) if (!Array.isArray(db[k])) db[k] = [];
  if (!db.settings || typeof db.settings !== 'object') db.settings = {};
  if (!db.seq) db.seq = { users: 0, memos: 0, audit_log: 0, announcements: 0, countdowns: 0, finances: 0 };
  save();
}
function save() {
  // 原子写：先写临时文件再重命名，避免并发写损坏
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}
load();
function nowStr() { return new Date().toLocaleString('zh-CN', { hour12: false }); }
function nextId(k) { db.seq[k] = (db.seq[k] || 0) + 1; return db.seq[k]; }

module.exports = {
  // ---- users ----
  getUserByUsername(username) { return db.users.find(u => u.username === username) || null; },
  getUserById(id) { return db.users.find(u => u.id === id) || null; },
  insertUser(u) { u.id = nextId('users'); u.created_at = u.created_at || nowStr(); db.users.push(u); save(); return u; },
  allUsers() { return db.users.map(u => ({ ...u })).sort((a, b) => Number(a.student_id) - Number(b.student_id)); },
  updateUser(id, patch) { const u = db.users.find(x => x.id === id); if (u) { Object.assign(u, patch); save(); } return u; },
  countByPosition(position) { return db.users.filter(u => u.position === position && !u.first_login).length; },
  // ---- memos ----
  getMemosByDate(date) { return db.memos.filter(m => m.date === date); },
  allMemos() { return db.memos.map(m => ({ ...m })); },
  getMemo(date, subject) { return db.memos.find(m => m.date === date && m.subject === subject) || null; },
  upsertMemo(date, subject, fields) {
    let m = db.memos.find(x => x.date === date && x.subject === subject);
    if (!m) { m = { id: nextId('memos'), date, subject, content: '', last_editor: '', last_edit_time: '' }; db.memos.push(m); }
    Object.assign(m, fields); save(); return m;
  },
  memoDates() { return [...new Set(db.memos.map(m => m.date))].sort().reverse(); },
  // ---- sessions ----
  insertSession(s) { db.sessions.push(s); save(); },
  getSession(token) { return db.sessions.find(s => s.token === token) || null; },
  deleteSession(token) { db.sessions = db.sessions.filter(s => s.token !== token); save(); },
  deleteUserSessions(userId) { db.sessions = db.sessions.filter(s => s.user_id !== userId); save(); },
  // ---- audit log ----
  addLog(entry) { entry.id = nextId('audit_log'); entry.created_at = entry.created_at || nowStr(); db.audit_log.push(entry); save(); return entry; },
  recentLogs(limit) { return db.audit_log.slice().reverse().slice(0, limit || 200); },
  // ---- finances 收支 ----
  allFinances() { return db.finances.map(f => ({ ...f })); },
  addFinance(f) {
    f.id = nextId('finances');
    f.created_at = f.created_at || nowStr();
    db.finances.push(f); save(); return { ...f };
  },
  deleteFinance(id) {
    db.finances = db.finances.filter(x => x.id !== id); save();
  },
  // ---- settings ----
  getSettings() { return { ...db.settings }; },
  updateSettings(patch) { Object.assign(db.settings, patch); save(); return { ...db.settings }; },
  // ---- announcements 公告 ----
  allAnnouncements() { return db.announcements.map(a => ({ ...a })); },
  addAnnouncement(a) {
    a.id = nextId('announcements');
    a.created_at = a.created_at || nowStr();
    db.announcements.push(a); save(); return { ...a };
  },
  deleteAnnouncement(id) {
    db.announcements = db.announcements.filter(x => x.id !== id); save();
  },
};
