/**
 * Server-side image dimension extraction and candidate filtering.
 * Parses image headers (JPEG, PNG, WebP, GIF, SVG) without external native libraries.
 */

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isPanorama: boolean;
}

export interface ImageValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  dimensions?: ImageDimensions;
}

// Patterns identifying icons, favicons, logos, trackers, and spacer pixels
const FORBIDDEN_IMAGE_PATTERNS = [
  /favicon/i,
  /logo[-_.]/i,
  /[-_]logo\./i,
  /\/logos?\//i,
  /avatar/i,
  /badge/i,
  /spacer/i,
  /pixel/i,
  /1x1/i,
  /tracking/i,
  /advert/i,
  /banner[-_]ad/i,
  /\.ico$/i,
];

/**
 * Checks whether an image URL matches common logo, icon, or tracker patterns.
 */
export function isLikelyLogoOrTracker(url: string): boolean {
  if (!url) return true;
  return FORBIDDEN_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extracts width and height from raw image buffer headers.
 * Supports PNG, JPEG, WebP, GIF, and SVG.
 */
export function extractBufferDimensions(
  buffer: Uint8Array,
  contentType?: string
): ImageDimensions | null {
  if (!buffer || buffer.length < 16) return null;

  // 1. PNG: 8-byte signature, IHDR chunk at offset 8 (width at 16, height at 20)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer.length >= 24
  ) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width > 0 && height > 0) {
      return buildDimensions(width, height);
    }
  }

  // 2. GIF: 'GIF87a' or 'GIF89a' (width at 6, height at 8, 16-bit LE)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer.length >= 10
  ) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width > 0 && height > 0) {
      return buildDimensions(width, height);
    }
  }

  // 3. WebP: 'RIFF'....'WEBP'
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 30
  ) {
    // VP8 chunk (lossy)
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
      const width = ((buffer[26] | (buffer[27] << 8)) & 0x3fff);
      const height = ((buffer[28] | (buffer[29] << 8)) & 0x3fff);
      if (width > 0 && height > 0) return buildDimensions(width, height);
    }
    // VP8L chunk (lossless)
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      if (width > 0 && height > 0) return buildDimensions(width, height);
    }
    // VP8X chunk (extended)
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      if (width > 0 && height > 0) return buildDimensions(width, height);
    }
  }

  // 4. JPEG: Starts with 0xFFD8, scans for SOF0/SOF2 markers (0xFFC0, 0xFFC2)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF markers: C0, C1, C2, C3, C5, C6, C7, C9, CA, CB, CD, CE, CF
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        if (width > 0 && height > 0) {
          return buildDimensions(width, height);
        }
      }
      const segmentLength = view.getUint16(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  // 5. SVG: Text-based viewBox or width/height attributes
  if (
    contentType?.includes("svg") ||
    (buffer[0] === 0x3c && buffer[1] === 0x73 && buffer[2] === 0x76 && buffer[3] === 0x67) ||
    (buffer[0] === 0x3c && buffer[1] === 0x3f && buffer[2] === 0x78)
  ) {
    try {
      const text = new TextDecoder().decode(buffer.slice(0, Math.min(2048, buffer.length)));
      const vbMatch = text.match(/viewBox=["'][\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);
      if (vbMatch) {
        const width = parseFloat(vbMatch[1]);
        const height = parseFloat(vbMatch[2]);
        if (width > 0 && height > 0) return buildDimensions(width, height);
      }
      const wMatch = text.match(/width=["']([\d.]+)p?x?["']/i);
      const hMatch = text.match(/height=["']([\d.]+)p?x?["']/i);
      if (wMatch && hMatch) {
        const width = parseFloat(wMatch[1]);
        const height = parseFloat(hMatch[2]);
        if (width > 0 && height > 0) return buildDimensions(width, height);
      }
    } catch {}
  }

  return null;
}

function buildDimensions(width: number, height: number): ImageDimensions {
  const aspectRatio = width / height;
  return {
    width,
    height,
    aspectRatio: Number(aspectRatio.toFixed(2)),
    isPortrait: height > width * 1.15,
    isPanorama: aspectRatio >= 2.5,
  };
}

/**
 * Validates candidate image according to production hero requirements:
 * 1. Must not be a logo, icon, avatar, or tracking pixel.
 * 2. Must be at least 800px on the long side.
 * 3. Aspect ratio must not be extremely narrow (width/height <= 4 and height/width <= 3).
 */
export function validateHeroImage(
  url: string,
  buffer?: Uint8Array,
  contentType?: string
): ImageValidationResult {
  if (isLikelyLogoOrTracker(url)) {
    return {
      isValid: false,
      rejectionReason: "URL matches logo, icon, or tracker pattern",
    };
  }

  if (buffer) {
    const dims = extractBufferDimensions(buffer, contentType);
    if (dims) {
      const longSide = Math.max(dims.width, dims.height);
      if (longSide < 800) {
        return {
          isValid: false,
          rejectionReason: `Image smaller than 800px on long side (${longSide}px)`,
          dimensions: dims,
        };
      }

      if (dims.aspectRatio > 4.0) {
        return {
          isValid: false,
          rejectionReason: `Extremely narrow horizontal aspect ratio (${dims.aspectRatio}:1 > 4:1)`,
          dimensions: dims,
        };
      }

      if (dims.height / dims.width > 3.0) {
        return {
          isValid: false,
          rejectionReason: `Extremely narrow vertical aspect ratio (${(dims.height / dims.width).toFixed(2)}:1 > 3:1)`,
          dimensions: dims,
        };
      }

      return {
        isValid: true,
        dimensions: dims,
      };
    }
  }

  return { isValid: true };
}

