// 高一(11)班 在线备忘录 — 主服务（Express + WebSocket，纯 JS 存储）
const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');

const config = require('./config');
const store = require('./store');
const auth = require('./auth');
const memo = require('./memo');
const accounts = require('./accounts');
const { SUBJECTS, POSITIONS, POSITION_ORDER } = require('./positions');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 脱敏后的用户信息
function pubUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, displayName: u.display_name,
    studentId: u.student_id, roleLevel: u.role_level,
    position: u.position, firstLogin: !!u.first_login,
  };
}

function currentUser(req) { return auth.getUserByToken(req.cookies.session); }

function requireUser(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: '未登录' });
  req.user = u; next();
}
function requireLevel(min) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: '未登录' });
    if ((u.role_level || 0) < min) return res.status(403).json({ error: '权限不足' });
    req.user = u; next();
  };
}

/* ---------------- 认证 API ---------------- */
app.post('/api/login', (req, res) => {
  const username = String((req.body || {}).username || '').trim().toLowerCase();
  const password = (req.body || {}).password || '';
  if (!username || !password) return res.status(400).json({ error: '请输入账号和密码' });
  const u = store.getUserByUsername(username);
  if (!u || !auth.verifyPwd(password, u.password_hash))
    return res.status(401).json({ error: '账号或密码错误' });
  const token = auth.createSession(u);
  res.cookie('session', token, { httpOnly: true, maxAge: config.SESSION_DAYS * 86400000, sameSite: 'lax' });
  auth.log(u.username, 'login', u.username, '');
  res.json({ ok: true, firstLogin: !!u.first_login, user: pubUser(u) });
});

app.post('/api/logout', (req, res) => {
  auth.destroySession(req.cookies.session);
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  res.json({ user: u ? pubUser(u) : null });
});

// 首次登录：选职位 + 设新密码
app.post('/api/complete-setup', requireUser, (req, res) => {
  const u = req.user;
  if (!u.first_login) return res.status(400).json({ error: '该账号已完成初始设置' });
  const { position, newPassword } = req.body || {};
  const def = POSITIONS[position];
  if (!def) return res.status(400).json({ error: '职位无效，请重新选择' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: '新密码至少 6 位' });
  if (newPassword.length > 64) return res.status(400).json({ error: '密码过长' });
  const used = store.countByPosition(position);
  if (used >= def.limit)
    return res.status(400).json({ error: `该职位已满（限额 ${def.limit} 人），请选择其他职位` });

  store.updateUser(u.id, {
    position, role_level: def.level,
    password_hash: auth.hashPwd(newPassword), first_login: 0,
  });
  auth.destroyUserSessions(u.id);
  const fresh = store.getUserById(u.id);
  const token = auth.createSession(fresh);
  res.cookie('session', token, { httpOnly: true, maxAge: config.SESSION_DAYS * 86400000, sameSite: 'lax' });
  auth.log(u.username, 'setup', u.username, `position=${position}, level=${def.level}`);
  res.json({ ok: true, user: pubUser(fresh) });
});

// 可选职位列表（含占用情况），仅首次登录需要
app.get('/api/positions', requireUser, (req, res) => {
  if (!req.user.first_login) return res.json({ positions: [] });
  const data = POSITION_ORDER.map(p => {
    const def = POSITIONS[p];
    const used = store.countByPosition(p);
    return { position: p, limit: def.limit === Infinity ? null : def.limit, used, available: used < def.limit };
  });
  res.json({ positions: data });
});

/* ---------------- 备忘录 API ---------------- */
app.get('/api/meta', (req, res) => {
  res.json({ version: config.VERSION, subjects: SUBJECTS });
});

app.get('/api/today', (req, res) => {
  const eff = memo.getEffectiveDate();
  res.json({ date: eff.date, isToday: eff.isToday });
});

app.get('/api/memo', (req, res) => {
  const eff = memo.getEffectiveDate();
  const date = req.query.date || eff.date;
  const data = memo.getMemoByDate(date);
  const yesterday = memo.getYesterday(); // 真实"昨天"
  // 3天及以前不再标"昨日备忘录"：仅恰好等于昨天时标记
  res.json({
    date, isToday: date === memo.ymd(new Date()), isYesterday: date === yesterday,
    memos: data, subjects: SUBJECTS,
    term: memo.getTermInfo(),
    overrideActive: !!eff.overrideActive,   // 今日被管理员覆盖默认显示
    overrideDate: eff.overrideDate || '',
  });
});

