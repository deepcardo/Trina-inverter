/**
 * 搜索 + 级联 + 最近使用
 *
 * 依赖: matching.js, data/*.js, render.js (hideResult, showRecentIfAvailable 等)
 * 加载顺序: 在 matching.js 之后，在 render.js 和 main.js 之前
 */

// ================= 搜索功能 =================
let searchTimer = null;
let searchActiveIdx = -1;

function matchPinyin(entry, pql) {
  if (typeof pinyinPro === 'undefined' || !pinyinPro.match) return null;
  try {
    function consecutive(text) {
      const r = pinyinPro.match(text, pql);
      if (!r) return null;
      for (let j = 1; j < r.length; j++) {
        if (typeof r[j] !== 'number' || typeof r[j-1] !== 'number' || r[j] !== r[j-1] + 1) return null;
      }
      return r;
    }
    const isLong = pql.length > 3;
    const levels = [
      { name: entry.district, level: 0 },
      { name: entry.city, level: 1 },
      { name: entry.province, level: 2 }
    ];
    for (const lv of levels) {
      const r = consecutive(lv.name);
      if (r && (isLong || r.includes(0))) {
        const targetPy = pinyinPro.pinyin(lv.name, { toneType: 'none', separator: '' }).toLowerCase();
        return { match: true, level: lv.level, tight: targetPy.includes(pql) };
      }
    }
  } catch (ex) {}
  return null;
}

function searchDistricts(q) {
  const cleaned = q ? ('' + q).replace(/[^一-鿿\sa-zA-Z]/g, '').replace(/\s+/g, ' ').trim() : '';
  if (!cleaned) return [];
  const isPinyin = /[a-zA-Z]/.test(cleaned);
  const pql = cleaned.replace(/[一-鿿\s]/g, '').toLowerCase();
  if (isPinyin && pql.length < 2) return [];

  const results = [];
  const provLimit = {};
  const cityLimit = {};

  for (let i = 0; i < SEARCH_INDEX.length; i++) {
    const e = SEARCH_INDEX[i];
    const chineseMatch = e.fullName.includes(cleaned) || e.district.includes(cleaned) || e.city.includes(cleaned) || e.province.includes(cleaned);
    const pRes = isPinyin ? matchPinyin(e, pql) : null;
    const pinyinMatch = pRes && pRes.match;
    const matchLevel = pRes ? pRes.level : -1;
    const isTight = pRes ? pRes.tight : false;

    if (chineseMatch || pinyinMatch) {
      if (isPinyin && !chineseMatch) {
        if (matchLevel === 2) {
          const k = e.province;
          provLimit[k] = (provLimit[k] || 0) + 1;
          if (provLimit[k] > 1) continue;
        } else if (matchLevel === 1 && !isTight) {
          const k = e.province + '-' + e.city;
          cityLimit[k] = (cityLimit[k] || 0) + 1;
          if (cityLimit[k] > 2) continue;
        }
      }
      const rank = chineseMatch
        ? (e.district.includes(cleaned) ? 0 : e.city.includes(cleaned) ? 1 : 2)
        : matchLevel;
      results.push({ entry: e, rank, isPinyin: !chineseMatch, matchLevel, isTight });
    }
  }
  results.sort((a, b) => {
    if (a.isPinyin !== b.isPinyin) return a.isPinyin ? 1 : -1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.isPinyin && b.isPinyin && a.isTight !== b.isTight) return a.isTight ? -1 : 1;
    if (a.isPinyin && b.isPinyin) {
      const segLen = x => x.matchLevel === 0 ? x.entry.district.length : x.matchLevel === 1 ? x.entry.city.length : x.entry.province.length;
      const d = segLen(a) - segLen(b);
      if (d !== 0) return d;
    }
    return a.entry.district.length - b.entry.district.length || a.entry.areaKey.localeCompare(b.entry.areaKey);
  });
  return results.slice(0, 10);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function highlightText(text, query) {
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const idx = escaped.indexOf(escapedQuery);
  if (idx === -1) return escaped;
  return escaped.slice(0, idx) + '<span class="sd-highlight">' + escaped.slice(idx, idx + escapedQuery.length) + '</span>' + escaped.slice(idx + escapedQuery.length);
}

