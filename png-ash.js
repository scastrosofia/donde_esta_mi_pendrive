// Decode a PNG and print a coarse ASCII brightness map + color info.
const fs = require('fs'), zlib = require('zlib');

function decode(path) {
  const buf = fs.readFileSync(path);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const bitDepth = buf[24], colorType = buf[25];
  let idat = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') idat.push(buf.slice(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const line = raw.slice(pos, pos + stride); pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let val = line[x];
      if (filter === 1) val = (val + a) & 255;
      else if (filter === 2) val = (val + b) & 255;
      else if (filter === 3) val = (val + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = val;
    }
    prev = cur;
  }
  return { w, h, colorType, bpp, out };
}

const { w, h, colorType, bpp, out } = decode(process.argv[2]);
console.log(process.argv[2], w + 'x' + h, 'colorType=' + colorType);

// ASCII map: AW x AH cells, average luma, but weight alpha (transparent = space).
const AW = 56, AH = 34;
const ramp = ' .:-=+*#%@';
let hasAlpha = colorType === 6;
for (let cy = 0; cy < AH; cy++) {
  let row = '';
  for (let cx = 0; cx < AW; cx++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const x0 = Math.floor(cx * w / AW), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / AW));
    const y0 = Math.floor(cy * h / AH), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / AH));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * w + x) * bpp;
        if (hasAlpha && out[o + 3] < 40) { a += 0; n++; continue; }
        r += out[o]; g += out[o + 1]; b += out[o + 2];
        if (hasAlpha) a += out[o + 3];
        n++;
      }
    }
    if (n === 0) { row += ' '; continue; }
    r /= n; g /= n; b /= n;
    if (hasAlpha && a / n < 90) { row += ' '; continue; }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    row += ramp[Math.min(ramp.length - 1, Math.floor(lum / 256 * ramp.length))];
  }
  console.log(row);
}
