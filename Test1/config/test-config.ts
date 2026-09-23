import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface TestConfig {
  urls: {
    home: string;
  };
  credentials: {
    username: string;
    password: string;
  };
}

export const testConfig: TestConfig = {
  urls: {
    home: process.env.BASE_URL ?? 'https://uatweb.cinescape.com.kw',
  },
  credentials: {
    username: process.env.TEST_USERNAME ?? '',
    password: process.env.TEST_PASSWORD ?? '',
  },
};