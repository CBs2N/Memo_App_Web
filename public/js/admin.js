// 后台：用户管理 + 学期设置 + 操作日志
let me = null;

(async function () {
  ensureThemeUI();
  document.getElementById('version').textContent = App.VERSION;
  try {
    const { user } = await api('/api/me');
    if (!user) { location.href = '/login.html'; return; }
    if ((user.roleLevel || 0) < 1) {
      const tip = document.getElementById('permTip');
      tip.hidden = false;
      tip.textContent = '权限不足：后台仅管理员及以上可访问。';
      return;
    }
    me = user;
    bindTabs();

    // 创建用户仅超管
    if (me.roleLevel < 2) document.getElementById('createBtn').hidden = true;

    // 学期设置 / 操作日志 tab 仅超管；默认显示 tab 管理员及以上都可
    if (me.roleLevel >= 2) {
      await loadTerm();
      await loadLogs();
    } else {
      document.getElementById('tabTermBtn').hidden = true;
      document.getElementById('tabLogsBtn').hidden = true;
    }
    await loadNoticeAdmin();
    await loadCountdownPanel();

    await loadUsers();
    bindEvents();

    // 支持从主页 #term 锚点直达
    if (location.hash === '#term') switchTab('term');
  } catch (e) {
    location.href = '/login.html';
  }
})();

function roleTag(level) {
  if (level === 2) return '<span class="tag tag-super">超级管理员</span>';
  if (level === 1) return '<span class="tag tag-admin">管理员</span>';
  if (level === 0) return '<span class="tag tag-user">普通用户</span>';
  return '<span class="tag tag-pending">未设置</span>';
}

// ---------- Tabs ----------
function bindTabs() {
  document.querySelectorAll('#adminTabs .tab').forEach(t => {
    t.onclick = () => switchTab(t.dataset.tab);
  });
}
function switchTab(name) {
  document.querySelectorAll('#adminTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  ['users', 'notice', 'countdown', 'term', 'logs'].forEach(p => {
    document.getElementById('pane-' + p).hidden = (p !== name);
  });
}

// ---------- 公告管理 ----------
async function loadNoticeAdmin() {
  try {
    const { announcements } = await api('/api/announcements');
    const box = document.getElementById('noticeAdminList');
    box.innerHTML = announcements.length ? announcements.map(a => `
      <div class="notice-item">
        <div class="notice-item-title">${escapeText(a.title)}
          ${a.active ? '' : '<span class="tag tag-pending" style="margin-left:8px">已过期</span>'}
        </div>
        ${a.content ? `<div class="notice-item-content">${escapeText(a.content)}</div>` : ''}
        <div class="notice-item-meta">${escapeText(a.createdBy || '')} · ${escapeText(a.created_at || '')}${a.expiresAt ? ` · ${a.expiresAt} 后过期` : ' · 永久'}</div>
        <button class="btn btn-danger notice-del" data-id="${a.id}" style="margin-top:8px">删除</button>
      </div>`).join('') : '<div class="alert info">暂无公告</div>';
    box.querySelectorAll('.notice-del').forEach(b => {
      b.onclick = async () => {
        if (!confirm('确定删除这条公告？')) return;
        try {
          await api(`/api/announcements/${b.dataset.id}`, { method: 'DELETE' });
          toast('已删除');
          loadNoticeAdmin();
        } catch (e) { toast(e.message); }
      };
    });
  } catch (e) { /* 无权限忽略 */ }
}
async function publishNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const content = document.getElementById('noticeContent').value.trim();
  const expiresAt = document.getElementById('noticeExpires').value;
  if (!title) { toast('标题不能为空'); return; }
  try {
    await api('/api/announcements', { method: 'POST', body: JSON.stringify({ title, content, expiresAt }) });
    toast('公告已发布');
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    document.getElementById('noticeExpires').value = '';
    loadNoticeAdmin();
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) { toast(e.message); }
}

