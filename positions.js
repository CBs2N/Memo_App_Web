// 学科 & 职位定义
// 职位 -> { limit: 限额, level: 角色等级 }
//   level: 0=普通用户, 1=管理员, 2=超级管理员
// 电教委员自动成为超级管理员；班长限额2、其余职位限额1；"我不是以上职位"无限制且为普通用户。

const SUBJECTS = [
  '语文', '数学', '英语', '物理', '化学', '生物',
  '地理', '政治', '历史', '艺术', '信息', '心理',
];

const POSITIONS = {
  '班主任': { limit: 1, level: 2 }, // 超级管理员
  '班长': { limit: 2, level: 1 },
  '团支书': { limit: 1, level: 1 },
  '电教委员': { limit: 1, level: 2 }, // 超级管理员
  '学习委员': { limit: 1, level: 1 },
  // 各学科课代表（限额 2）
  ...Object.fromEntries(SUBJECTS.map(s => [`${s}课代表`, { limit: 2, level: 1 }])),
  '我不是以上职位': { limit: Infinity, level: 0 },
};

// 下拉框里展示的顺序
const POSITION_ORDER = [
  '班主任', '班长', '团支书', '电教委员', '学习委员',
  ...SUBJECTS.map(s => `${s}课代表`),
  '我不是以上职位',
];

module.exports = { SUBJECTS, POSITIONS, POSITION_ORDER };
