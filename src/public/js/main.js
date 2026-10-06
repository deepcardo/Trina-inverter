/**
 * 入口文件 — DOM 缓存、事件绑定、初始化
 *
 * 依赖: data/*.js, matching.js, search.js, render.js（全部为全局函数）
 * 加载顺序: 最后一个加载的脚本
 */

// ================= 从 REGION_DB 构建索引 =================
const PROVINCE_CITY_DISTRICT = {};
const SEARCH_INDEX = [];
const CITY_DEFAULT_SET = new Set();

if (typeof REGION_DB !== 'undefined' && REGION_DB) {
  Object.keys(REGION_DB).forEach(k => {
    const [p, c, d] = k.split('-');
    if (!PROVINCE_CITY_DISTRICT[p]) PROVINCE_CITY_DISTRICT[p] = {};
    if (!PROVINCE_CITY_DISTRICT[p][c]) PROVINCE_CITY_DISTRICT[p][c] = [];
    if (!PROVINCE_CITY_DISTRICT[p][c].includes(d)) PROVINCE_CITY_DISTRICT[p][c].push(d);
    if (d === c || d === '市辖区') {
      CITY_DEFAULT_SET.add(k);
    }
    SEARCH_INDEX.push({ areaKey: k, province: p, city: c, district: d, fullName: p + c + d });
  });
}

// ================= DOM 缓存 =================
const $ = {};
function cacheDom() {
  $.searchInput = document.getElementById('searchInput');
  $.searchResults = document.getElementById('searchResults');
  $.searchClear = document.getElementById('searchClear');
  $.recentSection = document.getElementById('recentSection');
  $.recentList = document.getElementById('recentList');
  $.recentClear = document.getElementById('recentClear');
  $.expandLink = document.getElementById('expandLink');
  $.cascadingWrap = document.getElementById('cascadingWrap');
  $.province = document.getElementById('province');
  $.city = document.getElementById('city');
  $.district = document.getElementById('district');
  $.ratio = document.getElementById('ratio');
  $.series = document.getElementById('series');
  $.count = document.getElementById('count');
  $.queryBtn = document.getElementById('queryBtn');
  $.msgBox = document.getElementById('msgBox');
  $.msgText = document.getElementById('msgText');
  $.msgClose = document.querySelector('#msgBox .msg-close');
  $.resultPanel = document.getElementById('resultPanel');
  $.resInv = document.getElementById('resInv');
  $.resCu = document.getElementById('resCu');
  $.resBox = document.getElementById('resBox');
  $.resAl = document.getElementById('resAl');
  $.cableAdvice = document.getElementById('cableAdvice');
  $.gridNote = document.getElementById('gridNote');
  $.warningMsg = document.getElementById('warningMsg');
  $.copyBtn = document.getElementById('copyBtn');
}

// ================= 输入状态读取 =================
function getInputState() {
  return {
    province: $.province.value,
    city: $.city.value,
    district: $.district.value,
    series: $.series.value,
    ratio: $.ratio.dataset.value || '1.2倍(正常)',
    count: $.count.value === '' ? NaN : Number($.count.value)
  };
}

function countRangeMessage() {
  const range = getCountRange(getInputState());
  return range ? `⚠️ 请输入有效整数数量（${range.min} ~ ${range.max} 片）` : '⚠️ 请先选择地区和组件系列';
}

function updateCountRange() {
  const range = getCountRange(getInputState());
  $.count.placeholder = range ? `${range.min} ~ ${range.max}` : '请先选择地区和组件系列';
  for (const attr of ['min', 'max']) {
    if (range) $.count.setAttribute(attr, range[attr]);
    else $.count.removeAttribute(attr);
  }
  clearMarkError($.count);
  hideError();
  if ($.count.value && range && !isValidCount(Number($.count.value), getInputState())) {
    markError($.count);
    showError(countRangeMessage());
  }
}

// ================= 查询处理 =================
function handleQuery() {
  hideError();
  hideResult();
  clearFormErrors();
  $.queryBtn.classList.remove('loading', 'success');
  $.queryBtn.textContent = '智能匹配查询';

  const state = getInputState();
  let hasErr = false;
  if (!state.province || !state.city || !state.district) {
    if (!state.province) markError($.province);
    if (!state.city) markError($.city);
    if (!state.district) markError($.district);
    showError('⚠️ 请选择完整的地区（省/市/区县）');
    hasErr = true;
  }
  if (!state.count || !isValidCount(state.count, state)) {
    markError($.count);
    if (!hasErr) showError(countRangeMessage());
    hasErr = true;
  }
  if (hasErr) return;

  $.queryBtn.classList.add('loading');
  const match = lookupMatch(state);
  if (!match) {
    $.queryBtn.classList.remove('loading');
    showError('❌ 未找到匹配项。可能原因：当前数量不在该系列/容配比配置范围内，或该地区暂不支持此配置。请核对或联系技术支持。');
    return;
  }
  renderResult(match, state);
  $.queryBtn.classList.remove('loading');
  $.queryBtn.classList.add('success');
  $.queryBtn.textContent = '✓ 查询完成';
  setTimeout(() => { $.queryBtn.classList.remove('success'); $.queryBtn.textContent = '智能匹配查询'; }, 500);
}

