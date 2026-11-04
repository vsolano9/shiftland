// Packs dist/ into the zip itch.io takes and checks release items R1, R2 and R12 (docs/PLAN.md).
// It only packs and checks; nothing leaves this machine. usage: npm run pack:check     exits 1 on a failed check
import { deflateRawSync, crc32 } from 'node:zlib';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, relative, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist');
const out = resolve(process.argv[2] ?? join(root, 'release', 'shiftland-web.zip'));

const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist).map(p => ({ name: relative(dist, p).replaceAll('\\', '/'), data: readFileSync(p) }));

function zip(entries) {
  const parts = [], central = []; let at = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name), raw = deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(0x5821, 12); // a fixed date (2024-01-01), so one dist always makes one zip
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(raw.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(n.length, 26);
    parts.push(head, n, raw);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0x5821, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(raw.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(at, 42);
    central.push(c, n);
    at += head.length + n.length + raw.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...parts, cd, end]);
}

const bytes = zip(files);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, bytes);

let failed = 0;
const check = (id, ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${what}`); if (!ok) failed++; };
const longest = Math.max(...files.map(f => f.name.length));
check('R1', files.some(f => f.name === 'index.html'), 'index.html at the zip root');
check('R1', files.length < 1000, `${files.length} files (under 1000)`);
check('R1', longest < 240, `longest path ${longest} (under 240)`);
check('R1', bytes.length < 15e6, `zip ${(bytes.length / 1e6).toFixed(2)} MB (under 15 MB)`);

const text = files.filter(f => ['.html', '.js', '.css'].includes(extname(f.name)));
const absolute = text.filter(f => /["'(]\/assets\//.test(f.data.toString('utf8'))).map(f => f.name);
check('R2', absolute.length === 0, `no absolute /assets URL${absolute.length ? `: ${absolute}` : ''}`);
const remote = text.flatMap(f => f.data.toString('utf8').match(/(?:src|href)=["']https?:\/\/[^"']+/g) ?? []);
check('R2', remote.length === 0, `no remote src or href${remote.length ? `: ${remote.slice(0, 3)}` : ''}`);

// The only binary files allowed are the open-licensed UI font; art and sound are made by code at run time.
const media = files.map(f => f.name).filter(n => !['.html', '.js', '.css'].includes(extname(n)));
const stray = media.filter(n => !/\.woff2?$/.test(n) || !/fredoka/i.test(n));
check('R12', stray.length === 0, `${media.length} non-code files, all Fredoka fonts${stray.length ? `; stray: ${stray}` : ''}`);

console.log(`zip ${out}\nsha256 ${createHash('sha256').update(bytes).digest('hex')}`);
process.exit(failed ? 1 : 0);
