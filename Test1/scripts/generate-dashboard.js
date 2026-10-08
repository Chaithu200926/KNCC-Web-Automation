// Builds dashboard/index.html from Playwright's JSON results: summary tiles, a trend chart across runs,
// run & environment info, an overview table, and one card per test with its steps, screenshots and video.
// Also writes dashboard/summary.md and, on GitHub Actions, adds it to the run page (job summary).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Project folder; load .env so the site under test can be shown.
const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

// Input (Playwright JSON results), output folder, screenshot/video folder and run history.
const resultsPath = path.join(root, 'test-results', 'results.json');
const outputDir = path.join(root, 'dashboard');
const assetDir = path.join(outputDir, 'assets');
// On GitHub the workflow restores the history from its cache and points HISTORY_FILE at it.
const historyPath = process.env.HISTORY_FILE || path.join(outputDir, 'history.json');
const HISTORY_LIMIT = 30;

// Stop early if the tests have not been run yet.
if (!fs.existsSync(resultsPath)) {
  console.error(`No results found at ${resultsPath}. Run "npm test" first.`);
  process.exit(1);
}
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Remove screenshots/videos from the previous build so old files are not published.
if (fs.existsSync(assetDir)) {
  for (const fileName of fs.readdirSync(assetDir)) {
    if (/^test-\d+-(?:snapshot-\d+\.png|video(?:-\d+)?\.[^.]+)$/i.test(fileName)) fs.unlinkSync(path.join(assetDir, fileName));
  }
}

// ---------- collect tests ----------
// One entry per test with everything the dashboard shows.
const tests = [];

// Remove terminal colour codes from error messages.
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

// Turn nested test steps into a flat list; each title includes its parents ("A › B").
function flattenSteps(steps, parentTitles = []) {
  return (steps || []).flatMap((step) => {
    const title = [...parentTitles, step.title].join(' › ');
    const current = { title, duration: step.duration || 0, failed: !!step.error, error: stripAnsi(step.error?.message) };
    return [current, ...flattenSteps(step.steps, [...parentTitles, step.title])];
  });
}

// Save each screenshot a test attached (inline or as a file) as a PNG file in dashboard/assets.
function writeSnapshots(attachments, testIndex) {
  return (attachments || [])
    .filter((a) => a.contentType === 'image/png' && (a.body || (a.path && fs.existsSync(a.path))))
    .map((a, i) => {
      const fileName = `test-${testIndex + 1}-snapshot-${i + 1}.png`;
      fs.mkdirSync(assetDir, { recursive: true });
      if (a.body) fs.writeFileSync(path.join(assetDir, fileName), Buffer.from(a.body, 'base64'));
      else fs.copyFileSync(a.path, path.join(assetDir, fileName));
      return { name: a.name, path: `assets/${fileName}` };
    });
}

// Copy the test's videos (the test page, and a second user's browser if any) into dashboard/assets.
function writeVideos(attachments, testIndex) {
  return (attachments || [])
    .filter((x) => x.contentType?.startsWith('video/') && x.path && fs.existsSync(x.path))
    .map((a, i) => {
      const fileName = `test-${testIndex + 1}-video${i ? `-${i + 1}` : ''}${path.extname(a.path) || '.webm'}`;
      fs.mkdirSync(assetDir, { recursive: true });
      fs.copyFileSync(a.path, path.join(assetDir, fileName));
      return { name: a.name === 'video' ? 'Test video' : a.name, contentType: a.contentType, path: `assets/${fileName}` };
    });
}

