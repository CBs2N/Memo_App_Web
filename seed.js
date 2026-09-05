// 账号批量生成脚本
// 用法：
//   1. 编辑 students.json，填入 [{ "name":"张三", "studentId":"01" }, ...]
//   2. node seed.js
//   3. 生成的账号明文清单写入 accounts.txt（含密码，请妥善保管后删除）
//
// 账号规则：姓名拼音首字母(小写) + 学号。例如 "张小明" + "08" => "zxm08"
// 已存在的账号会跳过（不会覆盖已改过密码的用户），保证可重复运行。

const fs = require('fs');
const path = require('path');
const store = require('./store');
const auth = require('./auth');
const { makeUsername } = require('./accounts');

function main() {
  const file = path.join(__dirname, 'students.json');
  if (!fs.existsSync(file)) {
    console.error('\n未找到 students.json。请复制示例并填写名单：\n  cp students.json.example students.json\n  然后编辑 students.json\n');
    process.exit(1);
  }
  let list;
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('students.json 解析失败：', e.message); process.exit(1); }
  if (!Array.isArray(list) || !list.length) {
    console.error('students.json 为空或格式不正确。'); process.exit(1);
  }

  const created = [];
  const skipped = [];

  for (const s of list) {
    if (!s.name || s.studentId == null) { console.warn('跳过无效条目:', s); continue; }
    let username;
    try { username = makeUsername(s.name, s.studentId); }
    catch (e) { skipped.push({ name: s.name, username: '(生成失败)', reason: e.message }); continue; }
    if (store.getUserByUsername(username)) {
      skipped.push({ name: s.name, username, reason: '已存在' });
      continue;
    }
    const pwd = auth.genPassword(8);
    store.insertUser({
      username, display_name: s.name, student_id: String(s.studentId),
      password_hash: auth.hashPwd(pwd), role_level: null, position: null, first_login: 1,
    });
    created.push({ name: s.name, studentId: s.studentId, username, password: pwd });
  }

  const outPath = path.join(__dirname, 'accounts.txt');
  const lines = created.map(o => `${o.name}\t${o.username}\t${o.password}`);
  fs.writeFileSync(outPath,
    '# 姓名\t账号\t初始密码（请妥善保管，分发给同学后建议删除本文件）\n' + lines.join('\n') + '\n',
    'utf8'
  );

  console.log(`\n完成：新建 ${created.length} 个账号，跳过 ${skipped.length} 个。`);
  console.log(`明文清单已写入：${outPath}`);
  if (skipped.length) {
    console.log('\n跳过列表：');
    skipped.forEach(s => console.log(`  ${s.name} (${s.username}) - ${s.reason}`));
  }
  console.log('\n下一步：node server.js 启动服务');
}

main();
