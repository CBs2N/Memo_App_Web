// 登录 + 首次登录选职位/设密码
(function () {
  ensureThemeUI();
  document.getElementById('version').textContent = App.VERSION;
  showAlert('');

  function showAlert(msg) {
    const a = document.getElementById('alert');
    a.innerHTML = msg ? `<div class="alert">${escapeText(msg)}</div>` : '';
  }

  async function doLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) { showAlert('请输入账号和密码'); return; }
    try {
      const r = await api('/api/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      if (r.firstLogin) {
        await showSetup();
      } else {
        location.href = '/';
      }
    } catch (e) { showAlert(e.message); }
  }

  async function showSetup() {
    document.getElementById('loginForm').hidden = true;
    document.getElementById('setupForm').hidden = false;
    showAlert('');
    let positions = [];
    try {
      const r = await api('/api/positions');
      positions = r.positions || [];
    } catch (e) { showAlert(e.message); return; }
    const sel = document.getElementById('position');
    sel.innerHTML = positions.map(p => {
      const label = p.limit === null
        ? p.position
        : `${p.position}（${p.used}/${p.limit}）`;
      return `<option value="${p.position}" ${p.available ? '' : 'disabled'}>
        ${p.available ? label : label + ' · 已满'}</option>`;
    }).join('');
    // 默认选第一个可用的
    const firstAvail = positions.find(p => p.available);
    if (firstAvail) sel.value = firstAvail.position;
  }

  async function doSetup() {
    const position = document.getElementById('position').value;
    const p1 = document.getElementById('newPwd').value;
    const p2 = document.getElementById('newPwd2').value;
    if (!position) { showAlert('请选择职位'); return; }
    if (p1.length < 6) { showAlert('新密码至少 6 位'); return; }
    if (p1 !== p2) { showAlert('两次输入的密码不一致'); return; }
    try {
      await api('/api/complete-setup', {
        method: 'POST', body: JSON.stringify({ position, newPassword: p1 }),
      });
      location.href = '/';
    } catch (e) { showAlert(e.message); }
  }

  document.getElementById('loginBtn').onclick = doLogin;
  document.getElementById('setupBtn').onclick = doSetup;
  document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('password').focus();
  });
})();
