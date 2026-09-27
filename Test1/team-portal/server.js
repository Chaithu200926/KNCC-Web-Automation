const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const projectRoot = path.resolve(__dirname, '..');
const dataRoot = path.join(__dirname, 'data');
const runsRoot = path.join(dataRoot, 'runs');
const port = Number(process.env.PORTAL_PORT || 4173);
const host = '127.0.0.1';
const adminUsername = String(process.env.TEST_USERNAME || '').trim();
const adminPassword = String(process.env.TEST_PASSWORD || '');
const sessions = new Map();
const loginFailures = new Map();
let activeRun = null;

fs.mkdirSync(runsRoot, { recursive: true });

function safeEqual(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 32_000) reject(new Error('Request is too large.')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid request body.')); } });
    req.on('error', reject);
  });
}
function cookieValue(req, name) {
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}
function getSession(req) {
  const token = cookieValue(req, 'portal_session');
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return { token, ...session };
}
function requireSession(req, res) {
  const session = getSession(req);
  if (!session) sendJson(res, 401, { message: 'Your session expired. Please sign in again.' });
  return session;
}
function userView(email) {
  return { email, isAdmin: true, displayName: email.split('@')[0], initials: email.split('@')[0].split(/[._-]/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase() || 'TM' };
}
function flattenSteps(steps, parents = [], runId) {
  return (steps || []).flatMap((step) => {
    const titlePath = [...parents, step.title].filter(Boolean);
    const attachments = (step.attachments || []).map((attachment, index) => materializeAttachment(attachment, runId, `step-${crypto.randomUUID()}-${index}`)).filter(Boolean);
    const current = { title: titlePath.join(' › '), status: step.error ? 'failed' : 'passed', durationMs: step.duration || 0, error: step.error?.message || '', attachments };
    return [current, ...flattenSteps(step.steps, titlePath, runId)];
  });
}
function relativeEvidencePath(absolutePath, runId) {
  if (!absolutePath) return '';
  const runDir = path.join(runsRoot, runId);
  let candidate = path.resolve(absolutePath);
  if (!candidate.startsWith(`${runDir}${path.sep}`)) {
    const normalized = String(absolutePath).replace(/\\/g, '/');
    const marker = normalized.toLowerCase().lastIndexOf('/test-results/');
    if (marker >= 0) candidate = path.join(runDir, 'test-results', normalized.slice(marker + '/test-results/'.length));
  }
  const relative = path.relative(runDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(candidate)) return '';
  return relative.split(path.sep).join('/');
}
function materializeAttachment(attachment, runId, unique) {
  if (attachment.contentType === 'image/png' && attachment.body) {
    const relative = `evidence/${unique}.png`;
    const destination = path.join(runsRoot, runId, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(attachment.body, 'base64'));
    return { kind: 'image', name: attachment.name || 'Screenshot', url: `/api/portal/evidence?run=${encodeURIComponent(runId)}&file=${encodeURIComponent(relative)}` };
  }
  if (attachment.contentType?.startsWith('image/') && attachment.path) {
    const relative = relativeEvidencePath(attachment.path, runId);
    return relative ? { kind: 'image', name: attachment.name || 'Screenshot', url: `/api/portal/evidence?run=${encodeURIComponent(runId)}&file=${encodeURIComponent(relative)}` } : null;
  }
  return null;
}
function flattenSuite(suite, runId, startedAt, runNumber, runDurationMs, target) {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) {
    const result = test.results?.[test.results.length - 1] || {};
    const attachments = (result.attachments || []).map((attachment, index) => ({ attachment, index }));
    const videoAttachment = attachments.find(({ attachment }) => attachment.contentType?.startsWith('video/'))?.attachment;
    let video = null;
    if (videoAttachment?.path) {
      const relative = relativeEvidencePath(videoAttachment.path, runId);
      if (relative) video = { name: videoAttachment.name || 'Test recording', contentType: videoAttachment.contentType, url: `/api/portal/evidence?run=${encodeURIComponent(runId)}&file=${encodeURIComponent(relative)}` };
    }
    const steps = flattenSteps(result.steps, [], runId);
    for (const { attachment, index } of attachments) {
      if (attachment.contentType?.startsWith('image/')) {
        const evidence = materializeAttachment(attachment, runId, `test-${target.length}-${index}`);
        if (evidence) steps.push({ title: attachment.name || 'Test screenshot', status: 'passed', durationMs: 0, attachments: [evidence] });
      }
    }
    const status = result.status || test.status || 'unknown';
    const started = result.startTime || startedAt;
    target.push({
      id: `${runId}-${target.length}`, testName: test.title || spec.title || 'Playwright test', suiteLabel: spec.file ? path.basename(spec.file, path.extname(spec.file)).replaceAll('-', ' ') : 'Cinescape web test',
      status, startedAt: started, durationMs: result.duration || 0, runDurationMs, runNumber, browser: test.projectName || 'Chromium',
      summary: result.error?.message || (status === 'passed' ? 'This test completed successfully.' : status === 'skipped' ? 'This test was skipped. Check the setup requirements in the test report.' : 'Open the failed step and its evidence to see where the test stopped.'),
      steps, video,
    });
  }
  for (const child of suite.suites || []) flattenSuite(child, runId, startedAt, runNumber, runDurationMs, target);
}
function loadAllReports() {
  const reports = [];
  for (const runId of fs.readdirSync(runsRoot)) {
    const runDir = path.join(runsRoot, runId);
    try {
      reports.push(...JSON.parse(fs.readFileSync(path.join(runDir, 'reports.json'), 'utf8')));
    } catch (error) { console.warn(`Skipping incomplete local run ${runId}: ${error.message}`); }
  }
  return reports.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}
