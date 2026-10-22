// Pre-Prod website (http://10.35.1.66:8113): runs the tests in tests-pre-prod.
// npx playwright test -c playwright.pre-prod.config.ts   ->  report in playwright-report-pre-prod, files in test-results-pre-prod.
import { siteRunConfig } from './config/site-run-config';
import { siteUrl } from './tests-pre-prod/site';

export default siteRunConfig('pre-prod', './tests-pre-prod', siteUrl);
