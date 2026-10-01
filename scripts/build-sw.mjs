import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
// Small original app icon, generated at build time using only Node standard APIs.
const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
};
for (const size of [192, 512]) {
  const bytes = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const shaft =
        Math.abs(u + v - 1) < 0.067 &&
        u > 0.265 &&
        u < 0.73 &&
        v > 0.265 &&
        v < 0.735;
      const tip =
        (u > 0.31 && u < 0.75 && v > 0.25 && v < 0.34) ||
        (u > 0.66 && u < 0.75 && v > 0.25 && v < 0.69);
      const color = shaft || tip ? [237, 243, 230] : [35, 78, 64],
        i = y * (size * 4 + 1) + 1 + x * 4;
      bytes.set([...color, 255], i);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    `dist/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(bytes)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name !== "sw.js" && !entry.name.endsWith(".map"))
      files.push(relative("dist", path).replaceAll("\\", "/"));
  }
}
walk("dist");
const hash = createHash("sha256");
hash.update(readFileSync(new URL(import.meta.url)));
for (const file of files.sort())
  hash.update(file).update(readFileSync(join("dist", file)));
const version = hash.digest("hex").slice(0, 16);
writeFileSync(
  "dist/sw.js",
  `// Generated atomically from the production build. No development assets cached.
const PREFIX='vector-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+'${version}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new URL(file,self.registration.scope).href))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).slice(0,-1).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{if(event.request.mode==='navigate')return await cache.match(new URL('index.html',self.registration.scope).href)||fetch(event.request);return await cache.match(event.request,{ignoreVary:true})||await caches.match(event.request,{ignoreVary:true})||fetch(event.request);}));});
`,
);
console.log(`Offline build: ${files.length} assets, cache version ${version}`);
