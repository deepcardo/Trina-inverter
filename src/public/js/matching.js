/**
 * 核心匹配逻辑 — 纯数据查询，无 DOM 依赖
 *
 * 依赖: constants.js, inverters.js, hunan.js, cables.js (全局常量)
 * 加载顺序: 在 data/*.js 之后，在 main.js 之前
 */

function mapRegionRatio(val) {
  if (!val) return RATIO_NORMAL;
  const m = typeof val === 'string' && val.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const num = parseFloat(m[1]);
    if (num >= 1.2) return RATIO_NORMAL;
    if (num >= 1.1) return RATIO_LIGHT;
    if (num >= 1) return RATIO_NONE;
  }
  return RATIO_NORMAL;
}

// 是否张家界专项覆盖区县（判定标准与专项表同源于 hunan.js）
function isZhangjiajie(state) {
  return state.province === PROV_HUNAN && state.city === '张家界市'
    && ZHANGJIAJIE_DISTRICTS.includes(state.district);
}

// 湖南专项挡位表，按查询优先级排列：张家界先专项表再湖南表，其余地市只走湖南表
function getHunanDbs(state) {
  if (state.province !== PROV_HUNAN) return [];
  return isZhangjiajie(state) ? [ZHANGJIAJIE_DB, HUNAN_DB] : [HUNAN_DB];
}

// 从实际配置表读取范围，避免页面提示与数据脱节。
// 注意：此处返回的是各表区间的 min/max 并集，前提是挡位连续无缺口（scripts/validate-data.js 有专项检查兜底）。
// 若未来允许挡位表出现缺口，需改为逐行判断，否则缺口内的数量会通过校验但查询时才报「未找到匹配项」。
function getCountRange(state) {
  const rows = [...(DB[state.series]?.[state.ratio] || [])];
  if (!rows.length) return null;
  for (const db of getHunanDbs(state)) rows.push(...(db[state.ratio] || []));
  return { min: Math.min(...rows.map(row => row.r[0])), max: Math.max(...rows.map(row => row.r[1])) };
}

function isValidCount(val, state) {
  if (!Number.isInteger(val)) return false;
  const range = state ? getCountRange(state) : null;
  return !!range && val >= range.min && val <= range.max;
}

function lookupCable(power, type) {
  for (const t of CABLE_THRESHOLDS) { if (power <= t.limit) return type === 'cu' ? t.cu : t.al; }
  for (const t of CABLE_RECOMMENDATIONS) { if (power <= t.limit) return type === 'cu' ? t.cu : t.al; }
  return '超出建议表范围，需专项选型';
}

/**
 * 核心匹配查询
 * @param {Object} state - { province, city, district, series, ratio, count }
 * @returns {Object|null} - { r: [min,max], inv: string, box: number } 或 null
 *
 * 查询优先级:
 *   1. 张家界专项 → ZHANGJIAJIE_DB
 *   2. 湖南其他地区 → HUNAN_DB
 *   3. NEG21_730 系列 → DB.NEG21_730
 *   4. 当前系列 + 容配比 → DB[series][ratio]（兜底）
 */
function findInRange(rows, count) {
  if (!rows) return null;
  for (const row of rows) {
    if (count >= row.r[0] && count <= row.r[1]) return row;
  }
  return null;
}

function lookupMatch(state) {
  for (const db of getHunanDbs(state)) {
    const match = findInRange(db[state.ratio], state.count);
    if (match) return match;
  }
  if (state.series === 'NEG21_730') return findInRange(DB.NEG21_730[state.ratio], state.count);
  if (DB[state.series]) return findInRange(DB[state.series][state.ratio], state.count);
  return null;
}
