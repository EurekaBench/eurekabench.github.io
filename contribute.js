(() => {
  'use strict';

  function initializeContributions() {
    const form = document.getElementById('contribution-form');
    if (!form) return;

    const kindInput = document.getElementById('contribution-kind');
    const nameInput = document.getElementById('contribution-name');
    const affiliationInput = document.getElementById('contribution-affiliation');
    const webpageInput = document.getElementById('contribution-webpage');
    const titleInput = document.getElementById('contribution-title');
    const domainInput = document.getElementById('contribution-domain');
    const otherDomainInput = document.getElementById('contribution-domain-other');
    const referenceInput = document.getElementById('contribution-reference');
    const descriptionInput = document.getElementById('contribution-description');
    const evidenceInput = document.getElementById('contribution-evidence');
    const status = document.getElementById('contribution-status');
    const draft = document.getElementById('contribution-draft');
    const copyButton = document.getElementById('copy-contribution');
    const kindButtons = Array.from(document.querySelectorAll('[data-contribution-kind]'));
    const email = 'ogeng@cs.cmu.edu';

    if (![kindInput, nameInput, affiliationInput, webpageInput, titleInput, domainInput, otherDomainInput, referenceInput, descriptionInput, evidenceInput].every(Boolean)) return;

    const guidance = {
      problem: {
        title: 'Problem title',
        description: 'Problem description',
        descriptionHelp: 'Describe the scientific question, available experiments or data, and how progress or a solution could be evaluated.',
      },
      insight: {
        title: 'Insight title',
        description: 'Insight and verification',
        descriptionHelp: 'Explain the proposed insight, its connection to the existing problem, and how it can be verified or reproduced.',
      },
    };

    function setText(id, text) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    }

    function announce(message) {
      if (status) status.textContent = message;
    }

    function activateField(input, containerId, active) {
      const container = document.getElementById(containerId);
      if (container) container.hidden = !active;
      input.disabled = !active;
      input.required = active;
      input.setAttribute('aria-required', String(active));
      if (!active) input.setCustomValidity('');
    }

    function updateDomainFields() {
      const isProblem = kindInput.value !== 'insight';
      activateField(domainInput, 'contribution-domain-field', isProblem);
      activateField(otherDomainInput, 'contribution-domain-other-field', isProblem && domainInput.value === 'Others');
      activateField(referenceInput, 'contribution-reference-field', !isProblem);
    }

    function setKind(kind) {
      kind = kind === 'insight' ? 'insight' : 'problem';
      kindInput.value = kind;
      const labels = guidance[kind];

      kindButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.contributionKind === kind));
      });

      setText('contribution-title-label', labels.title);
      setText('contribution-description-label', labels.description);
      setText('contribution-description-help', labels.descriptionHelp);

      [nameInput, affiliationInput, webpageInput, titleInput, descriptionInput].forEach(input => {
        input.required = true;
        input.setAttribute('aria-required', 'true');
      });
      updateDomainFields();

      if (draft) draft.hidden = true;
      announce('');
    }

    function buildDraft() {
      updateDomainFields();
      const fields = [nameInput, affiliationInput, webpageInput, titleInput, otherDomainInput, referenceInput, descriptionInput, evidenceInput];
      fields.forEach((field) => { field.value = field.value.trim(); });
      webpageInput.setCustomValidity('');
      if (webpageInput.value) {
        try {
          const webpage = new URL(webpageInput.value);
          if (!['http:', 'https:'].includes(webpage.protocol)) throw new Error('Unsupported protocol');
        } catch {
          webpageInput.setCustomValidity('Enter a full http:// or https:// URL.');
        }
      }
      if (!form.reportValidity()) return null;

      const isInsight = kindInput.value === 'insight';
      const domain = domainInput.value === 'Others' ? otherDomainInput.value : domainInput.value;
      const type = isInsight ? 'New insight' : 'New problem';
      // Keep the email subject on one line; preserve paragraphs in the body.
      const subject = `[EurekaBench contribution] ${type}: ${titleInput.value.replace(/[\r\n]+/g, ' ')}`;
      const body = [
        'Hello EurekaBench team,',
        '',
        `I would like to contribute a ${isInsight ? 'new insight' : 'new scientific problem'} to EurekaBench.`,
        '',
        `Contributor: ${nameInput.value}`,
        `Affiliation: ${affiliationInput.value}`,
        `Personal webpage: ${webpageInput.value}`,
        `Contribution type: ${type}`,
        `Title: ${titleInput.value}`,
        isInsight ? `Existing problem ID: ${referenceInput.value}` : `Domain: ${domain}`,
        '',
        isInsight ? 'INSIGHT AND VERIFICATION' : 'SCIENTIFIC QUESTION AND EVALUATION',
        descriptionInput.value,
        '',
        'SUPPORTING EVIDENCE AND LINKS',
        evidenceInput.value || 'Not provided',
        '',
        'Thank you,',
        nameInput.value,
      ].join('\n');

      return { subject, body, text: `To: ${email}\nSubject: ${subject}\n\n${body}` };
    }

    function showDraft(text) {
      if (!draft) {
        announce('Copying is unavailable. Use Open email draft to review your contribution in your email app.');
        return;
      }
      draft.value = text;
      draft.readOnly = true;
      draft.hidden = false;
      draft.focus();
      draft.select();
      draft.setSelectionRange(0, draft.value.length);
      announce('The full draft is selected below. Press ⌘C or Ctrl+C to copy it.');
    }

    kindButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        setKind(button.dataset.contributionKind);
      });
    });

    domainInput.addEventListener('change', () => {
      updateDomainFields();
      if (draft) draft.hidden = true;
      announce('');
    });
    webpageInput.addEventListener('input', () => webpageInput.setCustomValidity(''));
    form.addEventListener('input', () => {
      if (draft) draft.hidden = true;
      announce('');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const contribution = buildDraft();
      if (!contribution) return;

      const mailto = `mailto:${email}?subject=${encodeURIComponent(contribution.subject)}&body=${encodeURIComponent(contribution.body)}`;
      if (draft) {
        draft.value = contribution.text;
        draft.hidden = true;
      }
      announce('Review and send the draft in your email app. If it does not open, use Copy draft.');
      try {
        window.location.href = mailto;
      } catch {
        showDraft(contribution.text);
      }
    });

    if (copyButton) {
      copyButton.addEventListener('click', async (event) => {
        event.preventDefault();
        const contribution = buildDraft();
        if (!contribution) return;

        try {
          if (!navigator.clipboard || !window.isSecureContext) {
            showDraft(contribution.text);
            return;
          }
          await navigator.clipboard.writeText(contribution.text);
          if (draft) draft.hidden = true;
          announce(`Draft copied. Paste it into an email to ${email}, then review and send.`);
        } catch {
          showDraft(contribution.text);
        }
      });
    }

    setKind(kindInput.value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContributions, { once: true });
  } else {
    initializeContributions();
  }
})();