function archiveRun(runId, startedAt, durationMs, exitCode) {
  const runDir = path.join(runsRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  for (const name of ['test-results', 'playwright-report']) {
    const source = path.join(projectRoot, name);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(runDir, name), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({ startedAt, durationMs, exitCode, runNumber: runId.slice(-6) }, null, 2));
  const resultsPath = path.join(runDir, 'test-results', 'results.json');
  if (fs.existsSync(resultsPath)) {
    const parsed = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const reports = [];
    for (const suite of parsed.suites || []) flattenSuite(suite, runId, startedAt, runId.slice(-6), durationMs, reports);
    fs.writeFileSync(path.join(runDir, 'reports.json'), JSON.stringify(reports));
    // The raw Playwright JSON can contain hundreds of megabytes of inline screenshots.
    // The normalized report plus evidence files is what the portal needs to retain.
    fs.rmSync(resultsPath, { force: true });
  }
}
function safeReportFile(runId, requestedFile) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) return null;
  const runDir = path.resolve(runsRoot, runId);
  const candidate = path.resolve(runDir, requestedFile || '');
  if (!candidate.startsWith(`${runDir}${path.sep}`) || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  return candidate;
}

async function handleApi(req, res, url) {
  const route = url.pathname.slice('/api/portal/'.length);
  if (route === 'auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const key = username.toLowerCase();
    const attempt = loginFailures.get(key) || { count: 0, blockedUntil: 0 };
    if (attempt.blockedUntil > Date.now()) return sendJson(res, 429, { message: 'Too many sign-in attempts. Wait five minutes and try again.' });
    const valid = Boolean(adminUsername && adminPassword)
      && safeEqual(key, adminUsername.toLowerCase())
      && safeEqual(password, adminPassword);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= 5) { attempt.count = 0; attempt.blockedUntil = Date.now() + 5 * 60_000; }
      loginFailures.set(key, attempt);
      return sendJson(res, 401, { message: 'Username or password is incorrect.' });
    }
    loginFailures.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { email: adminUsername, expiresAt: Date.now() + 8 * 60 * 60_000 });
    return sendJson(res, 200, { message: 'Signed in.' }, { 'Set-Cookie': `portal_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
  }
  if (route === 'session' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    return sendJson(res, 200, userView(session.email));
  }
  if (route === 'auth/logout' && req.method === 'POST') {
    const session = getSession(req); if (session) sessions.delete(session.token);
    return sendJson(res, 200, { message: 'Signed out.' }, { 'Set-Cookie': 'portal_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (route === 'reports' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const date = url.searchParams.get('date');
    const reports = loadAllReports().filter((report) => !date || String(report.startedAt).slice(0, 10) === date);
    return sendJson(res, 200, { reports });
  }
  if (route === 'evidence' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const file = safeReportFile(url.searchParams.get('run'), url.searchParams.get('file'));
    if (!file) return sendJson(res, 404, { message: 'Evidence file not found.' });
    const contentTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4' };
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(file).pipe(res);
  }
  if (route === 'runs' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (activeRun) return sendJson(res, 409, { message: 'A test run is already in progress.' });
    const { suite = 'all' } = await readBody(req);
    if (!['all', 'cinema-booking'].includes(suite)) return sendJson(res, 400, { message: 'Choose a supported test suite.' });
    const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const startedAt = new Date().toISOString();
    const cli = path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js');
    const args = [cli, 'test', '--retries=0'];
    if (suite === 'cinema-booking') args.push('tests/cinescape-cinema-booking.spec.ts');
    const child = spawn(process.execPath, args, { cwd: projectRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    activeRun = { runId, startedAt, child };
    const logFile = path.join(runsRoot, `${runId}.log`);
    const output = fs.createWriteStream(logFile);
    child.stdout.pipe(output); child.stderr.pipe(output);
    child.on('close', (code) => {
      output.end();
      const durationMs = Date.now() - Date.parse(startedAt);
      try { archiveRun(runId, startedAt, durationMs, code); }
      catch (error) { console.error(`Unable to archive run ${runId}:`, error); }
      fs.rmSync(logFile, { force: true });
      activeRun = null;
      console.log(`Local Playwright run ${runId} finished with exit code ${code}.`);
    });
    return sendJson(res, 202, { runNumber: runId.slice(-6), runId, status: 'running' });
  }
  if (route === 'run-status' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    return sendJson(res, 200, { running: Boolean(activeRun), runId: activeRun?.runId || null });
  }
  return sendJson(res, 404, { message: 'Unknown portal API route.' });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(__dirname, `.${pathname}`);
  if (!file.startsWith(`${path.resolve(__dirname)}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return;
  }
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  try {
    if (url.pathname.startsWith('/api/portal/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (error) {
    console.error('Portal request failed:', error);
    if (!res.headersSent) sendJson(res, 500, { message: 'The local portal encountered an error.' });
    else res.destroy();
  }
});

if (!adminUsername || !adminPassword) console.warn('Set TEST_USERNAME and TEST_PASSWORD in .env before signing in.');
server.listen(port, host, () => {
  console.log(`Team Test Portal: http://${host}:${port}`);
  console.log('Local-only mode: teammates on other devices cannot connect to this address.');
});
