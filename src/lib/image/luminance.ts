import zlib from "node:zlib";

/**
 * Image Luminance Analyzer
 *
 * Computes average normalized relative luminance (0.0 to 1.0)
 * from image buffers server-side for adaptive scrim contrast.
 */

/**
 * Relative luminance formula per ITU-R BT.709 / sRGB:
 * Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function sRgbToLinear(val: number): number {
  const norm = val / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function rgbToLuminance(r: number, g: number, b: number): number {
  const rLin = sRgbToLinear(r);
  const gLin = sRgbToLinear(g);
  const bLin = sRgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Computes average luminance of a PNG buffer using IDAT chunk decompression.
 */
function computePngLuminance(buffer: Buffer | Uint8Array): number | null {
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) {
      return null;
    }

    // Read IHDR chunk
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf[24];
    const colorType = buf[25];

    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6 && colorType !== 0)) {
      // For non-8-bit or palette PNGs, fallback to byte sampling
      return sampleByteLuminance(buf);
    }

    // Collect IDAT chunks
    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset < buf.length - 8) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") {
        idatChunks.push(buf.subarray(offset + 8, offset + 8 + length));
      }
      offset += 12 + length;
    }

    if (idatChunks.length === 0) return null;

    const compressed = Buffer.concat(idatChunks);
    const decompressed = zlib.inflateSync(compressed);

    let bytesPerPixel = 3;
    if (colorType === 6) bytesPerPixel = 4; // RGBA
    if (colorType === 0) bytesPerPixel = 1; // Grayscale

    const stride = 1 + width * bytesPerPixel;
    let totalLuminance = 0;
    let sampleCount = 0;

    // Sample pixels across rows (step by step to be fast)
    const rowStep = Math.max(1, Math.floor(height / 100));
    const colStep = Math.max(1, Math.floor(width / 100));

    for (let y = 0; y < height; y += rowStep) {
      const rowStart = y * stride + 1; // skip filter byte
      for (let x = 0; x < width; x += colStep) {
        const px = rowStart + x * bytesPerPixel;
        if (px + bytesPerPixel <= decompressed.length) {
          if (colorType === 0) {
            const gray = decompressed[px];
            totalLuminance += sRgbToLinear(gray);
          } else {
            const r = decompressed[px];
            const g = decompressed[px + 1];
            const b = decompressed[px + 2];
            totalLuminance += rgbToLuminance(r, g, b);
          }
          sampleCount++;
        }
      }
    }

    return sampleCount > 0 ? totalLuminance / sampleCount : null;
  } catch {
    return null;
  }
}

/**
 * Samples byte values of an image buffer to estimate luminance.
 */
function sampleByteLuminance(buf: Buffer): number {
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(buf.length / 500));
  for (let i = 0; i < buf.length; i += step) {
    sum += buf[i];
    count++;
  }
  return count > 0 ? (sum / count) / 255 : 0.4;
}

/**
 * Analyzes SVG text content for background and fill luminance.
 */
function computeSvgLuminance(text: string): number {
  const hexMatches = text.match(/#([0-9a-fA-F]{3,6})\b/g) || [];
  if (hexMatches.length === 0) {
    // Default SVG if unspecified
    return 0.5;
  }

  let totalLum = 0;
  let count = 0;
  for (const hex of hexMatches) {
    const clean = hex.replace("#", "");
    let r = 0, g = 0, b = 0;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length === 6) {
      r = parseInt(clean.slice(0, 2), 16);
      g = parseInt(clean.slice(2, 4), 16);
      b = parseInt(clean.slice(4, 6), 16);
    }
    totalLum += rgbToLuminance(r, g, b);
    count++;
  }
  return count > 0 ? totalLum / count : 0.5;
}

/**
 * Computes average normalized luminance (0.0 = total black, 1.0 = total white)
 * from an image buffer.
 */
export function computeImageLuminance(
  buffer: Buffer | Uint8Array,
  contentType?: string | null
): number {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!buf || buf.length === 0) return 0.4;

  const type = (contentType || "").toLowerCase();

  // 1. Try SVG
  if (type.includes("svg") || (buf.length > 4 && buf.toString("utf8", 0, 100).includes("<svg"))) {
    return computeSvgLuminance(buf.toString("utf8"));
  }

  // 2. Try PNG
  if (type.includes("png") || (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50)) {
    const pngLum = computePngLuminance(buf);
    if (pngLum !== null && !isNaN(pngLum)) {
      return Math.max(0, Math.min(1, pngLum));
    }
  }

  // 3. JPEG or other binary formats
  // Sample pixel data from body
  const sampleLum = sampleByteLuminance(buf);
  return Math.max(0, Math.min(1, sampleLum));
}