// Which step each named screenshot belongs to (screenshot name → end of the step title).
const snapshotStepMap = {
  '01-movie-book-now': 'STEP 1 - CLICK BOOK NOW',
  '02-experience': 'STEP 2 - CHOOSE CINESCAPE 360 EXPERIENCE',
  '03-date': 'STEP 3 - CHOOSE TOMORROW',
  '04-time': 'STEP 4 - CHOOSE TIME',
  '06-login-form': 'STEP 6 - SIGN-IN FORM',
  '07-submit-sign-in': 'STEP 7 - SUBMIT SIGN-IN',
  '08-email-otp-form': 'STEP 8 - ENTER EMAIL OTP',
  '09-submit-email-otp': 'STEP 9 - VERIFY EMAIL OTP',
  '10-date-after-sign-in': 'STEP 10 - RESELECT TOMORROW AFTER SIGN-IN',
  '10-date-selected-after-sign-in': 'STEP 10A - VERIFY TOMORROW REMAINS SELECTED',
  '11-seat-category': 'STEP 11 - CHOOSE GENERAL SEAT CATEGORY',
  '12-seat-type': 'STEP 12 - CHOOSE STANDARD SEAT TYPE',
  '13-ticket-proceed': 'STEP 13 - PROCEED TO SEAT MAP',
  '14-seat': 'STEP 14 - CHOOSE AVAILABLE SEAT',
  '15-seat-proceed': 'STEP 15 - PROCEED FROM SEAT MAP',
  '17-food-proceed': 'STEP 17 - CONTINUE WITHOUT FOOD',
  '17-food-skipped': 'STEP 17 - FOOD STEP ALREADY SKIPPED',
  '18-open-wallet': 'STEP 18 - OPEN WALLET PAYMENT',
  '19-wallet-apply': 'STEP 19 - APPLY WALLET BALANCE',
  '20-confirm-booking': 'STEP 20 - CONFIRM BOOKING',
  // KNET booking test (web-04-cinema-booking-with-knet.spec.ts).
  '18-select-knet': 'STEP 18 - SELECT KNET PAYMENT',
  '19-knet-proceed': 'STEP 19 - PROCEED TO KNET',
  '19a-knet-page': 'STEP 19A - KNET PAYMENT PAGE',
  '19b-knet-details': 'STEP 19B - ENTER KNET CARD DETAILS',
  '19c-knet-submit': 'STEP 19C - SUBMIT KNET PAYMENT',
  '19d-knet-confirm': 'STEP 19D - CONFIRM KNET PAYMENT',
  '20-booking-date-confirmed': 'STEP 20A - VERIFY BOOKING DATE',
  '21-my-profile': 'STEP 21 - OPEN MY PROFILE',
  '22-my-profile': 'STEP 22 - MY PROFILE OPENED',
  '23-bookings': 'STEP 23 - OPEN BOOKINGS',
  '24-booking-found': 'STEP 24 - FIND NEW MOVIE BOOKING',
  '25-cancel-booking': 'STEP 25 - CANCEL BOOKING',
  '26-confirm-cancellation': 'STEP 26 - CONFIRM CANCELLATION',
  '27-booking-cancelled': 'STEP 27 - CANCELLATION COMPLETE - NO ACTIVE BOOKING',
  '01-home-page-loaded': 'Verify the home page is ready',
  '02-book-now-selected-before-click': 'Open the first movie session',
  '03-date-and-time-selection-loaded': 'Verify date and time selection is available',
  'homepage-loaded': 'Verify the homepage is available',
  'header-cinescape-verified': 'Verify the Cinescape header',
  'search-control-before-click': 'Click and verify Search',
  'search-expanded': 'Click and verify Search',
  'search-closed': 'Click and verify Search',
  'language-control-before-click': 'Click Arabic button and verify the Arabic homepage',
  'arabic-homepage-verified': 'Click Arabic button and verify the Arabic homepage',
  'english-homepage-restored': 'Return to English homepage',
  'profile-sign-in-dialog': 'Click and verify My Profile',
  'returned-to-homepage': 'Click and verify My Profile',
  'menu-opened': 'Click and verify Menu',
  'menu-closed': 'Click and verify Menu',
};

// Footer screenshots are named by pattern, so work out their step title from the name.
function footerStepTitle(name) {
  const header = name.match(/^footer-header-(.+)$/i);
  if (header) return `Verify footer header ${header[1].replaceAll('-', ' ').toUpperCase()}`;
  const link = name.match(/^footer-\d+-(.+)-(click|landed|returned)$/i);
  if (!link) return '';
  const linkName = link[1].replaceAll('-', ' ').toUpperCase();
  return linkName === 'SIGN IN' || linkName === 'REGISTER' ? `Verify footer ${linkName} button` : `Click and verify footer ${linkName}`;
}

// Walk the results tree (files → suites → tests) and gather each test's data.
function collect(suite, ancestors = []) {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      // Use the last attempt of the test.
      const r = t.results?.[t.results.length - 1] || {};
      const index = tests.length;
      const snapshots = writeSnapshots(r.attachments, index);
      // Keep only real test steps: drop Playwright's hooks, fixtures and attachment records.
      const steps = flattenSteps(r.steps).filter(
        (s) => !s.title.split(' › ').some((part) => /^(Before Hooks|After Hooks|Worker Cleanup|Fixture |Attach ")/i.test(part)),
      );
      // Put each screenshot under the step it belongs to; the others (e.g. a second user's screen, the last screen)
      // are listed separately.
      const otherSnapshots = [];
      for (const snap of snapshots) {
        // Mapped names first; otherwise a screenshot named after its step title goes under that step (the WEB-xx tests).
        const target = snapshotStepMap[snap.name] || footerStepTitle(snap.name) || snap.name;
        const step = target && steps.find((s) => s.title.endsWith(target));
        if (step) (step.snapshots ||= []).push(snap);
        else otherSnapshots.push(snap);
      }
      // Notes the test recorded (booking IDs, amounts, what the site showed), without repeats.
      const notes = [...(t.annotations || []), ...(r.annotations || [])]
        .filter((n, j, all) => all.findIndex((m) => m.type === n.type && m.description === n.description) === j);
      tests.push({
        id: spec.title,
        title: [...ancestors, spec.title].filter(Boolean).join(' › '),
        file: spec.file,
        browser: t.projectName || 'chromium',
        status: r.status || t.status || 'unknown',
        duration: r.duration || 0,
        error: stripAnsi(r.error?.message),
        steps,
        otherSnapshots,
        notes,
        videos: writeVideos(r.attachments, index),
      });
    }
  }
  // Continue into nested suites.
  for (const child of suite.suites || []) collect(child, [...ancestors, suite.title].filter((x) => x && !x.endsWith('.ts')));
}
(results.suites || []).forEach((s) => collect(s));

