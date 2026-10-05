import { describe, it, expect } from 'vitest';
import { getApp } from './helpers/load-app.js';

describe('800W最新配置表边界', () => {
  it.each(['1倍', '1.1倍'])('%s的213～225片使用180kW组合', ratio => {
    const app = getApp();
    for (const [count, inv] of [[212, '40+40+40+50'], [213, '40+40+50+50'], [225, '40+40+50+50'], [226, '40+50+50+50'], [237, '40+50+50+50'], [238, ratio === '1倍' ? '50+50+50+50' : '40+50+50+50']]) {
      const match = app.lookupMatch({ province: '广东省', series: 'NEG22_800', ratio, count });
      expect(match.inv).toBe(inv);
      expect(match.box).toBe(200);
      const total = match.inv.split('+').reduce((sum, value) => sum + Number(value), 0);
      if (count === 213 || count === 225) expect(app.lookupCable(total, 'al')).toBe('3×185+1×95 mm²');
    }
  });
});
