import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',

	fullyParallel: true,

	forbidOnly: !!process.env.CI,

	retries: process.env.CI ? 2 : 0,

	workers: process.env.CI ? 2 : undefined,

	reporter: [
		['list'],
		['html', { outputFolder: 'playwright-report', open: 'never' }],
	],

	use: {
		baseURL: process.env.BASE_URL || 'https://your-test-website.example',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},

	projects: [
		{
			name: 'desktop-chromium',
			use: {
				...devices['Desktop Chrome'],
			},
		},
		{
			name: 'mobile-chrome',
			use: {
				...devices['Pixel 5'],
			},
		},
		{
			name: 'mobile-safari',
			use: {
				...devices['iPhone 13'],
			},
		},
	],
});
