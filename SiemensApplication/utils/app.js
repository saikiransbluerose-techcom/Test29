import fs from 'fs';
import path from 'path';

export function loadAppConfig() {
  const p = path.resolve('SiemensApplication/config/app.config.json');
  if (!fs.existsSync(p)) throw new Error(`Missing config: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
