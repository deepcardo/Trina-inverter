/**
 * 新旧 region-data 数据比对脚本
 *
 * 读取旧版（根目录）和新版（src/public/js/data/）的 region-data.js，
 * 按区域键比对并网箱(b)和容配比(r)字段的差异。
 */
import { loadScript } from './shared/load-module.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const oldPath = `${ROOT}/region-data.js`;
const newPath = `${ROOT}/src/public/js/data/region-data.js`;

const oldData = loadScript(oldPath, 'REGION_DB').REGION_DB;
const newData = loadScript(newPath, 'REGION_DB').REGION_DB;

const oldKeys = Object.keys(oldData);
const newKeys = Object.keys(newData);

console.log('=== 数据概览 ===');
console.log(`旧版条目: ${oldKeys.length}`);
console.log(`新版条目: ${newKeys.length}`);

// 键差异
const onlyInOld = oldKeys.filter(k => !newData[k]);
const onlyInNew = newKeys.filter(k => !oldData[k]);
const common = oldKeys.filter(k => newData[k]);

console.log(`\n=== 键差异 ===`);
console.log(`旧版独有: ${onlyInOld.length} 条`);
console.log(`新版独有: ${onlyInNew.length} 条`);
console.log(`共有: ${common.length} 条`);

// 字段值差异
const changes = [];
for (const key of common) {
  const old = oldData[key];
  const nw = newData[key];
  const boxDiff = (old.b || '') !== (nw.b || '');
  const ratioDiff = (old.r || '') !== (nw.r || '');
  if (boxDiff || ratioDiff) {
    changes.push({ key, old, new: nw, boxDiff, ratioDiff });
  }
}

console.log(`\n=== 值变更: ${changes.length} 条 ===`);
// 按变化类型分类
const boxChanges = changes.filter(c => c.boxDiff);
const ratioChanges = changes.filter(c => c.ratioDiff);
const bothChanges = changes.filter(c => c.boxDiff && c.ratioDiff);
console.log(`  并网箱变化: ${boxChanges.length}`);
console.log(`  容配比变化: ${ratioChanges.length}`);
console.log(`  两者都变: ${bothChanges.length}`);

// 输出前 20 条变更详情
console.log(`\n=== 变更明细（前 ${Math.min(20, changes.length)} 条）===`);
for (let i = 0; i < Math.min(20, changes.length); i++) {
  const c = changes[i];
  const parts = [];
  if (c.boxDiff) parts.push(`并网箱: "${c.old.b}" → "${c.new.b}"`);
  if (c.ratioDiff) parts.push(`容配比: "${c.old.r}" → "${c.new.r}"`);
  console.log(`  ${c.key}: ${parts.join(' | ')}`);
}

if (changes.length > 20) {
  console.log(`  ... 还有 ${changes.length - 20} 条`);
}

// 输出统计用于测试
console.log(`\n=== 测试参数 ===`);
console.log(`CHANGES_COUNT=${changes.length}`);
console.log(`BOX_CHANGES=${boxChanges.length}`);
console.log(`RATIO_CHANGES=${ratioChanges.length}`);
console.log(`ONLY_IN_OLD=${onlyInOld.length}`);
console.log(`ONLY_IN_NEW=${onlyInNew.length}`);
