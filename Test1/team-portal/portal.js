(() => {
  'use strict';

  // The UI talks only to same-origin, authenticated server routes. Secrets and GitHub
  // credentials must never be placed in this browser script.
  const API = '/api/portal';
  const el = (id) => document.getElementById(id);
  const ui = {
    signIn: el('signInDialog'), run: el('runDialog'), detail: el('detailDialog'),
    rows: el('reportRows'), date: el('reportDate'), summary: el('filterSummary'), toast: el('toast'),
  };
  let session = null;
  let reports = [];
  let toastTimer;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const dateLabel = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };
  const durationLabel = (ms) => {
    const seconds = Math.max(0, Number(ms || 0)) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} sec`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min ${Math.round(seconds % 60)} sec`;
  };
  const showToast = (message, isError = false) => {
    ui.toast.textContent = message;
    ui.toast.classList.toggle('error', isError);
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3600);
  };
  const api = async (action, options = {}) => {
    const response = await fetch(`${API}/${action}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    let body = {};
    try { body = await response.json(); } catch { /* Error text is intentionally not rendered as HTML. */ }
    if (response.status === 401) {
      session = null;
      if (!ui.signIn.open) ui.signIn.showModal();
    }
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
    return body;
  };

  function renderSummary() {
    const passed = reports.filter((report) => report.status === 'passed').length;
    const attention = reports.filter((report) => ['failed', 'timedOut', 'interrupted'].includes(report.status)).length;
    const latest = reports.reduce((value, report) => !value || new Date(report.startedAt) > new Date(value.startedAt) ? report : value, null);
    el('latestRun').textContent = latest ? dateLabel(latest.startedAt).replace(/,? \d{1,2}:\d{2}.*$/, '') : '—';
    el('latestRunNote').textContent = latest ? `${latest.suiteLabel || 'Test run'} · ${latest.runNumber ? `Run #${latest.runNumber}` : 'Latest report'}` : 'No report for this date';
    el('passedCount').textContent = String(passed);
    el('passedNote').textContent = `${reports.length ? Math.round((passed / reports.length) * 100) : 0}% of ${reports.length} tests passed`;
    el('attentionCount').textContent = String(attention);
    el('attentionNote').textContent = attention ? 'Open a report to see what happened' : 'No failures in this selection';
    el('durationValue').textContent = latest ? durationLabel(latest.runDurationMs || latest.durationMs) : '—';
  }

  function renderReports() {
    const selected = ui.date.value;
    const filtered = selected ? reports.filter((report) => String(report.startedAt || '').slice(0, 10) === selected) : reports;
    ui.summary.textContent = selected ? `Showing ${filtered.length} report${filtered.length === 1 ? '' : 's'} for ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${selected}T00:00:00Z`))}` : 'Showing the latest available reports';
    el('reportCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'report' : 'reports'}`;
    renderSummaryFor(filtered);
    if (!filtered.length) {
      ui.rows.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">◷</span><b>${selected ? 'No reports for this date' : 'No reports available yet'}</b><span>${selected ? 'Choose another date or clear the filter to see more reports.' : 'Start a workflow run and its reports will appear here.'}</span>${selected ? '<button class="outline-button" data-action="clear-date">Clear date filter</button>' : '<button class="outline-button" data-action="run">Start a test run</button>'}</div></td></tr>`;
      return;
    }
    ui.rows.innerHTML = filtered.map((report) => {
      const booking = /booking/i.test(`${report.testName} ${report.suiteLabel}`);
      const status = report.status || 'unknown';
      const attachmentCount = (report.steps || []).reduce((sum, step) => sum + (step.attachments || []).length, 0);
      const evidence = [report.video ? 'Video' : '', attachmentCount ? `${attachmentCount} screenshots` : ''].filter(Boolean).join(' · ') || 'Step-by-step report';
      return `<tr><td><div class="test-cell"><span class="test-symbol ${booking ? 'booking' : ''}">${booking ? '◉' : '✓'}</span><span><span class="test-title">${escapeHtml(report.testName || report.title || 'Playwright test')}</span><span class="test-subtitle">${escapeHtml(report.suiteLabel || 'Cinescape web test')}</span></span></div></td><td><span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status === 'timedOut' ? 'Timed out' : status)}</span></td><td class="when-cell">${dateLabel(report.startedAt)}</td><td class="duration-cell">${durationLabel(report.durationMs)}</td><td>${escapeHtml(evidence)}</td><td><button class="details-button" data-action="details" data-id="${escapeHtml(report.id)}">View report&nbsp; →</button></td></tr>`;
    }).join('');
  }

  function renderSummaryFor(selectedReports) {
    // Preserve the summary as a date-level rollup, using the filtered records.
    const all = reports;
    reports = selectedReports;
    renderSummary();
    reports = all;
  }

  function renderDetail(report) {
    const steps = report.steps || [];
    const passedSteps = steps.filter((step) => !['failed', 'timedOut'].includes(step.status)).length;
    const screenshots = steps.flatMap((step) => (step.attachments || []).filter((item) => item.kind === 'image').map((item) => ({ ...item, stepTitle: step.title })));
    const timeline = steps.length ? steps.map((step) => `<li class="step-row"><span class="step-marker ${['failed', 'timedOut'].includes(step.status) ? 'failed' : ''}">${['failed', 'timedOut'].includes(step.status) ? '!' : '✓'}</span><span class="step-copy"><b>${escapeHtml(step.title || 'Test step')}</b>${step.error ? `<p>${escapeHtml(step.error)}</p>` : ''}</span><span class="step-time">${durationLabel(step.durationMs)}</span></li>`).join('') : '<li class="step-row"><span class="step-copy"><b>Detailed step data is not available for this report.</b><p>The workflow must retain the Playwright JSON report to show the full timeline.</p></span></li>';
    const imageGrid = screenshots.length ? `<div class="evidence-grid">${screenshots.map((item) => `<div><p class="evidence-label">${escapeHtml(item.stepTitle)} · ${escapeHtml(item.name || 'Screenshot')}</p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><img class="evidence-image" loading="lazy" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || item.stepTitle || 'Test screenshot')}"></a></div>`).join('')}</div>` : '<p class="dialog-description">Screenshots are not attached to this report.</p>';
    const video = report.video?.url ? `<section class="detail-section"><h3>Transaction recording</h3><video class="video-player" controls preload="metadata"><source src="${escapeHtml(report.video.url)}" type="${escapeHtml(report.video.contentType || 'video/webm')}">Video playback is not supported by this browser.</video><p class="evidence-label">${escapeHtml(report.video.name || 'Playwright recording')} · ${durationLabel(report.video.durationMs || 0)}</p></section>` : '';
    el('reportDetail').innerHTML = `<div class="detail-heading"><div class="eyebrow">${escapeHtml(report.suiteLabel || 'TEST REPORT')} · ${escapeHtml(report.runNumber ? `RUN #${report.runNumber}` : 'EXECUTION DETAILS')}</div><h2>${escapeHtml(report.testName || report.title || 'Playwright test')}</h2><div class="detail-meta"><span class="status-pill status-${escapeHtml(report.status || 'unknown')}">${escapeHtml(report.status || 'unknown')}</span><span>${dateLabel(report.startedAt)}</span><span>${durationLabel(report.durationMs)}</span><span>${escapeHtml(report.browser || 'Chromium')}</span></div></div><p class="dialog-description">${escapeHtml(report.summary || (report.status === 'passed' ? 'This test completed successfully.' : 'Review the timeline and evidence below to understand this result.'))}</p><div class="detail-summary"><div class="detail-metric"><small>Steps completed</small><b>${passedSteps} / ${steps.length || '—'}</b></div><div class="detail-metric"><small>Result</small><b>${escapeHtml(report.status || 'Unknown')}</b></div><div class="detail-metric"><small>Run number</small><b>${escapeHtml(report.runNumber ? `#${report.runNumber}` : '—')}</b></div></div><section class="detail-section"><h3>What happened, step by step</h3><ol class="step-list">${timeline}</ol></section><section class="detail-section"><h3>Screenshots and evidence</h3>${imageGrid}</section>${video}<section class="detail-section"><h3>Need help understanding this result?</h3><p class="dialog-description">A green <b>Passed</b> result means every check completed as expected. A red <b>Failed</b> result means a check did not match what the test expected. Use the first failed step and its screenshot or video to see where the flow stopped.</p></section>`;
    ui.detail.showModal();
  }

  async function loadReports() {
    const refresh = el('refreshReports');
    refresh.disabled = true;
    try {
      const query = ui.date.value ? `?date=${encodeURIComponent(ui.date.value)}` : '';
      const data = await api(`reports${query}`);
      reports = Array.isArray(data.reports) ? data.reports : [];
      renderReports();
    } catch (error) {
      if (error.message !== 'Unauthorized') showToast(error.message || 'Could not load reports.', true);
    } finally { refresh.disabled = false; }
  }

  async function refreshSession() {
    try {
      session = await api('session');
      el('signOut').hidden = false;
      document.querySelector('.profile-copy b').textContent = session.displayName || session.email || 'Team member';
      document.querySelector('.profile-copy small').textContent = session.isAdmin ? 'Team administrator' : 'Approved team member';
      document.querySelectorAll('.avatar').forEach((avatar) => { avatar.textContent = session.initials || 'TM'; });
      document.querySelectorAll('.admin-only').forEach((node) => { node.style.display = session.isAdmin ? 'inline-flex' : 'none'; });
      if (ui.signIn.open) ui.signIn.close();
      await loadReports();
    } catch { session = null; if (!ui.signIn.open) ui.signIn.showModal(); }
  }

  el('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = el('emailInput').value.trim();
    const message = el('authMessage');
    message.className = 'form-message';
    try {
      await api('auth/login', { method: 'POST', body: JSON.stringify({ username: email, password: el('passwordInput').value }) });
      el('passwordInput').value = '';
      message.textContent = 'Signed in. Loading your reports…';
      await refreshSession();
    } catch (error) { message.textContent = error.message; message.classList.add('error'); }
  });

  el('signOut').addEventListener('click', async () => {
    try { await api('auth/logout', { method: 'POST', body: '{}' }); } catch { /* Local UI still returns to sign in. */ }
    session = null; reports = []; el('passwordInput').value = ''; renderReports(); ui.signIn.showModal();
  });
  el('reportDate').addEventListener('change', loadReports);
  el('clearDate').addEventListener('click', () => { ui.date.value = ''; loadReports(); });
  el('refreshReports').addEventListener('click', loadReports);
  el('emptyRefresh').addEventListener('click', loadReports);
  el('runTests').addEventListener('click', () => ui.run.showModal());
  el('confirmRun').addEventListener('click', async () => {
    const button = el('confirmRun');
    const suite = document.querySelector('input[name="suite"]:checked')?.value || 'all';
    const message = el('runMessage');
      button.disabled = true; message.className = 'form-message'; message.textContent = 'Starting Playwright on this computer…';
    try {
      const result = await api('runs', { method: 'POST', body: JSON.stringify({ suite }) });
      message.classList.add('success'); message.textContent = `Run #${result.runNumber || 'started'} queued successfully.`;
      showToast('Local test run started. This page will update when the report is ready.');
      pollRun();
    } catch (error) { message.classList.add('error'); message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  async function pollRun() {
    try {
      const state = await api('run-status');
      if (state.running) { setTimeout(pollRun, 5000); return; }
      await loadReports();
      el('runMessage').textContent = 'Run finished. The updated reports are ready.';
      showToast('Test run finished. Reports have been added to history.');
    } catch { /* Session expiry is handled by api(). */ }
  }
  document.querySelectorAll('.suite-option').forEach((option) => option.addEventListener('click', () => {
    document.querySelectorAll('.suite-option').forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked = true;
  }));
  el('reportRows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'details') {
      const report = reports.find((item) => String(item.id) === button.dataset.id);
      if (report) renderDetail(report);
    } else if (button.dataset.action === 'clear-date') { ui.date.value = ''; loadReports(); }
    else if (button.dataset.action === 'run') ui.run.showModal();
  });
  document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    const hash = link.getAttribute('href');
    if (hash === '#reports' || hash === '#overview') return;
    event.preventDefault();
    showToast(hash === '#runs' ? 'Run history is shown in the report list. Use the date filter to find a run.' : 'Each report includes a plain-language guide to its result.');
  }));

  // Initialize the shell. When deployed, the session endpoint gates report data;
  // the HTML itself contains no private results.
  refreshSession();
})();
