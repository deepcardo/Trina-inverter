/**
 * 区域容配比数据转换脚本
 *
 * 用法：node scripts/convert-all.js
 *
 * 读取 data/全国并网箱&逆变器配置统计.xlsx → Sheet: 全国省市区列表
 * 输出到 src/public/js/data/region-data.js
 *
 * 功能：
 * 1. 识别省级默认行（城市=A, 区县=a）、市级默认行（区县=a）
 * 2. 直接使用各区县行自有数据，无层级继承（空值保持为空，由运行时处理）
 * 3. 输出为前端可用的 region-data.js
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(__dirname, '..', process.argv[2] || '全国并网箱&逆变器配置统计.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'public', 'js', 'data', process.argv[3] || 'region-data.js');

function convert() {
  console.log(`📖 读取: ${EXCEL_PATH}`);
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ 文件不存在: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['全国省市区列表'] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    console.error('❌ 未找到 Sheet，检查 Excel 文件');
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r[0]);

  const sheetName = wb.SheetNames.find(n => wb.Sheets[n] === ws) || 'auto';
  console.log(`   总行数（含表头）: ${rows.length}`);
  console.log(`   数据行: ${dataRows.length}`);
  console.log(`   Sheet: ${sheetName}`);
  console.log(`   表头: ${headers.map(h => `"${h}"`).join(', ')}`);

  // 分离默认行与区县行
  const cityDefaults = {};
  const provinceDefaults = {};
  const districtRows = [];

  for (const row of dataRows) {
    const province = row[1];
    const city = row[2];
    const district = row[3];
    const boxType = row[5];
    const invRatio = row[6];
    const isDefault = String(district).toLowerCase() === 'a';
    if (isDefault) {
      if (String(city).toLowerCase() === 'a') {
        provinceDefaults[province] = { box: boxType || '', ratio: invRatio || '' };
      } else {
        cityDefaults[`${province}-${city}`] = { box: boxType || '', ratio: invRatio || '' };
      }
    } else {
      districtRows.push(row);
    }
  }

  console.log(`   省级默认行: ${Object.keys(provinceDefaults).length}`);
  console.log(`   市级默认行: ${Object.keys(cityDefaults).length}`);
  console.log(`   区县行: ${districtRows.length}`);

  // 构建 REGION_DB
  const regionDb = {};
  for (const row of districtRows) {
    const province = row[1];
    const city = row[2];
    const district = row[3];
    const boxType = row[5];
    const invRatio = row[6];
    regionDb[`${province}-${city}-${district}`] = {
      b: (boxType || '').trim(),
      r: (invRatio || '').trim(),
    };
  }

  // 校验报告
  console.log('');
  console.log('─'.repeat(50));
  console.log('  数据校验报告');
  console.log('─'.repeat(50));
  console.log(`  Excel 数据行:           ${dataRows.length}`);
  console.log(`  ├─ 省级默认行:          ${Object.keys(provinceDefaults).length}`);
  console.log(`  ├─ 市级默认行:          ${Object.keys(cityDefaults).length}`);
  console.log(`  └─ 区县行:              ${districtRows.length}`);

  let ownBox = 0, emptyBox = 0, ownRatio = 0, emptyRatio = 0;
  for (const v of Object.values(regionDb)) {
    if (v.b) ownBox++; else emptyBox++;
    if (v.r) ownRatio++; else emptyRatio++;
  }
  console.log(`  并网箱有值: ${ownBox}，空: ${emptyBox}`);
  console.log(`  容配比有值: ${ownRatio}，空: ${emptyRatio}`);
  console.log(`  输出 REGION_DB: ${Object.keys(regionDb).length} 条`);
  console.log(`  ✅ 数据行 = 默认行 + 区县行: ${dataRows.length === Object.keys(provinceDefaults).length + Object.keys(cityDefaults).length + districtRows.length}`);

  // 输出文件
  const keys = Object.keys(regionDb).sort();
  const lines = [
    '/**',
    ' * 区域容配比数据 — 由 scripts/convert-all.js 自动生成',
    ` * 源文件: 全国并网箱&逆变器配置统计.xlsx → 全国省市区列表`,
    ` * 生成时间: ${new Date().toISOString()}`,
    ` * 条目数: ${keys.length}`,
    ' */',
    '',
    'var REGION_DB = {',
  ];

  for (let i = 0; i < keys.length; i++) {
    const { b, r } = regionDb[keys[i]];
    const comma = i < keys.length - 1 ? ',' : '';
    lines.push(`"${keys[i]}":{b:"${b}",r:"${r}"}${comma}`);
  }

  lines.push('};');
  lines.push('');

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
  console.log(`✅ 输出: ${OUTPUT_PATH}`);
  console.log(`   文件大小: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
}

convert();
