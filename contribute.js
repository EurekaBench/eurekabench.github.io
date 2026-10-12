(() => {
  'use strict';

  function initializeContributions() {
    const form = document.getElementById('contribution-form');
    if (!form) return;

    const field = name => document.getElementById('contribution-' + name);
    const kindInput = field('kind');
    const nameInput = field('name');
    const emailInput = field('email');
    const affiliationInput = field('affiliation');
    const webpageInput = field('webpage');
    const titleInput = field('title');
    const domainInput = field('domain');
    const otherDomainInput = field('domain-other');
    const referenceInput = field('reference');
    const descriptionInput = field('description');
    const evidenceInput = field('evidence');
    const status = field('status');
    const submitButton = form.querySelector('[type="submit"]');
    const kindButtons = Array.from(document.querySelectorAll('[data-contribution-kind]'));
    const guidePanels = Array.from(document.querySelectorAll('[data-contribution-guide]'));
    const endpoint = 'https://formsubmit.co/ajax/ogeng@cs.cmu.edu';
    let sending = false;
    let submitted = false;

    const guidance = {
      problem: {
        description: 'Scientific discovery problem',
      },
      insight: {
        description: 'Scientific insights',
      },
    };

    function announce(message, state = '') {
      status.textContent = message;
      status.dataset.state = state;
    }

    function clearFeedback() {
      if (sending) return;
      submitted = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Submit';
      announce('');
    }

    function activateField(input, containerId, active) {
      document.getElementById(containerId).hidden = !active;
      input.disabled = !active;
      input.required = active;
      input.setAttribute('aria-required', String(active));
      if (!active) input.setCustomValidity('');
    }

    function updateDomainFields() {
      const isProblem = kindInput.value !== 'insight';
      activateField(titleInput, 'contribution-title-field', isProblem);
      activateField(domainInput, 'contribution-domain-field', isProblem);
      activateField(otherDomainInput, 'contribution-domain-other-field', isProblem && domainInput.value === 'Others');
      activateField(referenceInput, 'contribution-reference-field', !isProblem);
    }

    function setKind(kind) {
      if (sending) return;
      kind = kind === 'insight' ? 'insight' : 'problem';
      kindInput.value = kind;
      kindButtons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.contributionKind === kind));
      });
      guidePanels.forEach(panel => { panel.hidden = panel.dataset.contributionGuide !== kind; });
      // Update only the label text, keeping the required-field marker visible.
      field('description-label').textContent = guidance[kind].description;
      updateDomainFields();
      clearFeedback();
    }

    function buildSubmission() {
      updateDomainFields();
      const fields = [nameInput, emailInput, affiliationInput, webpageInput, titleInput, otherDomainInput, descriptionInput, evidenceInput];
      fields.forEach(input => { input.value = input.value.trim(); });
      webpageInput.setCustomValidity('');
      if (webpageInput.value) {
        try {
          const url = new URL(webpageInput.value);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
        } catch {
          webpageInput.setCustomValidity('Enter a full http:// or https:// URL.');
        }
      }
      if (!form.reportValidity()) return null;
      if (form.elements.namedItem('_honey').value) {
        announce('Unable to submit this form. Please contact ogeng@cs.cmu.edu.', 'error');
        return null;
      }

      const isInsight = kindInput.value === 'insight';
      const type = isInsight ? 'Additional scientific insights for an existing scientific discovery problem' : 'New scientific discovery problem';
      const subjectTitle = isInsight ? referenceInput.value : titleInput.value;
      const payload = {
        name: nameInput.value,
        email: emailInput.value,
        Affiliation: affiliationInput.value,
        'Personal webpage': webpageInput.value,
        'Contribution type': type,
        'Supporting links': evidenceInput.value || 'Not provided',
        _subject: '[EurekaBench contribution] ' + type + ': ' + subjectTitle.replace(/[\r\n]+/g, ' '),
        _replyto: emailInput.value,
        _template: 'table',
        _url: 'https://eurekabench.github.io/contribute.html',
        _honey: '',
      };
      if (isInsight) {
        payload['Existing scientific discovery problem'] = referenceInput.value;
        payload['Scientific insights'] = descriptionInput.value;
      } else {
        payload.Title = titleInput.value;
        payload.Domain = domainInput.value === 'Others' ? otherDomainInput.value : domainInput.value;
        payload['Scientific discovery problem'] = descriptionInput.value;
      }
      return payload;
    }

    kindButtons.forEach(button => {
      button.addEventListener('click', () => setKind(button.dataset.contributionKind));
    });
    domainInput.addEventListener('change', () => {
      if (sending) return;
      updateDomainFields();
      clearFeedback();
    });
    webpageInput.addEventListener('input', () => webpageInput.setCustomValidity(''));
    form.addEventListener('input', clearFeedback);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || submitted) return;
      const payload = buildSubmission();
      if (!payload) return;

      sending = true;
      form.setAttribute('aria-busy', 'true');
      const controls = [...form.querySelectorAll('input, select, textarea, button'), ...kindButtons];
      const previousDisabled = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      submitButton.textContent = 'Submitting…';
      announce('Submitting…');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await response.json();
        const serviceMessage = typeof result.message === 'string' ? result.message : '';
        // FormSubmit returns success: "false" until the receiving address is activated.
        // Keep the form available so it can be retried after activation without retyping.
        if (response.ok && /activat|check your email|confirm.{0,24}(email|form)/i.test(serviceMessage)) {
          announce('Email delivery is awaiting activation by the EurekaBench team. Your entries have been kept. You can submit again after activation.', 'pending');
          return;
        }
        const accepted = response.ok && (result.success === true || result.success === 'true');
        if (!accepted) {
          const reason = serviceMessage ? ' ' + serviceMessage : '';
          announce('Your contribution could not be submitted.' + reason + ' Your entries have been kept. Please try again or contact ogeng@cs.cmu.edu.', 'error');
          return;
        }

        submitted = true;
        announce('Your contribution has been submitted. We\'ll follow up at ' + payload.email + '.', 'success');
      } catch {
        announce('We couldn\'t confirm your submission. Your entries are still here. Please try again or contact ogeng@cs.cmu.edu.', 'error');
      } finally {
        clearTimeout(timeout);
        sending = false;
        form.removeAttribute('aria-busy');
        controls.forEach((control, index) => { control.disabled = previousDisabled[index]; });
        submitButton.disabled = submitted;
        submitButton.textContent = submitted ? 'Submitted' : 'Submit';
      }
    });

    const requestedKind = new URLSearchParams(window.location.search).get('kind');
    setKind(requestedKind === 'insight' ? 'insight' : kindInput.value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContributions, { once: true });
  } else {
    initializeContributions();
  }
})();
