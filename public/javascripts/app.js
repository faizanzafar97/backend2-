(function () {
  'use strict';

  function readStorage(storage, key) {
    try { return window[storage].getItem(key); } catch (_) { return null; }
  }
  function writeStorage(storage, key, value) {
    try { window[storage].setItem(key, value); } catch (_) { /* Storage is optional. */ }
  }

  const themeButtons = document.querySelectorAll('[data-theme-toggle]');
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeButtons.forEach(function (button) {
      const label = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }
  setTheme(readStorage('localStorage', 'nest:theme') === 'dark' ? 'dark' : 'light');
  themeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(theme);
      writeStorage('localStorage', 'nest:theme', theme);
    });
  });

  const tabList = document.querySelector('.auth-tabs');
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = document.querySelectorAll('[data-panel]');
  function selectTab(name, focus) {
    if (!tabs.some(function (tab) { return tab.dataset.tab === name; })) return;
    tabs.forEach(function (tab) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'tab-' + panel.dataset.panel);
    });
  }
  if (tabList) {
    tabList.hidden = false;
    const requestedTab = location.hash.slice(1);
    const previousTab = readStorage('sessionStorage', 'nest:pending-tab');
    selectTab(requestedTab === 'register' || requestedTab === 'login' ? requestedTab : previousTab === 'register' ? 'register' : 'login');
    // The saved choice is only needed for the redirect after a failed submission.
    writeStorage('sessionStorage', 'nest:pending-tab', '');
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { selectTab(tab.dataset.tab); });
      tab.addEventListener('keydown', function (event) {
        let nextIndex;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex !== undefined) {
          event.preventDefault();
          selectTab(tabs[nextIndex].dataset.tab, true);
        }
      });
    });
    document.querySelectorAll('[data-switch-tab]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        selectTab(link.dataset.switchTab, true);
      });
    });
    window.addEventListener('hashchange', function () { selectTab(location.hash.slice(1)); });
  }

  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    button.hidden = false;
    button.addEventListener('click', function () {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(reveal));
      button.setAttribute('aria-label', (reveal ? 'Hide' : 'Show') + (input.name === 'secret' ? ' secret' : ' password'));
    });
  });

  const password = document.getElementById('register-password');
  const meter = document.querySelector('[data-password-meter]');
  const guidance = document.querySelector('[data-password-guidance]');
  if (password && meter && guidance) {
    password.addEventListener('input', function () {
      const value = password.value;
      const strength = Number(value.length >= 8) + Number(value.length >= 12) + Number(/[a-z]/.test(value) && /[A-Z]/.test(value)) + Number(/\d/.test(value) && /[^a-zA-Z\d]/.test(value));
      meter.hidden = !value;
      meter.dataset.strength = String(strength);
      Array.from(meter.children).forEach(function (segment, index) { segment.classList.toggle('filled', index < Math.max(1, strength)); });
      guidance.textContent = !value ? 'Tip: use 8+ characters with a mix of letters and numbers.' : ['Try a longer password with mixed characters.', 'A start. Add more length and variety.', 'Getting better. A few more characters can help.', 'Good length and variety.', 'Great length and variety.'][strength];
    });
  }

  document.querySelectorAll('[data-auth-form]').forEach(function (form) {
    const username = form.elements.namedItem('username');
    username.addEventListener('input', function () {
      username.setCustomValidity(username.value && !username.value.trim() ? 'Please enter a username.' : '');
    });
    username.addEventListener('blur', function () { username.value = username.value.trim(); });
    const capsWarning = form.querySelector('[data-caps-warning]');
    const passwordInput = form.elements.namedItem('password');
    function updateCaps(event) { if (capsWarning && event.getModifierState) capsWarning.hidden = !event.getModifierState('CapsLock'); }
    passwordInput.addEventListener('keydown', updateCaps);
    passwordInput.addEventListener('keyup', updateCaps);
    passwordInput.addEventListener('blur', function () { if (capsWarning) capsWarning.hidden = true; });
    const button = form.querySelector('[type="submit"]');
    const label = button.querySelector('[data-button-label]');
    const originalLabel = label.textContent;
    form.addEventListener('submit', function () {
      username.value = username.value.trim();
      writeStorage('sessionStorage', 'nest:pending-tab', form.closest('[data-panel]').dataset.panel);
      button.disabled = true;
      button.classList.add('is-submitting');
      form.setAttribute('aria-busy', 'true');
      label.textContent = form.getAttribute('action') === '/login' ? 'Signing you in…' : 'Making room for you…';
    });
    window.addEventListener('pageshow', function () {
      button.disabled = false;
      button.classList.remove('is-submitting');
      form.removeAttribute('aria-busy');
      label.textContent = originalLabel;
    });
  });

  document.querySelectorAll('[data-dismiss-alert]').forEach(function (button) {
    button.addEventListener('click', function () {
      button.closest('[data-alert]').remove();
      const target = document.querySelector('[role="tab"][aria-selected="true"]');
      if (target) target.focus();
    });
  });

  const date = document.querySelector('[data-live-date]');
  if (date) {
    const now = new Date();
    date.dateTime = now.toISOString();
    date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now);
  }
  document.querySelectorAll('.side-nav .nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      document.querySelectorAll('.side-nav .nav-link').forEach(function (item) {
        item.classList.toggle('active', item === link);
        if (item === link) item.setAttribute('aria-current', 'location');
        else item.removeAttribute('aria-current');
      });
    });
  });

  const secretButton = document.querySelector('[data-secret-toggle]');
  const secretValue = document.querySelector('[data-secret-value]');
  const secretMask = document.querySelector('[data-secret-mask]');
  if (secretButton && secretValue && secretMask) {
    secretButton.hidden = false;
    secretButton.addEventListener('click', function () {
      const reveal = secretValue.hidden;
      secretValue.hidden = !reveal;
      secretMask.hidden = reveal;
      secretButton.setAttribute('aria-expanded', String(reveal));
      secretButton.textContent = reveal ? 'Hide my note ↗' : 'Reveal my note ↗';
    });
  }
  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3000);
  }
  const copyButton = document.querySelector('[data-copy-username]');
  if (copyButton && navigator.clipboard && navigator.clipboard.writeText) {
    copyButton.hidden = false;
    copyButton.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(copyButton.parentElement.querySelector('span').textContent);
        showToast('Username copied.');
      } catch (_) { showToast('Copy is unavailable. Select your username to copy it.'); }
    });
  }
  document.querySelectorAll('[data-reload]').forEach(function (button) {
    button.hidden = false;
    button.addEventListener('click', function () { location.reload(); });
  });
})();
