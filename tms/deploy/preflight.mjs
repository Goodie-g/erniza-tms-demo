import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const dir = process.env.PGLITE_PATH || '/app/apps/api/.data/pgdata';
const info = {
  node: process.version,
  arch: process.arch,
  uid: typeof process.getuid === 'function' ? process.getuid() : null,
  gid: typeof process.getgid === 'function' ? process.getgid() : null,
  cwd: process.cwd(),
  dir,
  memTotalMB: Math.round(os.totalmem() / 1048576),
  memFreeMB: Math.round(os.freemem() / 1048576),
};

try {
  const st = fs.statSync(dir);
  info.dirMode = (st.mode & 0o777).toString(8);
  info.dirUid = st.uid;
  info.dirGid = st.gid;
  fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
  info.dirWritable = true;
} catch (error) {
  info.dirWritable = false;
  info.dirError = String(error);
}
console.log('PREFLIGHT info', JSON.stringify(info));

try {
  const mem = new PGlite({ debug: 1 });
  await mem.waitReady;
  const result = await mem.query('select 1 as ok');
  console.log('PREFLIGHT memory OK', JSON.stringify(result.rows));
  await mem.close();
} catch (error) {
  console.error('PREFLIGHT memory FAILED', error, error?.cause);
}

const copy = '/tmp/pglite-preflight';
try {
  fs.rmSync(copy, { recursive: true, force: true });
  fs.cpSync(dir, copy, { recursive: true });
  const db = new PGlite(copy, { debug: 1 });
  await db.waitReady;
  const result = await db.query('select count(*)::int as n from admin_users');
  console.log('PREFLIGHT disk OK', JSON.stringify(result.rows));
  await db.close();
} catch (error) {
  console.error('PREFLIGHT disk FAILED', error, error?.cause);
} finally {
  fs.rmSync(copy, { recursive: true, force: true });
}