// ---------- 倒计时设置 ----------
function cdRowHtml(label = '', date = '') {
  return `
    <div class="cd-edit-row">
      <input class="cd-edit-label" placeholder="名称，如：期末考试" value="${escapeText(label)}" maxlength="30">
      <input class="cd-edit-date" type="date" value="${date}">
      <button class="btn btn-danger cd-edit-del">×</button>
    </div>`;
}
async function loadCountdownPanel() {
  try {
    const cd = await api('/api/countdown');
    document.getElementById('cdEnabled').checked = !!cd.enabled;
    const box = document.getElementById('cdItems');
    box.innerHTML = (cd.items || []).map(it => cdRowHtml(it.label, it.date)).join('') || '';
    bindCdRows();
  } catch (e) { /* 忽略 */ }
}
function bindCdRows() {
  document.querySelectorAll('#cdItems .cd-edit-del').forEach(b => {
    b.onclick = () => b.closest('.cd-edit-row').remove();
  });
}
async function saveCountdown() {
  const items = [];
  document.querySelectorAll('#cdItems .cd-edit-row').forEach(row => {
    const label = row.querySelector('.cd-edit-label').value.trim();
    const date = row.querySelector('.cd-edit-date').value;
    if (label && date) items.push({ label, date });
  });
  try {
    await api('/api/countdown', {
      method: 'PUT',
      body: JSON.stringify({ enabled: document.getElementById('cdEnabled').checked, items }),
    });
    document.getElementById('cdMsg').innerHTML = '<div class="alert info">✓ 已保存，主页即时生效</div>';
    toast('倒计时已保存');
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) {
    document.getElementById('cdMsg').innerHTML = `<div class="alert">${escapeText(e.message)}</div>`;
  }
}

// ---------- 用户列表 ----------
async function loadUsers() {
  const { users } = await api('/api/admin/users');
  const tbody = document.getElementById('userTbody');
  tbody.innerHTML = users.map(u => {
    const status = u.first_login
      ? '<span class="tag tag-pending">待首次设置</span>'
      : '<span class="tag tag-user">正常</span>';
    const canReset = me.roleLevel >= 2 || (u.role_level || 0) === 0;
    const resetBtn = canReset
      ? `<button class="btn btn-danger reset-btn" data-id="${u.id}" data-name="${escapeText(u.display_name)}">重置</button>`
      : '<span style="color:var(--muted)">—</span>';
    const roleBtn = me.roleLevel >= 2
      ? `<button class="btn setrole-btn" data-id="${u.id}" data-name="${escapeText(u.display_name)}" data-pos="${escapeText(u.position || '')}">设权限</button>`
      : '';
    return `<tr>
      <td>${escapeText(u.display_name)}</td>
      <td><code>${escapeText(u.username)}</code></td>
      <td>${escapeText(u.student_id)}</td>
      <td>${u.position ? escapeText(u.position) : '—'}</td>
      <td>${roleTag(u.role_level)}</td>
      <td>${status}</td>
      <td class="ops">${resetBtn} ${roleBtn}</td>
    </tr>`;
  }).join('');
}

