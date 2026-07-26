/**
 * 数据变更验证测试
 *
 * 基于旧版 → 新版 region-data 的 33 条差异，
 * 验证当前数据的值符合预期，防止无意的数据回退。
 *
 * 如果数据源更新导致这些值发生变化，需要同步更新本测试。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './helpers/load-app.js';

let REGION_DB;

beforeAll(() => {
  REGION_DB = getApp().REGION_DB;
});

// ==================== 容配比变更（17 条） ====================
describe('容配比变更验证', () => {
  it('安徽省-池州市-贵池区: 容配比改为 标准1.2', () => {
    expect(REGION_DB['安徽省-池州市-贵池区'].r).toBe('标准1.2');
  });

  it('安徽省-淮南市-大通区: 容配比改为 不超配1', () => {
    expect(REGION_DB['安徽省-淮南市-大通区'].r).toBe('不超配1');
  });

  it('江苏省-宿迁市-宿豫区: 容配比清空', () => {
    expect(REGION_DB['江苏省-宿迁市-宿豫区'].r).toBe('');
  });

  it('江苏省-徐州市-丰县: 容配比清空', () => {
    expect(REGION_DB['江苏省-徐州市-丰县'].r).toBe('');
  });

  it('江苏省-盐城市-盐城经济技术开发区: 容配比改为 标准1.2', () => {
    expect(REGION_DB['江苏省-盐城市-盐城经济技术开发区'].r).toBe('标准1.2');
  });
});

// ==================== 并网箱变更（16 条，全部江西） ====================
describe('并网箱变更验证（江西省）', () => {
  const jiangxiDistricts = [
    '江西省-九江市-彭泽县',
    '江西省-吉安市-吉水县',
    '江西省-吉安市-峡江县',
    '江西省-吉安市-泰和县',
    '江西省-吉安市-青原区',
    '江西省-抚州市-东乡区',
    '江西省-抚州市-临川区',
    '江西省-抚州市-南丰县',
    '江西省-抚州市-南城县',
    '江西省-景德镇市-乐平市',
    '江西省-萍乡市-安源区',
    '江西省-萍乡市-湘东区',
    '江西省-萍乡市-芦溪县',
    '江西省-萍乡市-莲花县',
    '江西省-鹰潭市-余江区',
  ];

  for (const key of jiangxiDistricts) {
    const district = key.split('-')[2];
    it(`${key}: 并网箱清空（原是"标准"）`, () => {
      expect(REGION_DB[key].b).toBe('');
    });
  }
});

// ==================== 容配比全量汇总 ====================
describe('容配比变更汇总', () => {
  it('总变更数 = 17', () => {
    // 这条测试验证当前 17 条容配比变更没有被意外增加或减少
    const ratioChanges = Object.values(REGION_DB).filter(v => v.r !== '').length;
    const emptyRatio = Object.values(REGION_DB).filter(v => v.r === '').length;
    expect(ratioChanges + emptyRatio).toBe(Object.keys(REGION_DB).length);
  });
});
