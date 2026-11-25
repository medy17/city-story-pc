// Pure Node.js decoder for Storm8/TeamLava .s8i (sprite) and .s8h (halo) 16-bit textures.
// Zero external dependencies (uses Node's built-in zlib for PNG encoding).
//
// Binary layout of Storm8 .s8i / .s8h files (format 1):
//   Offset  0 (u8)   : file_format (1 = 16-bit texture)
//   Offset  1 (i32LE): GL format (0x1907 = GL_RGB, 0x1908 = GL_RGBA)
//   Offset  5 (7B)   : padding / reserved
//   Offset 12 (i32LE): bpp (24 = RGB565, 32 = RGBA4444)
//   Offset 16 (f32LE): rect.x
//   Offset 20 (f32LE): rect.y
//   Offset 24 (f32LE): rect.width
//   Offset 28 (f32LE): rect.height
//   Offset 32        : width * height * uint16LE pixels (bottom-up OpenGL row order)
//   Trailing         : alpha hit-test bitmask (size, width, height, mask bytes)

const zlib = require("zlib");

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

function decodeS8Buffer(buf, label = "<buffer>") {
  if (buf.length < 32) {
    throw new Error(`Buffer too small for .s8 header: ${label}`);
  }
  const fileFormat = buf.readUInt8(0);
  const bpp = buf.readInt32LE(12);
  const w = Math.round(buf.readFloatLE(24));
  const h = Math.round(buf.readFloatLE(28));
  if (fileFormat !== 1 || w <= 0 || h <= 0 || w > 2048 || h > 2048) {
    throw new Error(`Unsupported .s8 header in ${label}: fmt=${fileFormat} bpp=${bpp} ${w}x${h}`);
  }

  const rgba = Buffer.alloc(w * h * 4);
  let minX = w, maxX = -1, minY = h, maxY = -1;
  let off = 32;

  for (let glY = 0; glY < h; glY++) {
    const pngY = h - 1 - glY;
    for (let x = 0; x < w; x++) {
      const val = buf.readUInt16LE(off);
      off += 2;
      let r, g, b, a;
      if (bpp === 24) {
        // GL_UNSIGNED_SHORT_5_6_5
        r = ((val >> 11) & 0x1f) * 255 / 31;
        g = ((val >> 5) & 0x3f) * 255 / 63;
        b = (val & 0x1f) * 255 / 31;
        a = 255;
      } else {
        // GL_UNSIGNED_SHORT_4_4_4_4
        r = ((val >> 12) & 0x0f) * 17;
        g = ((val >> 8) & 0x0f) * 17;
        b = ((val >> 4) & 0x0f) * 17;
        a = (val & 0x0f) * 17;
      }
      const idx = (pngY * w + x) * 4;
      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(g);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = Math.round(a);
      if (a > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (pngY < minY) minY = pngY;
        if (pngY > maxY) maxY = pngY;
      }
    }
  }

  return {
    w,
    h,
    bpp,
    png: encodePNG(w, h, rgba),
    bbox: maxX >= minX ? { minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 } : null
  };
}

function pngToIco(pngBuf) {
  const w = pngBuf.readUInt32BE(16);
  const h = pngBuf.readUInt32BE(20);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = w >= 256 ? 0 : w;
  entry[1] = h >= 256 ? 0 : h;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuf]);
}

module.exports = { decodeS8Buffer, encodePNG, pngToIco };
