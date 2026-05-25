/**
 * Excel → region-data.js 转换脚本
 *
 * 用法：node scripts/convert-excel.js [Excel文件路径] [输出路径]
 * 默认：node scripts/convert-excel.js
 *   → 读取 全国容配比查询表0506.xlsx（自动适配 Sheet1 或 容配比查询）
 *   → 输出 region-data.js
 *
 * 功能：
 * 1. 读取 Excel 容配比查询表
 * 2. 识别市级默认行（区县=a）作为兜底配置
 * 3. 识别省级默认行（城市=A，区县=a）作为全省兜底
 * 4. 将市级/省级默认值继承到下属区县（区县行为空时自动填充）
 * 5. 输出为前端可用的 region-data.js（不写入虚拟默认行，避免下拉框污染）
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ---- 配置 ----
const EXCEL_PATH = path.resolve(__dirname, '..', process.argv[2] || '全国容配比查询表0506.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, '..', process.argv[3] || 'region-data.js');

// ---- 主逻辑 ----
function convert() {
  console.log(`📖 读取: ${EXCEL_PATH}`);
  const wb = XLSX.readFile(EXCEL_PATH);
  // 自适应 sheet 名：优先 容配比查询，其次 Sheet1，最后取第一个 sheet
  const ws = wb.Sheets['容配比查询'] || wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 跳过表头行，提取数据行
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r[0]); // 过滤空行

  const sheetName = wb.SheetNames.find(n => (wb.Sheets[n] === ws)) || 'auto';
  console.log(`   总行数（含表头）: ${rows.length}`);
  console.log(`   数据行: ${dataRows.length}`);
  console.log(`   Sheet: ${sheetName}`);
  console.log(`   表头: ${headers.map(h => `"${h}"`).join(', ')}`);

  // 第一步：分离省级默认行（城市=A, 区县=a）、市级默认行（区县=a）和普通区县行
  const cityDefaults = {};     // 键: "省份-城市"，值: { 并网箱, 逆变器 }
  const provinceDefaults = {}; // 键: "省份" (城市=A)，值: { 并网箱, 逆变器 }
  const districtRows = [];

  for (const row of dataRows) {
    const [province, city, district, _region, boxType, invRatio] = row;
    const isDefault = String(district).toLowerCase() === 'a';
    if (isDefault) {
      const isProvinceDefault = String(city).toLowerCase() === 'a';
      if (isProvinceDefault) {
        // 省级默认行：城市=A
        provinceDefaults[province] = { box: boxType || '', ratio: invRatio || '' };
      } else {
        // 市级默认行
        const key = `${province}-${city}`;
        cityDefaults[key] = { box: boxType || '', ratio: invRatio || '' };
      }
    } else {
      districtRows.push(row);
    }
  }

  console.log(`   省级默认行: ${Object.keys(provinceDefaults).length}`);
  console.log(`   市级默认行: ${Object.keys(cityDefaults).length}`);
  console.log(`   区县行: ${districtRows.length}`);

  // 第二步：构建 REGION_DB，处理继承
  const regionDb = {};
  let inheritedFromCity = 0;
  let inheritedFromProvince = 0;

  for (const row of districtRows) {
    const [province, city, district, _region, boxType, invRatio] = row;
    const regionKey = `${province}-${city}-${district}`;
    const cityDefKey = `${province}-${city}`;

    let box = (boxType || '').trim();
    let ratio = (invRatio || '').trim();

    // 继承市级默认值（最优先：精确匹配城市）
    const cityDef = cityDefaults[cityDefKey];
    if (cityDef) {
      if (!box && cityDef.box) {
        box = cityDef.box;
        inheritedFromCity++;
      }
      if (!ratio && cityDef.ratio) {
        ratio = cityDef.ratio;
        inheritedFromCity++;
      }
    }

    // 继承省级默认值（兜底：全省统一默认）
    if (!box || !ratio) {
      const provDef = provinceDefaults[province];
      if (provDef) {
        if (!box && provDef.box) {
          box = provDef.box;
          inheritedFromProvince++;
        }
        if (!ratio && provDef.ratio) {
          ratio = provDef.ratio;
          inheritedFromProvince++;
        }
      }
    }

    regionDb[regionKey] = { b: box, r: ratio };
  }

  console.log(`   市级继承填充: ${inheritedFromCity} 个字段`);
  console.log(`   省级继承填充: ${inheritedFromProvince} 个字段`);

  // 第三步：数据校验报告
  const provCount = Object.keys(provinceDefaults).length;
  const cityCount = Object.keys(cityDefaults).length;
  const totalDefaults = provCount + cityCount;
  const outputCount = Object.keys(regionDb).length;
  const dataCount = dataRows.length;

  console.log('');
  console.log('─'.repeat(50));
  console.log('  数据校验报告');
  console.log('─'.repeat(50));
  console.log(`  Excel 行（含表头）:     ${rows.length}`);
  console.log(`  Excel 数据行:           ${dataCount}`);
  console.log(`  ├─ 省级默认行:          ${provCount}`);
  console.log(`  ├─ 市级默认行:          ${cityCount}`);
  console.log(`  └─ 区县行:              ${districtRows.length}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  默认行合计:              ${totalDefaults}`);
  console.log(`  区县行合计:              ${districtRows.length}`);
  console.log(`  合计:                    ${totalDefaults + districtRows.length}`);
  console.log(`  与数据行偏差:            ${dataCount - (totalDefaults + districtRows.length)}`);
  console.log(`  输出 REGION_DB 条目数:   ${outputCount}`);
  console.log(`  条目与区县行差异:        ${outputCount - districtRows.length}`);
  // 字段填充统计
  let ownBox = 0, ownRatio = 0, emptyBox = 0, emptyRatio = 0;
  for (const v of Object.values(regionDb)) {
    if (v.b) ownBox++; else emptyBox++;
    if (v.r) ownRatio++; else emptyRatio++;
  }
  console.log(`  并网箱有值:              ${ownBox}（自有+继承）`);
  console.log(`  并网箱为空:              ${emptyBox}`);
  console.log(`  逆变器有值:              ${ownRatio}（自有+继承）`);
  console.log(`  逆变器为空:              ${emptyRatio}`);
  console.log('');

  if (dataCount === totalDefaults + districtRows.length && outputCount === districtRows.length) {
    console.log('  ✅ 数量校验通过：数据行 = 默认行 + 区县行，且输出条目 = 区县行');
  } else {
    console.log('  ⚠️  数量偏差，请检查 Excel 数据格式');
  }

  // 第四步：输出 JS 文件
  const output = buildOutput(regionDb);
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');

  console.log('');
  console.log(`✅ 输出: ${OUTPUT_PATH}`);
  console.log(`   文件大小: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
}

function buildOutput(regionDb) {
  const keys = Object.keys(regionDb).sort();

  let lines = [];
  lines.push('/**');
  lines.push(' * 区域容配比数据 — 由 scripts/convert-excel.js 自动生成');
  lines.push(` * 生成时间: ${new Date().toISOString()}`);
  lines.push(` * 条目数: ${keys.length}`);
  lines.push(' */');
  lines.push('');
  lines.push('var REGION_DB = {');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const { b, r } = regionDb[key];
    const comma = (i < keys.length - 1) ? ',' : '';
    lines.push(`"${key}":{b:"${b}",r:"${r}"}${comma}`);
  }

  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

convert();
