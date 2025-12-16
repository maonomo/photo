
/**
 * Refactored professional image bed based on original architecture
 * - Server-side enforced JPG only
 * - Max edge 3000px
 * - Quality 85
 * - No video support
 * - R2 key structured by date
 *
 * Required bindings:
 * IMG_BUCKET (R2)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Upload endpoint (keep original path)
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }

    // Image access
    if (url.pathname.startsWith("/img/")) {
      return handleImage(request, env);
    }

    // Fallback to original HTML/UI if needed
    return new Response("OK");
  }
};

async function handleUpload(request, env) {
  const form = await request.formData();
  const file = form.get("file");

  if (!file || !file.type.startsWith("image/")) {
    return Response.json({ error: "Only image upload allowed" }, { status: 400 });
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const id = Date.now();

  const key = `img/${yyyy}/${mm}/${dd}/${id}.jpg`;

  // Force server-side image processing
  const processed = await fetch("https://image-resize.cloudflare.com", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
    cf: {
      image: {
        format: "jpeg",
        quality: 85,
        fit: "scale-down",
        width: 3000,
        height: 3000,
        metadata: "none"
      }
    }
  });

  if (!processed.ok) {
    return Response.json({ error: "Image processing failed" }, { status: 500 });
  }

  await env.IMG_BUCKET.put(key, processed.body, {
    httpMetadata: {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  return Response.json({
    success: true,
    url: `${request.headers.get("Origin") || ""}/${key}`
  });
}

async function handleImage(request, env) {
  const key = new URL(request.url).pathname.slice(1);
  const obj = await env.IMG_BUCKET.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
