#!/usr/bin/env node
// Pure Node.js ZIP/APK extractor & Storm8 .s8i/.s8h texture decoder.
// Works both as a library (called from Electron's first-run importer) and via CLI.
//
// CLI usage: node scripts/extract_apk.js <path-to-city-story.apk> [output-assets-dir]

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { decodeS8Buffer } = require("./s8_decoder");

function readZipEntries(zipBuf) {
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

function extractApk(apkPath, outAssetsDir, onProgress = null) {
  if (!apkPath || !fs.existsSync(apkPath)) {
    throw new Error(`APK file not found: ${apkPath}`);
  }
  const emit = (pct, message) => {
    if (typeof onProgress === "function") onProgress({ pct, message });
  };

  emit(5, "Reading APK archive...");
  const zipBuf = fs.readFileSync(apkPath);
  const entries = readZipEntries(zipBuf);

  const s8iEntries = [];
  const s8hEntries = [];
  const thumbEntries = [];
  const uiMdpi = [];
  const uiHdpi = [];
  const wavEntries = [];

  for (const e of entries) {
    const n = e.name;
    if (n.startsWith("assets/") && n.endsWith(".s8i")) s8iEntries.push(e);
    else if (n.startsWith("assets/") && n.endsWith(".s8h")) s8hEntries.push(e);
    else if (n.startsWith("res/drawable/") && n.endsWith(".png")) thumbEntries.push(e);
    else if (n.startsWith("res/drawable-mdpi/") && n.endsWith(".png")) uiMdpi.push(e);
    else if (n.startsWith("res/drawable-hdpi/") && n.endsWith(".png")) uiHdpi.push(e);
    else if (n.startsWith("res/raw/") && n.endsWith(".wav")) wavEntries.push(e);
  }

  if (s8iEntries.length === 0) {
    throw new Error("No City Story .s8i textures found in this APK. Make sure you selected a City Story APK (com.teamlava.citystory).");
  }

  for (const sub of ["sprites", "halos", "thumbs", "ui", "audio"]) {
    fs.mkdirSync(path.join(outAssetsDir, sub), { recursive: true });
  }

  const meta = {};
  const totalWork = s8iEntries.length + s8hEntries.length + thumbEntries.length + uiMdpi.length + uiHdpi.length + wavEntries.length;
  let done = 0;
  const tick = (label) => {
    done++;
    if (done % 40 === 0 || done === totalWork) {
      emit(10 + Math.round((done / totalWork) * 80), label);
    }
  };

  for (const e of s8iEntries) {
    const baseName = path.basename(e.name, ".s8i");
    const decoded = decodeS8Buffer(e.readData(), e.name);
    fs.writeFileSync(path.join(outAssetsDir, "sprites", baseName + ".png"), decoded.png);
    meta[baseName] = { w: decoded.w, h: decoded.h, bpp: decoded.bpp, bbox: decoded.bbox };
    tick(`Decoding building sprites (${s8iEntries.length})...`);
  }

  for (const e of s8hEntries) {
    const baseName = path.basename(e.name, ".s8h");
    const decoded = decodeS8Buffer(e.readData(), e.name);
    fs.writeFileSync(path.join(outAssetsDir, "halos", baseName + ".png"), decoded.png);
    tick(`Decoding selection halos (${s8hEntries.length})...`);
  }

  for (const e of thumbEntries) {
    fs.writeFileSync(path.join(outAssetsDir, "thumbs", path.basename(e.name)), e.readData());
    tick("Extracting market thumbnails...");
  }

  for (const e of [...uiMdpi, ...uiHdpi]) {
    fs.writeFileSync(path.join(outAssetsDir, "ui", path.basename(e.name)), e.readData());
    tick("Extracting UI artwork...");
  }

  for (const e of wavEntries) {
    fs.writeFileSync(path.join(outAssetsDir, "audio", path.basename(e.name)), e.readData());
    tick("Extracting original WAV audio...");
  }

  fs.writeFileSync(path.join(outAssetsDir, "sprite_meta.json"), JSON.stringify(meta, null, 2));
  emit(92, "Extracted all textures & audio!");

  return {
    s8iCount: s8iEntries.length,
    s8hCount: s8hEntries.length,
    thumbCount: thumbEntries.length,
    uiCount: uiMdpi.length + uiHdpi.length,
    wavCount: wavEntries.length
  };
}

if (require.main === module) {
  const apkPath = process.argv[2];
  if (!apkPath) {
    console.error("Usage: node scripts/extract_apk.js <path-to-CityStory.apk> [output-assets-dir]");
    process.exit(1);
  }
  const outDir = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.resolve(__dirname, "..", "web", "assets");
  const stats = extractApk(apkPath, outDir, ({ pct, message }) => {
    if (pct === 5 || pct === 92) console.log(`[${pct}%] ${message}`);
  });
  console.log(
    `Done! Decoded ${stats.s8iCount} .s8i sprites, ${stats.s8hCount} .s8h halos, ` +
    `${stats.thumbCount} thumbnails, ${stats.uiCount} UI textures, and ${stats.wavCount} WAV audio files.`
  );
}

module.exports = { extractApk };