function renderSearchResults(results, q) {
  $.searchResults.innerHTML = '';
  searchActiveIdx = -1;
  $.searchInput.removeAttribute('aria-activedescendant');
  if (!results || results.length === 0) {
    $.searchResults.removeAttribute('role');
    $.searchResults.innerHTML = '<div class="sd-empty" role="status">未找到匹配地区，请展开地区选择</div>';
    openSearchDropdown();
    return;
  }
  $.searchResults.setAttribute('role', 'listbox');
  $.searchResults.setAttribute('aria-label', '搜索结果');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const el = document.createElement('div');
    el.className = 'sd-item';
    el.id = 'sd-opt-' + i;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    const parts = [r.entry.province, r.entry.city, r.entry.district];
    let html = '';
    if (!r.isPinyin) {
      const hlText = q.replace(/[^一-鿿\sa-zA-Z]/g, '').replace(/\s+/g, ' ').trim();
      for (let j = 0; j < parts.length; j++) {
        html += highlightText(parts[j], hlText);
      }
    } else {
      for (let j = 0; j < parts.length; j++) {
        if ((r.matchLevel === 0 && j === 2) ||
            (r.matchLevel === 1 && j === 1) ||
            (r.matchLevel === 2 && j === 0)) {
          html += '<span class="sd-highlight">' + parts[j] + '</span>';
        } else {
          html += parts[j];
        }
      }
    }
    const mlLabel = ['区县', '城市', '省份'];
    const mlIndex = (r.isPinyin && r.matchLevel >= 0) ? r.matchLevel : 0;
    const badge = r.isPinyin
      ? '<span class="sd-match-type">' + mlLabel[mlIndex] + (r.isTight ? '匹配' : '·模糊') + '</span>'
      : '';
    el.innerHTML = '<span class="sd-path">' + html + '</span>' + badge;
    el.addEventListener('click', () => selectDistrict(r.entry.areaKey));
    $.searchResults.appendChild(el);
  }
  openSearchDropdown();
}

function openSearchDropdown() {
  $.searchResults.classList.add('sd-visible');
  $.searchInput.setAttribute('aria-expanded', 'true');
}

function closeSearchDropdown() {
  $.searchResults.classList.remove('sd-visible');
  searchActiveIdx = -1;
  $.searchInput.setAttribute('aria-expanded', 'false');
  $.searchInput.removeAttribute('aria-activedescendant');
}

// ================= 地区选择（三路同步核心） =================
function selectDistrict(areaKey) {
  const [p, c, d] = areaKey.split('-');
  if (!p || !c || !d) return;
  handleCascade('province', p, c);
  handleCascade('city', p, c, d);
  $.searchInput.value = p + c + d;
  $.searchClear.style.display = 'block';
  closeSearchDropdown();
  applyRegionRule(p, c, d);
  saveRecent(areaKey);
  showRecentIfAvailable();
  hideResult();
}

// ================= 最近使用 =================
const RECENT_KEY = 'recentDistricts';
const MAX_RECENT = 10;

function getRecent() {
  try {
    const data = localStorage.getItem(RECENT_KEY);
    const raw = data ? JSON.parse(data) : [];
    if (!Array.isArray(raw)) return [];
    return raw.filter(r => r && typeof r.areaKey === 'string' && r.areaKey.split('-').length === 3);
  } catch (e) { return []; }
}

function saveRecent(areaKey) {
  try {
    let recent = getRecent().filter(r => r.areaKey !== areaKey);
    recent.unshift({ areaKey: areaKey, selectedAt: Date.now() });
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch (e) {}
}

function removeRecentItem(areaKey) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(r => r.areaKey !== areaKey)));
    showRecentIfAvailable();
  } catch (e) {}
}

function clearRecentAll() {
  try { localStorage.removeItem(RECENT_KEY); showRecentIfAvailable(); } catch (e) {}
}

