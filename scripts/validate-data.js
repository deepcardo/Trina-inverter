/**
 * 数据完整性验证脚本
 *
 * 用法: node scripts/validate-data.js
 * 功能: 在构建前自动检查数据完整性
 *
 * 检查项:
 *   1. 区域数据键格式 "省份-城市-区县"
 *   2. 逆变器配置: 每个容配比下的挡位是否连续无缺口
 *   3. 逆变器配置: 最大/小挡位是否在合理范围
 *   4. 湖南配置: 所有挡位是否在标准表对应范围内
 *   5. 无重复条目
 */

import { loadScript } from './shared/load-module.js';

const DATA_DIR = new URL('../src/public/js/data/', import.meta.url);
const REGION_FILE = new URL('region-data.js', DATA_DIR);
const INVERTERS_FILE = new URL('inverters.js', DATA_DIR);
const HUNAN_FILE = new URL('hunan.js', DATA_DIR);
const CABLES_FILE = new URL('cables.js', DATA_DIR);

let exitCode = 0;
let totalChecks = 0;
let passedChecks = 0;

function check(name, ok, detail) {
  totalChecks++;
  if (ok) {
    passedChecks++;
    console.log(`  ✅ ${name}`);
  } else {
    exitCode = 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ==================== 1. 区域数据验证 ====================
console.log('\n📋 区域数据验证');
const regionSandbox = loadScript(REGION_FILE, 'REGION_DB');
const REGION_DB = regionSandbox.REGION_DB;
const regionKeys = Object.keys(REGION_DB);

check('REGION_DB 已定义', !!REGION_DB, 'REGION_DB is falsy');
check('REGION_DB 条目数', regionKeys.length > 0, `共 ${regionKeys.length} 条`);
check('REGION_DB 条目数 > 2000', regionKeys.length > 2000, `实际 ${regionKeys.length}`);

let badFormat = 0, badValue = 0;
for (const k of regionKeys) {
  const parts = k.split('-');
  if (parts.length !== 3) badFormat++;
  const v = REGION_DB[k];
  if (!v || typeof v.b !== 'string' || typeof v.r !== 'string') badValue++;
}
check('所有键格式为 "省-市-县"', badFormat === 0, `${badFormat} 个格式异常`);
check('所有值结构正确', badValue === 0, `${badValue} 个值异常`);

// ==================== 2. 逆变器配置验证 ====================
console.log('\n📋 逆变器配置验证');
const invSandbox = loadScript(INVERTERS_FILE, 'DB');
const DB = invSandbox.DB;

check('DB 已定义', !!DB, 'DB is falsy');

const seriesNames = ['NEG21_715', 'NEG21_730', 'NEG22_785', 'NEG22_800'];
const ratioNames = ['1.2倍(正常)', '1.1倍', '1倍'];

for (const s of seriesNames) {
  const series = DB[s];
  check(`DB.${s} 已定义`, !!series, `Series ${s} not found`);
  if (!series) continue;

  for (const r of ratioNames) {
    const entries = series[r];
    check(`DB.${s}.${r} 已定义`, !!entries, `Ratio ${r} not found in ${s}`);
    if (!entries || entries.length === 0) continue;

    // 检查最小挡位起始
    const first = entries[0].r[0];
    check(`DB.${s}.${r} 起始挡位`, first >= 10, `实际 ${first}`);

    // 检查最大挡位结束
    const last = entries[entries.length - 1].r[1];
    check(`DB.${s}.${r} 最大挡位`, last >= 250, `实际 ${last}`);

    // 检查连续性（相邻挡位之间无缺口）
    let gaps = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      const currEnd = entries[i].r[1];
      const nextStart = entries[i + 1].r[0];
      if (currEnd + 1 < nextStart) gaps++;
    }
    check(`DB.${s}.${r} 挡位连续`, gaps === 0, `${gaps} 个缺口`);

    // 检查每行 r[0] ≤ r[1]
    let badRange = 0;
    for (const row of entries) {
      if (row.r[0] > row.r[1]) badRange++;
    }
    check(`DB.${s}.${r} r[0]≤r[1]`, badRange === 0, `${badRange} 行异常`);

    // 检查无重复行
    const seen = new Set();
    let dupCount = 0;
    for (const row of entries) {
      const key = `${row.r[0]}-${row.r[1]}-${row.inv}`;
      if (seen.has(key)) dupCount++;
      seen.add(key);
    }
    check(`DB.${s}.${r} 无重复行`, dupCount === 0, `${dupCount} 行重复`);
  }
}

// ==================== 3. 线缆规格验证 ====================
console.log('\n📋 线缆规格验证');
const cableSandbox = loadScript(CABLES_FILE, 'CABLE_THRESHOLDS');
const CT = cableSandbox.CABLE_THRESHOLDS;

check('CABLE_THRESHOLDS 已定义', !!CT, 'CABLE_THRESHOLDS is falsy');
check('CABLE_THRESHOLDS 行数', CT && CT.length > 0, `共 ${CT?.length} 行`);
if (CT && CT.length > 0) {
  let badLimit = 0;
  for (let i = 0; i < CT.length - 1; i++) {
    if (CT[i].limit >= CT[i + 1].limit) badLimit++;
  }
  check('功率阶梯升序', badLimit === 0, `${badLimit} 处降序`);
}
check('最大功率覆盖', CT && CT[CT.length - 1].limit >= 150, `最大 ${CT?.[CT.length - 1]?.limit}`);

// ==================== 4. 湖南配置验证 ====================
console.log('\n📋 湖南配置验证');
const hunanSandbox = loadScript(HUNAN_FILE, 'HUNAN_DB', 'ZHANGJIAJIE_DB');
const HUNAN_DB = hunanSandbox.HUNAN_DB;
const ZHANGJIAJIE_DB = hunanSandbox.ZHANGJIAJIE_DB;

check('HUNAN_DB 已定义', !!HUNAN_DB);
check('ZHANGJIAJIE_DB 已定义', !!ZHANGJIAJIE_DB);

if (HUNAN_DB && DB && DB.NEG21_730) {
  for (const r of ratioNames) {
    const hunanEntries = HUNAN_DB[r];
    const stdEntries = DB.NEG21_730[r];
    if (!hunanEntries || !stdEntries) continue;

    // 湖南配置挡位应在标准表范围内
    const stdMin = stdEntries[0].r[0];
    const stdMax = stdEntries[stdEntries.length - 1].r[1];
    let outOfRange = 0;
    for (const row of hunanEntries) {
      if (row.r[0] < stdMin || row.r[1] > stdMax) outOfRange++;
    }
    check(`HUNAN_DB.${r} 在标准表范围内`, outOfRange === 0, `${outOfRange} 行超出`);
  }
}

// ==================== 汇总 ====================
console.log(`\n${'─'.repeat(40)}`);
console.log(`检查 ${totalChecks} 项，通过 ${passedChecks} 项，失败 ${totalChecks - passedChecks} 项`);
console.log(`${'─'.repeat(40)}`);
process.exit(exitCode);
