// Builds "Cinescape UAT and Pre-UAT Checklist.html": one row per website case (WEB-01..48) with a UAT and a Pre-UAT
// column, filled from the runs' Playwright JSON results. Every run is merged into site-checklist/state.json, so a run of
// a few cases (e.g. only WEB-07) updates those rows and keeps the rest. The page is one self-contained file to share.
//
//   node scripts/build-site-checklist.js [--add uat|pre-uat] [--out "<file.html>"]
//     --add <site>  merge test-results-<site>/results.json into the state first (run-site.ps1 does this after a run)
//     --out <file>  where to write the checklist (default: site-checklist/Cinescape UAT and Pre-UAT Checklist.html)
//   CHECKLIST_STATE=<file> keeps the merged results somewhere else (the "Internal UAT Testing" workflow uses the QA PC's
//   own copy, because every workflow run starts from a fresh checkout).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stateFile = process.env.CHECKLIST_STATE ? path.resolve(process.env.CHECKLIST_STATE) : path.join(root, 'site-checklist', 'state.json');
const SITES = [
  { id: 'uat', label: 'UAT', url: 'http://10.35.1.66:8103', specs: 'tests-uat' },
  { id: 'pre-uat', label: 'Pre-UAT', url: 'http://10.35.1.66:8123', specs: 'tests-pre-uat' },
];

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const outFile = path.resolve(root, arg('--out') || path.join('site-checklist', 'Cinescape UAT and Pre-UAT Checklist.html'));

// ---------- state: { titles: {WEB-NN: title}, sites: {uat: {WEB-NN: result}, 'pre-uat': {...}} } ----------
let state = { titles: {}, sites: { uat: {}, 'pre-uat': {} } };
try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* first build */ }
for (const site of SITES) state.sites[site.id] = state.sites[site.id] || {};

// Case names straight from the spec files, so every case has a row even before it has run.
for (const site of SITES) {
  const dir = path.join(root, site.specs);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => /^web-\d+-.*\.spec\.ts$/.test(f))) {
    const m = /test\((['"])(WEB-\d+) (.*?)\1/.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (m) state.titles[m[2]] = m[3];
  }
}

// First line of a failure message, without terminal colours ("Error: The new first name should be saved").
const firstLine = (message) => String(message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim())
  .filter(Boolean)[0]?.replace(/^Error:\s*/, '').slice(0, 300) || '';

// Merge one run's results.json.
const added = arg('--add');
if (added) {
  const site = SITES.find((s) => s.id === added);
  if (!site) throw new Error(`--add takes ${SITES.map((s) => s.id).join(' or ')}`);
  const resultsFile = path.join(root, `test-results-${site.id}`, 'results.json');
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  let count = 0;
  const walk = (suite) => {
    (suite.suites || []).forEach(walk);
    for (const spec of suite.specs || []) {
      const m = /^(WEB-\d+)\s+(.*)$/.exec(spec.title || '');
      if (!m) continue;
      for (const t of spec.tests || []) {
        const r = (t.results || []).at(-1);
        if (!r) continue;
        const s = r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed';
        const annotations = t.annotations || [];
        state.titles[m[1]] = m[2];
        state.sites[site.id][m[1]] = {
          s,
          d: Math.round((r.duration || 0) / 1000),
          e: s === 'failed' ? firstLine(r.error?.message || r.errors?.[0]?.message)
            : s === 'skipped' ? (annotations.find((a) => a.type === 'skip')?.description || 'Skipped') : '',
          n: annotations.filter((a) => a.type !== 'skip' && a.description).slice(0, 6).map((a) => `${a.type}: ${String(a.description).slice(0, 240)}`),
          at: r.startTime || results.stats?.startTime || new Date().toISOString(),
        };
        count += 1;
      }
    }
  };
  walk(results);
  console.log(`Checklist: ${count} ${site.label} result(s) merged from ${path.relative(root, resultsFile)}.`);
}

fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));

