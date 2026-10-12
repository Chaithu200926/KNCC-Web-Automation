// UAT website (http://10.35.1.66:8103): runs the tests in tests-uat.
// npx playwright test -c playwright.uat.config.ts   ->  report in playwright-report-uat, files in test-results-uat.
import { siteRunConfig } from './config/site-run-config';
import { siteUrl } from './tests-uat/site';

export default siteRunConfig('uat', './tests-uat', siteUrl);