// Totals for the summary tiles.
const isFail = (s) => ['failed', 'timedOut', 'interrupted'].includes(s);
const total = tests.length;
const passed = tests.filter((t) => t.status === 'passed').length;
const failed = tests.filter((t) => isFail(t.status)).length;
const skipped = tests.filter((t) => t.status === 'skipped').length;
const passRate = total ? Math.round((passed / total) * 100) : 0;
const stepCount = tests.reduce((n, t) => n + t.steps.length, 0);

// ---------- run & environment info ----------
// Run a git command and return its output ('' if git is not available).
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
// Installed version of an npm package, e.g. @playwright/test.
const pkgVersion = (name) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
};

// Repository and dashboard links (from Actions variables, or from the git remote locally).
const repoSlug =
  process.env.GITHUB_REPOSITORY || (git('remote get-url origin').match(/github\.com[/:]([^/]+\/[^/.]+)/) || [])[1] || '';
const repoUrl = repoSlug ? `https://github.com/${repoSlug}` : '';
const pagesUrl = repoSlug ? `https://${repoSlug.split('/')[0].toLowerCase()}.github.io/${repoSlug.split('/')[1]}/` : '';

// Load earlier runs (empty on the very first run).
let history = [];
try {
  history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
} catch {
  history = [];
}

// Details of this run, shown in the "Run & environment" panel.
const started = results.stats?.startTime ? new Date(results.stats.startTime) : new Date();
const wallMs = results.stats?.duration || tests.reduce((s, t) => s + t.duration, 0);
const sha = process.env.GITHUB_SHA || git('rev-parse HEAD');
const run = {
  number: process.env.GITHUB_RUN_NUMBER || 'local',
  url: process.env.GITHUB_RUN_ID ? `${repoUrl}/actions/runs/${process.env.GITHUB_RUN_ID}` : '',
  commit: sha.slice(0, 7),
  commitMessage: git('log -1 --pretty=%s'),
  commitUrl: sha && repoUrl ? `${repoUrl}/commit/${sha}` : '',
  author: process.env.GITHUB_ACTOR || git('log -1 --pretty=%an'),
  branch: process.env.GITHUB_REF_NAME || git('branch --show-current'),
  trigger: process.env.GITHUB_EVENT_NAME || 'local run',
  machine: process.env.GITHUB_ACTIONS ? `GitHub-hosted runner (${process.env.RUNNER_OS || os.type()})` : 'Local PC',
  os: `${os.type()} ${os.release()}`,
  node: process.version,
  playwright: pkgVersion('@playwright/test'),
  browser: [...new Set(tests.map((t) => t.browser))].join(', ') || 'chromium',
  site: process.env.BASE_URL || 'https://uatweb.cinescape.com.kw',
  started,
  finished: new Date(started.getTime() + wallMs),
  wallMs,
};

// ---------- history ----------
// Add this run to the history (used by the trend chart and the "last 10 runs" squares).
const entry = {
  run: run.number,
  at: run.started.toISOString(),
  commit: run.commit,
  url: run.url,
  total,
  passed,
  failed,
  skipped,
  tests: Object.fromEntries(tests.map((t) => [t.id, t.status])),
};
// Re-running the script for the same results replaces the entry instead of adding a duplicate.
history = history.filter((h) => h.at !== entry.at);
history.push(entry);
// Keep only the most recent runs, then save.
history = history.slice(-HISTORY_LIMIT);
fs.mkdirSync(path.dirname(historyPath), { recursive: true });
fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

// ---------- HTML helpers ----------
// Make text safe to put inside HTML.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Milliseconds → "1.23s".
const secs = (ms) => `${(ms / 1000).toFixed(2)}s`;
// Date → "2026-09-28 07:45:31 UTC".
const when = (d) => d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
// Test status → colour group (pass / fail / skip / none).
const kind = (s) => (s === 'passed' ? 'pass' : s === 'skipped' ? 'skip' : isFail(s) ? 'fail' : 'none');
// Symbol shown with each colour, so status is never colour-only.
const icon = { pass: '✓', fail: '✗', skip: '–', none: '·' };
// Test status → readable word.
const label = (s) => ({ passed: 'Passed', failed: 'Failed', timedOut: 'Timed out', skipped: 'Skipped', interrupted: 'Interrupted' })[s] || 'Not run';

