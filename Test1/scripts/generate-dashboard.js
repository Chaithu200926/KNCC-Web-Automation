const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json');
const outputDir = path.join(__dirname, '..', 'dashboard');
const outputPath = path.join(outputDir, 'index.html');
const assetDir = path.join(outputDir, 'assets');

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const tests = [];

function flattenSteps(steps, parentTitles = []) {
  return (steps || []).flatMap((step) => {
    const title = [...parentTitles, step.title].join(' › ');
    const current = {
      title,
      duration: step.duration || 0,
      status: step.error ? 'failed' : 'passed',
      error: step.error?.message || '',
    };
    return [current, ...flattenSteps(step.steps, [...parentTitles, step.title])];
  });
}

function writeSnapshots(attachments, testIndex) {
  return (attachments || [])
    .filter((attachment) => attachment.contentType === 'image/png' && attachment.body)
    .map((attachment, snapshotIndex) => {
      const fileName = `test-${testIndex + 1}-snapshot-${snapshotIndex + 1}.png`;
      fs.mkdirSync(assetDir, { recursive: true });
      fs.writeFileSync(path.join(assetDir, fileName), Buffer.from(attachment.body, 'base64'));
      return { name: attachment.name, path: `assets/${fileName}` };
    });
}

function collectSuite(suite, ancestors = []) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const result = test.results?.[test.results.length - 1] || {};
      const status = result.status || test.status || 'unknown';
      const snapshots = writeSnapshots(result.attachments, tests.length);
      const steps = flattenSteps(result.steps);
      const snapshotStepMap = {
        '01-movie-book-now': 'Open any movie and click Book Now',
        '02-experience': 'Choose tomorrow and the second showtime',
        '03-date': 'Choose tomorrow and the second showtime',
        '04-time': 'Choose tomorrow and the second showtime',
        '06-login-form': 'Choose tomorrow and the second showtime',
        '07-submit-sign-in': 'Choose tomorrow and the second showtime',
        '08-email-otp-form': 'Choose tomorrow and the second showtime',
        '09-submit-email-otp': 'Choose tomorrow and the second showtime',
        '11-seat-category': 'Choose seat category and ticket type',
        '12-seat-type': 'Choose seat category and ticket type',
        '13-ticket-proceed': 'Choose a seat and proceed',
        '14-seat': 'Choose a seat and proceed',
        '15-seat-proceed': 'Choose a seat and proceed',
        '17-food-proceed': 'Skip food and continue to payment',
        '18-open-wallet': 'Apply wallet and confirm booking',
        '19-wallet-apply': 'Apply wallet and confirm booking',
        '20-confirm-booking': 'Apply wallet and confirm booking',
        '21-my-profile': 'Open My Profile and cancel the confirmed booking',
        '22-my-profile': 'Open My Profile and cancel the confirmed booking',
        '23-bookings': 'Open My Profile and cancel the confirmed booking',
        '24-booking-found': 'Open My Profile and cancel the confirmed booking',
        '25-cancel-booking': 'Open My Profile and cancel the confirmed booking',
        '26-confirm-cancellation': 'Open My Profile and cancel the confirmed booking',
        '27-booking-cancelled': 'Open My Profile and cancel the confirmed booking',
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
      snapshots.forEach((snapshot) => {
        const footerHeader = snapshot.name.match(/^footer-header-(.+)$/i);
        const footerSnapshot = snapshot.name.match(/^footer-\d+-(.+)-(click|landed|returned)$/i);
        let footerTitle = '';
        if (footerHeader) {
          footerTitle = `Verify footer header ${footerHeader[1].replaceAll('-', ' ').toUpperCase()}`;
        } else if (footerSnapshot) {
          const snapshotName = footerSnapshot[1].replaceAll('-', ' ').toUpperCase();
          if (snapshotName.startsWith('DOWNLOAD OUR MOBILE APP ') || snapshotName.startsWith('SOCIAL MEDIA ')) {
            footerTitle = `Click and verify footer ${snapshotName}`;
          } else if (snapshotName === 'SIGN IN' || snapshotName === 'REGISTER') {
            footerTitle = `Verify footer ${snapshotName} button`;
          } else {
            footerTitle = `Click and verify footer ${snapshotName}`;
          }
        }
        const targetTitle = snapshotStepMap[snapshot.name] || footerTitle;
        const targetStep = steps.find((step) => step.title.endsWith(targetTitle));
        if (targetStep) {
          targetStep.snapshots = [...(targetStep.snapshots || []), snapshot];
        }
      });
      tests.push({
        name: [...ancestors, spec.title].join(' › '),
        status,
        duration: result.duration || 0,
        browser: test.projectName || 'unknown',
        error: result.error?.message || '',
        steps,
      });
    }
  }
  for (const child of suite.suites || []) {
    collectSuite(child, [...ancestors, suite.title].filter(Boolean));
  }
}

