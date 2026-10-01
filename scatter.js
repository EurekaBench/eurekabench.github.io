/* Read the current manuscript values directly from the visible leaderboard. */
(() => {
  'use strict';
  const host = document.querySelector('#scatter-chart');
  const detail = document.querySelector('#chart-detail');
  if (!host || !detail) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const filter = document.querySelector('#harness-filter');
  const sourceRows = [...document.querySelectorAll('#model-results tr[data-model]')];
  const humanRow = document.querySelector('#human-reference');
  const rows = [...sourceRows, ...(humanRow ? [humanRow] : [])];
  const data = rows.map((row, index) => ({
    id: row.id || `scatter-model-${index}`,
    model: row.dataset.model,
    harness: row.dataset.harness,
    accuracy: Number(row.dataset.accuracy),
    insights: Number(row.dataset.insights),
    score: Number(row.dataset.score),
    human: row === humanRow
  })).filter(item => Number.isFinite(item.accuracy) && Number.isFinite(item.insights));
  let selected = null;
  let lastWidth = 0;
  let renderPending = false;

  host.classList.add('scatter-host');
  detail.classList.add('scatter-detail');
  const tooltip = document.createElement('div');
  tooltip.className = 'scatter-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.id = 'scatter-tooltip';
  tooltip.hidden = true;

  function svgElement(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function htmlElement(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function providerClass(item) {
    if (item.human) return 'scatter-human';
    if (item.model.startsWith('Claude')) return 'scatter-claude';
    if (item.model.startsWith('GPT')) return 'scatter-openai';
    if (item.model.startsWith('DeepSeek')) return 'scatter-deepseek';
    return 'scatter-kimi';
  }

  function modelLogo(className) {
    const provider = className.replace('scatter-', '');
    return `assets/models/${provider}.${provider === 'openai' ? 'svg' : 'png'}`;
  }

  function percent(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
  }

  function updateDetail() {
    detail.replaceChildren();
    const item = data.find(candidate => candidate.id === selected);
    if (!item) {
      detail.append(htmlElement('p', 'scatter-instruction', 'Hover or focus on a point to inspect it. Select a model to keep its results below.'));
      return;
    }
    const heading = htmlElement('div', 'scatter-detail-heading');
    heading.append(
      htmlElement('strong', 'scatter-detail-name', item.model),
      htmlElement('span', 'scatter-detail-harness', item.human ? 'Reference from existing scientific progress' : item.harness)
    );
    const metrics = htmlElement('dl', 'scatter-detail-metrics');
    [['Predictive accuracy', item.accuracy], ['Insights', item.insights], ['Final score (conditional)', item.score]].forEach(([name, value]) => {
      const metric = htmlElement('div', 'scatter-detail-metric');
      metric.append(htmlElement('dt', 'scatter-detail-label', name), htmlElement('dd', 'scatter-detail-value', percent(value)));
      metrics.append(metric);
    });
    detail.append(heading, metrics);
  }

  function selectItem(item) {
    selected = item.id;
    host.querySelectorAll('.scatter-point').forEach(group => {
      const active = group.dataset.id === selected;
      group.classList.toggle('scatter-selected', active);
      group.setAttribute('aria-pressed', String(active));
    });
    updateDetail();
  }

  function hideTooltip() {
    tooltip.hidden = true;
    host.querySelectorAll('.scatter-point[aria-describedby]').forEach(group => group.removeAttribute('aria-describedby'));
  }

  function showTooltip(item, point, group) {
    tooltip.replaceChildren(
      htmlElement('strong', 'scatter-tooltip-name', item.model),
      htmlElement('span', 'scatter-tooltip-values', `${percent(item.accuracy)} accuracy · ${percent(item.insights)} insights`)
    );
    tooltip.hidden = false;
    group.setAttribute('aria-describedby', tooltip.id);
    const availableWidth = host.clientWidth;
    const left = Math.max(6, Math.min(point.x + 15, availableWidth - tooltip.offsetWidth - 6));
    const top = Math.max(5, point.y - tooltip.offsetHeight - 15);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function labelLayout(item, point, labelWidth, labelHeight, compact, iconSize) {
    const above = point.y - 20 - labelHeight;
    if (compact) {
      const layouts = {
        'Claude Fable 5.1': { x: point.x - labelWidth / 2, y: above },
        'Claude Opus 5': { x: point.x - 18 - labelWidth, y: above },
        'Claude Opus 4.8': { x: point.x - 18 - labelWidth, y: above },
        'GPT 6 Astra': { x: point.x - labelWidth / 2, y: point.y - iconSize / 2 - 7 - labelHeight },
        'GPT 5.6 Sol': { x: point.x + 14, y: point.y + 18 },
        'DeepSeek V4 Flash': { x: point.x - labelWidth / 2, y: point.y + 18 },
        'Kimi K3': { x: point.x - 14 - labelWidth, y: point.y - 22 - labelHeight }
      };
      if (item.human) return { x: point.x - 20 - labelWidth, y: point.y - labelHeight / 2 };
      return layouts[item.model];
    }
    const gap = iconSize / 2 + 7;
    const left = { x: point.x - labelWidth - gap, y: point.y - labelHeight / 2 };
    const right = { x: point.x + gap, y: point.y - labelHeight / 2 };
    const below = { x: point.x - labelWidth / 2, y: point.y + gap };
    if (item.human) return left;
    return {
      'Claude Fable 5.1': right,
      'Claude Opus 5': left,
      'Claude Opus 4.8': right,
      'GPT 6 Astra': right,
      'GPT 5.6 Sol': left,
      'DeepSeek V4 Flash': below,
      'Kimi K3': left
    }[item.model];
  }

  function modelLabelLines(item, compact) {
    if (!compact) return [item.model];
    return {
      'Claude Fable 5.1': ['Claude Fable', '5.1'],
      'Claude Opus 5': ['Claude Opus', '5'],
      'Claude Opus 4.8': ['Claude Opus', '4.8'],
      'GPT 6 Astra': ['GPT 6', 'Astra'],
      'GPT 5.6 Sol': ['GPT 5.6', 'Sol'],
      'DeepSeek V4 Flash': ['DeepSeek V4', 'Flash'],
      'Kimi K3': ['Kimi K3'],
      'Human scientist': ['Human scientist']
    }[item.model] || [item.model];
  }

  function render() {
    renderPending = false;
    const width = Math.round(host.getBoundingClientRect().width);
    if (width < 100 || !host.getClientRects().length) return;
    const focusedId = document.activeElement?.classList?.contains('scatter-point') ? document.activeElement.dataset.id : null;
    lastWidth = width;
    const compact = width < 700;
    const height = compact ? 520 : Math.round(Math.max(520, width * 0.60));
    const box = { left: compact ? 45 : 57, right: compact ? 15 : 24, top: 39, bottom: 65 };
    box.floor = height - box.bottom;
    const plotWidth = width - box.left - box.right;
    const plotHeight = height - box.top - box.bottom;
    const x = value => box.left + ((value - 25) / 27) * plotWidth;
    const y = value => box.top + (1 - value / 80) * plotHeight;
    const harness = filter?.value || 'all';
    const visible = data.filter(item => item.human || harness === 'all' || item.harness === harness);
    if (selected && !visible.some(item => item.id === selected)) {
      selected = null;
      updateDetail();
    }

    host.replaceChildren();
    const svg = svgElement('svg', {
      class: `scatter-svg${compact ? ' scatter-compact' : ''}`,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'group',
      'aria-labelledby': 'scatter-title scatter-description'
    });
    svg.append(
      svgElement('title', { id: 'scatter-title' }, 'Predictive accuracy and scientific insights'),
      svgElement('desc', { id: 'scatter-description' }, `Each model logo is centered at its exact measured coordinates; the gold plus marks the human scientist reference. Horizontal axis: predictive accuracy, 25 to 52 percent. Vertical axis: insights, 0 to 80 percent. ${visible.filter(item => !item.human).length} AI models are shown. Focus a point and press Enter or Space to select it.`)
    );
    const axes = svgElement('g', { class: 'scatter-axes', 'aria-hidden': 'true' });
    for (let value = 0; value <= 80; value += 20) {
      const lineY = y(value);
      axes.append(
        svgElement('line', { class: 'scatter-grid', x1: box.left, y1: lineY, x2: width - box.right, y2: lineY }),
        svgElement('text', { class: 'scatter-tick', x: box.left - 12, y: lineY + 5, 'text-anchor': 'end' }, String(value))
      );
    }
    for (let value = 25; value <= 50; value += 5) {
      const tickX = x(value);
      axes.append(
        svgElement('line', { class: 'scatter-x-tick', x1: tickX, y1: y(0), x2: tickX, y2: y(0) + 5 }),
        svgElement('text', { class: 'scatter-tick', x: tickX, y: y(0) + 23, 'text-anchor': 'middle' }, String(value))
      );
    }
    axes.append(
      svgElement('line', { class: 'scatter-axis', x1: box.left, y1: y(0), x2: width - box.right, y2: y(0) }),
      svgElement('text', { class: 'scatter-axis-title', x: box.left, y: 17 }, 'Insights (%)'),
      svgElement('text', { class: 'scatter-axis-title', x: box.left + plotWidth / 2, y: height - 13, 'text-anchor': 'middle' }, 'Predictive accuracy (%)')
    );
    svg.append(axes);
    host.append(svg, tooltip);
    hideTooltip();


    visible.forEach(item => {
      const point = { x: x(item.accuracy), y: y(item.insights) };
      const group = svgElement('g', {
        class: `scatter-point ${providerClass(item)}${selected === item.id ? ' scatter-selected' : ''}`,
        tabindex: '0', role: 'button', 'aria-pressed': String(selected === item.id),
        'aria-label': `${item.model}${item.human ? ', human reference' : `, ${item.harness}`}: predictive accuracy ${percent(item.accuracy)}, insights ${percent(item.insights)}, final score (conditional) ${percent(item.score)}. Select to show results.`,
        'data-id': item.id
      });
      const lines = modelLabelLines(item, compact);
      const text = svgElement('text', { class: 'scatter-label', 'aria-hidden': 'true' });
      const lineHeight = compact ? 20 : 24;
      const iconSize = compact ? 16 : width < 1000 ? 22 : 28;
      let spans = lines.map((line, index) => svgElement('tspan', { x: 0, dy: index ? lineHeight : 0 }, line));
      text.append(...spans);
      group.append(text);
      svg.append(group);
      // Keep the close Opus/OpenAI pair on opposite sides of their own logos.
      // Wrap the Opus label within the gap before GPT 6, never shift a data mark.
      const astra = visible.find(candidate => candidate.model === 'GPT 6 Astra');
      if (!compact && item.model === 'Claude Opus 4.8' && astra) {
        const available = x(astra.accuracy) - point.x - iconSize - 14;
        const wrapped = [];
        let line = '';
        item.model.split(' ').forEach(word => {
          const candidate = line ? `${line} ${word}` : word;
          text.textContent = candidate;
          if (line && text.getComputedTextLength() > available) {
            wrapped.push(line);
            line = word;
          } else line = candidate;
        });
        if (line) wrapped.push(line);
        spans = wrapped.map((line, index) => svgElement('tspan', { x: 0, dy: index ? lineHeight : 0 }, line));
        text.replaceChildren(...spans);
      }
      const labelBounds = text.getBBox();
      const labelWidth = labelBounds.width;
      const labelHeight = labelBounds.height;
      let preferred = labelLayout(item, point, labelWidth, labelHeight, compact, iconSize)
        || { x: point.x + 21, y: point.y - labelHeight / 2 };
      if (!compact && item.model === 'Claude Fable 5.1' && preferred.x + labelWidth > width - 8) {
        preferred = { x: point.x - iconSize / 2 - 7 - labelWidth, y: point.y - labelHeight / 2 };
      }
      const labelX = Math.max(8, Math.min(preferred.x, width - 8 - labelWidth));
      const labelY = Math.max(box.top, Math.min(preferred.y, y(0) - labelHeight - 8));
      text.setAttribute('x', labelX);
      text.setAttribute('y', labelY - labelBounds.y);
      spans.forEach(span => span.setAttribute('x', labelX));

      group.append(svgElement('circle', { class: 'scatter-halo', cx: point.x, cy: point.y, r: Math.max(16, iconSize / 2 + 4), 'aria-hidden': 'true' }));
      if (item.human) {
        group.append(svgElement('path', { class: 'scatter-human-mark', d: `M${point.x - 11},${point.y}H${point.x + 11}M${point.x},${point.y - 11}V${point.y + 11}`, 'aria-hidden': 'true' }));
      } else {
        group.append(svgElement('image', {
          class: 'scatter-model-logo', href: modelLogo(providerClass(item)),
          x: point.x - iconSize / 2, y: point.y - iconSize / 2, width: iconSize, height: iconSize,
          preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true'
        }));
      }
      group.append(svgElement('circle', { class: 'scatter-hit', cx: point.x, cy: point.y, r: Math.max(12, iconSize / 2), 'aria-hidden': 'true' }));
      group.addEventListener('mouseenter', () => showTooltip(item, point, group));
      group.addEventListener('mouseleave', () => { if (document.activeElement !== group) hideTooltip(); });
      group.addEventListener('focus', () => showTooltip(item, point, group));
      group.addEventListener('blur', hideTooltip);
      group.addEventListener('click', () => selectItem(item));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectItem(item);
        } else if (event.key === 'Escape') hideTooltip();
      });
    });

    const legend = htmlElement('div', 'scatter-legend');
    legend.setAttribute('aria-label', 'Chart legend');
    [['Claude', 'scatter-claude'], ['OpenAI', 'scatter-openai'], ['DeepSeek', 'scatter-deepseek'], ['Kimi', 'scatter-kimi'], ['Human reference', 'scatter-human']].forEach(([name, className]) => {
      if (!visible.some(item => providerClass(item) === className)) return;
      const entry = htmlElement('span', `scatter-legend-item ${className}`);
      const mark = htmlElement(className === 'scatter-human' ? 'span' : 'img', 'scatter-legend-mark', className === 'scatter-human' ? '+' : undefined);
      if (className !== 'scatter-human') { mark.src = modelLogo(className); mark.alt = ''; }
      mark.setAttribute('aria-hidden', 'true');
      entry.append(mark, document.createTextNode(name));
      legend.append(entry);
    });
    host.append(legend);
    if (focusedId) [...host.querySelectorAll('.scatter-point')].find(group => group.dataset.id === focusedId)?.focus({ preventScroll: true });
  }

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(render);
  }

  filter?.addEventListener('change', scheduleRender);
  window.addEventListener('eureka:viewchange', event => {
    if (event.detail?.view === 'chart') scheduleRender();
    else hideTooltip();
  });
  window.addEventListener('resize', scheduleRender, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width || 0);
      if (width > 0 && width !== lastWidth) scheduleRender();
    }).observe(host);
  }
  if (document.fonts?.ready) document.fonts.ready.then(scheduleRender);
  updateDetail();
  scheduleRender();
})();
