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
    pin: string;
  };
  /** Second test account (no wallet balance, no payment methods): the second user in WEB-31 / 38 / 44, the empty wallet in WEB-43. */
  secondAccount: {
    username: string;
    password: string;
    pin: string;
  };
  /** Email and mobile OTP for the new users that WEB-05 / 09 / 13 register (on UAT always 111111). */
  newUserOtp: string;
  payment: {
    cardNumber: string;
    cardExpiry: string;
    cardCvv: string;
    knetNumber: string;
    knetExpiry: string;
    knetPin: string;
  };
}

export const testConfig: TestConfig = {
  urls: {
    home: process.env.BASE_URL ?? 'https://uatweb.cinescape.com.kw',
  },
  credentials: {
    username: process.env.TEST_USERNAME ?? '',
    password: process.env.TEST_PASSWORD ?? '',
    pin: process.env.TEST_PIN ?? '',
  },
  secondAccount: {
    username: process.env.TEST2_USERNAME ?? '',
    password: process.env.TEST2_PASSWORD ?? '',
    pin: process.env.TEST2_PIN ?? '',
  },
  newUserOtp: process.env.TEST_NEW_USER_OTP ?? '111111',
  payment: {
    cardNumber: process.env.TEST_CARD_NUMBER ?? '',
    cardExpiry: process.env.TEST_CARD_EXPIRY ?? '',
    cardCvv: process.env.TEST_CARD_CVV ?? '',
    knetNumber: process.env.TEST_KNET_NUMBER ?? '',
    knetExpiry: process.env.TEST_KNET_EXPIRY ?? '',
    knetPin: process.env.TEST_KNET_PIN ?? '',
  },
};