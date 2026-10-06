# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本项目中工作时提供指导。

## 项目简介

一个纯前端的光伏系统组件匹配工具，用于根据地区、组件系列和数量查询逆变器、并网箱及线缆规格。部署于 GitHub Pages。

## 命令

### 开发

```bash
npm run dev       # 启动 Vite 开发服务器（热更新）
npm run build     # 生产构建 → 输出 dist/
npm run preview   # 预览构建产物
```

### 测试

```bash
npm run test      # 运行 76 个单元测试
npm run validate  # 运行数据完整性验证（110 项检查）
```

### 数据更新

```bash
npm run convert   # 从 Excel 重新生成区域容配比数据
```

### 部署

推送到 `main` 分支后，GitHub Actions 自动运行：

```
npm test → npm run build → deploy-pages
```

中间任一环节失败（测试不通过 / 验证不通过 / 构建失败），部署自动中止，线上不受影响。

## 架构

### 目录结构

```
src/
├── index.html               ← 视图入口（约 5KB）
├── css/
│   └── style.css            ← 样式（从内联分离）
├── public/                   ← Vite public 目录，原样复制到 dist
│   └── js/
│       ├── main.js           ← 应用入口：事件绑定、初始化、模块协调
│       ├── search.js         ← 搜索 + 拼音匹配 + 级联联动
│       ├── matching.js       ← 核心匹配逻辑（lookupMatch, lookupCable）
│       ├── render.js         ← 结果渲染 + 施工规范 + 复制功能
│       └── data/
│           ├── region-data.js   ← 区域容配比数据（由 convert 脚本自动生成）
│           ├── inverters.js     ← 逆变器配置表 DB（手动维护）
│           ├── hunan.js         ← 湖南/张家界专项配置（手动维护）
│           ├── cables.js        ← 线缆规格表（手动维护）
│           └── constants.js     ← 共享常量（版本号、数据源名称、系列枚举）
scripts/
├── convert-all.js           ← Excel → region-data.js 转换脚本
├── validate-data.js         ← 数据完整性验证（110 项检查）
└── shared/
    └── load-module.js       ← VM 沙箱加载共享模块
tests/
├── matching.test.js         ← 匹配逻辑单元测试
├── data-changes.test.js     ← 数据变更回归测试
├── inverter-correction.test.js ← 配置表修正回归测试
└── helpers/
    └── load-app.js          ← 测试辅助模块
*.xlsx (根目录)              ← Excel 源文件（版本管理）
dist/                        ← 构建产物（gitignore 已排除，不提交）
```

### 数据流

```
Excel 源文件 (全国并网箱&逆变器配置统计.xlsx / 全国省市区列表 sheet)
    │
    ▼ npm run convert
scripts/convert-all.js
    │
    ▼
src/public/js/data/region-data.js   ← 区域容配比数据（由 convert 脚本自动生成）
    │
    ▼ 用户交互
地区选择 → 容配比锁定 → 组件系列选择 → 数量输入
    │
    ▼ matching.js
1. 张家界专项 → ZHANGJIAJIE_DB
2. 湖南其他 → HUNAN_DB
3. 730系列 → DB.NEG21_730
4. 兜底 → DB[系列][容配比]
    │
    ▼ render.js
输出：逆变器配置 | 交流铜线 | 并网箱配置 | 交流铝线
```

### 数据维护说明

| 数据 | 维护方式 | 来源 |
|------|---------|------|
| 区域容配比 | `npm run convert` 自动生成 | 全国并网箱&逆变器配置统计.xlsx → 全国省市区列表 |
| 逆变器配置 | 手动编辑 `src/public/js/data/inverters.js` | Excel 手动整理 |
| 湖南专项 | 手动编辑 `src/public/js/data/hunan.js` | Excel 手动整理 |
| 线缆规格 | 手动编辑 `src/public/js/data/cables.js` | Excel 手动整理 |

### 组件系列

- `NEG21(715W)` — NEG21_715
- `NEG21(730W)` — NEG21_730
- `NEG22(780~785W)` — NEG22_785
- `NEG22(800W)` — NEG22_800

## 关键数据结构

```javascript
// 区域容配比数据
REGION_DB: { "省份-城市-区县": { b: "并网箱类型", r: "容配比限制" } }

// 逆变器配置表（4个系列 × 3种容配比）
DB: { 系列: { "1.2倍(正常)": [{ r: [min, max], inv: "逆变器组合", box: 功率 }] } }

// 线缆规格（10档功率阶梯）
CABLE_THRESHOLDS: [{ limit: 功率, cu: "铜线规格", al: "铝线规格" }]
```

## 更新流程

### 日常修改（逆变器配置 / 线缆 / 界面逻辑）
```
改代码 → git push（推送到 main）
→ GitHub Actions 自动构建并部署
```

### 区域容配比更新
```
更新 Excel → npm run convert → git push
→ GitHub Actions 自动构建并部署
```

### 完整更新
```
更新 Excel + 改代码 → npm run convert → npm run test → git push
→ GitHub Actions 自动构建并部署
```

## 强制标准

1. **副标题日期更新**：每次提交推送前，检查 `src/index.html` 中的副标题（`.subtitle` 元素），将其更新为 **推送当天的日期**，格式为 `MMDD更新`（例如 `0512更新`）。此为强制标准，不可跳过。

2. **构建验证**：推送前执行 `npm run test && npm run build`，确保测试和构建通过。GitHub Actions 会自动执行，但本地先跑一遍能提前发现问题。

3. **数据注释**：修改 `src/public/js/data/` 下的数据文件时，在文件头部更新版本信息和修改日期。

## 语言要求

所有与用户的交流、回复、解释、注释必须使用**中文**。