// 学期设置（读取：任何已登录用户可看，供主页显示进度；写：仅超管）
app.get('/api/term', (req, res) => {
  const s = store.getSettings();
  res.json({
    academicYear: s.academicYear || '', termStart: s.termStart || '', termEnd: s.termEnd || '',
  });
});
app.put('/api/term', requireLevel(2), (req, res) => {
  const { academicYear, termStart, termEnd } = req.body || {};
  if (termStart && !/^\d{4}-\d{2}-\d{2}$/.test(termStart)) return res.status(400).json({ error: '开学日格式错误' });
  if (termEnd && !/^\d{4}-\d{2}-\d{2}$/.test(termEnd)) return res.status(400).json({ error: '学年最后一天格式错误' });
  if (termStart && termEnd && termEnd < termStart) return res.status(400).json({ error: '学年最后一天不能早于开学日' });
  const next = store.updateSettings({
    academicYear: String(academicYear || '').trim(),
    termStart: termStart || '',
    termEnd: termEnd || '',
  });
  auth.log(req.user.username, 'set_term', '', JSON.stringify(next));
  res.json({ ok: true });
});

app.get('/api/memo-dates', (req, res) => {
  res.json({ dates: memo.listMemoDates() });
});

/* ---------------- 公告栏 ---------------- */
// 有效公告（所有人可看）：expiresAt 为空=永久；已过期的直接删除（不保留隐藏）
app.get('/api/announcements', (req, res) => {
  const today = memo.ymd(new Date());
  // 清理已过期公告（删除而非隐藏）
  const all = store.allAnnouncements();
  const expired = all.filter(a => a.expiresAt && a.expiresAt < today);
  for (const a of expired) {
    store.deleteAnnouncement(a.id);
    auth.log('system', 'del_announcement_expired', `#${a.id}`, `公告「${a.title}」已过期自动删除`);
  }
  const list = store.allAnnouncements()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .map(a => ({ ...a, active: true }));
  res.json({ announcements: list, today });
});
// 发布公告（管理员及以上）
app.post('/api/announcements', requireLevel(1), (req, res) => {
  const { title, content, expiresAt } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '标题不能为空' });
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return res.status(400).json({ error: '过期日期格式错误' });
  const a = store.addAnnouncement({
    title: String(title).trim().slice(0, 100),
    content: String(content || '').trim().slice(0, 2000),
    expiresAt: expiresAt || '',
    createdBy: req.user.display_name,
  });
  auth.log(req.user.username, 'add_announcement', `#${a.id}`, a.title);
  broadcast({ type: 'announcement' });
  res.json({ ok: true, announcement: a });
});
// 删除公告（管理员及以上）
app.delete('/api/announcements/:id', requireLevel(1), (req, res) => {
  const id = Number(req.params.id);
  const exists = store.allAnnouncements().some(a => a.id === id);
  if (!exists) return res.status(404).json({ error: '公告不存在' });
  store.deleteAnnouncement(id);
  auth.log(req.user.username, 'del_announcement', `#${id}`, '');
  broadcast({ type: 'announcement' });
  res.json({ ok: true });
});

/* ---------------- 倒计时 ---------------- */
const MS_DAY = 86400000;
function countdownView() {
  const s = store.getSettings();
  const cfg = s.countdowns || { enabled: false, items: [] };
  const today = memo.ymd(new Date());
  const todayMs = Date.parse(today + 'T00:00:00');
  const items = (cfg.items || []).map(it => {
    const daysLeft = Math.round((Date.parse(it.date + 'T00:00:00') - todayMs) / MS_DAY);
    return { ...it, daysLeft };
  });
  return { enabled: !!cfg.enabled, items, today };
}
// 倒计时（所有人可看）
app.get('/api/countdown', (req, res) => {
  res.json(countdownView());
});
// 保存倒计时配置（管理员及以上）：{ enabled, items:[{label,date}] }
app.put('/api/countdown', requireLevel(1), (req, res) => {
  const { enabled, items } = req.body || {};
  const clean = [];
  for (const it of (Array.isArray(items) ? items : [])) {
    const label = String((it || {}).label || '').trim().slice(0, 30);
    const date = String((it || {}).date || '').trim();
    if (label && /^\d{4}-\d{2}-\d{2}$/.test(date)) clean.push({ label, date });
  }
  if (clean.length > 10) return res.status(400).json({ error: '倒计时最多 10 个' });
  store.updateSettings({ countdowns: { enabled: !!enabled, items: clean } });
  auth.log(req.user.username, 'set_countdown', '', `enabled=${!!enabled}, n=${clean.length}`);
  broadcast({ type: 'countdown' });
  res.json({ ok: true });
});

