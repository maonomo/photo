// worker_album_sidebar_v3.js
// v3: Fix admin interactions by rendering stable IDs/classes and using robust event delegation.
// Requires bindings: R2_BUCKET (R2 bucket), DATABASE (D1 database)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/" || path === "") return serveUploadPage(request, env);
      if (path === "/admin" || path === "/pic" || path === "/admin/") return serveAdminPage(request, env);
      if (path === "/upload" && request.method === "POST") return handleUpload(request, env);
      if (path.startsWith("/api/")) return handleAPI(request, env);
      if (path.startsWith("/r2/")) return serveFromR2(path.slice(4), env);
      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return json({ ok: false, error: String(e?.stack || e) }, 500);
    }
  }
};

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" }
  });
}

function assertBindings(env) {
  if (!env.DATABASE) throw new Error("Missing D1 binding: DATABASE");
  if (!env.R2_BUCKET || typeof env.R2_BUCKET.put !== "function") {
    throw new Error("R2 binding error: R2_BUCKET is not an R2 bucket binding (missing .put())");
  }
}

async function serveUploadPage(request, env) {
  let r2Ok = true, r2Err = "";
  try { assertBindings(env); } catch (e) { r2Ok = false; r2Err = String(e.message || e); }

  const page = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>JSimages 上传</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;background:#0b1020;color:#e6e8ef}
.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
.card{width:min(720px,92vw);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 18px 14px;backdrop-filter: blur(8px)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.btn{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
.btn.primary{background:rgba(79,128,255,.35);border-color:rgba(79,128,255,.55)}
input[type=file]{color:#cbd2ff}
.hint{opacity:.9;margin-top:10px;font-size:13px;line-height:1.5}
.ok{color:#7CFFB2}.bad{color:#FF9A9A}
#out{margin-top:12px;white-space:pre-wrap;background:rgba(0,0,0,.35);border-radius:12px;padding:12px;min-height:54px}
.corner{position:fixed;right:14px;bottom:14px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);padding:8px 10px;border-radius:999px;font-size:12px}
.corner.ok{color:#7CFFB2}.corner.bad{color:#FF9A9A}
a{color:#b6c7ff}
</style></head>
<body>
<div class="wrap"><div class="card">
  <div class="row" style="justify-content:space-between">
    <div style="font-weight:700">JSimages 上传</div><div><a href="/admin">进入后台</a></div>
  </div>
  <div class="hint">${r2Ok ? `<span class="ok">✅ R2/D1 绑定正常</span>` : `<span class="bad">⚠️ ${escapeHtml(r2Err)}</span>`}</div>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,.12);margin:14px 0">
  <div class="row">
    <input id="file" type="file" multiple accept="image/*"/>
    <button id="btnUpload" class="btn primary">上传</button>
    <button id="btnClear" class="btn">清空输出</button>
  </div>
  <div id="out">等待上传…</div>
</div></div>
<div id="corner" class="corner ok">JS 正常运行</div>
<script>
(()=>{const out=document.getElementById('out');const file=document.getElementById('file');
const up=document.getElementById('btnUpload');const clr=document.getElementById('btnClear');
const log=(m)=>out.textContent=m+"\n"+out.textContent;clr.onclick=()=>out.textContent="已清空\n";
up.onclick=async()=>{if(!file.files||file.files.length===0){alert('请选择图片');return;}
for(const f of file.files){const fd=new FormData();fd.append('file',f,f.name);log("上传中: "+f.name);
const res=await fetch('/upload',{method:'POST',body:fd});const text=await res.text();
if(!res.ok){log("❌ 失败 "+res.status+": "+text);continue;}
try{const j=JSON.parse(text);log("✅ "+j.url);}catch(e){log("✅ "+text);}}};})();
</script>
</body></html>`;
  return html(page);
}

async function serveAdminPage(request, env) {
  const albums = await fetchAlbums(env.DATABASE);
  const media = await fetchMedia(env.DATABASE);
  const albumOptions = albums.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.image_count||0})</option>`).join("");
  const mediaCards = media.map(m => `
    <div class="media-card" data-id="${m.id}" data-url="${escapeHtml(m.url)}">
      <div class="thumb"><img src="${escapeHtml(m.url)}" alt="Image"/><div class="check">✓</div></div>
      <div class="meta">
        <div class="line"><span class="ext">${escapeHtml(m.ext||"")}</span><span class="time">${escapeHtml(m.created_at||"")}</span></div>
        <div class="line"><select class="moveSel">
          <option value="" selected>移动到相册...</option>
          <option value="remove">从相册移除</option>
          ${albumOptions}
        </select></div>
      </div>
    </div>`).join("");

  const page = `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>图库管理</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;background:#0b1020;color:#e6e8ef}
a{color:#b6c7ff}
.top{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);position:sticky;top:0;backdrop-filter: blur(8px);z-index:20}
.layout{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 56px)}
.side{border-right:1px solid rgba(255,255,255,.10);padding:14px 12px}
.main{padding:14px 16px}
.btn{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);color:#fff;border-radius:10px;padding:9px 11px;cursor:pointer}
.btn.primary{background:rgba(79,128,255,.35);border-color:rgba(79,128,255,.55)}
.btn.danger{background:rgba(255,79,79,.25);border-color:rgba(255,79,79,.5)}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);cursor:pointer;margin:6px 0}
.pill.active{outline:2px solid rgba(120,160,255,.5)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.media-card{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.06);overflow:hidden;cursor:pointer}
.thumb{position:relative;aspect-ratio:4/3;background:rgba(0,0,0,.25);display:grid;place-items:center}
.thumb img{max-width:100%;max-height:100%;display:block}
.check{position:absolute;left:10px;top:10px;width:26px;height:26px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;opacity:0;transform:scale(.95);transition:.12s}
.media-card:hover .check{opacity:.8}
.media-card.selected .check{opacity:1;transform:scale(1);outline:2px solid rgba(124,255,178,.35)}
.meta{padding:10px 10px 12px;display:grid;gap:8px}
.line{display:flex;justify-content:space-between;gap:10px;align-items:center}
.ext{font-size:12px;opacity:.9}.time{font-size:12px;opacity:.7}
select{width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#e6e8ef}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 12px}
.muted{opacity:.7;font-size:13px}
.modal-back{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:50}
.modal{width:min(520px,92vw);background:#0f1732;border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px}
.field{display:grid;gap:6px;margin:10px 0}
input,textarea{width:100%;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#e6e8ef}
textarea{min-height:80px;resize:vertical}
.row{display:flex;gap:8px;justify-content:flex-end}
.corner{position:fixed;right:14px;bottom:14px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);padding:8px 10px;border-radius:999px;font-size:12px;color:#7CFFB2;z-index:60}
</style></head><body>
<div class="top"><div style="font-weight:800">图库管理</div><div class="muted">当前：所有图片 · <a href="/">返回首页</a></div></div>
<div class="layout">
  <aside class="side">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-weight:700">相册</div><button id="btnNewAlbum" class="btn primary">新建</button>
    </div>
    <div id="albumList">
      <div class="pill active" data-album="all">所有图片 <span class="muted">${media.length} 张</span></div>
      <div class="pill" data-album="unassigned">未分类 <span class="muted">只看未分配相册的图片</span></div>
      ${albums.length ? albums.map(a => `<div class="pill" data-album="${a.id}">${escapeHtml(a.name)} <span class="muted">${a.image_count||0} 张</span></div>`).join("") : `<div class="muted" style="margin-top:10px">暂无相册（点击右上角“新建”）</div>`}
    </div>
  </aside>
  <main class="main">
    <div class="muted">媒体文件 <span id="mediaCount">${media.length}</span> 个 · 已选中: <span id="selectedCount">0</span> 个</div>
    <div class="toolbar">
      <button id="btnCopyUrl" class="btn">复制 URL</button>
      <button id="btnCopyMd" class="btn">Markdown</button>
      <button id="btnSelectAll" class="btn">全选</button>
      <button id="btnDelete" class="btn danger">删除</button>
    </div>
    <div id="grid" class="grid">${mediaCards || `<div class="muted">暂无媒体</div>`}</div>
  </main>
</div>

<div id="modalBack" class="modal-back">
  <div class="modal" role="dialog" aria-modal="true">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0">新建相册</h3><button id="btnCloseModal" class="btn">×</button>
    </div>
    <div class="field"><label>相册名称 *</label><input id="albumName" type="text" placeholder="例如：旅行 / 家人 / 美食"/></div>
    <div class="field"><label>相册描述</label><textarea id="albumDesc" placeholder="可选"></textarea></div>
    <div class="field"><label>封面 URL（可选）</label><input id="albumCover" type="text" placeholder="https://..."/></div>
    <div class="row"><button id="btnCancelAlbum" class="btn">取消</button><button id="btnSaveAlbum" class="btn primary">保存</button></div>
  </div>
</div>

<div class="corner">JS 正常运行</div>

<script>
(()=> {
  const grid=document.getElementById('grid');
  const selectedCount=document.getElementById('selectedCount');
  const btnSelectAll=document.getElementById('btnSelectAll');
  const btnDelete=document.getElementById('btnDelete');
  const btnCopyUrl=document.getElementById('btnCopyUrl');
  const btnCopyMd=document.getElementById('btnCopyMd');
  const btnNewAlbum=document.getElementById('btnNewAlbum');
  const modalBack=document.getElementById('modalBack');
  const btnCloseModal=document.getElementById('btnCloseModal');
  const btnCancelAlbum=document.getElementById('btnCancelAlbum');
  const btnSaveAlbum=document.getElementById('btnSaveAlbum');

  const getCards=()=>Array.from(document.querySelectorAll('.media-card'));
  const getSelected=()=>getCards().filter(c=>c.classList.contains('selected'));
  const update=()=>selectedCount.textContent=String(getSelected().length);

  grid.addEventListener('click',(e)=>{
    if(e.target.closest('select')) return;
    const card=e.target.closest('.media-card'); if(!card) return;
    card.classList.toggle('selected'); update();
  });

  grid.addEventListener('change', async (e)=>{
    const sel=e.target.closest('select.moveSel'); if(!sel) return;
    const card=e.target.closest('.media-card'); if(!card) return;
    const id=card.dataset.id; const val=sel.value; sel.disabled=true;
    try{
      if(val==='remove'){ await api('/api/media/'+id+'/album',{method:'PUT',body:JSON.stringify({album_id:null})}); }
      else if(val){ await api('/api/media/'+id+'/album',{method:'PUT',body:JSON.stringify({album_id:Number(val)})}); }
    }catch(err){ alert('移动失败：'+err.message); }
    finally{ sel.value=''; sel.disabled=false; }
  });

  btnSelectAll.onclick=()=>{
    const cards=getCards();
    const all=cards.length && cards.every(c=>c.classList.contains('selected'));
    cards.forEach(c=>c.classList.toggle('selected',!all)); update();
  };

  btnDelete.onclick=async()=>{
    const sel=getSelected(); if(sel.length===0){alert('请先选择要删除的图片');return;}
    if(!confirm('确定删除选中的 '+sel.length+' 张图片吗？')) return;
    try{
      const ids=sel.map(c=>Number(c.dataset.id));
      await api('/api/media/batch-delete',{method:'POST',body:JSON.stringify({ids})});
      sel.forEach(c=>c.remove()); update();
    }catch(err){ alert('删除失败：'+err.message); }
  };

  btnCopyUrl.onclick=async()=>{
    const sel=getSelected(); if(sel.length===0){alert('请先选择图片');return;}
    await navigator.clipboard.writeText(sel.map(c=>c.dataset.url).join('\n'));
    alert('已复制 '+sel.length+' 条 URL');
  };

  btnCopyMd.onclick=async()=>{
    const sel=getSelected(); if(sel.length===0){alert('请先选择图片');return;}
    await navigator.clipboard.writeText(sel.map(c=>'![](' + c.dataset.url + ')').join('\n'));
    alert('已复制 Markdown');
  };

  const open=()=>modalBack.style.display='flex';
  const close=()=>modalBack.style.display='none';
  btnNewAlbum.onclick=open; btnCloseModal.onclick=close; btnCancelAlbum.onclick=close;
  modalBack.addEventListener('click',(e)=>{ if(e.target===modalBack) close(); });

  btnSaveAlbum.onclick=async()=>{
    const name=document.getElementById('albumName').value.trim();
    const description=document.getElementById('albumDesc').value.trim();
    const cover_url=document.getElementById('albumCover').value.trim();
    if(!name){alert('请输入相册名称');return;}
    btnSaveAlbum.disabled=true;
    try{
      await api('/api/albums',{method:'POST',body:JSON.stringify({name,description,cover_url})});
      alert('相册已创建。刷新页面后可见。'); close();
    }catch(err){ alert('创建失败：'+err.message); }
    finally{ btnSaveAlbum.disabled=false; }
  };

  async function api(url,opt={}){
    const res=await fetch(url,{headers:{'content-type':'application/json'},...opt});
    const text=await res.text(); let data;
    try{ data=JSON.parse(text);}catch(e){ data={ok:false,error:text};}
    if(!res.ok || data.ok===false) throw new Error(data.error || ('HTTP '+res.status));
    return data;
  }

  update();
})();
</script>
</body></html>`;
  return html(page);
}

async function handleUpload(request, env) {
  assertBindings(env);
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return json({ ok: false, error: "missing file" }, 400);
  const buf = await file.arrayBuffer();
  const ct = file.type || "application/octet-stream";
  const ext = guessExt(file.name, ct);
  const key = `${Date.now()}_${crypto.randomUUID().slice(0,8)}.${ext}`;
  await env.R2_BUCKET.put(key, buf, { httpMetadata: { contentType: ct } });
  const base = new URL(request.url);
  const url = `${base.origin}/r2/${key}`;
  await env.DATABASE.prepare(`INSERT INTO media (url, ext, created_at, album_id) VALUES (?1, ?2, CURRENT_TIMESTAMP, NULL)`).bind(url, ext).run();
  return json({ ok: true, url, key });
}

async function serveFromR2(key, env) {
  if (!env.R2_BUCKET || typeof env.R2_BUCKET.get !== "function") return new Response("R2 binding missing", { status: 500 });
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const db = env.DATABASE;
  if (!db) return json({ ok: false, error: "Missing D1 binding: DATABASE" }, 500);

  if (path === "/api/albums") {
    if (request.method === "GET") return json({ ok: true, results: await fetchAlbums(db) });
    if (request.method === "POST") {
      const body = await request.json().catch(()=> ({}));
      const name = (body.name || "").trim();
      if (!name) return json({ ok:false, error:"name required" }, 400);
      await db.prepare(`INSERT INTO albums (name, description, cover_url) VALUES (?1, ?2, ?3)`)
        .bind(name, body.description || "", body.cover_url || "").run();
      return json({ ok:true });
    }
  }

  const m1 = path.match(/^\/api\/media\/(\d+)\/album$/);
  if (m1 && request.method === "PUT") {
    const id = Number(m1[1]);
    const body = await request.json().catch(()=> ({}));
    const album_id = body.album_id === null ? null : Number(body.album_id);
    await db.prepare(`UPDATE media SET album_id = ?1 WHERE id = ?2`).bind(album_id, id).run();
    return json({ ok:true });
  }

  if (path === "/api/media/batch-delete" && request.method === "POST") {
    assertBindings(env);
    const body = await request.json().catch(()=> ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
    if (!ids.length) return json({ ok:false, error:"ids required" }, 400);
    const qs = ids.map(()=>"?").join(",");
    const rows = await db.prepare(`SELECT id, url FROM media WHERE id IN (${qs})`).bind(...ids).all();
    for (const r of (rows.results || [])) {
      try{
        const u = new URL(r.url);
        if (u.pathname.startsWith("/r2/")) {
          const key = u.pathname.slice(4); // remove "/r2"
          if (key.startsWith("/")) await env.R2_BUCKET.delete(key.slice(1));
        }
      }catch(e){}
    }
    await db.prepare(`DELETE FROM media WHERE id IN (${qs})`).bind(...ids).run();
    return json({ ok:true });
  }

  return json({ ok:false, error:"Not Found" }, 404);
}

async function fetchAlbums(db) {
  const rs = await db.prepare(`SELECT a.*, COUNT(m.url) AS image_count FROM albums a LEFT JOIN media m ON a.id=m.album_id GROUP BY a.id ORDER BY a.created_at DESC`).all();
  return rs.results || [];
}
async function fetchMedia(db) {
  const rs = await db.prepare(`SELECT id, url, ext, created_at, album_id FROM media ORDER BY created_at DESC LIMIT 200`).all();
  return rs.results || [];
}
function escapeHtml(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
function guessExt(name, ct){
  const lower=String(name||"").toLowerCase(); const m=lower.match(/\.([a-z0-9]{1,6})$/); if(m) return m[1];
  if(ct.includes("png")) return "png"; if(ct.includes("webp")) return "webp"; if(ct.includes("gif")) return "gif";
  if(ct.includes("jpeg")||ct.includes("jpg")) return "jpg"; return "bin";
}