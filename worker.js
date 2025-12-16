export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Upload endpoint
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }

    // Image access endpoint
    if (url.pathname.startsWith("/img/")) {
      return handleImage(request, env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !file.type.startsWith("image/")) {
    return new Response("Invalid image", { status: 400 });
  }

  const imageId = Date.now().toString();
  const r2Key = `img/${imageId}.jpg`;

  // Use Cloudflare Image Resizing
  const processed = await fetch("https://image-resize.cloudflare.com", {
    method: "POST",
    headers: {
      "Content-Type": file.type
    },
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
    return new Response("Image processing failed", { status: 500 });
  }

  await env.IMG_BUCKET.put(r2Key, processed.body, {
    httpMetadata: {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  const imageUrl = `https://${env.DOMAIN}/${r2Key}`;
  return Response.json({ url: imageUrl });
}

async function handleImage(request, env) {
  const referer = request.headers.get("Referer") || "";
  const allowList = [
    "telegra.ph",
    env.DOMAIN
  ];

  if (!allowList.some(d => referer.includes(d))) {
    return new Response("Forbidden", { status: 403 });
  }

  const key = new URL(request.url).pathname.slice(1);
  const object = await env.IMG_BUCKET.get(key);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
