# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本项目中工作时提供指导。

**文档分工**：本文件是**规范类信息**（工作流约束、强制标准、架构数据流）的权威来源；**事实类信息**（功能说明、完整目录结构、命令详解、数据维护表、部署细节、技术规范）以 [README.md](./README.md) 为权威来源，本文件仅保留速查与引用，避免两处维护产生冲突。

## 相关文档

- [README.md](./README.md) — 项目事实类权威：功能、命令详解、目录结构、数据维护、部署、业务技术规范
- [docs/glossary.md](./docs/glossary.md) — 术语表
- [docs/adrs/](./docs/adrs/) — 架构决策记录 ADR-001 ~ 003
- [docs/specs/架构演进-单文件到模块化.md](./docs/specs/架构演进-单文件到模块化.md) — 架构演进规格
- [docs/](./docs/) — 需求规格文档（索引见 [README §文档索引](./README.md#文档索引)）

## 项目简介

一个纯前端的光伏系统组件匹配工具，用于根据地区、组件系列和数量查询逆变器、并网箱及线缆规格。部署于 GitHub Pages。功能与使用方式详见 [README](./README.md#功能特性)。

## 命令速查

```bash
npm run dev       # 启动 Vite 开发服务器（热更新，端口 3000）
npm run test      # 运行 76 个单元测试（推送前必跑）
npm run validate  # 运行 110 项数据完整性检查（build 内置）
npm run build     # 校验 + 生产构建 → dist/
npm run convert   # 从 Excel 重新生成 region-data.js（勿手改生成物）
npm run preview   # 预览构建产物
```

命令的完整说明与环境要求见 [README §开发命令](./README.md#开发命令)；测试与校验的构成见 [README §测试说明](./README.md#测试说明)。

## 架构

### 目录结构（速查）

只列出与日常改动最相关的部分，**完整目录树见 [README §项目结构](./README.md#项目结构)**：

```
src/
├── index.html               ← 视图入口（副标题日期在此维护）
├── css/style.css            ← 样式
└── public/js/
    ├── main.js              ← 应用入口：事件绑定、输入校验、模块协调
    ├── search.js            ← 搜索 + 拼音匹配 + 级联联动 + 最近使用
    ├── matching.js          ← 核心匹配逻辑（纯数据，无 DOM 依赖）
    ├── render.js            ← 结果渲染 + 施工规范 + 复制
    └── data/
        ├── region-data.js   ← 区域容配比数据（convert 生成，勿手改）
        ├── inverters.js     ← 逆变器配置表 DB（手动维护）
        ├── hunan.js         ← 湖南/张家界专项（手动维护）
        ├── cables.js        ← 线缆规格表（手动维护）
        └── constants.js     ← 共享常量（版本号、系列枚举、容配比选项）
scripts/                     ← convert-all.js / validate-data.js / shared/
tests/                       ← matching / data-changes / inverter-correction
dist/                        ← 构建产物（gitignore 排除，勿提交、勿手改）
```

JS 按 `index.html` 中的 `<script>` 顺序全局加载：`data/*.js` → `matching.js` → `render.js` → `search.js` → `main.js`。新增全局变量必须注意加载顺序。

### 数据流

```
Excel 源文件 (全国并网箱&逆变器配置统计.xlsx / 全国省市区列表 sheet)
    │
    ▼ npm run convert
scripts/convert-all.js
    │
    ▼
src/public/js/data/region-data.js   ← 区域容配比数据（自动生成，勿手改）
    │
    ▼ 用户交互
地区选择 → 容配比锁定 → 组件系列选择 → 数量输入
    │
    ▼ matching.js  lookupMatch(state)
1. 张家界专项 → ZHANGJIAJIE_DB
2. 湖南其他 → HUNAN_DB
3. 730系列 → DB.NEG21_730
4. 兜底 → DB[系列][容配比]
    │
    ▼ render.js
输出：逆变器配置 | 交流铜线 | 并网箱配置 | 交流铝线
```

### matching.js 核心函数

| 函数 | 职责 |
|------|------|
| `lookupMatch(state)` | 主查询入口，按上述 4 级优先级返回配置行 |
| `lookupCable(power, type)` | 线缆查询，`type` 为 `'cu'` / `'al'`，先查标准表再查建议表 |
| `findInRange(rows, count)` | 在配置行数组中按 `row.r = [min, max]` 匹配数量 |
| `mapRegionRatio(val)` | 区域原始容配比字符串 → 标准挡位（1.2 / 1.1 / 1.0） |
| `getHunanDbs(state)` | 湖南地区返回专项表数组（张家界返回两张表） |
| `getCountRange(state)` | 按地区+系列+容配比计算数量合法范围（页面提示同源） |
| `isValidCount(val, state)` | 数量合法性校验 |

### 关键数据结构

```javascript
// 区域容配比数据
REGION_DB: { "省份-城市-区县": { b: "并网箱类型", r: "容配比限制" } }

// 逆变器配置表（4个系列 × 3种容配比）
DB: { 系列: { "1.2倍(正常)": [{ r: [min, max], inv: "逆变器组合", box: 功率 }] } }

// 湖南 / 张家界专项（结构同 DB）
HUNAN_DB / ZHANGJIAJIE_DB: { 容配比: [{ r: [min, max], inv, box }] }

// 线缆规格（标准表 10 档至 160kW + 超出后的建议表 180/200kW）
CABLE_THRESHOLDS: [{ limit: 功率, cu: "铜线规格", al: "铝线规格" }]
CABLE_RECOMMENDATIONS: [{ limit, cu, al }]
CABLE_ADVICE_NOTICE: "此为建议线缆规格，需根据当地供电局要求确定线缆是否可用。"
```

### 组件系列

- `NEG21(715W)` — NEG21_715
- `NEG21(730W)` — NEG21_730
- `NEG22(780~785W)` — NEG22_785
- `NEG22(800W)` — NEG22_800

湖南地区限制为 730W 系列，张家界另有专项覆盖区县。

## 测试指引

- 测试运行于 Node（Vitest），**不依赖浏览器**：`tests/helpers/load-app.js` 通过 `vm.runInNewContext` 沙箱加载 `data/*.js` 与 `matching.js`，并把导出函数挂到返回对象上
- 新增 `matching.js` 全局函数若要被测试覆盖，需同步加入 `load-app.js` 的 `cached` 返回对象
- 新增数据文件或新全局常量时，需在 `load-app.js` 中补 `loadScript(...)` 加载项，并确保 `index.html` 的 `<script>` 顺序同步更新
- 新断言写入对应文件：匹配逻辑 → `matching.test.js`；数据值变更 → `data-changes.test.js`；配置表修正 → `inverter-correction.test.js`
- 数据变更测试是**回归快照型**：改数据后若测试失败，先确认新值符合预期再更新断言，禁止为过测试而盲目改断言

### 数据文件头注释规范

`src/public/js/data/` 下手动维护的数据文件，头部必须包含版本与修改日期，格式参考 `cables.js`：

```javascript
/**
 * 线缆规格表
 * 版本: 2026-10-05 建议规格初版；160kW及以下公司标准原样保留
 *
 * 维护方式: 手动编辑
 * 数据结构: 按功率阶梯排序 [{ limit: 功率, cu: "铜线规格", al: "铝线规格" }]
 */
```

## 常见失败与排查

| 现象 | 常见原因 | 处理 |
|------|---------|------|
| `npm run validate` 报功率阶梯失败 | `CABLE_THRESHOLDS` 未按 limit 升序，或标准表与建议表衔接断档 | 恢复升序、补齐衔接档位 |
| `npm run validate` 报专项超范围 | `HUNAN_DB` / `ZHANGJIAJIE_DB` 挡位超出标准表区间 | 专项挡位须落在标准表范围内 |
| `npm run test` 数据回归失败 | 手动改了配置表但未同步更新断言 | 核对新值正确后更新 `data-changes.test.js` |
| `region-data.js` 改动被还原 | 该文件由 convert 生成 | 改 Excel → `npm run convert`，勿手改 |
| CI 部署中止 | 本地未跑 test / build，或副标题日期未更新 | 本地执行 [强制标准](#强制标准) 第 1、2 条 |

## 更新流程

### 日常修改（逆变器配置 / 线缆 / 界面逻辑）
```
改代码 → npm run test && npm run build → git push（推送到 main）
→ GitHub Actions 自动构建并部署
```

### 区域容配比更新
```
更新 Excel → 更新 scripts/convert-all.js 顶部的 DATA_VERSION / UPDATED_DATE 常量
→ npm run convert → npm run test → git push
→ GitHub Actions 自动构建并部署（CI 会重新 convert 并与提交的 region-data.js 比对，
  不一致即部署失败——因此 convert 必须在提交前跑，且生成物不手改）
```

### 完整更新
```
更新 Excel + 改代码 → 更新 convert-all.js 版本常量 → npm run convert
→ npm run test && npm run build → git push
→ GitHub Actions 自动构建并部署
```

部署流水线细节见 [README §部署](./README.md#部署)。

## 常见任务操作指引

| 任务 | 步骤 | 必跑命令 |
|------|------|---------|
| 修改逆变器配置 | 编辑 `src/public/js/data/inverters.js`，更新文件头版本注释 | `npm run test` `npm run validate` |
| 修改线缆规格 | 编辑 `src/public/js/data/cables.js`，注意功率阶梯升序，更新头注释 | `npm run test` `npm run validate` |
| 修改湖南 / 张家界专项 | 编辑 `src/public/js/data/hunan.js`，专项挡位须落在标准表范围内 | `npm run test` `npm run validate` |
| 更新区域容配比 | 改根目录 Excel → 更新 `convert-all.js` 的 `DATA_VERSION`/`UPDATED_DATE` → 执行 convert，**不手改 region-data.js** | `npm run convert` `npm run test` |
| 修改界面 / 交互 | 改 `src/index.html` / `src/css/style.css` / `src/public/js/*.js` | `npm run test` `npm run build` |
| 修改匹配逻辑 | 改 `src/public/js/matching.js`，同步补充 `tests/matching.test.js` | `npm run test` |

## 注意事项 / 禁区

1. **不要手改 `region-data.js`**：它是 `npm run convert` 的生成产物，改动会在下次 convert 时被覆盖
2. **不要改 `dist/`**：构建产物已被 gitignore，任何修改都不会生效也不会提交
3. **数据文件改动必须过校验**：`npm run test` 与 `npm run validate` 任一失败都不得提交（CI 会拦截并中止部署）
4. **改数据文件同步改头注释**：`src/public/js/data/` 下的手动数据文件，修改时更新文件头部版本信息与修改日期
5. **匹配逻辑变更需补测试**：`matching.js` 行为变化必须在 `tests/matching.test.js` 中有对应断言
6. **新增全局脚本注意加载顺序**：`index.html` 中 `<script>` 顺序即依赖顺序，数据文件必须在 `matching.js` 之前
7. **业务规则不可自行发挥**：线径放大规则、强制铜线等业务规则的权威描述在 [README §技术规范](./README.md#技术规范)，改动需业务确认

## 强制标准

1. **副标题日期更新**：每次提交推送前，检查 `src/index.html` 中的副标题（`.subtitle` 元素），将其更新为 **推送当天的日期**，格式为 `MMDD更新`（例如 `0512更新`）。此为强制标准，不可跳过。

2. **构建验证**：推送前执行 `npm run test && npm run build`，确保测试和构建通过。GitHub Actions 会自动执行，但本地先跑一遍能提前发现问题。

3. **数据注释**：修改 `src/public/js/data/` 下的数据文件时，在文件头部更新版本信息和修改日期。

## 语言要求

所有与用户的交流、回复、解释、注释必须使用**中文**。