function handleCountBlur() {
  const val = Number($.count.value);
  if ($.count.value && !isValidCount(val, getInputState())) {
    markError($.count);
    $.msgText.textContent = countRangeMessage();
    $.msgBox.classList.add('msg-visible');
  } else {
    clearMarkError($.count);
    hideError();
  }
}

// ================= 事件绑定 =================
function markError(el) {
  el.closest('.form-group').classList.add('has-error');
}
function clearMarkError(el) {
  const fg = el.closest('.form-group');
  if (fg) fg.classList.remove('has-error');
}
function clearFormErrors() {
  document.querySelectorAll('.form-group.has-error').forEach(el => el.classList.remove('has-error'));
}

function setupCascade() {
  function onCascadeChange(lv) {
    handleCascade(lv);
    const p = $.province.value, c = $.city.value, d = $.district.value;
    if (p && c && d) {
      cascadeSync();
    } else if ($.searchInput.value) {
      $.searchInput.value = '';
      $.searchClear.style.display = 'none';
      hideResult();
      closeSearchDropdown();
      showRecentIfAvailable();
    }
  }
  $.province.addEventListener('change', () => onCascadeChange('province'));
  $.city.addEventListener('change', () => onCascadeChange('city'));
  $.district.addEventListener('change', () => onCascadeChange('district'));
}

function setupSearch() {
  $.searchInput.addEventListener('input', function () {
    const q = this.value.trim();
    if (q) {
      $.searchClear.style.display = 'block';
      $.recentSection.style.display = 'none';
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const results = searchDistricts(q);
        renderSearchResults(results, q);
      }, 300);
    } else {
      $.searchClear.style.display = 'none';
      closeSearchDropdown();
      resetSearchState();
    }
  });
  $.searchClear.addEventListener('click', function () {
    $.searchInput.value = '';
    $.searchInput.focus();
    $.searchClear.style.display = 'none';
    closeSearchDropdown();
    resetSearchState();
    hideResult();
  });
  $.searchInput.addEventListener('keydown', function (e) {
    const items = $.searchResults.querySelectorAll('.sd-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === searchActiveIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === searchActiveIdx));
    } else if (e.key === 'Enter' && searchActiveIdx >= 0 && items[searchActiveIdx]) {
      e.preventDefault();
      items[searchActiveIdx].click();
    } else if (e.key === 'Escape') {
      closeSearchDropdown();
      $.searchInput.blur();
    }
  });
  $.searchInput.addEventListener('focus', function () {
    const q = this.value.trim();
    if (q) { renderSearchResults(searchDistricts(q), q); }
    else { showRecentIfAvailable(); }
  });
  $.searchInput.addEventListener('blur', function () {
    setTimeout(closeSearchDropdown, 200);
  });
}

function setupMisc() {
  $.expandLink.addEventListener('click', function () {
    const isVisible = $.cascadingWrap.classList.toggle('visible');
    this.classList.toggle('expanded');
    this.innerHTML = isVisible
      ? '收起地区选择 <span class="expand-arrow"></span>'
      : '展开地区选择 <span class="expand-arrow"></span>';
  });
  $.recentClear.addEventListener('click', clearRecentAll);
  $.recentList.addEventListener('click', function (e) {
    const target = e.target;
    if (target.classList.contains('ri-del')) {
      removeRecentItem(target.dataset.key);
    } else {
      const item = target.closest('.recent-item');
      if (item) selectDistrict(item.dataset.areaKey);
    }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-section')) closeSearchDropdown();
  });
}

function setupActions() {
  $.queryBtn.addEventListener('click', handleQuery);
  $.copyBtn.addEventListener('pointerdown', handleCopy);
  $.msgClose.addEventListener('click', () => { hideError(); clearFormErrors(); });
  $.count.addEventListener('keypress', e => { if (e.key === 'Enter') handleQuery(); });
  $.count.addEventListener('blur', handleCountBlur);
  $.count.addEventListener('input', function () {
    clearMarkError(this);
    hideError();
    debounceAutoQuery();
  });
  $.series.addEventListener('change', function () {
    updateCountRange();
    hideResult();
    debounceAutoQuery();
  });
}

// ================= 自动触发查询（防抖） =================
let autoQueryTimer = null;

function tryAutoQuery() {
  clearFormErrors();
  hideError();
  updateCountRange();
  const state = getInputState();
  if (state.province && state.city && state.district && state.series && isValidCount(state.count, state)) {
    handleQuery();
  }
}

function debounceAutoQuery() {
  clearTimeout(autoQueryTimer);
  autoQueryTimer = setTimeout(tryAutoQuery, 500);
}

// ================= 初始化 =================
function init() {
  cacheDom();
  Object.keys(PROVINCE_CITY_DISTRICT).sort().forEach(p => $.province.add(new Option(p, p)));
  const initialRatio = RATIO_OPTIONS.find(o => o.value === RATIO_NORMAL)?.label || RATIO_NORMAL;
  $.ratio.dataset.value = RATIO_NORMAL;
  $.ratio.querySelector('.ratio-value').textContent = initialRatio;
  setupCascade();
  setupSearch();
  setupMisc();
  setupActions();
  if (typeof REGION_DB === 'undefined' || !REGION_DB) showDataLoadError();
  handleCascade('init');
  showRecentIfAvailable();
}

init();
