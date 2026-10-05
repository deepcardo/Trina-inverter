/**
 * 核心匹配逻辑单元测试
 *
 * 测试对象: matching.js 中的全部函数 + 全局索引正确性
 * 使用真实数据（非 mock），确保测试反映实际生产行为
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './helpers/load-app.js';

let app;

describe('组件数量动态范围', () => {
  it.each([
    ['NEG22_785', '1倍', 254],
    ['NEG21_730', '1倍', 270],
    ['NEG21_730', '1.2倍(正常)', 320],
    ['NEG21_730', '1.1倍', 297],
  ])('%s / %s 的范围和边界校验一致', (series, ratio, max) => {
    const state = { province: '广东省', series, ratio };
    expect(app.getCountRange(state)).toEqual({ min: 10, max });
    expect(app.isValidCount(max, state)).toBe(true);
    expect(app.isValidCount(max + 1, state)).toBe(false);
    expect(app.isValidCount(10.5, state)).toBe(false);
  });
  it('未选择系列时不提供误导性的范围', () => {
    expect(app.getCountRange({ series: '', ratio: '1倍' })).toBeNull();
  });
});

beforeAll(() => {
  app = getApp();
});

// ==================== isValidCount ====================
describe('isValidCount', () => {
  it('有效数量 10~330 返回 true', () => {
    expect(app.isValidCount(10)).toBe(true);
    expect(app.isValidCount(100)).toBe(true);
    expect(app.isValidCount(330)).toBe(true);
  });

  it('小于 10 返回 false', () => {
    expect(app.isValidCount(0)).toBe(false);
    expect(app.isValidCount(9)).toBe(false);
  });

  it('大于 330 返回 false', () => {
    expect(app.isValidCount(331)).toBe(false);
    expect(app.isValidCount(999)).toBe(false);
  });

  it('非数字返回 false', () => {
    expect(app.isValidCount(NaN)).toBe(false);
    expect(app.isValidCount('abc')).toBe(false);
    expect(app.isValidCount(null)).toBe(false);
    expect(app.isValidCount(undefined)).toBe(false);
  });
});

// ==================== mapRegionRatio ====================
describe('mapRegionRatio', () => {
  it('空值返回 1.2倍(正常)', () => {
    expect(app.mapRegionRatio('')).toBe('1.2倍(正常)');
    expect(app.mapRegionRatio(null)).toBe('1.2倍(正常)');
    expect(app.mapRegionRatio(undefined)).toBe('1.2倍(正常)');
  });

  it('"不超配1" 返回 1倍', () => {
    expect(app.mapRegionRatio('不超配1')).toBe('1倍');
  });

  it('"不超配1.1" 返回 1.1倍', () => {
    expect(app.mapRegionRatio('不超配1.1')).toBe('1.1倍');
  });

  it('"不超配1.2" 返回 1.2倍(正常)', () => {
    expect(app.mapRegionRatio('不超配1.2')).toBe('1.2倍(正常)');
  });

  it('无法识别的文本返回 1.2倍(正常)', () => {
    expect(app.mapRegionRatio('不超配')).toBe('1.2倍(正常)');
    expect(app.mapRegionRatio('自定义')).toBe('1.2倍(正常)');
  });

  it('数值字符串处理', () => {
    expect(app.mapRegionRatio('1')).toBe('1倍');
    expect(app.mapRegionRatio('1.0')).toBe('1倍');
    expect(app.mapRegionRatio('1.5')).toBe('1.2倍(正常)');
    expect(app.mapRegionRatio('2.0')).toBe('1.2倍(正常)');
  });
});

// ==================== lookupCable ====================
describe('lookupCable', () => {
  it('小功率返回最小规格', () => {
    expect(app.lookupCable(5, 'cu')).toBe('3×10+2×6 mm²');
    expect(app.lookupCable(5, 'al')).toBe('3×16+1×10 mm²');
  });

  it('边界功率返回对应规格', () => {
    expect(app.lookupCable(20, 'cu')).toBe('3×10+2×6 mm²');
    expect(app.lookupCable(33, 'cu')).toBe('3×16+2×10 mm²');
  });

  it('160kW仍执行公司标准，超过后使用建议表', () => {
    expect(app.lookupCable(160, 'cu')).toBe('3×120+1×70 mm²');
    expect(app.lookupCable(160, 'al')).toBe('3×150+1×70 mm²');
    for (const power of [160.1, 170, 180]) {
      expect(app.lookupCable(power, 'al')).toBe('3×185+1×95 mm²');
    }
    for (const power of [180.1, 190, 200]) {
      expect(app.lookupCable(power, 'cu')).toBe('3×185+1×95 mm²');
      expect(app.lookupCable(power, 'al')).toBe('3×240+1×120 mm²');
    }
    expect(app.lookupCable(201, 'al')).toBe('超出建议表范围，需专项选型');
    expect(app.lookupCable(999, 'cu')).toBe('超出建议表范围，需专项选型');
  });

  it('铜线与铝线返回不同值', () => {
    const cu = app.lookupCable(50, 'cu');
    const al = app.lookupCable(50, 'al');
    expect(cu).not.toBe(al);
  });

  it('每个功率阶梯阈值精确匹配', () => {
    const thresholds = [20, 33, 50, 60, 70, 80, 90, 100, 125, 160];
    for (const t of thresholds) {
      expect(app.lookupCable(t, 'cu')).toBeDefined();
      expect(app.lookupCable(t, 'al')).toBeDefined();
    }
  });

  it('功率在阈值之间返回正确阶梯', () => {
    // 21~33 之间应返回 limit=33 的规格
    const cu21 = app.lookupCable(21, 'cu');
    const cu33 = app.lookupCable(33, 'cu');
    expect(cu21).toBe(cu33);
    // 34~50 之间应返回 limit=50 的规格
    expect(app.lookupCable(34, 'cu')).toBe(app.lookupCable(50, 'cu'));
  });
});

// ==================== findInRange ====================
describe('findInRange', () => {
  const testRows = [
    { r: [10, 20], inv: 'A', box: 25 },
    { r: [21, 30], inv: 'B', box: 50 },
    { r: [31, 40], inv: 'C', box: 100 },
  ];

  it('null 输入返回 null', () => {
    expect(app.findInRange(null, 15)).toBeNull();
  });

  it('空数组返回 null', () => {
    expect(app.findInRange([], 15)).toBeNull();
  });

  it('匹配中间范围', () => {
    expect(app.findInRange(testRows, 25).inv).toBe('B');
  });

  it('精确匹配左边界', () => {
    expect(app.findInRange(testRows, 21).inv).toBe('B');
  });

  it('精确匹配右边界', () => {
    expect(app.findInRange(testRows, 30).inv).toBe('B');
  });

  it('低于范围返回 null', () => {
    expect(app.findInRange(testRows, 5)).toBeNull();
  });

  it('高于范围返回 null', () => {
    expect(app.findInRange(testRows, 50)).toBeNull();
  });

  it('单行数据匹配', () => {
    expect(app.findInRange([{ r: [1, 100], inv: 'X', box: 50 }], 50).inv).toBe('X');
  });
});

// ==================== lookupMatch ====================
describe('lookupMatch', () => {
  const normalRatio = '1.2倍(正常)';
  const lightRatio = '1.1倍';
  const noneRatio = '1倍';

  describe('通用匹配（非湖南）', () => {
    const baseState = {
      province: '广东省',
      city: '广州市',
      district: '番禺区',
      ratio: normalRatio,
      count: 50,
    };

    it('NEG21_715 系列返回正确匹配', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_715' });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('30');
      expect(result.box).toBe(50);
    });

    it('NEG21_730 系列返回正确匹配', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_730' });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('33');
      expect(result.box).toBe(50);
    });

    it('NEG22_800 系列返回正确匹配', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG22_800', count: 75 });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('50');
      expect(result.box).toBe(50);
    });

    it('NEG22_785 系列返回正确匹配', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG22_785', count: 75 });
      expect(result).not.toBeNull();
    });

    it('不同容配比返回不同逆变器组合', () => {
      const normal = app.lookupMatch({ ...baseState, series: 'NEG21_730', ratio: normalRatio, count: 40 });
      const light = app.lookupMatch({ ...baseState, series: 'NEG21_730', ratio: lightRatio, count: 40 });
      const none = app.lookupMatch({ ...baseState, series: 'NEG21_730', ratio: noneRatio, count: 40 });
      // 容配比不同，逆变器组合应不同
      const results = [normal?.inv, light?.inv, none?.inv].filter(Boolean);
      expect(new Set(results).size).toBeGreaterThan(1);
    });

    it('数量超出范围返回 null', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_715', count: 999 });
      expect(result).toBeNull();
    });
  });

  describe('湖南匹配', () => {
    const hunanState = {
      province: '湖南省',
      city: '长沙市',
      district: '岳麓区',
      ratio: normalRatio,
      count: 68,
    };

    it('湖南地区命中 HUNAN_DB 中间挡位', () => {
      const result = app.lookupMatch({ ...hunanState, series: 'NEG21_730' });
      expect(result).not.toBeNull();
      // 65-68 片应返回 "17+25"
      expect(result.inv).toBe('17+25');
    });

    it('湖南地区数量为 700 片应匹配到标准表', () => {
      const result = app.lookupMatch({ ...hunanState, count: 70, series: 'NEG21_730' });
      expect(result).not.toBeNull();
    });
  });

  describe('张家界专项匹配', () => {
    const zjjState = {
      province: '湖南省',
      city: '张家界市',
      district: '永定区',
      ratio: normalRatio,
      count: 68,
    };

    it('张家界命中 ZHANGJIAJIE_DB', () => {
      const result = app.lookupMatch({ ...zjjState, series: 'NEG21_730' });
      expect(result).not.toBeNull();
      // 65-72 片应返回 "20+25"
      expect(result.inv).toBe('20+25');
    });

    it('张家界 73-76 片返回 50kW 单台', () => {
      const result = app.lookupMatch({ ...zjjState, count: 75, series: 'NEG21_730' });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('50');
    });

    it('张家界非永定区/武陵源区/慈利县/桑植县的地区去掉专项', () => {
      // 张家界的非标准区县应走湖南通用配置
      const result = app.lookupMatch({
        ...zjjState,
        district: '其他区',
      });
      // 此时应不命中张家界专项，但可能命中湖南通用或标准表
      expect(result).not.toBeNull();
    });
  });

  describe('多逆变器组合', () => {
    it('大数量返回多台逆变器组合', () => {
      const state = {
        province: '广东省', city: '广州市', district: '番禺区',
        series: 'NEG21_715', ratio: normalRatio, count: 200,
      };
      const result = app.lookupMatch(state);
      expect(result).not.toBeNull();
      expect(result.inv).toContain('+'); // 包含多台
      expect(result.box).toBeGreaterThanOrEqual(100);
    });

    it('超大数量返回 4 台逆变器', () => {
      const state = {
        province: '广东省', city: '广州市', district: '番禺区',
        series: 'NEG21_715', ratio: normalRatio, count: 310,
      };
      const result = app.lookupMatch(state);
      expect(result).not.toBeNull();
      const parts = result.inv.split('+');
      expect(parts.length).toBe(4);
    });
  });

  describe('边缘情况', () => {
    const baseState = {
      province: '广东省', city: '广州市', district: '番禺区',
      ratio: '1.2倍(正常)', count: 50,
    };

    it('不存在的系列返回 null', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NON_EXISTENT' });
      expect(result).toBeNull();
    });

    it('不存在的容配比返回 null', () => {
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_730', ratio: '不存在倍' });
      expect(result).toBeNull();
    });

    it('count 精确匹配挡位左边界', () => {
      // NEG21_715 1.2倍: 第一个挡位 r:[10,13]
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_715', count: 10 });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('8');
    });

    it('count 精确匹配挡位右边界', () => {
      // NEG21_715 1.2倍: 第一个挡位 r:[10,13]
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_715', count: 13 });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('8');
    });

    it('count 在两个挡位之间返回上挡位', () => {
      // NEG21_730 1.2倍: [10,12]→8, [13,16]→10
      const result = app.lookupMatch({ ...baseState, series: 'NEG21_730', count: 13 });
      expect(result).not.toBeNull();
      expect(result.inv).toBe('10');
    });

    it('湖南地区非 NEG21_730 系列，不命中 HUNAN_DB，走标准表', () => {
      // 湖南但选 715 系列，应跳过 HUNAN_DB 走标准 DB
      const result = app.lookupMatch({
        province: '湖南省', city: '长沙市', district: '岳麓区',
        series: 'NEG21_715', ratio: '1.2倍(正常)', count: 50,
      });
      expect(result).not.toBeNull();
    });
  });

  describe('SEARCH_INDEX 和 PROVINCE_CITY_DISTRICT', () => {
    it('PROVINCE_CITY_DISTRICT 包含广东省', () => {
      expect(app.PROVINCE_CITY_DISTRICT['广东省']).toBeDefined();
    });

    it('SEARCH_INDEX 包含所有区域键', () => {
      expect(app.SEARCH_INDEX.length).toBeGreaterThan(0);
      expect(app.SEARCH_INDEX.length).toBe(Object.keys(app.REGION_DB).length);
    });

    it('SEARCH_INDEX 元素格式正确', () => {
      const first = app.SEARCH_INDEX[0];
      expect(first).toHaveProperty('areaKey');
      expect(first).toHaveProperty('province');
      expect(first).toHaveProperty('city');
      expect(first).toHaveProperty('district');
      expect(first).toHaveProperty('fullName');
    });
  });
});
