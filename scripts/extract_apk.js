#!/usr/bin/env node
// Extracts and decodes all sprites (.s8i/.s8h), UI PNGs, thumbnails, and WAV audio
// directly from a user-supplied City Story APK (pure Node.js, zero npm dependencies).
//
// Usage: node scripts/extract_apk.js <path-to-city-story.apk>

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { decodeS8Buffer, pngToIco } = require("./s8_decoder");

const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "web", "assets");
const nativeDir = path.join(rootDir, "native");

const apkPath = process.argv[2];
if (!apkPath) {
  console.error("Usage: node scripts/extract_apk.js <path-to-CityStory.apk>");
  process.exit(1);
}
if (!fs.existsSync(apkPath)) {
  console.error(`APK not found: ${apkPath}`);
  process.exit(1);
}

// Minimal pure-Node ZIP reader (handles Store & Deflate entries from standard APKs)
function readZipEntries(zipBuf) {
  // Locate End of Central Directory (signature 0x06054b50)
  let eocdOff = -1;
  const minOff = Math.max(0, zipBuf.length - 65557);
  for (let i = zipBuf.length - 22; i >= minOff; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOff = i;
      break;
    }
  }
  if (eocdOff < 0) throw new Error("Invalid APK/ZIP file (EOCD header not found)");

  const totalEntries = zipBuf.readUInt16LE(eocdOff + 10);
  let cdOff = zipBuf.readUInt32LE(eocdOff + 16);
  const entries = [];

  for (let i = 0; i < totalEntries; i++) {
    if (zipBuf.readUInt32LE(cdOff) !== 0x02014b50) {
      throw new Error(`Corrupt central directory entry at offset ${cdOff}`);
    }
    const method = zipBuf.readUInt16LE(cdOff + 10);
    const compSize = zipBuf.readUInt32LE(cdOff + 20);
    const nameLen = zipBuf.readUInt16LE(cdOff + 28);
    const extraLen = zipBuf.readUInt16LE(cdOff + 30);
    const commentLen = zipBuf.readUInt16LE(cdOff + 32);
    const localHeaderOff = zipBuf.readUInt32LE(cdOff + 42);
    const name = zipBuf.slice(cdOff + 46, cdOff + 46 + nameLen).toString("utf8");

    entries.push({
      name,
      readData() {
        const lNameLen = zipBuf.readUInt16LE(localHeaderOff + 26);
        const lExtraLen = zipBuf.readUInt16LE(localHeaderOff + 28);
        const dataStart = localHeaderOff + 30 + lNameLen + lExtraLen;
        const raw = zipBuf.slice(dataStart, dataStart + compSize);
        if (method === 0) return raw;
        if (method === 8) return zlib.inflateRawSync(raw);
        throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
      }
    });

    cdOff += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

console.log(`Reading APK: ${apkPath}`);
const zipBuf = fs.readFileSync(apkPath);
const entries = readZipEntries(zipBuf);

for (const sub of ["sprites", "halos", "thumbs", "ui", "audio"]) {
  fs.mkdirSync(path.join(outDir, sub), { recursive: true });
}

const meta = {};
let s8iCount = 0;
let s8hCount = 0;
let thumbCount = 0;
let uiCount = 0;
let wavCount = 0;

// Process drawable-mdpi before drawable-hdpi so HDPI overrides MDPI cleanly
const uiMdpi = [];
const uiHdpi = [];

for (const e of entries) {
  const name = e.name;
  if (name.startsWith("assets/") && name.endsWith(".s8i")) {
    const baseName = path.basename(name, ".s8i");
    const decoded = decodeS8Buffer(e.readData(), name);
    fs.writeFileSync(path.join(outDir, "sprites", baseName + ".png"), decoded.png);
    meta[baseName] = { w: decoded.w, h: decoded.h, bpp: decoded.bpp, bbox: decoded.bbox };
    s8iCount++;
  } else if (name.startsWith("assets/") && name.endsWith(".s8h")) {
    const baseName = path.basename(name, ".s8h");
    const decoded = decodeS8Buffer(e.readData(), name);
    fs.writeFileSync(path.join(outDir, "halos", baseName + ".png"), decoded.png);
    s8hCount++;
  } else if (name.startsWith("res/drawable/") && name.endsWith(".png")) {
    fs.writeFileSync(path.join(outDir, "thumbs", path.basename(name)), e.readData());
    thumbCount++;
  } else if (name.startsWith("res/drawable-mdpi/") && name.endsWith(".png")) {
    uiMdpi.push(e);
  } else if (name.startsWith("res/drawable-hdpi/") && name.endsWith(".png")) {
    uiHdpi.push(e);
  } else if (name.startsWith("res/raw/") && name.endsWith(".wav")) {
    fs.writeFileSync(path.join(outDir, "audio", path.basename(name)), e.readData());
    wavCount++;
  }
}

for (const e of [...uiMdpi, ...uiHdpi]) {
  fs.writeFileSync(path.join(outDir, "ui", path.basename(e.name)), e.readData());
  uiCount++;
}

fs.writeFileSync(path.join(outDir, "sprite_meta.json"), JSON.stringify(meta, null, 2));

// Generate native Windows app.ico from extracted icon.png
const iconPngPath = path.join(outDir, "ui", "icon.png");
if (fs.existsSync(iconPngPath) && fs.existsSync(nativeDir)) {
  fs.writeFileSync(path.join(nativeDir, "app.ico"), pngToIco(fs.readFileSync(iconPngPath)));
  console.log("Generated native/app.ico from icon.png");
}

console.log(
  `Done! Decoded ${s8iCount} .s8i sprites, ${s8hCount} .s8h halos, ` +
  `${thumbCount} thumbnails, ${uiCount} UI textures, and ${wavCount} WAV audio files.`
);
