// Pre-UAT website (http://10.35.1.66:8123): runs the tests in tests-pre-uat.
// npx playwright test -c playwright.pre-uat.config.ts   ->  report in playwright-report-pre-uat, files in test-results-pre-uat.
import { siteRunConfig } from './config/site-run-config';
import { siteUrl } from './tests-pre-uat/site';

export default siteRunConfig('pre-uat', './tests-pre-uat', siteUrl);
