# KNCC Web Automation

End-to-end browser tests for the **Cinescape Kuwait website** (UAT: <https://uatweb.cinescape.com.kw>),
written with [Playwright](https://playwright.dev) and TypeScript.

[![CINESCAPE WEB Testing](https://github.com/Chaithu200926/KNCC-Web-Automation/actions/workflows/cinescape-web-testing.yml/badge.svg)](https://github.com/Chaithu200926/KNCC-Web-Automation/actions/workflows/cinescape-web-testing.yml)

**Latest results dashboard:** <https://chaithu200926.github.io/KNCC-Web-Automation/>

## What is tested

| Test case | File | What it does |
|---|---|---|
| **WEB-01 Homepage header icons** | [`web-01-homepage-header-icons.spec.ts`](Test1/tests/web-01-homepage-header-icons.spec.ts) | Loads the homepage and checks the Cinescape header, Search, the Arabic/English language switch, My Profile (sign-in dialog) and the Menu. |
| **WEB-02 Homepage footer links navigation** | [`web-02-homepage-footer-links-navigation.spec.ts`](Test1/tests/web-02-homepage-footer-links-navigation.spec.ts) | Checks every footer heading, clicks each footer link and verifies where it lands, and checks the Sign in / Register buttons, app store and social media links. |
| **WEB-03 Cinema booking with wallet, confirmed and cancelled in My Profile** | [`web-03-cinema-booking-with-wallet.spec.ts`](Test1/tests/web-03-cinema-booking-with-wallet.spec.ts) | Books a real ticket end to end: picks a movie and tomorrow's showtime, signs in with email OTP, chooses seat category, ticket type and a seat, skips food, pays with the wallet, confirms the booking in **My Profile**, then **cancels it** so no booking is left behind. |
| **WEB-04 Cinema booking with KNET, confirmed and cancelled in My Profile** | [`web-04-cinema-booking-with-knet.spec.ts`](Test1/tests/web-04-cinema-booking-with-knet.spec.ts) | Same flow as the wallet booking, but pays with **KNET**: selects KNET, enters the test card on the KNET test gateway (`kpaytest.com.kw`), returns to the confirmation page, checks the booking in **My Profile** and cancels it. |

The booking tests use a real test account on the UAT site. They are skipped automatically when
`TEST_USERNAME`, `TEST_PASSWORD` or `TEST_PIN` is not set; the KNET test also needs the
`TEST_KNET_*` settings. Card details are hidden in screenshots and videos, and the KNET test
records no trace.

### Website test cases (WEB-xx)

The **Web** sheet of `KNCC-Test-Cases-All-Projects.xlsx` lists only automatable cases, numbered WEB-01..WEB-49 in
order: the automated cases first (WEB-01..WEB-43), then the cases still planned (WEB-44..WEB-49). Each automated
case has its own spec file, `Test1/tests/web-NN-<test case name>.spec.ts`, whose test title is the case number and
name from the sheet (e.g. "WEB-24 Seat category, seat type and ticket quantity"). All of them run in CI and on the QA PC, each in a new incognito browser context (no cookies or cache carried over from other tests,
service workers blocked), so no cache clearing is needed. Cases still planned (no spec yet): WEB-44 credit
card, WEB-45 gift card, WEB-46 bank offer, WEB-47 recharge the wallet, WEB-48 browsers and screen sizes, WEB-49 network
lost during booking. The specs share the test account, so run them one at a time:

```bash
cd Test1
npx playwright test tests/web-*.spec.ts --workers=1                     # all website test cases
npx playwright test tests/web-24-seat-category-type-quantity.spec.ts    # one test case
```

| Area | Test cases |
|---|---|
| Account | WEB-05 sign up with a new account, WEB-06 sign-up form validation, WEB-07 sign in and sign out, WEB-08 wrong details, WEB-09 forgot password, WEB-10 session stays signed in, WEB-11 profile details, WEB-12 edit profile, WEB-13 change password, WEB-37 preferences |
| Homepage and movies | WEB-14 homepage content, WEB-15 events & promotions, WEB-16 search, WEB-17 Arabic website, WEB-18 movie lists, WEB-19 filters, WEB-20 trailer, WEB-39 movie details, WEB-40 cinema map links |
| Showtimes and prices | WEB-21 by location, WEB-22 today and future dates, WEB-23 half-price Monday |
| Seats and food | WEB-24 seat category / type / quantity, WEB-25 seat map rules, WEB-26 food for today's show, WEB-27 no food for a future date, WEB-38 same seat chosen by two users |
| Holds, payment and bookings | WEB-28 price check to history, WEB-29 seat free again after going back, WEB-30 cancel during booking, WEB-31 payment cancelled at the gateway, WEB-32 OTP during booking, WEB-33 ticket matches the choices, WEB-34 upcoming bookings, WEB-35 history, WEB-36 cancel and wallet refund, WEB-41 refresh does not book again, WEB-42 KNET refund to the wallet, WEB-43 pay with an empty wallet |

WEB-28, 33, 34, 36 and 41 pay with the test account's wallet and WEB-42 with the KNET test card; each cancels its
booking afterwards. WEB-26 and WEB-28 need a show later the same day (food is offered for today's shows only), so
they skip themselves late in the evening. WEB-31, 38 and 43 also need the second test account (`TEST2_*`
settings), an account with no wallet balance that never pays: WEB-31 and 38 use it as a second user in a separate
browser. WEB-05, 09 and 13 register a **new UAT user on every run** (a unique `kncc.autotest.<time>@example.com`
email, so the provided accounts are never changed); on UAT the email and mobile OTP for new users is `111111`.

## Related test projects

The other Cinescape test projects are separate repositories (they sit next to `Test1/` on the QA PC and are
ignored by this repo):

| Project | Repository | Dashboard |
|---|---|---|
| Kiosk backend API | [CinescapeKiosk-API-Automation](https://github.com/Chaithu200926/CinescapeKiosk-API-Automation) | <https://chaithu200926.github.io/CinescapeKiosk-API-Automation/> |
| Kiosk Windows app (UI, build 13) | [Kiosk-UI-13-Test-Automation](https://github.com/Chaithu200926/Kiosk-UI-13-Test-Automation) | <https://chaithu200926.github.io/Kiosk-UI-13-Test-Automation/> |
| Android app | [Cinescape-Android-Test-Automation](https://github.com/Chaithu200926/Cinescape-Android-Test-Automation) (private) | local HTML report |

## Project layout

```
.github/workflows/
  cinescape-web-testing.yml   The CI workflow (see below)
Test1/                        The Playwright project
  tests/                      The four CI tests, the WEB-xx test cases (web-NN-*.spec.ts) + shared fixtures
  pages/HomePage.ts           Page object for the homepage (header, menu, sections)
  pages/WebSite.ts, Account.ts, Booking.ts, BookingChecks.ts, Food.ts, NewUser.ts
                              Shared steps for the WEB-xx tests (pages, sign-in, booking, seat map, food, amounts)
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

npm test                            # run every test file (use --workers=1 for the WEB-xx tests, see above)
npm run test:headed                 # watch the browser while tests run
npm run test:ui                     # Playwright's interactive UI mode
npx playwright test tests/web-01-homepage-header-icons.spec.ts   # run one test

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
| `TEST2_USERNAME` | WEB-31, 38, 43 | Second test account email (an account with no wallet balance) |
| `TEST2_PASSWORD` | WEB-31, 38, 43 | Second test account password |
| `TEST2_PIN` | WEB-31, 38, 43 | Email OTP code for the second test account |
| `TEST_NEW_USER_OTP` | WEB-05, 09, 13 | Email and mobile OTP for newly registered users (default `111111`, the UAT value) |

`.env` is git-ignored. Never commit real credentials.

## Continuous integration: **CINESCAPE WEB Testing**

The workflow [`cinescape-web-testing.yml`](.github/workflows/cinescape-web-testing.yml) runs every automated
website test case (43 specs, about 30 minutes) one after another on a GitHub-hosted Ubuntu machine with Chromium.
The dashboard shows each test with its steps, a screenshot after every step, the test video (and the second user's
video for the two-user tests) and the notes the test recorded, such as booking IDs, amounts and refunds.

- **When:** on every push to `main` (documentation-only changes are skipped) and on demand from
  **Actions → CINESCAPE WEB Testing → Run workflow**.
- **One at a time:** runs queue instead of overlapping, and the tests run one after another, because they
  share the test accounts on the shared UAT site.
- **Secrets required** (Settings → Secrets and variables → Actions): `TEST_USERNAME`,
  `TEST_PASSWORD`, `TEST_PIN`, `TEST2_USERNAME`, `TEST2_PASSWORD`, `TEST2_PIN`, `TEST_KNET_NUMBER`,
  `TEST_KNET_EXPIRY`, `TEST_KNET_PIN`.

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
