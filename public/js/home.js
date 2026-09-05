// 主页（班级门户）：登录区 + 功能入口可见性 + 公告 + 学期进度
(function () {
  let user = null;

  async function init() {
    ensureThemeUI();
    document.getElementById('version').textContent = App.VERSION;
    setGreeting();
    try {
      const { user: u } = await api('/api/me');
      user = u;
    } catch (_) {}
    renderAuth();
    // 管理员及以上显示"后台管理"入口
    if (user && (user.roleLevel || 0) >= 1) document.getElementById('cardAdmin').hidden = false;
    loadTermLine();
    loadNotices();
    loadCountdown();
  }

  function setGreeting() {
    const h = new Date().getHours();
    const t = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    document.getElementById('greetPill').textContent = `👋 ${t}`;
  }

  function renderAuth() {
    const area = document.getElementById('authArea');
    if (user) {
      area.innerHTML = `
        <span class="user-chip">${escapeText(user.displayName)} <em>· ${escapeText(roleText(user.roleLevel))}</em></span>
        <button class="btn-ghost btn" id="logoutBtn">登出</button>`;
      document.getElementById('logoutBtn').onclick = async () => {
        await api('/api/logout', { method: 'POST' });
        location.reload();
      };
    } else {
      area.innerHTML = `<a class="btn-primary btn" href="/login.html">登录</a>`;
    }
  }

  // 学期进度行（同备忘录页）
  async function loadTermLine() {
    try {
      const { term } = await api('/api/memo');
      const el = document.getElementById('termLine');
      if (!term || !term.configured) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = `今天是 ${escapeText(term.academicYear)}学年第${term.week}周第${term.weekDay}天（合第${term.dayNo}天）&nbsp;·&nbsp;本学期共 ${term.totalDays} 天 · 进度 ${term.progress}%
        <span class="term-bar"><span style="width:${term.progress}%"></span></span>`;
    } catch (_) { /* 忽略 */ }
  }

  // 公告列表
  async function loadNotices() {
    try {
      const { announcements } = await api('/api/announcements');
      const active = announcements.filter(a => a.active);
      const box = document.getElementById('homeNotices');
      box.innerHTML = active.length ? active.map(a => `
        <div class="notice-card">
          <div class="notice-item-title">${escapeText(a.title)}</div>
          ${a.content ? `<div class="notice-item-content">${escapeText(a.content)}</div>` : ''}
          <div class="notice-item-meta">${escapeText(a.createdBy || '')} · ${escapeText((a.created_at || '').split(' ')[0] || '')}${a.expiresAt ? ` · ${a.expiresAt} 后过期` : ''}</div>
        </div>`).join('') : '<div class="notice-empty">暂无公告</div>';
    } catch (_) { box.innerHTML = '<div class="notice-empty">公告加载失败</div>'; }
  }

  // 倒计时
  async function loadCountdown() {
    try {
      const cd = await api('/api/countdown');
      const row = document.getElementById('homeCountdown');
      if (!cd.enabled) { row.hidden = true; return; }
      const items = (cd.items || []).filter(it => it.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
      if (!items.length) { row.hidden = true; return; }
      row.hidden = false;
      row.innerHTML = items.map(it => `
        <div class="cd-pill ${it.daysLeft === 0 ? 'today' : ''}">
          <span class="cd-label">${escapeText(it.label)}</span>
          <span class="cd-days">${it.daysLeft === 0 ? '就是今天' : `${it.daysLeft}天`}</span>
        </div>`).join('');
    } catch (_) { /* 忽略 */ }
  }

  init();
})();
