// 课程表：今日（高亮当前时段）+ 全周 + 页内编辑（管理员及以上）
(function () {
  ensureThemeUI();
  document.getElementById('version').textContent = App.VERSION;

  /* ===== 默认课表（后端未设置自定义时使用） type: lesson/break/noon/activity */
  const DEFAULT_TIMETABLE = {
    1: [
      ['07:10', '07:50', '早自习', 'lesson'], ['07:50', '08:00', '课间', 'break'],
      ['08:00', '08:40', '语文', 'lesson'], ['08:40', '08:50', '课间', 'break'],
      ['08:50', '09:30', '数学', 'lesson'], ['09:30', '09:40', '课间', 'break'],
      ['09:40', '09:45', '眼保健操', 'break'], ['09:45', '10:25', '体育', 'lesson'],
      ['10:25', '10:35', '课间', 'break'], ['10:35', '11:15', '体育', 'lesson'],
      ['11:15', '12:40', '午餐 + 午休', 'noon'], ['12:40', '13:20', '物理', 'lesson'],
      ['13:20', '13:30', '课间', 'break'], ['13:30', '14:10', '班会', 'lesson'],
      ['14:10', '14:40', '大课间', 'activity'], ['14:40', '15:20', '英语', 'lesson'],
      ['15:20', '15:30', '课间', 'break'], ['15:30', '16:10', '历史', 'lesson'],
      ['16:10', '16:20', '课间', 'break'], ['16:20', '17:00', '学习方法指导：体育', 'lesson'],
    ],
    2: [
      ['07:10', '07:50', '早自习', 'lesson'], ['07:50', '08:00', '课间', 'break'],
      ['08:00', '08:40', '语文', 'lesson'], ['08:40', '08:50', '课间', 'break'],
      ['08:50', '09:30', '语文', 'lesson'], ['09:30', '09:40', '课间', 'break'],
      ['09:40', '09:45', '眼保健操', 'break'], ['09:45', '10:25', '地理', 'lesson'],
      ['10:25', '10:35', '课间', 'break'], ['10:35', '11:15', '物理', 'lesson'],
      ['11:15', '12:40', '午餐 + 午休', 'noon'], ['12:40', '13:20', '数学', 'lesson'],
      ['13:20', '13:30', '课间', 'break'], ['13:30', '14:10', '数学', 'lesson'],
      ['14:10', '14:40', '大课间', 'activity'], ['14:40', '15:20', '化学', 'lesson'],
      ['15:20', '15:30', '课间', 'break'], ['15:30', '16:10', '体育', 'lesson'],
      ['16:10', '16:20', '课间', 'break'], ['16:20', '17:00', '学习方法指导：英语', 'lesson'],
    ],
    3: [
      ['07:10', '07:50', '早自习', 'lesson'], ['07:50', '08:00', '课间', 'break'],
      ['08:00', '08:40', '政治', 'lesson'], ['08:40', '08:50', '课间', 'break'],
      ['08:50', '09:30', '体育', 'lesson'], ['09:30', '09:40', '课间', 'break'],
      ['09:40', '09:45', '眼保健操', 'break'], ['09:45', '10:25', '数学', 'lesson'],
      ['10:25', '10:35', '课间', 'break'], ['10:35', '11:15', '英语', 'lesson'],
      ['11:15', '12:40', '午餐 + 午休', 'noon'], ['12:40', '13:20', '历史', 'lesson'],
      ['13:20', '13:30', '课间', 'break'], ['13:30', '14:10', '化学', 'lesson'],
      ['14:10', '14:40', '大课间', 'activity'], ['14:40', '15:20', '生物', 'lesson'],
      ['15:20', '15:30', '课间', 'break'], ['15:30', '16:10', '艺术', 'lesson'],
      ['16:10', '16:20', '课间', 'break'], ['16:20', '17:00', '学习方法指导：语文', 'lesson'],
    ],
    4: [
      ['07:10', '07:50', '早自习', 'lesson'], ['07:50', '08:00', '课间', 'break'],
      ['08:00', '08:40', '语文', 'lesson'], ['08:40', '08:50', '课间', 'break'],
      ['08:50', '09:30', '地理', 'lesson'], ['09:30', '09:40', '课间', 'break'],
      ['09:40', '09:45', '眼保健操', 'break'], ['09:45', '10:25', '物理', 'lesson'],
      ['10:25', '10:35', '课间', 'break'], ['10:35', '11:15', '政治', 'lesson'],
      ['11:15', '12:40', '午餐 + 午休', 'noon'], ['12:40', '13:20', '英语', 'lesson'],
      ['13:20', '13:30', '课间', 'break'], ['13:30', '14:10', '英语', 'lesson'],
      ['14:10', '14:40', '大课间', 'activity'], ['14:40', '15:20', '信息', 'lesson'],
      ['15:20', '15:30', '课间', 'break'], ['15:30', '16:10', '信息', 'lesson'],
      ['16:10', '16:20', '课间', 'break'], ['16:20', '17:00', '学习方法指导：数学', 'lesson'],
    ],
    5: [
      ['07:10', '07:50', '早自习', 'lesson'], ['07:50', '08:00', '课间', 'break'],
      ['08:00', '08:40', '语文', 'lesson'], ['08:40', '08:50', '课间', 'break'],
      ['08:50', '09:30', '化学', 'lesson'], ['09:30', '09:40', '课间', 'break'],
      ['09:40', '09:45', '眼保健操', 'break'], ['09:45', '10:25', '生物', 'lesson'],
      ['10:25', '10:35', '课间', 'break'], ['10:35', '11:15', '心理', 'lesson'],
      ['11:15', '12:40', '午餐 + 午休', 'noon'], ['12:40', '13:20', '校本课程', 'lesson'],
      ['13:20', '13:30', '课间', 'break'], ['13:30', '14:10', '校本课程', 'lesson'],
      ['14:10', '14:40', '大课间', 'activity'], ['14:40', '15:20', '数学', 'lesson'],
      ['15:20', '15:30', '课间', 'break'], ['15:30', '16:10', '学习方法指导：英语', 'lesson'],
    ],
  };
  const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周日'];

  // 学科配色与图标
  const COLORS = {
    '语文': '#3b5bdb', '数学': '#e8590c', '英语': '#2b8a3e', '物理': '#6741d9',
    '化学': '#c92a2a', '生物': '#0c8599', '地理': '#1864ab', '政治': '#a61e4d',
    '历史': '#846358', '艺术': '#c2255c', '信息': '#1971c2', '心理': '#0ca678',
    '体育': '#d9480f',
  };
  const NEUTRAL = '#495057';
  const ICONS = {
    '早自习': '📖', '班会': '🚩', '校本课程': '📚', '体育': '🏃',
    '学习方法指导': '🧭', '眼保健操': '👀', '大课间': '🌤️', '午餐': '🍚', '课间': '⏸️',
  };
  const colorOf = name => COLORS[name] || NEUTRAL;
  const iconOf = name => {
    if (name.startsWith('学习方法指导')) return ICONS['学习方法指导'];
    return ICONS[name] || subjectIcon(name.split('：')[0]);
  };

  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

  /* ===== 数据：优先后端自定义，否则默认 ===== */
  let TIMETABLE = JSON.parse(JSON.stringify(DEFAULT_TIMETABLE));
  async function loadData() {
    try {
      const r = await api('/api/timetable');
      if (r.timetable && Object.keys(r.timetable).length) {
        TIMETABLE = r.timetable;
      }
    } catch (_) {}
  }
  const rowsOf = d => TIMETABLE[d] || [];

  /* ===== 今日视图（支持 ?d=1~5 预览；周末默认展示周五；按当前钟点高亮） ===== */
  const params = new URLSearchParams(location.search);
  const previewParam = parseInt(params.get('d'), 10);
  const hasPreview = previewParam >= 1 && previewParam <= 5;

  function renderToday() {
    const realDay = new Date().getDay();
    const isWeekend = realDay === 0 || realDay === 6;
    const day = hasPreview ? previewParam : (isWeekend ? 5 : realDay);
    const simulated = hasPreview || isWeekend;

    const list = document.getElementById('ttTodayList');
    const nowBar = document.getElementById('ttNow');
    const rows = rowsOf(day);
    const now = nowMin();

    let currentIdx = -1, next = null;
    rows.forEach((r, i) => {
      if (now >= toMin(r[0]) && now < toMin(r[1])) currentIdx = i;
    });
    if (currentIdx === -1) {
      for (const r of rows) { if (now < toMin(r[0])) { next = r; break; } }
    } else {
      for (let i = currentIdx + 1; i < rows.length; i++) {
        if (rows[i][3] === 'lesson') { next = rows[i]; break; }
      }
    }

    nowBar.hidden = false;
    nowBar.className = 'tt-now' + (currentIdx > -1 ? ' active' : '');
    let prefix = '';
    if (simulated) {
      prefix = isWeekend && !hasPreview
        ? `🌤️ 今天是周末没有课，以下是<b>周五课表预览</b>（高亮为当前时刻模拟）<br>`
        : `🗓️ 正在预览<b>${DAY_NAMES[day]}</b>的课表（高亮为当前时刻模拟）<br>`;
    }
    if (currentIdx > -1) {
      const r = rows[currentIdx];
      const left = toMin(r[1]) - now;
      nowBar.innerHTML = `${prefix}⏰ 此时：<b style="color:${colorOf(r[2])}">${iconOf(r[2])} ${escapeText(r[2])}</b>（${r[0]}-${r[1]}）· 还剩 <b>${left}</b> 分钟`;
    } else if (next) {
      const nm = toMin(next[0]) - now;
      nowBar.innerHTML = `${prefix}⏭️ 下一节：${iconOf(next[2])} <b>${escapeText(next[2])}</b>（${next[0]}）· ${nm >= 60 ? Math.floor(nm / 60) + '小时' + (nm % 60) + '分' : nm + '分钟'}后开始`;
    } else {
      nowBar.innerHTML = `${prefix}🎉 此时段之后已经没有课了`;
    }

    // 时间轴：非课程（课间/眼操/午餐/大课间）统一紧凑灰行
    list.innerHTML = rows.map((r, i) => {
      const [s, e, name, type] = r;
      const isNow = i === currentIdx;
      const isPast = now >= toMin(e);
      const col = colorOf(name);
      if (type !== 'lesson') {
        return `<div class="tt-row break ${isPast ? 'past' : ''} ${isNow ? 'now' : ''}">
          <span class="tt-time">${s}</span>
          <span class="tt-dot" style="background:${isNow ? 'var(--danger)' : 'var(--border)'}"></span>
          <span class="tt-name muted">${escapeText(name)}</span>
          <span class="tt-range">${s}-${e}</span>
        </div>`;
      }
      return `<div class="tt-row lesson ${isPast ? 'past' : ''} ${isNow ? 'now' : ''}" style="--lc:${col}">
        <span class="tt-time">${s}</span>
        <span class="tt-dot"></span>
        <span class="tt-name">${iconOf(name)} ${escapeText(name)}</span>
        <span class="tt-range">${s}-${e}</span>
      </div>`;
    }).join('');
  }

  /* ===== 全周视图 ===== */
  function renderWeek() {
    const slotMap = new Map();
    for (let d = 1; d <= 5; d++) {
      for (const [s, e] of rowsOf(d)) {
        const k = s + '-' + e;
        if (!slotMap.has(k)) slotMap.set(k, { s, e });
      }
    }
    const slots = [...slotMap.values()].sort((a, b) => toMin(a.s) - toMin(b.s));

    let html = '<tr><th class="tt-corner">时间</th>' +
      [1, 2, 3, 4, 5].map(d => `<th><a href="/timetable.html?d=${d}" style="color:inherit;text-decoration:none">周${'一二三四五'[d - 1]}</a></th>`).join('') + '</tr>';
    for (const slot of slots) {
      const cells = [];
      for (let d = 1; d <= 5; d++) {
        const hit = rowsOf(d).find(r => r[0] === slot.s && r[1] === slot.e);
        cells.push(hit ? { name: hit[2], type: hit[3] } : null);
      }
      const present = cells.filter(Boolean);
      const same = present.length > 0 &&
        present.every(c => c.name === present[0].name && c.type === present[0].type);
      // 合并规则：课程行要求 5 天都有且一致；非课程行（课间/午餐/大课间等）只要非空天一致即可合并
      const canMerge = same && (present[0].type !== 'lesson' || present.length === 5);
      const timeCell = `<td class="tt-time-cell">${slot.s}<br><span>${slot.e}</span></td>`;
      if (canMerge) {
        const c = present[0];
        const cls = c.type === 'lesson' ? 'tt-cell' : 'tt-cell muted-cell';
        const col = c.type === 'lesson' ? colorOf(c.name) : 'var(--muted)';
        html += `<tr class="tt-samerow">${timeCell}<td class="${cls}" colspan="5" style="--lc:${col}"><span>${c.type === 'lesson' ? iconOf(c.name) + ' ' : ''}${escapeText(c.name)}</span></td></tr>`;
      } else {
        html += `<tr>${timeCell}` + cells.map(c => {
          if (!c) return '<td class="tt-cell empty"></td>';
          if (c.type !== 'lesson') return `<td class="tt-cell muted-cell"><span>${escapeText(c.name)}</span></td>`;
          return `<td class="tt-cell" style="--lc:${colorOf(c.name)}"><span>${escapeText(c.name)}</span></td>`;
        }).join('') + '</tr>';
      }
    }
    document.getElementById('ttGrid').innerHTML = html;
    const today = new Date().getDay();
    if (today >= 1 && today <= 5) {
      const ths = document.querySelectorAll('#ttGrid th');
      if (ths[today]) ths[today].classList.add('today-col');
      document.querySelectorAll('#ttGrid tr').forEach(tr => {
        const td = tr.querySelectorAll('td')[today];
        if (td) td.classList.add('today-col');
      });
    }
  }

  /* ===== 视图切换 ===== */
  function switchView(v) {
    document.querySelectorAll('#ttTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    document.getElementById('todayView').hidden = v !== 'today';
    document.getElementById('weekView').hidden = v !== 'week';
  }
  document.querySelectorAll('#ttTabs .tab').forEach(t => {
    t.onclick = () => switchView(t.dataset.view);
  });

  /* ===== 编辑模式（管理员及以上） ===== */
  let me = null;
  let editData = null;
  let editDay = 1;

  function renderEditDayTabs() {
    const box = document.getElementById('editDayTabs');
    box.innerHTML = [1, 2, 3, 4, 5].map(d =>
      `<button class="tab ${d === editDay ? 'active' : ''}" data-day="${d}">${DAY_NAMES[d]}</button>`).join('');
    box.querySelectorAll('.tab').forEach(b => {
      b.onclick = () => { editDay = Number(b.dataset.day); renderEditDayTabs(); renderEditRows(); };
    });
  }

  function renderEditRows() {
    const rows = editData[editDay] || (editData[editDay] = []);
    const box = document.getElementById('editRows');
    box.innerHTML = rows.length ? rows.map((r, i) => `
      <div class="tt-edit-row2">
        <input type="time" class="e-s" data-i="${i}" value="${r[0]}">
        <span style="color:var(--muted)">—</span>
        <input type="time" class="e-e" data-i="${i}" value="${r[1]}">
        <input type="text" class="e-n" data-i="${i}" value="${escapeText(r[2])}" maxlength="30" placeholder="名称" style="flex:1;min-width:110px">
        <select class="e-t" data-i="${i}">
          <option value="lesson" ${r[3] === 'lesson' ? 'selected' : ''}>课程</option>
          <option value="break" ${r[3] === 'break' ? 'selected' : ''}>课间</option>
          <option value="noon" ${r[3] === 'noon' ? 'selected' : ''}>午餐</option>
          <option value="activity" ${r[3] === 'activity' ? 'selected' : ''}>大课间</option>
        </select>
        <button class="btn btn-danger e-del" data-i="${i}" title="删除此行">✕</button>
      </div>`).join('')
      : '<div class="alert info">这一天暂无时段，点下方「＋ 添加时段」。</div>';
  }

  function openEdit() {
    editData = JSON.parse(JSON.stringify(TIMETABLE));
    editDay = (new Date().getDay() >= 1 && new Date().getDay() <= 5) ? new Date().getDay() : 1;
    document.getElementById('editMsg').innerHTML = '';
    renderEditDayTabs();
    renderEditRows();
    document.getElementById('editPanel').hidden = false;
    document.getElementById('editPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeEdit() { document.getElementById('editPanel').hidden = true; }

  const addMin = (hm, n) => {
    const t = toMin(hm) + n;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  async function saveEdit() {
    const msg = document.getElementById('editMsg');
    msg.innerHTML = '';
    // 校验
    for (const d of Object.keys(editData)) {
      for (const r of editData[d]) {
        if (!r[0] || !r[1] || !String(r[2]).trim()) { msg.innerHTML = `<div class="alert">周${d} 存在未填写的时段（时间/名称不能为空）</div>`; return; }
        if (r[0] >= r[1]) { msg.innerHTML = `<div class="alert">周${d}「${escapeText(r[2])}」开始时间需早于结束时间</div>`; return; }
      }
    }
    try {
      await api('/api/timetable', { method: 'PUT', body: JSON.stringify({ timetable: editData }) });
      TIMETABLE = JSON.parse(JSON.stringify(editData));
      renderToday(); renderWeek();
      closeEdit();
      toast('课表已保存 ✓');
    } catch (e) { msg.innerHTML = `<div class="alert">${escapeText(e.message)}</div>`; }
  }

  async function resetEdit() {
    if (!confirm('确定恢复默认课表吗？将丢弃全部自定义修改。')) return;
    try {
      await api('/api/timetable', { method: 'PUT', body: JSON.stringify({ timetable: null }) });
      TIMETABLE = JSON.parse(JSON.stringify(DEFAULT_TIMETABLE));
      renderToday(); renderWeek();
      closeEdit();
      toast('已恢复默认课表');
    } catch (e) { toast(e.message); }
  }

  function bindEdit() {
    document.getElementById('editBtn').onclick = openEdit;
    document.getElementById('editCancel').onclick = closeEdit;
    document.getElementById('editSave').onclick = saveEdit;
    document.getElementById('editReset').onclick = resetEdit;
    document.getElementById('editAddRow').onclick = () => {
      const rows = editData[editDay] || (editData[editDay] = []);
      const last = rows[rows.length - 1];
      const s = last ? last[1] : '08:00';
      rows.push([s, addMin(s, 40), '新时段', 'lesson']);
      renderEditRows();
    };
    // 输入实时写回 + 删除（事件委托）
    document.getElementById('editRows').addEventListener('input', (e) => {
      const el = e.target; const i = Number(el.dataset.i);
      if (Number.isNaN(i)) return;
      const r = editData[editDay][i];
      if (!r) return;
      if (el.classList.contains('e-s')) r[0] = el.value;
      if (el.classList.contains('e-e')) r[1] = el.value;
      if (el.classList.contains('e-n')) r[2] = el.value;
      if (el.classList.contains('e-t')) r[3] = el.value;
    });
    document.getElementById('editRows').addEventListener('change', (e) => {
      const el = e.target;
      if (el.classList.contains('e-t')) {
        const i = Number(el.dataset.i);
        if (editData[editDay][i]) editData[editDay][i][3] = el.value;
      }
    });
    document.getElementById('editRows').addEventListener('click', (e) => {
      const del = e.target.closest('.e-del');
      if (!del) return;
      const i = Number(del.dataset.i);
      editData[editDay].splice(i, 1);
      renderEditRows();
    });
  }

  /* ===== 实时同步：他人改课表后自动刷新 ===== */
  connectSync((msg) => {
    if (msg && msg.type === 'timetable') {
      loadData().then(() => { renderToday(); renderWeek(); });
    }
  });

  /* ===== 初始化 ===== */
  (async function init() {
    try {
      const { user } = await api('/api/me');
      me = user;
    } catch (_) { me = null; }
    if (me && (me.roleLevel || 0) >= 1) {
      document.getElementById('editBtn').hidden = false;
      bindEdit();
    }
    await loadData();
    renderToday();
    renderWeek();
    setInterval(renderToday, 30000);
  })();
})();
