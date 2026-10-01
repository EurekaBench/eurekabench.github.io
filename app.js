/* Progressive enhancement: the leaderboard's paper results are in HTML. */
(() => {
  'use strict';
  const tbody = document.querySelector('#model-results');
  if (!tbody) return;
  const rows = [...tbody.querySelectorAll('tr')];
  const filter = document.querySelector('#harness-filter');
  const headings = [...document.querySelectorAll('[data-sort]')];
  const metrics = {
    score: 'final score (conditional)', accuracy: 'predictive accuracy',
    insights: 'scientific insights', failures: 'SC failures', calls: 'calls', cost: 'cost'
  };
  const state = { metric: 'score', ascending: false, harness: 'all' };

  const viewTabs = [...document.querySelectorAll('.results-view [role="tab"]')];
  function activateView(tab, moveFocus = false) {
    viewTabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (moveFocus) tab.focus();
    window.dispatchEvent(new CustomEvent('eureka:viewchange', {
      detail: { view: tab.id === 'chart-tab' ? 'chart' : 'table' }
    }));
  }
  viewTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateView(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % viewTabs.length;
      if (event.key === 'ArrowLeft') next = (index + viewTabs.length - 1) % viewTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = viewTabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      activateView(viewTabs[next], true);
    });
  });

  if (new URLSearchParams(window.location.search).get('view') === 'chart') {
    const chartTab = viewTabs.find(tab => tab.id === 'chart-tab');
    if (chartTab) activateView(chartTab);
  }

  function updateResults() {
    const metric = state.metric;
    const ordered = [...rows].sort((a, b) => {
      const difference = Number(a.dataset[metric]) - Number(b.dataset[metric]);
      return (state.ascending ? difference : -difference)
        || Number(b.dataset.score) - Number(a.dataset.score)
        || a.dataset.model.localeCompare(b.dataset.model);
    });
    let visibleCount = 0;
    let rank = 0;
    let previousValue = null;
    const harnesses = new Set();
    ordered.forEach(row => {
      row.hidden = state.harness !== 'all' && row.dataset.harness !== state.harness;
      row.classList.remove('is-leader');
      if (!row.hidden) {
        visibleCount += 1;
        harnesses.add(row.dataset.harness);
        const value = Number(row.dataset[metric]);
        if (value !== previousValue) rank = visibleCount;
        previousValue = value;
        row.querySelector('.rank').textContent = String(rank).padStart(2, '0');
        row.classList.toggle('is-leader', rank === 1);
      }
      tbody.append(row);
    });
    document.querySelector('#results-status').textContent =
      `${visibleCount} ${visibleCount === 1 ? 'model' : 'models'} / ${harnesses.size} ${harnesses.size === 1 ? 'agent harness' : 'agent harnesses'}`;
    document.querySelector('#sort-status').textContent =
      `Sorted by ${metrics[metric]} · ${state.ascending ? 'ascending' : 'descending'}`;
    headings.forEach(button => {
      const active = button.dataset.sort === metric;
      const th = button.closest('th');
      if (active) th.setAttribute('aria-sort', state.ascending ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
      button.querySelector('.sort-arrow').textContent = active ? (state.ascending ? '↑' : '↓') : '↕';
    });
  }

  headings.forEach(button => button.addEventListener('click', () => {
    const metric = button.dataset.sort;
    state.ascending = state.metric === metric ? !state.ascending : ['failures', 'calls', 'cost'].includes(metric);
    state.metric = metric;
    updateResults();
  }));
  filter.addEventListener('change', () => {
    state.harness = filter.value;
    updateResults();
  });

  document.querySelector('#download-results').addEventListener('click', () => {
    const fields = ['model', 'harness', 'score', 'accuracy', 'insights', 'failures', 'calls', 'cost'];
    const columnNames = ['Model', 'Agent harness', 'Final score (conditional, %)', 'Predictive accuracy (%)', 'Scientific insights (%)', 'SC failures (out of 26)', 'Calls', 'Cost (USD)'];
    const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const allRows = [...rows].sort((a, b) => Number(b.dataset.score) - Number(a.dataset.score));
    allRows.push(document.querySelector('#human-reference'));
    const csv = [columnNames.map(csvCell).join(','), ...allRows.map(row => fields.map(field => csvCell(row.dataset[field])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eurekabench-results.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

})();
