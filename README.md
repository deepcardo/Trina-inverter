# 光伏组件-逆变器及线缆匹配查询工具

一个用于光伏发电系统中组件、逆变器、并网箱及线缆选型匹配的在线查询工具。部署于 GitHub Pages。

## 功能特性

- **区域选择**：支持全国各省、市、区县三级联动选择 + 拼音搜索
- **最近使用**：自动记录最近选择的地区
- **容配比配置**：根据地区政策自动匹配容配比（1.0 / 1.1 / 1.2 倍）
- **组件系列**：支持 NEG21 (715-720W)、NEG21 (730-740W)、NEG22 (780-785W)、NEG22 (790-800W) 四个系列（湖南地区限制为 730W 系列）
- **湖南专项**：湖南省有独立的中间挡位配置，张家界市另有专项调整
- **智能匹配**：根据输入条件自动计算并输出：
  - 逆变器配置方案
  - 逆变器交流铜线规格
  - 并网箱配置方案
  - 并网箱交流铝线规格
- **结果复制**：一键复制匹配结果

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript，无框架依赖
- **构建**：Vite 6.x
- **测试**：Vitest（76 个单元测试）+ 数据完整性验证（110 项检查）
- **数据**：Excel 源文件 → 自动转换脚本
- **部署**：GitHub Actions 自动构建并发布到 GitHub Pages
- **拼音**：pinyin-pro 3.x

## 项目结构

```
├── src/
│   ├── index.html           ← 入口（Vite root）
│   ├── css/style.css        ← 样式（从 HTML 分离）
│   └── public/js/
│       ├── main.js           ← 入口：DOM 缓存、事件绑定、初始化
│       ├── matching.js       ← 核心匹配逻辑（lookupMatch, findInRange）
│       ├── search.js         ← 搜索 + 拼音匹配 + 级联联动 + 最近使用
│       ├── render.js         ← 结果渲染 + 复制功能
│       └── data/
│           ├── region-data.js   ← 区域容配比数据（由 convert 脚本生成）
│           ├── inverters.js     ← 逆变器配置表 DB（手动维护）
│           ├── hunan.js         ← 湖南/张家界专项（手动维护）
│           ├── cables.js        ← 线缆规格表（手动维护）
│           └── constants.js     ← 共享常量
├── scripts/
│   ├── convert-all.js        ← Excel → region-data.js 转换
│   ├── validate-data.js      ← 数据完整性验证
│   └── shared/
│       └── load-module.js    ← VM 沙箱加载共享模块
├── tests/
│   ├── matching.test.js         ← 匹配逻辑单元测试
│   ├── data-changes.test.js     ← 数据变更回归测试
│   ├── inverter-correction.test.js ← 配置表修正回归测试
│   └── helpers/
│       └── load-app.js       ← 测试辅助
├── *.xlsx                    ← Excel 源文件（根目录，版本管理）
├── docs/
│   ├── adrs/                 ← 架构决策记录 (ADR-001 ~ 003)
│   ├── specs/                ← 需求规格文档
│   └── glossary.md           ← 术语表
├── .github/workflows/
│   └── build-deploy.yml      ← CI/CD：推送 main 自动构建部署
├── CLAUDE.md                 ← AI 辅助开发指导
├── vite.config.js
└── vitest.config.js
```

## 开发命令

```bash
npm run dev       # 启动开发服务器（热更新）
npm run build     # 生产构建（自动运行数据验证）
npm run test      # 运行 76 个单元测试
npm run validate  # 运行 110 项数据完整性检查
npm run convert   # 从 Excel 重新生成区域容配比数据
npm run preview   # 预览构建产物
```

## 使用说明

1. 选择省份、城市、区县（支持拼音搜索）
2. 容配比根据地区政策自动锁定
3. 选择组件系列
4. 输入组件数量（合法范围随组件系列与容配比动态提示，选择地区/系列后输入框会显示范围）
5. 点击"智能匹配查询"获取结果，或修改数量/系列自动触发查询

## 数据维护

| 数据 | 维护方式 | 位置 |
|------|---------|------|
| 区域容配比 | `npm run convert` 自动生成 | `src/public/js/data/region-data.js` |
| 全国逆变器配置 | 手动编辑 | `src/public/js/data/inverters.js` |
| 湖南/张家界专项 | 手动编辑 | `src/public/js/data/hunan.js` |
| 线缆规格 | 手动编辑 | `src/public/js/data/cables.js` |

> 逆变器/线缆数据目前手动维护，未来可按需扩展 Excel 自动管线。

## 部署

推送到 `main` 分支后，GitHub Actions 自动执行：

```
npm test → npm run build（内含 validate 数据验证）→ deploy-pages
```

任一环节失败，部署自动中止，线上不受影响。

## 技术规范

- 逆变器输出线必须使用铜线 (ZR-YJV-0.6/1kV)
- 交流电缆长度 ≤50m，线径参考表格标准
- 50m < 长度 ≤100m，线径比规定大一号
- 100m < 长度 ≤150m，线径比规定大二号
- 长度 >150m，需联系交付人员处理

## 联系方式

有疑问请联系：南部解决方案部 段林钢
