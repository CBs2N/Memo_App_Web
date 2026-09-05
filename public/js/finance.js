// 收支·赞助页
(function () {
  ensureThemeUI();
  document.getElementById('version').textContent = App.VERSION;

  let me = null;   // 当前用户
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const yuan = n => '¥' + Number(n).toFixed(2);

  async function init() {
    try {
      const { user } = await api('/api/me');
      me = user;
    } catch (_) { me = null; }
    // 右上角登录态
    const area = document.getElementById('authArea');
    if (me) {
      area.innerHTML = `<span class="user-chip">${escapeText(me.displayName)}</span>
        <button class="btn-ghost btn" id="logoutBtn">登出</button>`;
      document.getElementById('logoutBtn').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = '/'; };
    } else {
      area.innerHTML = `<a class="btn-primary btn" href="/login.html">登录</a>`;
    }
    // 超管显示"添加记录"
    if (me && (me.roleLevel || 0) >= 2) {
      document.getElementById('addForm').hidden = false;
      const today = new Date();
      document.getElementById('finDate').value =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    await load();
  }

  async function load() {
    const { records, summary } = await api('/api/finance');
    document.getElementById('sumIncome').textContent = yuan(summary.income);
    document.getElementById('sumExpense').textContent = yuan(summary.expense);
    document.getElementById('sumBalance').textContent = yuan(summary.balance);
    renderChart(records);
    renderTable(records);
  }

  // 近6个月柱状图
  function renderChart(records) {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    }
    const data = months.map(mo => {
      let inc = 0, exp = 0;
      for (const r of records) {
        if ((r.date || '').slice(0, 7) === mo.key) {
          if (r.type === 'income') inc += Number(r.amount) || 0;
          else exp += Number(r.amount) || 0;
        }
      }
      return { ...mo, inc, exp };
    });
    const max = Math.max(1, ...data.map(d => Math.max(d.inc, d.exp)));
    const box = document.getElementById('chartBars');
    box.innerHTML = data.map(d => `
      <div class="chart-col">
        <div style="display:flex;gap:6px;align-items:flex-end;height:130px;width:100%;justify-content:center">
          <div class="bar inc" style="height:${(d.inc / max * 100).toFixed(0)}%" title="收入 ${yuan(d.inc)}"></div>
          <div class="bar exp" style="height:${(d.exp / max * 100).toFixed(0)}%" title="支出 ${yuan(d.exp)}"></div>
        </div>
        <div class="vl">${d.inc ? yuan(d.inc) : ''}</div>
        <div class="ml">${MONTHS[d.m]}</div>
      </div>`).join('');
  }

  function renderTable(records) {
    const tbody = document.getElementById('finTbody');
    const isSuper = me && (me.roleLevel || 0) >= 2;
    tbody.innerHTML = records.length ? records.map(r => `
      <tr>
        <td>${escapeText(r.date)}</td>
        <td>${r.type === 'income' ? '<span class="tag tag-user" style="background:#eafaf1;color:var(--ok)">收入</span>' : '<span class="tag tag-super">支出</span>'}</td>
        <td style="font-weight:700;${r.type === 'income' ? 'color:var(--ok)' : 'color:var(--danger)'}">${r.type === 'income' ? '+' : '-'}${yuan(r.amount)}</td>
        <td>${escapeText(r.desc || '—')}</td>
        <td>${escapeText(r.by || '—')}</td>
        <td>${isSuper ? `<button class="btn btn-danger del-btn del-fin" data-id="${r.id}">删</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted)">暂无收支记录</td></tr>';
    tbody.querySelectorAll('.del-fin').forEach(b => {
      b.onclick = async () => {
        if (!confirm('确定删除这条记录？')) return;
        try {
          await api(`/api/finance/${b.dataset.id}`, { method: 'DELETE' });
          toast('已删除');
          load();
        } catch (e) { toast(e.message); }
      };
    });
  }

  async function addRecord() {
    const date = document.getElementById('finDate').value;
    const type = document.getElementById('finType').value;
    const amount = document.getElementById('finAmount').value;
    const desc = document.getElementById('finDesc').value.trim();
    const msg = document.getElementById('finMsg');
    if (!date || !amount || Number(amount) <= 0) { msg.innerHTML = '<div class="alert">请填写日期和有效金额</div>'; return; }
    try {
      await api('/api/finance', { method: 'POST', body: JSON.stringify({ date, type, amount: Number(amount), desc }) });
      document.getElementById('finAmount').value = '';
      document.getElementById('finDesc').value = '';
      msg.innerHTML = '';
      toast('已添加');
      load();
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }

  document.getElementById('finAdd').onclick = addRecord;
  document.getElementById('finAmount').addEventListener('keydown', e => { if (e.key === 'Enter') addRecord(); });
  document.getElementById('finDesc').addEventListener('keydown', e => { if (e.key === 'Enter') addRecord(); });

  init().catch(e => toast(e.message));
})();
