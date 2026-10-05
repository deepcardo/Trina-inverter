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

function isValidCount(val) {
  return !isNaN(val) && val >= 10 && val <= 330;
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
  let match = null;
  const isZhangjiajie = state.province === PROV_HUNAN && state.city === '张家界市'
    && state.district && ['永定区', '武陵源区', '慈利县', '桑植县'].includes(state.district);
  if (isZhangjiajie) match = findInRange(ZHANGJIAJIE_DB[state.ratio], state.count);
  if (!match && state.province === PROV_HUNAN) match = findInRange(HUNAN_DB[state.ratio], state.count);
  if (!match && state.series === 'NEG21_730') match = findInRange(DB.NEG21_730[state.ratio], state.count);
  if (!match && DB[state.series]) match = findInRange(DB[state.series][state.ratio], state.count);
  return match;
}
