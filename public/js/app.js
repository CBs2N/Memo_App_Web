// 主页逻辑：备忘录展示 + 详情/编辑 + 打勾完成 + 日期翻页 + 主题/改密 + 实时同步
(function () {
  const state = {
    currentDate: null,   // 当前查看日期 YYYY-MM-DD
    isYesterday: false,  // 当前查看的是否"昨天"
    todayDate: null,     // 系统当前应显示日期
    memos: {}, subjects: [],
    user: null,
    subject: null, editing: false, originalContent: '',
    done: {},            // { '日期/学科': true } 个人完成记录
  };

  const COLORS = ['#1f2733', '#e74c5e', '#2bb673', '#4f7cff', '#f5a623', '#9b59f6'];
  const HIGHLIGHTS = ['#fff3a0', '#bff0a0', '#ffc0d6', '#c5d8ff', '#ffd9b0'];
  const doneKey = () => (state.user ? state.user.username : 'anon') + ':done';

  async function init() {
    ensureThemeUI();
    document.getElementById('version').textContent = App.VERSION;
    loadDone();
    setGreeting();
    try { await loadMe(); } catch (_) {}
    const today = await api('/api/today');
    state.todayDate = today.date;
    await loadMemo(today.date);
    buildSwatches();
    bindEvents();
    initSync((msg) => {
      if (!msg) return;
      if (msg.type === 'memo-update') {
        if (state.user && msg.by && msg.by === state.user.username) return;
        const b = document.getElementById('updateBanner');
        if (!b) return;
        b.hidden = false;
        b.textContent = `备忘录有更新（${msg.date}），点击刷新查看`;
        b.onclick = () => location.reload();
      }
    });
  }


  function loadDone() {
    try { state.done = JSON.parse(localStorage.getItem(doneKey()) || '{}'); } catch (_) { state.done = {}; }
  }
  function saveDone() {
    try { localStorage.setItem(doneKey(), JSON.stringify(state.done)); } catch (_) {}
  }

  function setGreeting() {
    const h = new Date().getHours();
    const t = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    const el = document.getElementById('greetPill');
    el.textContent = `👋 ${t}`;
    el.hidden = false;
  }

  // ---------- 认证 ----------
  async function loadMe() {
    const { user } = await api('/api/me');
    state.user = user;
    renderAuth();
    // 管理员及以上：显示"今日默认显示"管理入口
    const ovBtn = document.getElementById('ovManageBtn');
    if (ovBtn) ovBtn.hidden = !(user && (user.roleLevel || 0) >= 1);
    renderGrid(); // 打勾状态可能随登录变化
  }

  // ---------- 今日默认显示管理 ----------
  async function openOvPanel() {
    document.getElementById('ovPanel').hidden = false;
    const msg = document.getElementById('ovMsg');
    try {
      const r = await api('/api/override');
      const dateInput = document.getElementById('ovDate');
      if (r.active && r.overrideMemoDate) {
        dateInput.value = r.overrideMemoDate;
        msg.innerHTML = `<div class="alert info">当前已设置：今天默认显示 <b>${escapeText(r.overrideMemoDate)}</b>（仅今日有效）</div>`;
      } else {
        dateInput.value = '';
        msg.innerHTML = '<div class="alert info">当前未设置，按默认规则显示（8 点前昨天 / 8 点后今天）。</div>';
      }
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }
  function closeOvPanel() { document.getElementById('ovPanel').hidden = true; }
  async function saveOverrideMemo() {
    const date = document.getElementById('ovDate').value;
    const msg = document.getElementById('ovMsg');
    if (!date) { msg.innerHTML = '<div class="alert">请先选择日期</div>'; return; }
    try {
      await api('/api/override', { method: 'PUT', body: JSON.stringify({ date }) });
      msg.innerHTML = `<div class="alert info">✓ 已设置：今天默认显示 <b>${escapeText(date)}</b>，第 2 天自动恢复默认。</div>`;
      toast('已设为今日默认显示');
      await loadMemo();
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }
  async function clearOverrideMemo() {
    if (!confirm('确定清除今日默认显示设置吗？将恢复默认规则（8 点前昨天 / 8 点后今天）。')) return;
    try {
      await api('/api/override', { method: 'PUT', body: JSON.stringify({ date: null }) });
      document.getElementById('ovDate').value = '';
      document.getElementById('ovMsg').innerHTML = '<div class="alert info">已清除，恢复默认规则。</div>';
      toast('已清除今日默认显示');
      await loadMemo();
    } catch (e) { toast(e.message); }
  }

  function renderAuth() {
    const area = document.getElementById('authArea');
    if (state.user) {
      area.innerHTML = `
        <span class="user-chip">${escapeText(state.user.displayName)} <em>· ${escapeText(roleText(state.user.roleLevel))}</em></span>
        ${state.user.roleLevel >= 1 ? '<a class="btn" href="/admin.html">管理</a>' : ''}
        <button class="btn-ghost btn" id="logoutBtn">登出</button>`;
      document.getElementById('logoutBtn').onclick = logout;
    } else {
      area.innerHTML = `<a class="btn-primary btn" href="/login.html">登录</a>`;
    }
  }
  async function logout() { await api('/api/logout', { method: 'POST' }); location.reload(); }

  // ---------- 备忘录加载 ----------
  async function loadMemo(date) {
    const url = date ? `/api/memo?date=${encodeURIComponent(date)}` : '/api/memo';
    const data = await api(url);
    state.currentDate = data.date;
    state.isYesterday = data.isYesterday;   // 仅恰好是"昨天"
    state.term = data.term || { configured: false };
    state.memos = data.memos || {};
    state.subjects = data.subjects || [];
    // 今日被管理员设置"默认显示"
    state.overrideActive = data.overrideActive;
    renderDateBar();
    renderGrid();
  }

  function renderDateBar() {
    const label = document.getElementById('dateLabel');
    label.innerHTML = fmtCnDate(state.currentDate) +
      (state.isYesterday ? '<span class="yesterday">（昨日备忘录）</span>' : '');
    document.getElementById('datePicker').value = state.currentDate;
    document.getElementById('backTodayBtn').hidden = (state.currentDate === state.todayDate);
    renderOverrideTip();
    renderTermLine();
    renderProgress();
  }

  // 管理员"今日默认显示"提示条
  function renderOverrideTip() {
    const el = document.getElementById('overrideTip');
    if (!el) return;
    if (state.overrideActive) {
      el.hidden = false;
      el.textContent = `管理员已设置：今天默认显示 ${state.currentDate}`;
    } else {
      el.hidden = true;
    }
  }

  // 学期信息行：今天是 2026学年第x周第x天（合x天）· 本学期共x天 · 进度x%
  function renderTermLine() {
    const el = document.getElementById('termLine');
    const t = state.term;
    if (!t || !t.configured) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `今天是 ${escapeText(t.academicYear)}学年第${t.week}周第${t.weekDay}天（合第${t.dayNo}天）&nbsp;·&nbsp;本学期共 ${t.totalDays} 天 · 进度 ${t.progress}%
      <span class="term-bar"><span style="width:${t.progress}%"></span></span>`;
  }

  // 今日完成进度
  function renderProgress() {
    const pill = document.getElementById('progressPill');
    const n = state.subjects.length;
    if (!n) { pill.hidden = true; return; }
    let done = 0;
    state.subjects.forEach(s => { if (state.done[`${state.currentDate}/${s}`]) done++; });
    if (done === 0) { pill.hidden = true; return; }
    pill.hidden = false;
    const pct = Math.round(done / n * 100);
    pill.textContent = `✅ 已完成 ${done}/${n}（${pct}%）`;
    pill.style.background = `linear-gradient(90deg, rgba(43,182,115,.25) ${pct}%, transparent ${pct}%)`;
  }

  function renderGrid() {
    const grid = document.getElementById('memoGrid');
    grid.innerHTML = state.subjects.map((subj, idx) => {
      const m = state.memos[subj] || {};
      const isDone = !!state.done[`${state.currentDate}/${subj}`];
      const bodyHtml = (m.content || '').trim()
        ? `<div class="rich">${stripPreview(m.content)}</div>`
        : '<div class="empty">暂无作业</div>';
      return `<div class="subject-card ${isDone ? 'is-done' : ''}" data-subject="${subj}" style="animation-delay:${idx * 40}ms">
        <span class="done-mark ${isDone ? 'checked' : ''}" data-subject="${subj}" title="${isDone ? '取消完成' : '标记完成'}">${isDone ? '✓' : ''}</span>
        <div class="subject-head"><span class="sicon">${subjectIcon(subj)}</span>${subj}</div>
        <div class="subject-body">${bodyHtml}</div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.subject-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.classList.contains('done-mark')) return; // 打勾不打开详情
        openModal(card.dataset.subject);
      };
    });
    grid.querySelectorAll('.done-mark').forEach(mark => {
      mark.onclick = (e) => { e.stopPropagation(); toggleDone(mark.dataset.subject); };
    });
  }

  function stripPreview(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = (tmp.textContent || '').trim();
    return escapeText(text.length > 60 ? text.slice(0, 60) + '…' : text);
  }

  function toggleDone(subject) {
    const key = `${state.currentDate}/${subject}`;
    if (state.done[key]) delete state.done[key]; else state.done[key] = true;
    saveDone();
    renderGrid();
    renderProgress();
    if (state.done[key]) toast(`「${subject}」已完成 🎉`, 1800);
    else toast(`已取消「${subject}」完成`, 1800);
  }

  // ---------- 日期翻页 ----------
  function shiftDay(delta) {
    const d = new Date(state.currentDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    loadMemo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  // ---------- 详情模态 ----------
  function openModal(subject) {
    state.subject = subject;
    state.editing = false;
    const m = state.memos[subject] || {};
    const title = document.getElementById('modalTitle');
    title.innerHTML = `${subjectIcon(subject)} ${escapeText(subject)}`;
    const view = document.getElementById('memoView');
    view.className = 'memo-view';
    view.removeAttribute('contenteditable');
    view.innerHTML = m.content
      ? m.content
      : '<div class="empty" style="color:#9aa3b2;font-style:italic;">暂无作业内容</div>';
    document.getElementById('modalMeta').textContent = m.last_edit_time
      ? `最近编辑：${m.last_edit_time} · 编辑人：${m.last_editor || '—'}`
      : '最近编辑：—';
    document.getElementById('editBtn').hidden = false;
    document.getElementById('saveBtn').hidden = true;
    document.getElementById('cancelBtn').hidden = true;
    document.getElementById('editorToolbar').hidden = true;
    document.getElementById('modalBackdrop').hidden = false;
  }
  function closeModal() { state.editing = false; state.subject = null; document.getElementById('modalBackdrop').hidden = true; }

  // ---------- 编辑 ----------
  function enterEdit() {
    if (!state.user) { toast('请先登录后再编辑'); return; }
    if ((state.user.roleLevel || 0) < 1) { toast('权限不足：仅管理员及以上可编辑备忘录'); return; }
    state.editing = true;
    const m = state.memos[state.subject] || {};
    state.originalContent = m.content || '';
    document.getElementById('modalTitle').innerHTML = `${subjectIcon(state.subject)} ${escapeText(state.subject)}<span class="star">*</span>`;
    document.getElementById('editorToolbar').hidden = false;
    const view = document.getElementById('memoView');
    view.className = 'memo-editor';
    view.setAttribute('contenteditable', 'true');
    view.innerHTML = state.originalContent;
    document.getElementById('editBtn').hidden = true;
    document.getElementById('saveBtn').hidden = false;
    document.getElementById('cancelBtn').hidden = false;
    view.focus();
  }
  function exitEdit(restore) {
    state.editing = false;
    document.getElementById('modalTitle').innerHTML = `${subjectIcon(state.subject)} ${escapeText(state.subject)}`;
    document.getElementById('editorToolbar').hidden = true;
    const view = document.getElementById('memoView');
    view.className = 'memo-view';
    view.removeAttribute('contenteditable');
    const show = restore ? state.originalContent : (state.memos[state.subject] || {}).content || '';
    view.innerHTML = show || '<div class="empty" style="color:#9aa3b2;font-style:italic;">暂无作业内容</div>';
    document.getElementById('editBtn').hidden = false;
    document.getElementById('saveBtn').hidden = true;
    document.getElementById('cancelBtn').hidden = true;
  }
  async function save() {
    const content = document.getElementById('memoView').innerHTML;
    try {
      await api('/api/memo', { method: 'POST', body: JSON.stringify({ date: state.currentDate, subject: state.subject, content }) });
      toast('保存成功 ✓');
      await loadMemo(state.currentDate);
      closeModal();
    } catch (e) { toast(e.message); }
  }

  // ---------- 富文本工具 ----------
  function buildSwatches() {
    const cs = document.getElementById('colorSwatches');
    cs.innerHTML = COLORS.map(c => `<div class="swatch" style="background:${c}" data-color="${c}" title="文字颜色"></div>`).join('');
    cs.querySelectorAll('.swatch').forEach(s => { s.onmousedown = (e) => e.preventDefault(); s.onclick = () => applyColor(s.dataset.color); });
    const hs = document.getElementById('hlSwatches');
    hs.innerHTML = HIGHLIGHTS.map(c => `<div class="swatch" style="background:${c}" data-color="${c}" title="高亮"></div>`).join('');
    hs.querySelectorAll('.swatch').forEach(s => { s.onmousedown = (e) => e.preventDefault(); s.onclick = () => applyHighlight(s.dataset.color); });
  }
  function focusEditor() { const v = document.getElementById('memoView'); v.focus(); return v; }
  function applyColor(color) { focusEditor(); try { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, color); } catch (_) { toast('当前浏览器不支持文字颜色'); } }
  function applyHighlight(color) { focusEditor(); try { document.execCommand('styleWithCSS', false, true); try { document.execCommand('hiliteColor', false, color); } catch (_) { document.execCommand('backColor', false, color); } } catch (_) { toast('当前浏览器不支持高亮'); } }
  function insertSn(text) {
    focusEditor();
    if (!document.execCommand('insertText', false, text)) {
      const sel = window.getSelection();
      if (sel.rangeCount) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(document.createTextNode(text)); r.collapse(false); }
    }
  }

  // ---------- 事件 ----------
  function bindEvents() {
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('editBtn').onclick = enterEdit;
    document.getElementById('saveBtn').onclick = save;
    document.getElementById('cancelBtn').onclick = () => exitEdit(true);
    document.getElementById('colorPicker').oninput = (e) => applyColor(e.target.value);
    document.getElementById('hlPicker').oninput = (e) => applyHighlight(e.target.value);
    document.querySelectorAll('.sn-btn').forEach(b => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => insertSn(b.dataset.sn); });
    document.getElementById('modalBackdrop').addEventListener('mousedown', (e) => { if (e.target.id === 'modalBackdrop' && !state.editing) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('modalBackdrop').hidden && !state.editing) closeModal();
    });
    document.getElementById('datePicker').onchange = async (e) => { if (e.target.value) await loadMemo(e.target.value); };
    document.getElementById('prevDay').onclick = () => shiftDay(-1);
    document.getElementById('nextDay').onclick = () => shiftDay(1);
    document.getElementById('backTodayBtn').onclick = async () => { await loadMemo(state.todayDate); };

    // 今日默认显示管理面板
    const ovBtn = document.getElementById('ovManageBtn');
    if (ovBtn) ovBtn.onclick = openOvPanel;
    const ovClose = document.getElementById('ovClose');
    if (ovClose) ovClose.onclick = closeOvPanel;
    const ovSave = document.getElementById('ovSave');
    if (ovSave) ovSave.onclick = saveOverrideMemo;
    const ovClear = document.getElementById('ovClear');
    if (ovClear) ovClear.onclick = clearOverrideMemo;
  }

  init();
})();