/* ---------------- 作业量统计（所有人可看） ---------------- */
function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}
app.get('/api/stats', (req, res) => {
  let days = parseInt(req.query.days, 10);
  if (!Number.isFinite(days) || days <= 0) days = 30;
  const today = memo.ymd(new Date());
  const fromMs = Date.parse(today + 'T00:00:00') - (days - 1) * MS_DAY;
  const fromDate = memo.ymd(new Date(fromMs));

  const rows = {};
  for (const s of SUBJECTS) rows[s] = { subject: s, days: 0, items: 0, chars: 0, edits: 0, lastEditor: '', lastTime: '' };

  // 备忘内容统计
  const all = store.allMemos();
  for (const m of all) {
    if (m.date < fromDate || m.date > today) continue;
    const r = rows[m.subject];
    if (!r) continue;
    const text = htmlToText(m.content);
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length === 0 && !text.trim()) continue;
    r.days += 1;
    r.items += lines.length;
    r.chars += text.replace(/\s/g, '').length;
    if (!r.lastTime || (m.last_edit_time || '') > r.lastTime) {
      r.lastTime = m.last_edit_time || '';
      r.lastEditor = m.last_editor || '';
    }
  }
  // 编辑次数（来自操作日志 edit_memo，target 为 "date/subject"）
  for (const l of store.recentLogs(5000)) {
    if (l.action !== 'edit_memo') continue;
    const date = String(l.target || '').split('/')[0];
    const subject = String(l.target || '').split('/')[1];
    if (!rows[subject] || date < fromDate || date > today) continue;
    rows[subject].edits += 1;
  }
  res.json({ range: { days, from: fromDate, to: today }, stats: Object.values(rows) });
});

/* ---------------- 课程表 ---------------- */
// 读取课表（所有人可看）：返回自定义课表，未设置时为 null（前端用内置默认）
app.get('/api/timetable', (req, res) => {
  res.json({ timetable: store.getSettings().timetable || null });
});
// 保存课表（管理员及以上）：{ timetable: {1..5: [[起,止,名称,类型],...]} }；timetable:null 恢复默认
app.put('/api/timetable', requireLevel(1), (req, res) => {
  const tt = (req.body || {}).timetable;
  if (tt === null || tt === undefined) {
    store.updateSettings({ timetable: null });
    auth.log(req.user.username, 'set_timetable', '', '恢复默认课表');
    broadcast({ type: 'timetable' });
    return res.json({ ok: true });
  }
  if (typeof tt !== 'object' || Array.isArray(tt)) return res.status(400).json({ error: '课表格式错误' });
  const TYPES = ['lesson', 'break', 'noon', 'activity'];
  const out = {};
  for (const key of Object.keys(tt)) {
    const d = Number(key);
    if (!(d >= 1 && d <= 5)) return res.status(400).json({ error: '星期无效（仅 1~5）' });
    if (!Array.isArray(tt[key])) return res.status(400).json({ error: `周${d} 数据格式错误` });
    if (tt[key].length > 80) return res.status(400).json({ error: `周${d} 时段过多` });
    const rows = [];
    for (const r of tt[key]) {
      if (!Array.isArray(r) || r.length < 4) return res.status(400).json({ error: '时段格式错误' });
      const [s, e, name, type] = [String(r[0]), String(r[1]), String(r[2] || ''), String(r[3])];
      if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return res.status(400).json({ error: '时间格式应为 HH:MM' });
      if (s >= e) return res.status(400).json({ error: `开始时间需早于结束时间（${name || s}）` });
      if (!name.trim() || name.trim().length > 30) return res.status(400).json({ error: '名称需为 1~30 字' });
      if (!TYPES.includes(type)) return res.status(400).json({ error: '类型无效' });
      rows.push([s, e, name.trim(), type]);
    }
    out[d] = rows;
  }
  store.updateSettings({ timetable: out });
  auth.log(req.user.username, 'set_timetable', '', `days=${Object.keys(out).length}`);
  broadcast({ type: 'timetable' });
  res.json({ ok: true });
});

