// Packs one website's local test results for the "Internal Site Dashboard" workflow: results.json plus the screenshots
// and videos the dashboard shows, with the file paths made relative (test-results-<site>/...) so GitHub's runner finds them.
// Traces and the Playwright HTML report are left out: they record typed values (password, OTP, card details).
//
//   node scripts/pack-site-results.js <site> <out folder>     e.g. node scripts/pack-site-results.js pre-prod C:\temp\pack
const fs = require('fs');
const path = require('path');

const [site, outArg] = process.argv.slice(2);
if (!site || !outArg) { console.error('Usage: node scripts/pack-site-results.js <site> <out folder>'); process.exit(1); }

const root = path.join(__dirname, '..');
const resultsDir = `test-results-${site}`;
const resultsFile = path.join(root, resultsDir, 'results.json');
if (!fs.existsSync(resultsFile)) { console.error(`No ${resultsDir}/results.json - run the tests first.`); process.exit(1); }
const out = path.resolve(outArg);

// Only screenshots and videos go along; any other attachment (trace, error context) is dropped from the results.
const keep = (a) => a.path && (a.contentType === 'image/png' || a.contentType?.startsWith('video/')) && fs.existsSync(a.path);

let files = 0;
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const visitSuite = (suite) => {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) for (const result of test.results || []) {
    result.attachments = (result.attachments || []).filter((a) => a.body || keep(a)).map((a) => {
      if (a.body) return a.contentType === 'image/png' ? a : null; // Inline screenshots stay; other inline data is dropped.
      const relative = path.relative(root, a.path).split(path.sep).join('/'); // test-results-<site>/<test folder>/<file>
      fs.mkdirSync(path.dirname(path.join(out, relative)), { recursive: true });
      fs.copyFileSync(a.path, path.join(out, relative));
      files++;
      return { ...a, path: relative };
    }).filter(Boolean);
  }
  (suite.suites || []).forEach(visitSuite);
};
(results.suites || []).forEach(visitSuite);

fs.mkdirSync(path.join(out, resultsDir), { recursive: true });
fs.writeFileSync(path.join(out, resultsDir, 'results.json'), JSON.stringify(results));
console.log(`Packed ${resultsDir}/results.json and ${files} screenshot/video file(s) into ${out}`);
