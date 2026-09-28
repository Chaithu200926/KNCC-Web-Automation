# KNCC Web Automation

End-to-end browser tests for the **Cinescape Kuwait website** (UAT: <https://uatweb.cinescape.com.kw>),
written with [Playwright](https://playwright.dev) and TypeScript.

[![CINESCAPE WEB Testing](https://github.com/Chaithu200926/KNCC-Web-Automation/actions/workflows/cinescape-web-testing.yml/badge.svg)](https://github.com/Chaithu200926/KNCC-Web-Automation/actions/workflows/cinescape-web-testing.yml)

**Latest results dashboard:** <https://chaithu200926.github.io/KNCC-Web-Automation/>

## What is tested

| Test | File | What it does |
|---|---|---|
| **Homepage header icons** | [`cinescape-homepage-header-icons.spec.ts`](Test1/tests/cinescape-homepage-header-icons.spec.ts) | Loads the homepage and checks the Cinescape header, Search, the Arabic/English language switch, My Profile (sign-in dialog) and the Menu. |
| **Homepage footer links** | [`cinescape-homepage-footer-links.spec.ts`](Test1/tests/cinescape-homepage-footer-links.spec.ts) | Checks every footer heading, clicks each footer link and verifies where it lands, and checks the Sign in / Register buttons, app store and social media links. |
| **Cinema booking flow (wallet)** | [`cinescape-cinema-booking.spec.ts`](Test1/tests/cinescape-cinema-booking.spec.ts) | Books a real ticket end to end: picks a movie and tomorrow's showtime, signs in with email OTP, chooses seat category, ticket type and a seat, skips food, pays with the wallet, confirms the booking in **My Profile**, then **cancels it** so no booking is left behind. |
| **Cinema booking flow (KNET)** | [`cinescape-cinema-booking-knet.spec.ts`](Test1/tests/cinescape-cinema-booking-knet.spec.ts) | Same flow as the wallet booking, but pays with **KNET**: selects KNET, enters the test card on the KNET test gateway (`kpaytest.com.kw`), returns to the confirmation page, checks the booking in **My Profile** and cancels it. |

The booking tests use a real test account on the UAT site. They are skipped automatically when
`TEST_USERNAME`, `TEST_PASSWORD` or `TEST_PIN` is not set; the KNET test also needs the
`TEST_KNET_*` settings. Card details are hidden in screenshots and videos, and the KNET test
records no trace.

## Project layout

```
.github/workflows/
  cinescape-web-testing.yml   The CI workflow (see below)
Test1/                        The Playwright project
  tests/                      The four test files + shared fixtures
  pages/HomePage.ts           Page object for the homepage (header, menu, sections)
  config/test-config.ts       Reads URLs and credentials from environment variables
  reporters/text-reporter.ts  Writes a plain-text execution log
  scripts/generate-dashboard.js  Builds the visual dashboard and the run summary
  team-portal/                Optional local web portal to run tests and browse past runs
  playwright.config.ts        Browser, reporters, screenshots/videos/traces settings
```

## Run the tests on your computer

Requirements: [Node.js](https://nodejs.org) 22 or later.

```bash
cd Test1
npm ci                              # install packages
npx playwright install chromium     # download the browser
cp .env.example .env                # then fill in the values (see below)

npm test                            # run all four tests
npm run test:headed                 # watch the browser while tests run
npm run test:ui                     # Playwright's interactive UI mode
npx playwright test tests/cinescape-homepage-header-icons.spec.ts   # run one test

npm run report                      # open the Playwright HTML report
npm run dashboard                   # build dashboard/index.html from the last run
npm run portal                      # start the local team portal (see team-portal/README.md)
```

### Settings (`Test1/.env`)

| Variable | Needed for | Meaning |
|---|---|---|
| `BASE_URL` | all tests | Site under test. Default: `https://uatweb.cinescape.com.kw` |
| `TEST_USERNAME` | booking tests | Test account email |
| `TEST_PASSWORD` | booking tests | Test account password |
| `TEST_PIN` | booking tests | Email OTP code for the test account |
| `TEST_KNET_NUMBER` | KNET booking test | KNET test card number |
| `TEST_KNET_EXPIRY` | KNET booking test | Card expiry as `MM/YY` |
| `TEST_KNET_PIN` | KNET booking test | Card PIN, exactly 4 digits (the KNET test card accepts any 4 digits) |

`.env` is git-ignored. Never commit real credentials.

## Continuous integration: **CINESCAPE WEB Testing**

The workflow [`cinescape-web-testing.yml`](.github/workflows/cinescape-web-testing.yml) runs all
four tests together on a GitHub-hosted Ubuntu machine with Chromium.

- **When:** on every push to `main` (documentation-only changes are skipped) and on demand from
  **Actions → CINESCAPE WEB Testing → Run workflow**.
- **One at a time:** runs queue instead of overlapping, because both booking tests use a single
  test account on the shared UAT site.
- **Secrets required** (Settings → Secrets and variables → Actions): `TEST_USERNAME`,
  `TEST_PASSWORD`, `TEST_PIN`, `TEST_KNET_NUMBER`, `TEST_KNET_EXPIRY`, `TEST_KNET_PIN`.

### What each run produces

| Where | What you get |
|---|---|
| **Run page summary** | Results table: each test's result, duration, number of steps, its last 10 results and the failure reason; plus a *Failed steps* table and the pass-rate trend. |
| **"Test results" check** | Pass/fail per test on the commit (JUnit). |
| **GitHub Pages dashboard** | Summary tiles, trend chart of recent runs, run & environment details, an overview table, and for every test its steps with screenshots, the failure details and the full test video. |
| **Artifact `cinescape-web-reports`** | The dashboard, Playwright HTML report and raw results (videos, traces, JUnit/JSON), kept for 14 days. The Playwright report and traces are only here, never on the public Pages site, because traces record the values typed into fields. |

A run is marked ❌ when any test fails. The dashboard is still published, so the failure can be
inspected there.

## Notes

- Tests run in Chromium only. Firefox and WebKit are disabled in `playwright.config.ts` because the
  local Windows Application Control policy blocks them.
- Every run records screenshots, a video and a trace for each test (`screenshot`, `video` and
  `trace` are `on`), and retries are off so each test has exactly one recording.
