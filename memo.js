// 备忘录业务逻辑：日期算法 + 读写 + HTML 消毒（基于纯 JS 存储）
const store = require('./store');
const sanitizeHtml = require('sanitize-html');
const { SUBJECTS } = require('./positions');
const config = require('./config');

/* ---------------- 日期算法 ----------------
 * 统一规则（周末与工作日一致）：
 *  - 每天 8:00 之前：显示"昨天"的备忘录
 *  - 每天 8:00 及之后：显示当天空白备忘录
 *  - 管理员可在后台"今日默认显示"覆盖：仅当 overrideOn === 今天时，整天固定显示指定日期
 *    （隔天自动失效，恢复默认规则）
 */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function getEffectiveDate(now = new Date()) {
  const d = new Date(now);
  const today = ymd(d);
  // 管理员"今日默认显示"覆盖（仅当天生效）
  const s = store.getSettings();
  if (s.overrideOn === today && s.overrideMemoDate) {
    return {
      date: s.overrideMemoDate,
      isToday: s.overrideMemoDate === today,
      overrideActive: true,
      overrideDate: s.overrideMemoDate,
    };
  }
  if (d.getHours() < config.DAILY_RESET_HOUR) {
    return { date: ymd(addDays(d, -1)), isToday: false };
  }
  return { date: today, isToday: true };
}
// 昨天（YYYY-MM-DD），用于"昨日备忘录"标记判断
function getYesterday(now = new Date()) { return ymd(addDays(new Date(now), -1)); }

/* ---------------- 备忘录读写 ---------------- */
function getMemoByDate(date) {
  const rows = store.getMemosByDate(date);
  const map = {};
  for (const s of SUBJECTS) map[s] = { content: '', last_editor: '', last_edit_time: '' };
  rows.forEach(r => { map[r.subject] = { content: r.content, last_editor: r.last_editor, last_edit_time: r.last_edit_time }; });
  return map;
}

function getMemoSubject(date, subject) {
  const m = store.getMemo(date, subject);
  return m
    ? { content: m.content, last_editor: m.last_editor, last_edit_time: m.last_edit_time }
    : { content: '', last_editor: '', last_edit_time: '' };
}

// 富文本白名单消毒：仅保留 span 的 color/background-color、br、b/i/u、div
function sanitize(content) {
  return sanitizeHtml(content || '', {
    allowedTags: ['span', 'br', 'b', 'i', 'u', 'div'],
    allowedAttributes: { span: ['style'] },
    allowedStyles: {
      span: {
        'color': [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, /^rgba?\([^;]*\)$/i],
        'background-color': [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, /^rgba?\([^;]*\)$/i],
      },
    },
    disallowedTagsMode: 'discard',
  });
}

function saveMemo(date, subject, content, editorName) {
  const clean = sanitize(content);
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  store.upsertMemo(date, subject, { content: clean, last_editor: editorName, last_edit_time: now });
  return clean;
}

function listMemoDates() { return store.memoDates(); }

// 启动时清理过期覆盖（overrideOn 不是今天则删除）
function clearExpiredOverride(now = new Date()) {
  const s = store.getSettings();
  if (s.overrideOn && s.overrideOn !== ymd(now)) {
    store.updateSettings({ overrideOn: '', overrideMemoDate: '' });
  }
}

/* ---------------- 学期进度 ----------------
 * 参数（由超管在后台设置）：
 *   academicYear  学年标签，如 "2026"
 *   termStart     开学日  YYYY-MM-DD（第1周第1天）
 *   termEnd       学年最后一天  YYYY-MM-DD
 * 计算：
 *   开学日为第1周第1天，7天为1周；dayNo=距开学天数+1
 *   week=ceil(dayNo/7)，weekDay=((dayNo-1)%7)+1
 *   totalDays=结束日-开学日+1，progress=min(dayNo,totalDays)/totalDays
 */
function diffDays(a, b) { // a-b 的天数
  return Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
}
function getTermInfo(now = new Date()) {
  const s = store.getSettings();
  const start = s.termStart, end = s.termEnd;
  const today = ymd(now);
  if (!start || !end || !s.academicYear) {
    return { configured: false };
  }
  const totalDays = diffDays(end, start) + 1;
  if (totalDays < 1) return { configured: false };
  const dayNo = diffDays(today, start) + 1;
  const week = Math.max(1, Math.ceil(dayNo / 7));
  const weekDay = ((dayNo - 1) % 7) + 1;
  const progress = Math.max(0, Math.min(1, dayNo / totalDays));
  return {
    configured: true,
    academicYear: s.academicYear,
    start, end,
    totalDays,
    week,
    weekDay,
    // 合计第几天：已过去的学期总天数（第1天=1）
    dayNo: Math.max(1, dayNo),
    // 进度百分比，保留两位小数（如 3.12）
    progress: Math.round(progress * 10000) / 100,
  };
}

module.exports = {
  ymd, addDays, getEffectiveDate, getYesterday, clearExpiredOverride,
  getMemoByDate, getMemoSubject, saveMemo, sanitize, listMemoDates,
  getTermInfo,
};