/* ---------------- 收支·赞助 ---------------- */
// 收支记录（所有人可看）
app.get('/api/finance', (req, res) => {
  const list = store.allFinances().sort((a, b) => {
    // 按日期倒序，同日按 id 倒序
    return (b.date || '').localeCompare(a.date || '') || b.id - a.id;
  });
  // 汇总：总收入/总支出/余额
  let income = 0, expense = 0;
  for (const f of list) {
    if (f.type === 'income') income += Number(f.amount) || 0;
    else expense += Number(f.amount) || 0;
  }
  res.json({ records: list, summary: { income, expense, balance: income - expense } });
});
// 添加收支（仅超管）
app.post('/api/finance', requireLevel(2), (req, res) => {
  const { date, type, amount, desc } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期格式错误' });
  if (type !== 'income' && type !== 'expense') return res.status(400).json({ error: '类型无效' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: '金额需为正数' });
  const f = store.addFinance({
    date, type, amount: Math.round(amt * 100) / 100,
    desc: String(desc || '').trim().slice(0, 200),
    by: req.user.display_name,
  });
  auth.log(req.user.username, 'add_finance', `#${f.id}`, `${type} ${f.amount} ${f.desc}`);
  broadcast({ type: 'finance' });
  res.json({ ok: true, record: f });
});
// 删除收支（仅超管）
app.delete('/api/finance/:id', requireLevel(2), (req, res) => {
  const id = Number(req.params.id);
  const exists = store.allFinances().some(f => f.id === id);
  if (!exists) return res.status(404).json({ error: '记录不存在' });
  store.deleteFinance(id);
  auth.log(req.user.username, 'del_finance', `#${id}`, '');
  broadcast({ type: 'finance' });
  res.json({ ok: true });
});