function showRecentIfAvailable() {
  try {
    const recent = getRecent();
    if (recent.length === 0) { $.recentSection.style.display = 'none'; return; }
    // 有历史即常显（含搜索框有值时），提升功能可发现性
    $.recentSection.style.display = 'block';
    $.recentList.innerHTML = '';
    for (let i = 0; i < recent.length; i++) {
      const item = recent[i];
      const label = item.areaKey.split('-').join('');
      const el = document.createElement('span');
      el.className = 'recent-item';
      el.dataset.areaKey = item.areaKey;
      el.innerHTML = '<span>' + escapeHtml(label) + '</span><button type="button" class="ri-del" data-key="' + escapeHtml(item.areaKey) + '" aria-label="删除' + escapeHtml(label) + '">×</button>';
      $.recentList.appendChild(el);
    }
  } catch (e) { $.recentSection.style.display = 'none'; }
}

// ================= 级联联动 =================
function handleCascade(lv, presetP, presetC, presetD) {
  const p = presetP || $.province.value;
  const c = presetC || (lv === 'province' ? '' : $.city.value);
  hideResult();

  // 记住用户已选的系列：重建选项后若仍可用则恢复，避免换区县时被静默重置
  const prevSeries = $.series.value;

  if (presetP) $.province.value = presetP;

  if (lv === 'province' || lv === 'init') {
    $.city.innerHTML = '<option value="">请选择</option>';
    $.district.innerHTML = '<option value="">请选择</option>';
    if (p && PROVINCE_CITY_DISTRICT[p]) Object.keys(PROVINCE_CITY_DISTRICT[p]).sort().forEach(x => $.city.add(new Option(x, x)));
    if (presetC && PROVINCE_CITY_DISTRICT[p]?.[presetC]) $.city.value = presetC;
  }
  if (lv === 'city' || lv === 'province' || lv === 'init') {
    $.district.innerHTML = '<option value="">请选择</option>';
    if (p && c && PROVINCE_CITY_DISTRICT[p]?.[c]) PROVINCE_CITY_DISTRICT[p][c].sort().forEach(x => $.district.add(new Option(x, x)));
  }

  if (!p) {
    $.series.innerHTML = '<option value="">请先选择地区</option>';
  } else if (p === PROV_HUNAN) {
    $.series.innerHTML = '<option value="NEG21_730">NEG21 (730W~740W)</option>';
  } else {
    $.series.innerHTML = '<option value="NEG21_715">NEG21 (715W~720W)</option><option value="NEG21_730">NEG21 (730W~740W)</option><option value="NEG22_785">NEG22 (780W~785W)</option><option value="NEG22_800">NEG22 (790W~800W)</option>';
  }
  if ($.series.options.length > 0 && $.series.options[0].value) $.series.value = $.series.options[0].value;
  if (prevSeries && Array.from($.series.options).some(o => o.value === prevSeries)) $.series.value = prevSeries;

  if (presetD) $.district.value = presetD;
  updateCountRange();
}

function applyRegionRule(p, c, d) {
  if (!p) { p = $.province.value; c = $.city.value; d = $.district.value; }
  const newVal = mapRegionRatio((REGION_DB[`${p}-${c}-${d}`] || {}).r);
  const oldVal = $.ratio.dataset.value;
  if (oldVal !== newVal) {
    $.ratio.dataset.value = newVal;
    const label = RATIO_OPTIONS.find(o => o.value === newVal)?.label || newVal;
    $.ratio.querySelector('.ratio-value').textContent = label;
    $.ratio.classList.remove('ratio-flash');
    void $.ratio.offsetWidth;
    $.ratio.classList.add('ratio-flash');
  }
  updateCountRange();
}

function cascadeSync() {
  const p = $.province.value, c = $.city.value, d = $.district.value;
  if (!p || !c || !d) return;
  $.searchInput.value = p + c + d;
  $.searchClear.style.display = 'block';
  applyRegionRule(p, c, d);
  saveRecent(p + '-' + c + '-' + d);
  showRecentIfAvailable();
  hideResult();
  closeSearchDropdown();
}

function resetSearchState() {
  $.province.value = '';
  handleCascade('province');
  $.city.value = '';
  $.district.value = '';
  // 地区已清空，数量一并复位，避免留下「有数量无地区」的中间态
  $.count.value = '';
  clearMarkError($.count);
  hideError();
  $.ratio.dataset.value = RATIO_NORMAL;
  const defaultLabel = RATIO_OPTIONS.find(o => o.value === RATIO_NORMAL)?.label || RATIO_NORMAL;
  $.ratio.querySelector('.ratio-value').textContent = defaultLabel;
  showRecentIfAvailable();
}
