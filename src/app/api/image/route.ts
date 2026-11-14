import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl } from "@/lib/ingestion/article";
import { computeImageLuminance } from "@/lib/image/luminance";
import { validateHeroImage, isLikelyLogoOrTracker } from "@/lib/image/dimensions";
import { applyRouteGuard } from "@/lib/ratelimit/limiter";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(request: NextRequest) {
  const guard = await applyRouteGuard(request, "image", { maxRequests: 60, windowSeconds: 60 });
  if (guard) return guard;

  const urlParam = request.nextUrl.searchParams.get("url");

  if (!urlParam) {
    return NextResponse.json(
      { error: "Missing required 'url' query parameter" },
      { status: 400 }
    );
  }

  // 1. SSRF & Scheme Validation
  const validation = validateSafeUrl(urlParam);
  if (!validation.isValid || !validation.sanitizedUrl) {
    return NextResponse.json(
      { error: validation.errorMessage || "URL rejected due to security policy" },
      { status: 403 }
    );
  }

  // 1b. Reject logos, favicons, avatars, and tracking pixels upfront
  if (isLikelyLogoOrTracker(urlParam)) {
    return NextResponse.json(
      { error: "Image candidate rejected: URL matches logo, icon, or tracker pattern" },
      { status: 422 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(validation.sanitizedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "FakeNewzz-ImageProxy/1.0",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed with status ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    // 2. Validate Content-Type
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json(
        { error: "Requested resource is not a valid image format" },
        { status: 415 }
      );
    }

    // 3. Validate Content-Length if present
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the maximum allowed size of 5 MB" },
        { status: 413 }
      );
    }

    // 4. Read body with stream size guard
    const reader = res.body?.getReader();
    if (!reader) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Image exceeds the maximum allowed size of 5 MB" },
          { status: 413 }
        );
      }
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        },
      });
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.length;
        if (receivedBytes > MAX_IMAGE_SIZE_BYTES) {
          reader.cancel();
          return NextResponse.json(
            { error: "Image exceeds the maximum allowed size of 5 MB" },
            { status: 413 }
          );
        }
        chunks.push(value);
      }
    }

    // Concatenate chunks
    const totalBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      totalBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Validate image dimensions, aspect ratio, and logo/tracker characteristics
    const heroValidation = validateHeroImage(urlParam, totalBuffer, contentType);
    if (!heroValidation.isValid) {
      return NextResponse.json(
        { error: heroValidation.rejectionReason || "Image rejected due to size or aspect ratio limits" },
        { status: 422 }
      );
    }

    const luminance = computeImageLuminance(totalBuffer, contentType);

    if (request.nextUrl.searchParams.get("info") === "true") {
      return NextResponse.json({
        success: true,
        luminance: Number(luminance.toFixed(3)),
        contentType,
        bytes: totalBuffer.byteLength,
        dimensions: heroValidation.dimensions,
      });
    }

    return new NextResponse(totalBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
        "X-Image-Luminance": luminance.toFixed(3),
        ...(heroValidation.dimensions?.width ? { "X-Image-Width": String(heroValidation.dimensions.width) } : {}),
        ...(heroValidation.dimensions?.height ? { "X-Image-Height": String(heroValidation.dimensions.height) } : {}),
      },
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "Image fetch timed out" }, { status: 504 });
    }
    return NextResponse.json(
      { error: err?.message || "Internal error fetching image" },
      { status: 500 }
    );
  }
}