// 今日默认显示覆盖（管理员及以上可读写，仅当天生效，隔天自动失效）
app.get('/api/override', requireLevel(1), (req, res) => {
  const s = store.getSettings();
  const today = memo.ymd(new Date());
  const active = s.overrideOn === today;
  res.json({
    active,
    overrideOn: active ? s.overrideOn : '',
    overrideMemoDate: active ? s.overrideMemoDate : '',
    today,
  });
});
app.put('/api/override', requireLevel(1), (req, res) => {
  const { date } = req.body || {};
  if (!date) {
    // 空 = 清除覆盖
    store.updateSettings({ overrideOn: '', overrideMemoDate: '' });
    auth.log(req.user.username, 'override_memo', 'clear', '取消今日默认显示');
    return res.json({ ok: true, active: false });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期格式错误' });
  const today = memo.ymd(new Date());
  store.updateSettings({ overrideOn: today, overrideMemoDate: date });
  auth.log(req.user.username, 'override_memo', date, `设为今天默认显示`);
  res.json({ ok: true, active: true, today });
});

// 保存单个学科备忘录（管理员及以上）
app.post('/api/memo', requireLevel(1), (req, res) => {
  const { date, subject, content } = req.body || {};
  if (!date || !subject) return res.status(400).json({ error: '缺少日期或学科' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期格式错误' });
  if (!SUBJECTS.includes(subject)) return res.status(400).json({ error: '学科无效' });
  memo.saveMemo(date, subject, content || '', req.user.display_name);
  auth.log(req.user.username, 'edit_memo', `${date}/${subject}`, '');
  broadcast({ type: 'memo-update', date, subject, by: req.user.username });
  res.json({ ok: true });
});

/* ---------------- 后台 API ---------------- */
// 用户列表：管理员(level1)可看，超管(level2)同
app.get('/api/admin/users', requireLevel(1), (req, res) => {
  const users = store.allUsers();
  res.json({ users, me: pubUser(req.user) });
});

// 重置账号：管理员只能重置普通用户(level0)；超管可重置所有
app.post('/api/admin/reset-user', requireLevel(1), (req, res) => {
  const userId = (req.body || {}).userId;
  if (!userId) return res.status(400).json({ error: '缺少 userId' });
  const target = store.getUserById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (req.user.role_level < 2 && (target.role_level || 0) !== 0)
    return res.status(403).json({ error: '管理员只能重置普通用户的账号' });

  const newPwd = auth.genPassword(8);
  store.updateUser(userId, {
    password_hash: auth.hashPwd(newPwd),
    position: null, role_level: null, first_login: 1,
  });
  auth.destroyUserSessions(userId);
  auth.log(req.user.username, 'reset_user', target.username, '清空职位与等级，签发新初始密码');
  res.json({ ok: true, newPassword: newPwd, username: target.username, displayName: target.display_name });
});

// 创建用户（仅超管）：自动生成账号 + 随机初始密码
app.post('/api/admin/create-user', requireLevel(2), (req, res) => {
  const { name, studentId } = req.body || {};
  if (!name || !studentId) return res.status(400).json({ error: '请输入姓名和学号' });
  let username;
  try { username = accounts.makeUsername(name, studentId); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (store.getUserByUsername(username))
    return res.status(409).json({ error: `账号已存在：${username}` });
  const pwd = auth.genPassword(8);
  store.insertUser({
    username, display_name: name, student_id: String(studentId),
    password_hash: auth.hashPwd(pwd), role_level: null, position: null, first_login: 1,
  });
  auth.log(req.user.username, 'create_user', username, `name=${name}`);
  res.json({ ok: true, username, displayName: name, password: pwd });
});

// 设置用户权限/职位（仅超管）：按职位自动定级，受名额限制
app.post('/api/admin/set-role', requireLevel(2), (req, res) => {
  const { userId, position } = req.body || {};
  const def = POSITIONS[position];
  if (!def) return res.status(400).json({ error: '职位无效' });
  const target = store.getUserById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  const used = store.countByPosition(position);
  const isAlready = target.position === position && !target.first_login;
  if (!isAlready && used >= def.limit)
    return res.status(400).json({ error: `该职位已满（限额 ${def.limit} 人）` });
  store.updateUser(userId, { position, role_level: def.level, first_login: 0 });
  auth.log(req.user.username, 'set_role', target.username, `position=${position}, level=${def.level}`);
  res.json({ ok: true, user: pubUser(store.getUserById(userId)) });
});

// 职位列表（含占用/限额），供后台设权限下拉用（仅超管）
app.get('/api/admin/positions', requireLevel(2), (req, res) => {
  const data = POSITION_ORDER.map(p => {
    const def = POSITIONS[p];
    const used = store.countByPosition(p);
    return { position: p, limit: def.limit === Infinity ? null : def.limit, used, available: used < def.limit };
  });
  res.json({ positions: data });
});

// 操作日志：仅超管
app.get('/api/admin/logs', requireLevel(2), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const logs = store.recentLogs(limit);
  // 操作人显示姓名（display_name）：把 username 映射为姓名，保留 username 供查询
  const nameMap = {};
  for (const u of store.allUsers()) nameMap[u.username] = u.display_name;
  const out = logs.map(l => ({
    ...l,
    actor_name: nameMap[l.actor] || (l.actor === 'system' ? '系统' : l.actor),
  }));
  res.json({ logs: out });
});

/* ---------------- 个人设置 ---------------- */
// 修改自己的密码（登录后任意用户可用）
app.post('/api/change-password', requireUser, (req, res) => {
  const u = req.user;
  const { oldPassword, newPassword } = req.body || {};
  if (!auth.verifyPwd(oldPassword || '', u.password_hash))
    return res.status(401).json({ error: '原密码错误' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: '新密码至少 6 位' });
  if (newPassword.length > 64) return res.status(400).json({ error: '密码过长' });
  store.updateUser(u.id, { password_hash: auth.hashPwd(newPassword) });
  auth.destroyUserSessions(u.id); // 其他设备下线，本请求重新签发
  const fresh = store.getUserById(u.id);
  const token = auth.createSession(fresh);
  res.cookie('session', token, { httpOnly: true, maxAge: config.SESSION_DAYS * 86400000, sameSite: 'lax' });
  auth.log(u.username, 'change_password', u.username, '');
  res.json({ ok: true });
});

// 修改自己的账号名（"我的"页面，登录账号）
app.put('/api/profile', requireUser, (req, res) => {
  const newUsername = String((req.body || {}).username || '').trim().toLowerCase();
  if (!newUsername) return res.status(400).json({ error: '账号名不能为空' });
  if (!/^[a-z0-9_]{2,30}$/.test(newUsername))
    return res.status(400).json({ error: '账号名需为 2~30 位小写字母/数字/下划线' });
  if (newUsername === req.user.username) return res.status(400).json({ error: '新账号与当前相同' });
  if (store.getUserByUsername(newUsername))
    return res.status(409).json({ error: `账号 ${newUsername} 已被占用` });
  store.updateUser(req.user.id, { username: newUsername });
  // 改账号名后强制重新登录（旧会话作废），并用新账号签发
  auth.destroyUserSessions(req.user.id);
  const fresh = store.getUserById(req.user.id);
  const token = auth.createSession(fresh);
  res.cookie('session', token, { httpOnly: true, maxAge: config.SESSION_DAYS * 86400000, sameSite: 'lax' });
  auth.log(req.user.username, 'change_username', `${req.user.username} -> ${newUsername}`, '');
  res.json({ ok: true, user: pubUser(fresh) });
});

/* ---------------- WebSocket 实时同步 ---------------- */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of clients) { try { c.send(data); } catch (_) {} }
}

// 启动时清理"昨日默认显示"的过期覆盖（隔天自动失效）
memo.clearExpiredOverride();

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`\n  高一(11)班 备忘录已启动`);
  console.log(`  访问: http://<服务器IP>:${config.PORT}`);
  console.log(`  版本: ${config.VERSION}  Powered By CBs2N\n`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
