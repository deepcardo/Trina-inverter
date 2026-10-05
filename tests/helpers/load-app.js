/**
 * 测试辅助：加载 app 所有模块（通过 vm 模拟浏览器环境）
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { loadScript } from '../../scripts/shared/load-module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../../src/public/js');

let cached = null;

export function getApp() {
  if (cached) return cached;

  const region = loadScript(`${PUBLIC}/data/region-data.js`, 'REGION_DB');
  const constants = loadScript(`${PUBLIC}/data/constants.js`,
    'APP_VERSION', 'DATA_SOURCE', 'PROV_HUNAN',
    'RATIO_NORMAL', 'RATIO_LIGHT', 'RATIO_NONE', 'RATIO_OPTIONS');
  const inverters = loadScript(`${PUBLIC}/data/inverters.js`, 'DB');
  const hunan = loadScript(`${PUBLIC}/data/hunan.js`, 'HUNAN_DB', 'ZHANGJIAJIE_DB');
  const cables = loadScript(`${PUBLIC}/data/cables.js`, 'CABLE_THRESHOLDS', 'CABLE_RECOMMENDATIONS', 'CABLE_ADVICE_NOTICE');
  const matching = loadScript(`${PUBLIC}/matching.js`,
    'mapRegionRatio', 'isValidCount', 'lookupCable', 'findInRange', 'lookupMatch');

  Object.assign(globalThis, region, constants, inverters, hunan, cables);

  // 重新在 globalThis 上下文中执行 matching.js，使其函数能访问这些全局变量
  const matchingCode = readFileSync(`${PUBLIC}/matching.js`, 'utf-8');
  vm.runInNewContext(matchingCode, globalThis, { filename: 'matching.js' });

  // 构建 PROVINCE_CITY_DISTRICT 和 SEARCH_INDEX（模拟 main.js 的行为）
  const PROVINCE_CITY_DISTRICT = {};
  const SEARCH_INDEX = [];
  if (globalThis.REGION_DB) {
    Object.keys(globalThis.REGION_DB).forEach(k => {
      const [p, c, d] = k.split('-');
      if (!PROVINCE_CITY_DISTRICT[p]) PROVINCE_CITY_DISTRICT[p] = {};
      if (!PROVINCE_CITY_DISTRICT[p][c]) PROVINCE_CITY_DISTRICT[p][c] = [];
      if (!PROVINCE_CITY_DISTRICT[p][c].includes(d)) PROVINCE_CITY_DISTRICT[p][c].push(d);
      SEARCH_INDEX.push({ areaKey: k, province: p, city: c, district: d, fullName: p + c + d });
    });
  }
  Object.assign(globalThis, { PROVINCE_CITY_DISTRICT, SEARCH_INDEX });

  cached = {
    REGION_DB: globalThis.REGION_DB,
    DB: globalThis.DB,
    HUNAN_DB: globalThis.HUNAN_DB,
    ZHANGJIAJIE_DB: globalThis.ZHANGJIAJIE_DB,
    CABLE_THRESHOLDS: globalThis.CABLE_THRESHOLDS,
    PROV_HUNAN: globalThis.PROV_HUNAN,
    RATIO_NORMAL: globalThis.RATIO_NORMAL,
    RATIO_LIGHT: globalThis.RATIO_LIGHT,
    RATIO_NONE: globalThis.RATIO_NONE,
    PROVINCE_CITY_DISTRICT: globalThis.PROVINCE_CITY_DISTRICT,
    SEARCH_INDEX: globalThis.SEARCH_INDEX,
    mapRegionRatio: globalThis.mapRegionRatio,
    isValidCount: globalThis.isValidCount,
    getCountRange: globalThis.getCountRange,
    lookupCable: globalThis.lookupCable,
    findInRange: globalThis.findInRange,
    lookupMatch: globalThis.lookupMatch,
  };
  return cached;
}
