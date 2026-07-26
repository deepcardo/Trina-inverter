/**
 * 共享常量
 *
 * 区域数据来源: 全国并网箱&逆变器配置统计.xlsx → Sheet: 全国省市区列表
 * 逆变器/线缆数据: 手动维护（见同目录下的 inverters.js / hunan.js / cables.js）
 */

const APP_VERSION = '2.0.0';
const DATA_SOURCE = '全国并网箱&逆变器配置统计.xlsx';

const PROV_HUNAN = '湖南省';

const RATIO_NORMAL = '1.2倍(正常)';
const RATIO_LIGHT = '1.1倍';
const RATIO_NONE = '1倍';

const RATIO_OPTIONS = [
  { value: RATIO_NORMAL, label: '1.2倍 (正常超配)' },
  { value: RATIO_LIGHT, label: '1.1倍 (轻度超配)' },
  { value: RATIO_NONE, label: '1倍 (不超配)' }
];
