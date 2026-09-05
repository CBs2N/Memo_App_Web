// 公共工具：API、提示、日期、学科图标、主题切换
const App = {
  VERSION: 'v1.2', // 与后端 config.VERSION 保持一致
  WEEK: ['日', '一', '二', '三', '四', '五', '六'],
};

// 各学科图标与主题色
const SUBJECT_META = {
  '语文': { icon: '📖' }, '数学': { icon: '📐' }, '英语': { icon: '🔤' },
  '物理': { icon: '⚛️' }, '化学': { icon: '🧪' }, '生物': { icon: '🧬' },
  '地理': { icon: '🌍' }, '政治': { icon: '⚖️' }, '历史': { icon: '🏛️' },
  '艺术': { icon: '🎨' }, '信息': { icon: '💻' }, '心理': { icon: '🧠' },
};
function subjectIcon(name) { return (SUBJECT_META[name] || {}).icon || '📌'; }

async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && data.error) || ('请求失败 (' + res.status + ')'));
  return data;
}

function toast(msg, ms = 2400, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#1f2733;color:#fff;padding:11px 24px;border-radius:30px;z-index:9999;font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .25s,transform .25s;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(-8px)'; }, ms);
}

// '2026-09-03' -> '2026年9月3日'
function fmtCnDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${App.WEEK[d.getDay()]}`;
}

function escapeText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ================= 深色模式 =================
function getTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('cb2n-theme', t); } catch (_) {}
  const b = document.getElementById('themeToggle');
  if (b) { b.textContent = t === 'dark' ? '☀️' : '🌙'; b.title = t === 'dark' ? '切换到浅色模式' : '切换到深色模式'; }
}
function ensureThemeUI() {
  let b = document.getElementById('themeToggle');
  if (!b) {
    b = document.createElement('button');
    b.id = 'themeToggle';
    b.className = 'theme-toggle';
    document.body.appendChild(b);
    b.onclick = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }
  setTheme(getTheme());
}
// 页面加载早期调用（在 body 出现前可用 documentElement）
(function initThemeEarly() {
  try {
    if (localStorage.getItem('cb2n-theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch (_) {}
})();

// 注册 Service Worker（PWA：手机可"添加到主屏幕"当 App 用；仅 https/localhost 生效）
(function registerSW() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();

// WebSocket 实时同步：断线自动重连
function connectSync(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let ws, timer;
  function open() {
    try { ws = new WebSocket(`${proto}//${location.host}/ws`); }
    catch (_) { timer = setTimeout(open, 4000); return; }
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (_) {} };
    ws.onclose = () => { timer = setTimeout(open, 3000); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }
  open();
}

function roleText(level) {
  return level === 2 ? '超级管理员' : level === 1 ? '管理员' : level === 0 ? '普通用户' : '未设置';
}
