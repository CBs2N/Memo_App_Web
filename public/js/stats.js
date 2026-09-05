// 作业统计页：范围切换 + 条形图 + 记录情况表
(function () {
  let days = 30;

  async function load() {
    const { range, stats } = await api(`/api/stats?days=${days}`);
    document.getElementById('rangeNote').textContent =
      `统计区间：${range.from} ~ ${range.to}（作业条数按内容非空行计算）`;

    // 排序：按条数降序
    const sorted = stats.slice().sort((a, b) => b.items - a.items);
    const max = Math.max(1, ...sorted.map(s => s.items));

    // 条形图（只显示条数）
    document.getElementById('barChart').innerHTML = sorted.map(s => `
      <div class="bar-row">
        <span class="bar-label">${subjectIcon(s.subject)} ${escapeText(s.subject)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(s.items / max * 100).toFixed(1)}%"></div></div>
        <span class="bar-value">${s.items}条</span>
      </div>`).join('');

    // 表格
    document.getElementById('statsTable').innerHTML = sorted.map(s => `
      <tr>
        <td>${escapeText(s.subject)}</td>
        <td>${s.days}</td>
        <td>${s.edits}</td>
        <td>${escapeText(s.lastEditor || '—')}</td>
        <td>${escapeText(s.lastTime || '—')}</td>
      </tr>`).join('');
  }

  document.querySelectorAll('#rangeTabs .tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('#rangeTabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      days = Number(t.dataset.days);
      load().catch(e => toast(e.message));
    };
  });

  load().catch(e => toast(e.message));
})();