// ---------- page ----------
const data = { built: new Date().toISOString(), sites: SITES.map(({ id, label, url }) => ({ id, label, url })), titles: state.titles, results: state.sites };
const json = JSON.stringify(data).replace(/</g, '\\u003c'); // Safe inside <script>.

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Cinescape UAT and Pre-UAT Checklist</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: same ticket-stub table as the Cinescape Test Checklist, with two site columns (UAT, Pre-UAT); results come from the test runs. */
:root {
  --bg: #f3f1ec; --panel: #fbfaf7; --fg: #1d2326; --muted: #667075; --line: #d9d6cd;
  --ok: #1f7a4d; --ok-bg: #d9efe2; --bad: #b3362b; --bad-bg: #f7dad6; --skip: #8a6a1c; --skip-bg: #f1e6c4;
  --accent: #c8501e; --na: #b9b5a9;
  --font-display: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
  --font-body: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12181b; --panel: #192124; --fg: #e8e6df; --muted: #9aa5aa; --line: #2c373b;
    --ok: #5fcf93; --ok-bg: #1c3a2b; --bad: #ff8a7c; --bad-bg: #432421; --skip: #e3c26a; --skip-bg: #3c3319;
    --accent: #ff9a62; --na: #4a575c; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #12181b; --panel: #192124; --fg: #e8e6df; --muted: #9aa5aa; --line: #2c373b;
  --ok: #5fcf93; --ok-bg: #1c3a2b; --bad: #ff8a7c; --bad-bg: #432421; --skip: #e3c26a; --skip-bg: #3c3319;
  --accent: #ff9a62; --na: #4a575c; color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 15px; line-height: 1.45; padding-inline: 16px; padding-block: 0 56px; }
.wrap { max-width: 880px; margin-inline: auto; }
header.top { padding-block: 28px 16px; display: grid; gap: 12px; }
h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(28px, 6vw, 42px); line-height: 1.05; margin: 0; text-wrap: balance; letter-spacing: -0.01em; }
.sub { color: var(--muted); margin: 0; max-width: 62ch; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.strip { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); border-block: 1px solid var(--line); padding-block: 10px; margin-inline: -16px; padding-inline: 16px; }
.strip-in { max-width: 880px; margin-inline: auto; display: grid; gap: 10px; }
.bars { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bar b { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; gap: 6px; flex-wrap: wrap; }
.bar b i { font-style: normal; font-family: var(--font-mono); font-weight: 500; color: var(--muted); font-size: 11px; }
.track { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin-top: 4px; display: flex; }
.track u { display: block; height: 100%; background: var(--ok); }
.track s { display: block; height: 100%; background: var(--bad); }
.track em { display: block; height: 100%; background: var(--skip); }
.bar small { display: block; margin-top: 3px; font-size: 11px; color: var(--muted); font-family: var(--font-mono); overflow-wrap: anywhere; }
.filters { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.filters button { font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--fg); cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.filters button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.filters .tot { margin-left: auto; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.tbl { margin-top: 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 340px; }
th, td { padding: 0; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); padding: 8px 4px; font-weight: 600; width: 76px; }
thead th:first-child { text-align: left; padding-left: 12px; width: auto; }
td.name { padding: 10px 8px 10px 12px; }
td.name .id { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-right: 6px; }
td.name .why { display: block; margin-top: 4px; font-size: 12px; line-height: 1.35; color: var(--muted); overflow-wrap: anywhere; }
td.name .why b { font-family: var(--font-mono); font-weight: 500; font-size: 11px; color: var(--bad); }
td.name .why.note b { color: var(--skip); }
td.c { text-align: center; width: 76px; padding-block: 8px; }
.mark { width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid var(--line); display: inline-grid; place-items: center; line-height: 1; font-weight: 600; background: var(--bg); color: var(--na); }
.mark[data-v="passed"] { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
.mark[data-v="failed"] { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
.mark[data-v="skipped"] { background: var(--skip-bg); border-color: var(--skip); color: var(--skip); font-size: 14px; }
td.c small { display: block; margin-top: 3px; font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
.empty { color: var(--muted); padding: 20px 0; text-align: center; }
.foot { margin-top: 24px; padding: 14px 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); font-size: 13px; }
.foot code { font-family: var(--font-mono); font-size: 12px; color: var(--fg); }
@media (max-width: 520px) { .bar b i { display: none; } thead th, td.c { width: 60px; } }
@media (prefers-reduced-motion: no-preference) { .track u, .track s, .track em { transition: width .25s ease; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Cinescape UAT and Pre-UAT Checklist</h1>
    <p class="sub">The website test cases WEB-01 to WEB-48, run on the UAT and Pre-UAT websites. Each box shows the latest result of that case on that site; failed cases show the reason under the case name.</p>
    <div class="legend"><span><span class="mark" data-v="passed">&#10003;</span> passed</span><span><span class="mark" data-v="failed">&#10007;</span> failed</span><span><span class="mark" data-v="skipped">&ndash;</span> skipped</span><span><span class="mark">&middot;</span> not run yet</span></div>
  </header>
  <div class="strip"><div class="strip-in">
    <div class="bars" id="bars"></div>
    <div class="filters" id="filters">
      <button type="button" data-f="all" aria-pressed="true">All</button>
      <button type="button" data-f="failed" aria-pressed="false">Failed</button>
      <button type="button" data-f="differs" aria-pressed="false">Different on the two sites</button>
      <button type="button" data-f="none" aria-pressed="false">Not run yet</button>
      <span class="tot" id="tot"></span>
    </div>
  </div></div>
  <div class="tbl"><table><thead id="head"></thead><tbody id="rows"></tbody></table></div>
  <p class="foot" id="foot"></p>
</div>
<script>
(function () {
  var D = ${json};
  var MARK = { passed: "\\u2713", failed: "\\u2717", skipped: "\\u2013", none: "\\u00b7" };
  var filter = "all";
  var ids = Object.keys(D.titles).sort(function (a, b) { return parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10); });
  function r(site, id) { return (D.results[site] || {})[id] || null; }
  function st(x) { return x ? x.s : "none"; }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function dur(s) { return s == null ? "" : s >= 60 ? (Math.round(s / 6) / 10) + " min" : s + " s"; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  var bars = document.getElementById("bars");
  D.sites.forEach(function (s) {
    var n = { passed: 0, failed: 0, skipped: 0 }, last = "";
    ids.forEach(function (id) { var x = r(s.id, id); if (x) { n[x.s]++; if ((x.at || "") > last) last = x.at; } });
    var total = ids.length || 1, none = ids.length - n.passed - n.failed - n.skipped;
    var bar = el("div", "bar"), b = el("b");
    b.appendChild(document.createTextNode(s.label));
    b.appendChild(el("i", null, n.passed + " passed \\u00b7 " + n.failed + " failed" + (n.skipped ? " \\u00b7 " + n.skipped + " skipped" : "") + " \\u00b7 " + none + " not run"));
    var track = el("div", "track");
    [["u", n.passed], ["s", n.failed], ["em", n.skipped]].forEach(function (p) { if (p[1]) { var x = el(p[0]); x.style.width = (100 * p[1] / total) + "%"; track.appendChild(x); } });
    bar.appendChild(b); bar.appendChild(track);
    bar.appendChild(el("small", null, s.url + (last ? " \\u00b7 last result " + when(last) : " \\u00b7 not run yet")));
    bars.appendChild(bar);
  });

  var head = document.getElementById("head"), hr = el("tr");
  hr.appendChild(el("th", null, "Test case"));
  D.sites.forEach(function (s) { hr.appendChild(el("th", null, s.label)); });
  head.appendChild(hr);

  function keep(id) {
    var v = D.sites.map(function (s) { return st(r(s.id, id)); });
    if (filter === "failed") return v.indexOf("failed") >= 0;
    if (filter === "none") return v.indexOf("none") >= 0;
    if (filter === "differs") return v.indexOf("none") < 0 && v.some(function (x) { return x !== v[0]; });
    return true;
  }
  function render() {
    var body = document.getElementById("rows"); body.textContent = ""; var shown = 0;
    ids.forEach(function (id) {
      if (!keep(id)) return; shown++;
      var tr = el("tr"), name = el("td", "name");
      name.appendChild(el("span", "id", id)); name.appendChild(document.createTextNode(D.titles[id]));
      D.sites.forEach(function (s) {
        var x = r(s.id, id);
        if (x && x.s !== "passed" && x.e) { var w = el("span", "why"); w.appendChild(el("b", null, s.label + ": ")); w.appendChild(document.createTextNode(x.e)); name.appendChild(w); }
        if (x && x.n) x.n.forEach(function (t) { var w = el("span", "why note"); w.appendChild(el("b", null, s.label + ": ")); w.appendChild(document.createTextNode(t)); name.appendChild(w); });
      });
      tr.appendChild(name);
      D.sites.forEach(function (s) {
        var x = r(s.id, id), v = st(x), td = el("td", "c"), m = el("span", "mark", MARK[v]);
        if (x) m.setAttribute("data-v", v);
        m.title = s.label + ": " + (x ? v + (x.at ? " \\u00b7 " + when(x.at) : "") : "not run yet");
        td.appendChild(m);
        if (x && x.d != null) td.appendChild(el("small", null, dur(x.d)));
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    if (!shown) { var tr = el("tr"), td = el("td", "empty", "No cases match this filter."); td.colSpan = 1 + D.sites.length; tr.appendChild(td); body.appendChild(tr); }
    document.getElementById("tot").textContent = shown + " of " + ids.length + " cases";
  }
  Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (b) {
    b.addEventListener("click", function () {
      filter = b.getAttribute("data-f");
      Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      render();
    });
  });
  document.getElementById("foot").textContent = "Built " + when(D.built) + " from the test runs. Screenshots and videos of each run are in the dashboard-uat and dashboard-pre-uat folders of the test project.";
  render();
})();
</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`Checklist written to ${outFile}`);