async function loadLogs() {
  try {
    const { logs } = await api('/api/admin/logs?limit=300');
    const tbody = document.getElementById('logTbody');
    tbody.innerHTML = logs.map(l => `<tr>
      <td>${escapeText(l.created_at)}</td>
      <td>${escapeText(l.actor_name || l.actor)}</td>
      <td>${escapeText(l.action)}</td>
      <td>${escapeText(l.target)}</td>
      <td>${escapeText(l.detail)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">暂无日志</td></tr>';
  } catch (e) { /* 无权限等忽略 */ }
}

// ---------- 学期设置 ----------
async function loadTerm() {
  try {
    const t = await api('/api/term');
    document.getElementById('termYear').value = t.academicYear || '';
    document.getElementById('termStart').value = t.termStart || '';
    document.getElementById('termEnd').value = t.termEnd || '';
  } catch (e) { toast(e.message); }
}
async function saveTerm() {
  const year = document.getElementById('termYear').value.trim();
  const termStart = document.getElementById('termStart').value;
  const termEnd = document.getElementById('termEnd').value;
  const msg = document.getElementById('termMsg');
  msg.innerHTML = '';
  if (!year || !termStart || !termEnd) { msg.innerHTML = '<div class="alert">请完整填写学年与起止日期</div>'; return; }
  try {
    await api('/api/term', { method: 'PUT', body: JSON.stringify({ academicYear: year, termStart, termEnd }) });
    msg.innerHTML = '<div class="alert info">✓ 已保存，主页学期信息已生效</div>';
    toast('学期设置已保存');
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
}

// ---------- 重置 ----------
async function resetUser(userId, name) {
  if (!confirm(`确定重置「${name}」的账号吗？\n该账号将恢复到首次登录前状态（清空职位与角色），并生成新的初始密码。`)) return;
  try {
    const r = await api('/api/admin/reset-user', { method: 'POST', body: JSON.stringify({ userId }) });
    showResult('重置成功', `已重置为首次登录前状态，新初始密码：`, r.displayName, r.username, r.newPassword);
    await loadUsers();
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) { toast(e.message); }
}

// ---------- 创建用户 ----------
async function createUser() {
  const name = document.getElementById('newName').value.trim();
  const studentId = document.getElementById('newSid').value.trim();
  const err = document.getElementById('createErr');
  err.innerHTML = '';
  if (!name || !studentId) { err.innerHTML = '<div class="alert">请输入姓名和学号</div>'; return; }
  try {
    const r = await api('/api/admin/create-user', {
      method: 'POST', body: JSON.stringify({ name, studentId }),
    });
    document.getElementById('createModal').hidden = true;
    showResult('创建成功', `已创建账号，初始密码（请转告该同学）：`, r.displayName, r.username, r.password);
    document.getElementById('newName').value = '';
    document.getElementById('newSid').value = '';
    await loadUsers();
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) { err.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
}

// ---------- 设权限 ----------
async function openRole(userId, name, curPos) {
  document.getElementById('roleUser').value = name;
  document.getElementById('roleErr').innerHTML = '';
  let positions = [];
  try { const r = await api('/api/admin/positions'); positions = r.positions; }
  catch (e) { toast(e.message); return; }
  const sel = document.getElementById('rolePosition');
  sel.innerHTML = positions.map(p => {
    const label = p.limit === null ? p.position : `${p.position}（${p.used}/${p.limit}）`;
    return `<option value="${p.position}" ${p.position === curPos ? 'selected' : ''}>
      ${p.available ? label : label + ' · 已满'}</option>`;
  }).join('');
  document.getElementById('roleInfo').textContent =
    '电教委员=超级管理员；班长/团支书/学习委员/各科课代表=管理员；我不是以上职位=普通用户。';
  sel.dataset.userId = userId;
  document.getElementById('roleModal').hidden = false;
}

async function submitRole() {
  const sel = document.getElementById('rolePosition');
  const userId = Number(sel.dataset.userId);
  const position = sel.value;
  try {
    await api('/api/admin/set-role', {
      method: 'POST', body: JSON.stringify({ userId, position }),
    });
    toast('权限已更新');
    document.getElementById('roleModal').hidden = true;
    await loadUsers();
    if (me.roleLevel >= 2) await loadLogs();
  } catch (e) {
    document.getElementById('roleErr').innerHTML = `<div class="alert">${escapeText(e.message)}</div>`;
  }
}

// ---------- 结果展示 ----------
function showResult(title, lead, displayName, username, password) {
  document.getElementById('pwdTitle').textContent = title;
  document.getElementById('pwdLead').textContent = lead;
  document.getElementById('pwdUser').textContent = `${displayName}（${username}）`;
  document.getElementById('pwdText').value = password;
  document.getElementById('pwdModal').hidden = false;
}

// ---------- 事件 ----------
function bindEvents() {
  document.getElementById('userTbody').addEventListener('click', (e) => {
    const reset = e.target.closest('.reset-btn');
    if (reset) return resetUser(Number(reset.dataset.id), reset.dataset.name);
    const set = e.target.closest('.setrole-btn');
    if (set) return openRole(Number(set.dataset.id), set.dataset.name, set.dataset.pos);
  });

  document.getElementById('createBtn').onclick = () => {
    document.getElementById('createModal').hidden = false;
    setTimeout(() => document.getElementById('newName').focus(), 50);
  };
  document.getElementById('createClose').onclick = () => { document.getElementById('createModal').hidden = true; };
  document.getElementById('createSubmit').onclick = createUser;
  document.getElementById('newSid').addEventListener('keydown', (e) => { if (e.key === 'Enter') createUser(); });

  document.getElementById('roleClose').onclick = () => { document.getElementById('roleModal').hidden = true; };
  document.getElementById('roleSubmit').onclick = submitRole;

  document.getElementById('termSave').onclick = saveTerm;

  document.getElementById('noticePublish').onclick = publishNotice;
  document.getElementById('cdAdd').onclick = () => {
    document.getElementById('cdItems').insertAdjacentHTML('beforeend', cdRowHtml());
    bindCdRows();
  };
  document.getElementById('cdSave').onclick = saveCountdown;

  document.getElementById('pwdClose').onclick = () => { document.getElementById('pwdModal').hidden = true; };
  document.getElementById('copyPwd').onclick = () => {
    const t = document.getElementById('pwdText');
    t.select(); t.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch (_) { toast('复制失败，请手动复制'); }
  };

  ['createModal', 'roleModal', 'pwdModal'].forEach(id => {
    document.getElementById(id).addEventListener('mousedown', (e) => {
      if (e.target.id === id) document.getElementById(id).hidden = true;
    });
  });
}
