import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve('SiemensApplication/.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

export const ENV = {
  LOGIN_USER: process.env.LOGIN_USER || '',
  LOGIN_PASS: process.env.LOGIN_PASS || '',
  TOTP_SECRET: (process.env.TOTP_SECRET || '').replace(/\s+/g, '').toUpperCase(),
  MFA_CODE: (process.env.MFA_CODE || '').trim(),
  APPROVER_DEFAULT_PASS: process.env.APPROVER_DEFAULT_PASS || '',
  APPROVER_0_PASS: process.env.APPROVER_0_PASS || '',
  APPROVER_1_PASS: process.env.APPROVER_1_PASS || '',
  APPROVER_2_PASS: process.env.APPROVER_2_PASS || '',
  LOGIN_NONSSO_USER: process.env.LOGIN_NONSSO_USER

};
