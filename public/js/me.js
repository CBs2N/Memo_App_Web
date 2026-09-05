// "我的"页：查看账号信息、修改显示姓名、修改密码
(function () {
  ensureThemeUI();
  document.getElementById('version').textContent = App.VERSION;

  let me = null;

  async function init() {
    try {
      const { user } = await api('/api/me');
      if (!user) { location.href = '/login.html'; return; }
      me = user;
    } catch (_) { location.href = '/login.html'; return; }
    renderInfo();
    bind();
  }

  function renderInfo() {
    document.getElementById('permMsg').hidden = true;
    document.getElementById('mePanel').hidden = false;
    document.getElementById('meAvatar').textContent = (me.displayName || '?').slice(0, 1);
    document.getElementById('meName').textContent = me.displayName;
    document.getElementById('meMeta').textContent = `学号：${me.studentId || '—'}`;
    document.getElementById('meRole').textContent = `职位：${me.position || '未设置'}  ·  角色：${roleText(me.roleLevel)}`;
    document.getElementById('curUsername').value = me.username;
    document.getElementById('usernameInput').value = '';
    // 右上角
    document.getElementById('authArea').innerHTML = `
      <span class="user-chip">${escapeText(me.displayName)}（${escapeText(me.username)}）</span>
      <button class="btn-ghost btn" id="logoutBtn">登出</button>`;
    document.getElementById('logoutBtn').onclick = async () => {
      await api('/api/logout', { method: 'POST' });
      location.href = '/';
    };
  }

  async function saveName() {
    const username = document.getElementById('usernameInput').value.trim().toLowerCase();
    const msg = document.getElementById('nameMsg');
    if (!username) { msg.innerHTML = '<div class="alert">新账号不能为空</div>'; return; }
    try {
      const { user } = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ username }) });
      me = user;
      msg.innerHTML = `<div class="alert info">✓ 账号已改为 <b>${escapeText(user.username)}</b>，请牢记新账号</div>`;
      renderInfo();
      toast('账号已更新');
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }

  async function savePwd() {
    const oldPassword = document.getElementById('oldPwd').value;
    const newPassword = document.getElementById('newPwd').value;
    const newPassword2 = document.getElementById('newPwd2').value;
    const msg = document.getElementById('pwdMsg');
    msg.innerHTML = '';
    if (newPassword.length < 6) { msg.innerHTML = '<div class="alert">新密码至少 6 位</div>'; return; }
    if (newPassword !== newPassword2) { msg.innerHTML = '<div class="alert">两次输入不一致</div>'; return; }
    try {
      await api('/api/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
      document.getElementById('oldPwd').value = document.getElementById('newPwd').value = document.getElementById('newPwd2').value = '';
      msg.innerHTML = '<div class="alert info">✓ 密码已修改</div>';
      toast('密码已修改');
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }

  function bind() {
    document.getElementById('saveNameBtn').onclick = saveName;
    document.getElementById('savePwdBtn').onclick = savePwd;
    document.getElementById('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
    ['oldPwd', 'newPwd', 'newPwd2'].forEach(id =>
      document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') savePwd(); }));
  }

  init();
})();