// The "last 10 runs" squares for one test (✓ / ✗ / – with a tooltip per run).
function historyChips(id) {
  const recent = history.slice(-10);
  return `<span class="chips" aria-label="Last ${recent.length} runs">${recent
    .map((h) => {
      const s = h.tests[id];
      const k = s ? kind(s) : 'none';
      return `<span class="chip ${k}" title="Run ${esc(h.run)} · ${esc(h.at.slice(0, 16).replace('T', ' '))} · ${esc(label(s))}">${icon[k]}</span>`;
    })
    .join('')}</span>`;
}

// Stacked columns (passed / failed / skipped) for each run in the history.
function trendChart() {
  const max = Math.max(1, ...history.map((h) => h.total));
  const cols = history
    .map((h) => {
      const seg = (n, k) => (n ? `<i class="seg ${k}" style="height:${(n / max) * 100}%"></i>` : '');
      const rate = h.total ? Math.round((h.passed / h.total) * 100) : 0;
      return `<div class="col" tabindex="0" data-tip="Run ${esc(h.run)} · ${esc(h.at.slice(0, 16).replace('T', ' '))}&#10;${h.passed} passed · ${h.failed} failed · ${h.skipped} skipped&#10;Pass rate ${rate}%${h.commit ? ' · ' + esc(h.commit) : ''}">
        <div class="stack">${seg(h.skipped, 'skip')}${seg(h.failed, 'fail')}${seg(h.passed, 'pass')}</div>
        <span class="xl">${esc(h.run)}</span></div>`;
    })
    .join('');
  return `<div class="chart" role="img" aria-label="Test results for the last ${history.length} runs">
    <div class="yaxis"><span>${max}</span><span>${Math.round(max / 2)}</span><span>0</span></div>
    <div class="plot"><div class="grid"></div>${cols}</div>
  </div>
  <div class="legend"><span><i class="sw pass"></i>Passed</span><span><i class="sw fail"></i>Failed</span><span><i class="sw skip"></i>Skipped</span><span class="muted">Hover a column for details · x-axis: run number</span></div>`;
}

// The numbered step list for one test, with each step's screenshots under it
// (previews show the top of the page; click one to open the full screenshot).
function stepsHtml(steps) {
  return `<ol class="steps">${steps
    .map(
      (s) => `<li class="${s.failed ? 'bad' : ''}">
        <div class="step-row"><span class="pill ${s.failed ? 'fail' : 'pass'}">${s.failed ? '✗' : '✓'}</span><span class="step-title">${esc(s.title)}</span><span class="muted">${secs(s.duration)}</span></div>
        ${s.error ? `<pre class="error">${esc(s.error)}</pre>` : ''}
        ${(s.snapshots || []).map((p) => `<a href="${esc(p.path)}" target="_blank"><img class="snapshot" loading="lazy" src="${esc(p.path)}" alt="Screenshot: ${esc(p.name)}"></a>`).join('')}
      </li>`,
    )
    .join('')}</ol>`;
}

// One card per test: status, history, failure, video and steps.
const testCards = tests
  .map((t, i) => {
    const k = kind(t.status);
    const failedSteps = t.steps.filter((s) => s.failed).length;
    return `<article class="test ${k}" id="test-${i + 1}" data-kind="${k}" data-text="${esc(t.title.toLowerCase())}">
  <header>
    <span class="pill ${k}">${icon[k]} ${label(t.status)}</span>
    <h3>${esc(t.title)}</h3>
    ${historyChips(t.id)}
    <span class="muted">${secs(t.duration)}</span>
  </header>
  <p class="file">${esc(t.file)} · ${esc(t.browser)} · ${t.steps.length} steps${failedSteps ? ` · ${failedSteps} failed` : ''}</p>
  ${t.error ? `<details class="err" open><summary>Failure details</summary><pre class="error">${esc(t.error)}</pre></details>` : ''}
  ${t.notes.length ? `<details open><summary>Notes from the test (${t.notes.length})</summary><ul class="notes">${t.notes.map((n) => `<li><b>${esc(n.type)}:</b> ${esc(n.description)}</li>`).join('')}</ul></details>` : ''}
  ${t.videos.map((v) => `<details><summary>Watch ${esc(v.name.toLowerCase().startsWith('user 2') ? v.name : 'test video')}</summary><video class="video" controls preload="metadata"><source src="${esc(v.path)}" type="${esc(v.contentType)}">Your browser cannot play WebM video.</video></details>`).join('')}
  <details ${t.error ? 'open' : ''}><summary>${t.steps.length} execution steps with screenshots</summary>${stepsHtml(t.steps)}</details>
  ${t.otherSnapshots.length ? `<details><summary>Other screenshots (${t.otherSnapshots.length})</summary><div class="others">${t.otherSnapshots.map((p) => `<figure><a href="${esc(p.path)}" target="_blank"><img class="snapshot" loading="lazy" src="${esc(p.path)}" alt="Screenshot: ${esc(p.name)}"></a><figcaption>${esc(p.name)}</figcaption></figure>`).join('')}</div></details>` : ''}
</article>`;
  })
  .join('\n');

