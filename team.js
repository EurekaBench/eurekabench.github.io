/* Keep institution references usable within the team page and from direct URLs. */
(() => {
  'use strict';

  function initializeAffiliations() {
    const affiliations = document.getElementById('full-affiliations');
    if (!affiliations) return;

    document.querySelectorAll('.author-affiliations').forEach(link => {
      link.addEventListener('click', () => {
        affiliations.open = true;
      });
    });

    function openAffiliationFromHash() {
      if (!/^#affiliation-\d+$/.test(location.hash)) return;
      const target = document.getElementById(location.hash.slice(1));
      if (!target || !affiliations.contains(target)) return;
      affiliations.open = true;
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }

    openAffiliationFromHash();
    window.addEventListener('hashchange', openAffiliationFromHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAffiliations, { once: true });
  } else {
    initializeAffiliations();
  }
})();
