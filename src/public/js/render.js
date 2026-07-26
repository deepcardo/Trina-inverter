/**
 * DOM 渲染 — 结果展示、错误提示、复制
 *
 * 依赖: matching.js (lookupCable), data/*.js (REGION_DB)
 * 加载顺序: 在 matching.js 之后，在 main.js 之前
 */

function hideResult() { $.resultPanel.style.display = 'none'; }

function showError(msg) {
  $.msgText.textContent = msg;
  $.msgBox.classList.add('msg-visible');
  $.resultPanel.style.display = 'none';
}

function hideError() { $.msgBox.classList.remove('msg-visible'); }

function renderResult(match, state) {
  const invPowers = match.inv.split('+').map(Number);
  const totalPower = invPowers.reduce((a, b) => a + b, 0);
  const isSmallPower = invPowers.length === 1 && (invPowers[0] === 8 || invPowers[0] === 10);

  if (isSmallPower) {
    $.resInv.textContent = `${invPowers[0]}kW单相 / ${invPowers[0]}kW三相`;
    $.resBox.textContent = '10kW单相，25kW三相';
    $.resCu.innerHTML = '<span class="cable-line">单相：3×10 mm²</span><span class="cable-line">三相：3×10+2×6 mm²</span>';
    $.resAl.innerHTML = '<span class="cable-line">单相：2×16 mm²</span><span class="cable-line">三相：3×16+1×10 mm²</span>';
  } else {
    let cuHtml = '';
    for (let i = 0; i < invPowers.length; i++) {
      const pw = invPowers[i];
      const label = match.inv.includes('+') ? `<span class="cable-label">${pw}kW → </span>` : '';
      cuHtml += `<span class="cable-line">${label}${lookupCable(pw, 'cu')}</span>`;
    }
    $.resInv.textContent = `${match.inv}kW 三相`;
    $.resCu.innerHTML = cuHtml;
    $.resBox.textContent = `${match.box}kW`;
    $.resAl.textContent = lookupCable(totalPower, 'al');
  }

  const regionRule = REGION_DB[`${state.province}-${state.city}-${state.district}`];
  if (regionRule?.b && regionRule.b !== '标准') {
    $.gridNote.textContent = '备注：' + regionRule.b;
    $.gridNote.style.display = 'block';
  } else {
    $.gridNote.style.display = 'none';
  }
  $.warningMsg.style.display = totalPower > 100 ? 'flex' : 'none';
  $.resultPanel.style.display = 'block';
}

function showDataLoadError() {
  $.msgText.textContent = '⚠️ 区域数据加载失败，请刷新页面重试。如持续失败，请联系技术支持。';
  $.msgBox.classList.add('msg-visible');
  $.queryBtn.disabled = true;
  $.queryBtn.textContent = '数据不可用';
}

// ================= 复制功能 =================
function extractLines(el) {
  const lines = el.querySelectorAll('.cable-line');
  if (lines.length > 0) {
    return Array.from(lines).map(l => l.textContent.trim()).join('\n  - ');
  }
  return el.textContent.trim();
}

function doCopyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error('execCommand copy returned false'));
    } catch (e) {
      document.body.removeChild(ta);
      reject(e);
    }
  });
}

function handleCopy() {
  if ($.resultPanel.style.display === 'none') return;
  const text = [
    '【组件逆变器-线缆匹配查询结果】',
    '',
    '• 容配比：' + $.ratio.querySelector('.ratio-value').textContent.trim(),
    '• 逆变器配置：' + $.resInv.textContent.trim(),
    '• 逆变器交流铜线：\n  - ' + extractLines($.resCu),
    '• 并网箱配置：' + $.resBox.textContent.trim(),
    '• 并网箱交流铝线：' + extractLines($.resAl)
  ].join('\n');
  doCopyText(text).then(function () {
    $.copyBtn.textContent = '✓ 已复制';
    $.copyBtn.classList.add('copied');
    setTimeout(function () { $.copyBtn.textContent = '复制结果'; $.copyBtn.classList.remove('copied'); }, 2000);
  }).catch(function () {
    $.copyBtn.textContent = '⚠ 复制失败';
    $.copyBtn.classList.add('copied');
    setTimeout(function () { $.copyBtn.textContent = '复制结果'; $.copyBtn.classList.remove('copied'); }, 2000);
  });
}