// Overview table rows: result, duration, steps, first line of the failure, history squares.
const overview = tests
  .map((t, i) => {
    const k = kind(t.status);
    return `<tr data-kind="${k}" data-text="${esc(t.title.toLowerCase())}"><td><a href="#test-${i + 1}">${esc(t.title)}</a></td><td><span class="pill ${k}">${icon[k]} ${label(t.status)}</span></td>
      <td>${secs(t.duration)}</td><td>${t.steps.length}</td><td>${esc(t.error.split('\n')[0])}</td><td>${historyChips(t.id)}</td></tr>`;
  })
  .join('');

// Rows of the "Run & environment" panel.
const runInfo = {
  'Run': run.url ? `<a href="${esc(run.url)}">#${esc(run.number)}</a>` : esc(run.number),
  'Commit': run.commitUrl ? `<a href="${esc(run.commitUrl)}">${esc(run.commit)}</a> ${esc(run.commitMessage)}` : `${esc(run.commit || 'uncommitted')} ${esc(run.commitMessage)}`,
  'Pushed by': esc(run.author || 'unknown'),
  'Branch': esc(run.branch || 'unknown'),
  'Trigger': esc(run.trigger),
  'Started': esc(when(run.started)),
  'Finished': esc(when(run.finished)),
  'Machine': esc(run.machine),
  'OS': esc(run.os),
  'Node.js / Playwright': `${esc(run.node)} / ${esc(run.playwright)}`,
  'Browser': esc(run.browser),
  'Site under test': `<a href="${esc(run.site)}">${esc(run.site)}</a>`,
};

