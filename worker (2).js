
const UPLOAD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Image Upload</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont;
  background: #f6f7f9;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
.card {
  background: #fff;
  width: 380px;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.08);
}
h1 {
  font-size: 18px;
  margin-bottom: 16px;
}
.drop {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  color: #666;
  cursor: pointer;
}
.drop.drag {
  border-color: #4f46e5;
  background: #eef2ff;
}
.result {
  margin-top: 12px;
  font-size: 13px;
  word-break: break-all;
}
button {
  margin-top: 12px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
}
</style>
</head>
<body>
<div class="card">
  <h1>上传图片</h1>
  <div class="drop" id="drop">点击或拖拽图片到这里</div>
  <input type="file" id="file" hidden accept="image/*">
  <div class="result" id="result"></div>
</div>

<script>
const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const result = document.getElementById('result');

drop.onclick = () => fileInput.click();

drop.ondragover = e => {
  e.preventDefault();
  drop.classList.add('drag');
};
drop.ondragleave = () => drop.classList.remove('drag');
drop.ondrop = e => {
  e.preventDefault();
  drop.classList.remove('drag');
  upload(e.dataTransfer.files[0]);
};

fileInput.onchange = () => upload(fileInput.files[0]);

async function upload(file) {
  if (!file) return;
  result.textContent = '上传中…';

  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/upload', { method: 'POST', body: form });
  const data = await res.json();

  if (data.url) {
    result.innerHTML = `
      <div>上传成功：</div>
      <a href="${data.url}" target="_blank">${data.url}</a>
      <button onclick="navigator.clipboard.writeText('${data.url}')">
        复制链接
      </button>
    `;
  } else {
    result.textContent = '上传失败';
  }
}
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(UPLOAD_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }

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
    return new Response(JSON.stringify({ error: "Invalid image" }), { status: 400 });
  }

  const imageId = Date.now().toString();
  const r2Key = `img/${imageId}.jpg`;

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
    return new Response(JSON.stringify({ error: "Image processing failed" }), { status: 500 });
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
  const allowList = ["telegra.ph", env.DOMAIN];

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