for (const suite of results.suites || []) collectSuite(suite);

const counts = tests.reduce((summary, test) => {
  summary[test.status] = (summary[test.status] || 0) + 1;
  return summary;
}, {});
const total = tests.length;
const passed = counts.passed || 0;
const failed = (counts.failed || 0) + (counts.timedOut || 0) + (counts.interrupted || 0);
const skipped = (counts.skipped || 0) + (counts.pending || 0);
const duration = tests.reduce((sum, test) => sum + test.duration, 0);
const passRate = total ? Math.round((passed / total) * 100) : 0;
const safe = (value) => String(value).replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
const barWidth = (value) => (total ? Math.max(2, Math.round((value / total) * 100)) : 0);
const generatedAt = new Date().toISOString();

const rows = tests.map((test) => `
  <tr>
    <td><strong>${safe(test.name)}</strong>${test.error ? `<small>${safe(test.error)}</small>` : ''}<details><summary>View ${test.steps.length} execution steps</summary><ol class="steps">${test.steps.map((step) => `<li><span class="step-status ${step.status}">${step.status}</span><span>${safe(step.title)}${(step.snapshots || []).map((snapshot) => `<img class="snapshot" src="${snapshot.path}" alt="${safe(snapshot.name)} snapshot">`).join('')}</span><time>${(step.duration / 1000).toFixed(2)}s</time>${step.error ? `<small>${safe(step.error)}</small>` : ''}</li>`).join('')}</ol></details></td>
    <td><span class="status ${safe(test.status)}">${safe(test.status)}</span></td>
    <td>${safe(test.browser)}</td>
    <td>${(test.duration / 1000).toFixed(2)}s</td>
  </tr>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Playwright Test Dashboard</title>
<style>
:root { color-scheme: dark; --bg:#101820; --panel:#182631; --line:#2b414e; --text:#edf5f7; --muted:#9eb2bb; --green:#43d17a; --red:#ff6b6b; --amber:#f5c451; --cyan:#57c7d9; }
* { box-sizing:border-box; } body { margin:0; background:linear-gradient(135deg,#101820,#17303a); color:var(--text); font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
main { max-width:1180px; margin:auto; padding:42px 24px 64px; } header { display:flex; justify-content:space-between; gap:24px; align-items:end; margin-bottom:30px; } h1 { margin:0; font-size:clamp(28px,4vw,44px); letter-spacing:-.02em; } h2 { margin:0 0 18px; font-size:18px; } .muted { color:var(--muted); }
.grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:18px; } .card { background:rgba(24,38,49,.92); border:1px solid var(--line); border-radius:10px; padding:20px; } .metric { font-size:32px; font-weight:750; } .metric-label { color:var(--muted); }
.content { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:18px; } .chart { display:flex; gap:28px; align-items:center; } .donut { width:150px; aspect-ratio:1; border-radius:50%; background:conic-gradient(var(--green) ${passRate}%, var(--red) ${passRate}% ${Math.min(100, passRate + (total ? failed / total * 100 : 0))}%, var(--amber) 0); display:grid; place-items:center; } .donut:after { content:'${passRate}%'; width:102px; aspect-ratio:1; border-radius:50%; background:var(--panel); display:grid; place-items:center; font-size:24px; font-weight:700; } .legend { display:grid; gap:9px; } .key { display:flex; gap:9px; align-items:center; } .dot { width:10px; height:10px; border-radius:50%; background:var(--green); } .dot.fail { background:var(--red); } .dot.skip { background:var(--amber); }
.bars { display:grid; gap:14px; } .bar-row { display:grid; grid-template-columns:90px 1fr 35px; gap:10px; align-items:center; } .track { background:#0e171d; height:12px; border-radius:20px; overflow:hidden; } .fill { height:100%; background:var(--green); border-radius:20px; } .fill.fail { background:var(--red); } .fill.skip { background:var(--amber); }
table { width:100%; border-collapse:collapse; } th,td { text-align:left; padding:14px 12px; border-bottom:1px solid var(--line); vertical-align:top; } th { color:var(--muted); font-weight:600; } td small { display:block; color:var(--red); margin-top:4px; word-break:break-word; } details { margin-top:12px; } summary { color:var(--cyan); cursor:pointer; font-size:13px; } .steps { margin:10px 0 0 18px; padding:0; display:grid; gap:12px; } .steps li { display:grid; grid-template-columns:62px 1fr auto; gap:8px; align-items:start; color:var(--muted); } .steps time { color:var(--muted); white-space:nowrap; } .step-status { font-size:10px; text-transform:uppercase; color:var(--green); } .step-status.failed { color:var(--red); } .snapshot { display:block; width:min(100%,520px); margin-top:8px; border:1px solid var(--line); border-radius:6px; } .status { display:inline-block; padding:3px 9px; border-radius:20px; background:#244434; color:var(--green); font-size:12px; text-transform:uppercase; } .status.failed,.status.timedOut { background:#512c32; color:var(--red); } .status.skipped { background:#554621; color:var(--amber); } footer { margin-top:20px; color:var(--muted); font-size:13px; }
@media (max-width:760px) { header,.content { display:block; } header > div:last-child { margin-top:12px; } .grid { grid-template-columns:repeat(2,1fr); } .card { margin-bottom:16px; } .chart { justify-content:center; margin-bottom:12px; } table { font-size:13px; } th:nth-child(3),td:nth-child(3) { display:none; } }
</style>
</head>
<body><main>
<header><div><p class="muted">Cinescape Kuwait · Playwright</p><h1>Test execution dashboard</h1></div><div class="muted">Generated ${safe(generatedAt)}</div></header>
<section class="grid">
  <div class="card"><div class="metric">${total}</div><div class="metric-label">Total tests</div></div>
  <div class="card"><div class="metric" style="color:var(--green)">${passed}</div><div class="metric-label">Passed</div></div>
  <div class="card"><div class="metric" style="color:var(--red)">${failed}</div><div class="metric-label">Failed</div></div>
  <div class="card"><div class="metric">${(duration / 1000).toFixed(2)}s</div><div class="metric-label">Total duration</div></div>
</section>
<section class="content">
  <div class="card"><h2>Outcome</h2><div class="chart"><div class="donut"></div><div class="legend"><div class="key"><span class="dot"></span>Passed: ${passed}</div><div class="key"><span class="dot fail"></span>Failed: ${failed}</div><div class="key"><span class="dot skip"></span>Skipped: ${skipped}</div></div></div></div>
  <div class="card"><h2>Test distribution</h2><div class="bars"><div class="bar-row"><span>Passed</span><div class="track"><div class="fill" style="width:${barWidth(passed)}%"></div></div><strong>${passed}</strong></div><div class="bar-row"><span>Failed</span><div class="track"><div class="fill fail" style="width:${barWidth(failed)}%"></div></div><strong>${failed}</strong></div><div class="bar-row"><span>Skipped</span><div class="track"><div class="fill skip" style="width:${barWidth(skipped)}%"></div></div><strong>${skipped}</strong></div></div></div>
</section>
<section class="card"><h2>Test details</h2><table><thead><tr><th>Test</th><th>Status</th><th>Browser</th><th>Duration</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No tests found</td></tr>'}</tbody></table></section>
<footer>Generated from Playwright JSON results. Screenshots are shown with their verification steps.</footer>
</main></body></html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html);
console.log(`Dashboard generated at ${outputPath}`);