// ---------- the dashboard page ----------
// Styles (light + dark), summary tiles, trend chart, run info, overview table, test cards, tooltip script.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cinescape Web Dashboard</title>
<style>
:root { --bg:#f6f7fb; --panel:#fcfcfb; --ink:#1b2230; --muted:#5d6678; --line:#dde2ea; --code:#f1f3f8; --accent:#1f4e8c;
  --good:#0ca30c; --critical:#d03b3b; --warning:#fab219;
  --good-ink:#006300; --critical-ink:#a42525; --warning-ink:#7a5200; --good-bg:#e3f4e3; --critical-bg:#fbe7e5; --warning-bg:#fdf1d6; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#121212; --panel:#1a1a19; --ink:#e9ecf1; --muted:#9aa3b2; --line:#2e3440; --code:#141414; --accent:#8db4f0;
  --good-ink:#5fd35f; --critical-ink:#ff8a80; --warning-ink:#fab219; --good-bg:#15301a; --critical-bg:#3a1c1c; --warning-bg:#3a2f14; } }
:root[data-theme="dark"] { --bg:#121212; --panel:#1a1a19; --ink:#e9ecf1; --muted:#9aa3b2; --line:#2e3440; --code:#141414; --accent:#8db4f0;
  --good-ink:#5fd35f; --critical-ink:#ff8a80; --warning-ink:#fab219; --good-bg:#15301a; --critical-bg:#3a1c1c; --warning-bg:#3a2f14; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 "Segoe UI", system-ui, sans-serif; }
main { max-width:1140px; margin:0 auto; padding:32px 16px 64px; }
h1 { margin:0; font-size:28px; } h2 { font-size:18px; margin:28px 0 12px; } h3 { margin:0; font-size:16px; flex:1; min-width:220px; }
a { color:var(--accent); } .muted { color:var(--muted); font-size:13px; }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
.tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin:20px 0; }
.tile { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
button.tile { font:inherit; color:inherit; text-align:left; cursor:pointer; } button.tile:hover, button.tile:focus-visible { border-color:var(--accent); }
.filters { position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; padding:10px 12px; }
.fbtn { font:inherit; font-size:13px; padding:4px 12px; border-radius:20px; border:1px solid var(--line); background:var(--bg); color:var(--ink); cursor:pointer; }
.fbtn b { font-variant-numeric:tabular-nums; } .fbtn[aria-pressed="true"] { border-color:var(--accent); background:var(--accent); color:var(--panel); }
.fbtn.fail[aria-pressed="true"] { background:var(--critical); border-color:var(--critical); color:#fff; } .fbtn.pass[aria-pressed="true"] { background:var(--good); border-color:var(--good); color:#fff; }
.fbtn.skip[aria-pressed="true"] { background:var(--warning); border-color:var(--warning); color:#1b2230; }
#filter-text { font:inherit; font-size:13px; padding:4px 10px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink); min-width:220px; flex:1; max-width:340px; }
[hidden] { display:none !important; }
.tile b { display:block; font-size:28px; font-variant-numeric:tabular-nums; } .tile span { color:var(--muted); font-size:13px; }
.two { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.kv { width:100%; border-collapse:collapse; font-size:13px; } .kv th { text-align:left; color:var(--muted); font-weight:500; padding:4px 12px 4px 0; width:38%; vertical-align:top; }
.kv td { padding:4px 0; word-break:break-word; }
.chart { display:flex; gap:8px; height:180px; margin-top:4px; }
.yaxis { display:flex; flex-direction:column; justify-content:space-between; font-size:11px; color:var(--muted); padding-bottom:18px; text-align:right; min-width:18px; }
.plot { position:relative; flex:1; display:flex; align-items:flex-end; gap:6px; }
.grid { position:absolute; inset:0 0 18px 0; border-bottom:1px solid var(--line); background:linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 100% 50%; opacity:.6; pointer-events:none; }
.col { position:relative; flex:1; max-width:36px; height:100%; display:flex; flex-direction:column; align-items:center; outline:none; }
.stack { flex:1; width:100%; display:flex; flex-direction:column; justify-content:flex-end; gap:2px; }
.seg { display:block; width:100%; min-height:3px; } .stack .seg:first-child { border-radius:4px 4px 0 0; }
.seg.pass { background:var(--good); } .seg.fail { background:var(--critical); } .seg.skip { background:var(--warning); }
.xl { font-size:11px; color:var(--muted); height:18px; line-height:18px; }
.col:hover .stack, .col:focus .stack { opacity:.85; }
.tip { position:fixed; pointer-events:none; background:var(--ink); color:var(--bg); font-size:12px; padding:6px 9px; border-radius:6px; white-space:pre; z-index:10; display:none; }
.legend { display:flex; flex-wrap:wrap; gap:14px; font-size:13px; margin-top:8px; align-items:center; }
.sw { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; } .sw.pass { background:var(--good); } .sw.fail { background:var(--critical); } .sw.skip { background:var(--warning); }
.chips { display:inline-flex; gap:3px; } .chip { width:18px; height:18px; border-radius:4px; font-size:11px; font-weight:700; display:inline-grid; place-items:center; color:#fff; background:var(--line); }
.chip.pass { background:var(--good); } .chip.fail { background:var(--critical); } .chip.skip { background:var(--warning); color:#1b2230; } .chip.none { color:var(--muted); }
.scroll { overflow-x:auto; max-width:100%; }
table.list { width:100%; min-width:640px; border-collapse:collapse; font-size:14px; } table.list th, table.list td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
table.list th { color:var(--muted); font-weight:500; font-size:13px; }
.pill { display:inline-block; font-size:12px; font-weight:600; padding:1px 9px; border-radius:20px; white-space:nowrap; }
.pill.pass { background:var(--good-bg); color:var(--good-ink); } .pill.fail { background:var(--critical-bg); color:var(--critical-ink); } .pill.skip { background:var(--warning-bg); color:var(--warning-ink); }
.test { background:var(--panel); border:1px solid var(--line); border-left:4px solid var(--good); border-radius:10px; padding:14px 16px; margin-bottom:14px; }
.test.fail { border-left-color:var(--critical); } .test.skip { border-left-color:var(--warning); }
.test header { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.file { font-family:Consolas, monospace; font-size:12px; color:var(--muted); margin:6px 0; }
details { margin-top:8px; } summary { cursor:pointer; color:var(--accent); font-size:13px; }
pre { background:var(--code); border:1px solid var(--line); border-radius:6px; padding:10px; overflow:auto; max-height:360px; font:12px/1.45 Consolas, monospace; white-space:pre-wrap; word-break:break-word; }
pre.error { color:var(--critical-ink); }
.video { display:block; width:min(100%,720px); margin-top:8px; border:1px solid var(--line); border-radius:8px; background:#000; }
.notes { margin:6px 0 0; padding-left:18px; } .notes li { margin:3px 0; overflow-wrap:anywhere; }
.others { display:flex; flex-wrap:wrap; gap:10px; } .others figure { margin:0; } .others figcaption { font-size:12px; color:var(--muted); max-width:320px; }
.steps { margin:8px 0 0; padding-left:22px; font-size:13px; display:grid; gap:8px; }
.step-row { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; } .step-title { flex:1; min-width:200px; }
.steps li.bad .step-title { color:var(--critical-ink); }
.snapshot { display:block; width:min(100%,520px); max-height:420px; object-fit:cover; object-position:top; margin-top:6px; border:1px solid var(--line); border-radius:6px; }
footer { color:var(--muted); font-size:13px; margin-top:24px; }
@media (max-width:760px) { .two { grid-template-columns:1fr; } h1 { font-size:22px; } }
</style>
</head>
<body><main>
<h1>Cinescape web tests</h1>
<p class="muted">Run ${esc(run.number)} · ${esc(when(run.started))}${run.url ? ` · <a href="${esc(run.url)}">GitHub Actions run</a>` : ''}${repoUrl ? ` · <a href="${esc(repoUrl)}">Repository</a> · <a href="${esc(repoUrl)}/actions">Actions</a>` : ''}${fs.existsSync(path.join(outputDir, 'playwright-report', 'index.html')) ? ' · <a href="playwright-report/index.html">Playwright HTML report</a>' : ''}</p>

<section class="tiles">
  <div class="tile"><b>${total}</b><span>Tests</span></div>
  <button type="button" class="tile" data-filter="pass" title="Show only the passed tests"><b>${passed}</b><span>✓ Passed</span></button>
  <button type="button" class="tile" data-filter="fail" title="Show only the failed tests"><b>${failed}</b><span>✗ Failed</span></button>
  <button type="button" class="tile" data-filter="skip" title="Show only the skipped tests"><b>${skipped}</b><span>– Skipped</span></button>
  <div class="tile"><b>${passRate}%</b><span>Pass rate</span></div>
  <div class="tile"><b>${stepCount}</b><span>Steps executed</span></div>
  <div class="tile"><b>${secs(run.wallMs)}</b><span>Duration</span></div>
</section>

<section class="two">
  <div class="panel"><h2 style="margin-top:0">Trend: last ${history.length} run${history.length === 1 ? '' : 's'}</h2>${trendChart()}</div>
  <div class="panel"><h2 style="margin-top:0">Run &amp; environment</h2><table class="kv">${Object.entries(runInfo)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`)
    .join('')}</table></div>
</section>

<h2>Overview</h2>
<div class="filters panel" role="toolbar" aria-label="Filter the tests">
  <span class="muted">Show</span>
  <button type="button" class="fbtn" data-filter="all" aria-pressed="true">All <b>${total}</b></button>
  <button type="button" class="fbtn fail" data-filter="fail" aria-pressed="false">✗ Failed <b>${failed}</b></button>
  <button type="button" class="fbtn pass" data-filter="pass" aria-pressed="false">✓ Passed <b>${passed}</b></button>
  <button type="button" class="fbtn skip" data-filter="skip" aria-pressed="false">– Skipped <b>${skipped}</b></button>
  <input type="search" id="filter-text" placeholder="Search a test, e.g. WEB-29 or gift" aria-label="Search the tests by number or name">
  <span class="muted" id="filter-count" aria-live="polite"></span>
</div>
<div class="panel scroll"><table class="list"><thead><tr><th>Test</th><th>Result</th><th>Duration</th><th>Steps</th><th>Failure</th><th>Last 10 runs</th></tr></thead><tbody>${overview || '<tr><td colspan="6">No tests found</td></tr>'}<tr id="no-match-row" hidden><td colspan="6" class="muted">No test matches this filter.</td></tr></tbody></table></div>

<h2>Test details</h2>
${testCards || '<p>No tests found.</p>'}
<p id="no-match-cards" class="muted" hidden>No test matches this filter.</p>
<footer>Generated from Playwright JSON results. Screenshots and test videos are bundled with the dashboard.</footer>
</main>
<div class="tip" id="tip"></div>
<script>
// Filter: All / Failed / Passed / Skipped and a search box; applies to the overview table and the test cards.
// The choice is kept in the address (#filter=fail&q=web-29), so a "failed only" link can be bookmarked or shared.
(function () {
  var state = { filter: 'all', q: '' };
  var items = document.querySelectorAll('tr[data-kind], article[data-kind]');
  var box = document.getElementById('filter-text');
  function apply(keepAddress) {
    var shown = 0, rows = 0, cards = 0, total = document.querySelectorAll('article[data-kind]').length;
    items.forEach(function (el) {
      var kind = el.getAttribute('data-kind');
      var ok = (state.filter === 'all' || kind === state.filter)
        && (!state.q || el.getAttribute('data-text').indexOf(state.q) !== -1);
      el.hidden = !ok;
      if (ok && el.tagName === 'ARTICLE') cards += 1; else if (ok) rows += 1;
    });
    shown = cards;
    document.getElementById('no-match-row').hidden = rows > 0;
    document.getElementById('no-match-cards').hidden = cards > 0;
    document.getElementById('filter-count').textContent = 'Showing ' + shown + ' of ' + total;
    document.querySelectorAll('.fbtn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === state.filter)); });
    if (keepAddress) return; // Opened from a link such as #test-37, or with no filter: leave the address as it is.
    var hash = (state.filter !== 'all' ? 'filter=' + state.filter : '') + (state.q ? (state.filter !== 'all' ? '&' : '') + 'q=' + encodeURIComponent(state.q) : '');
    history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
  }
  function read() {
    var h = new URLSearchParams(location.hash.slice(1));
    state.filter = ['fail', 'pass', 'skip'].indexOf(h.get('filter')) !== -1 ? h.get('filter') : 'all';
    state.q = (h.get('q') || '').toLowerCase();
    box.value = state.q;
  }
  document.querySelectorAll('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.filter = b.getAttribute('data-filter'); apply();
      if (b.classList.contains('tile')) document.querySelector('.filters').scrollIntoView({ behavior: 'smooth' });
    });
  });
  box.addEventListener('input', function () { state.q = box.value.trim().toLowerCase(); apply(); });
  if (/^#test-\\d+$/.test(location.hash)) { apply(true); return; } // A link to one test: show everything, keep the link.
  read(); apply(!location.hash);
})();
// Tooltip for the trend chart columns (mouse hover and keyboard focus).
(function () {
  var tip = document.getElementById('tip');
  function show(e) { tip.textContent = e.currentTarget.getAttribute('data-tip'); tip.style.display = 'block'; move(e); }
  function move(e) { var r = e.clientX !== undefined ? e : e.currentTarget.getBoundingClientRect(); var x = (r.clientX || r.left) + 12, y = (r.clientY || r.top) - 10;
    tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.max(8, y - tip.offsetHeight) + 'px'; }
  function hide() { tip.style.display = 'none'; }
  document.querySelectorAll('.col').forEach(function (c) {
    c.addEventListener('mouseenter', show); c.addEventListener('mousemove', move); c.addEventListener('mouseleave', hide);
    c.addEventListener('focus', show); c.addEventListener('blur', hide);
  });
})();
</script>
</body></html>`;

// Save the page and a copy of the history next to it (the history is also published).
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);
fs.writeFileSync(path.join(outputDir, 'history.json'), JSON.stringify(history, null, 2));
console.log(`Dashboard generated at ${path.join(outputDir, 'index.html')} (${passed}/${total} passed, ${history.length} runs in history)`);

// ---------- Markdown summary (summary.md, and the GitHub job summary when on Actions) ----------
{
  // Make text safe inside a Markdown table cell.
  const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  // Status → emoji for the summary.
  const emoji = { pass: '✅', fail: '❌', skip: '⏭️', none: '▫️' };
  // Last 10 results of one test as emojis.
  const trail = (id) => history.slice(-10).map((h) => emoji[h.tests[id] ? kind(h.tests[id]) : 'none']).join('');
  // Heading, run details, trend and the main results table.
  const lines = [
    `## Cinescape web tests: ${passed}/${total} passed${failed ? `, ${failed} failed` : ''}${skipped ? `, ${skipped} skipped` : ''}`,
    '',
    `**Run** #${md(run.number)} · **commit** \`${md(run.commit)}\` ${md(run.commitMessage)} · **by** ${md(run.author)} · **trigger** ${md(run.trigger)}  `,
    `**Site** ${md(run.site)} · **Browser** ${md(run.browser)} · **Node** ${md(run.node)} · **Playwright** ${md(run.playwright)} · **Duration** ${secs(run.wallMs)}  `,
    `**Pass-rate trend** (oldest → newest): ${history.slice(-10).map((h) => `${h.total ? Math.round((h.passed / h.total) * 100) : 0}%`).join(' → ')}  `,
    pagesUrl ? `**Dashboard (screenshots & videos):** ${pagesUrl}` : '',
    '',
    '| Test | Result | Duration | Steps | Last 10 runs | Failure |',
    '|---|---|---|---|---|---|',
    ...tests.map((t) => `| ${md(t.title)} | ${emoji[kind(t.status)]} ${label(t.status)} | ${secs(t.duration)} | ${t.steps.length} | ${trail(t.id)} | ${md(t.error.split('\n')[0])} |`),
  ];
  // Every failed step, so the cause is visible without opening the dashboard.
  const failedSteps = tests.flatMap((t) => t.steps.filter((s) => s.failed && s.error).map((s) => ({ t, s })));
  if (failedSteps.length) {
    lines.push('', '### Failed steps', '', '| Test | Step | Error |', '|---|---|---|');
    for (const { t, s } of failedSteps) lines.push(`| ${md(t.title)} | ${md(s.title)} | ${md(s.error.split('\n')[0])} |`);
  }
  // Save summary.md; on GitHub Actions also add it to the run page.
  const summary = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outputDir, 'summary.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
