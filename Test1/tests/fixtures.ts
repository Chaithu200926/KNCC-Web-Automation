import { test as base } from '@playwright/test';
import { testConfig, TestConfig } from '../config/test-config';

export const test = base.extend<{ testConfig: TestConfig }>({
  testConfig: async ({}, use) => {
    await use(testConfig);
  },
});

export { expect } from '@playwright/test';