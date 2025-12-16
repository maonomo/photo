export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const domain = env.DOMAIN;
    const DATABASE = env.DATABASE;
    const USERNAME = env.USERNAME;
    const PASSWORD = env.PASSWORD;
    const adminPath = env.ADMIN_PATH;
    const enableAuth = env.ENABLE_AUTH === 'true';
    const R2_BUCKET = env.R2_BUCKET;
    const maxSizeMB = env.MAX_SIZE_MB ? parseInt(env.MAX_SIZE_MB, 10) : 10;
    const maxSize = maxSizeMB * 1024 * 1024;

    switch (pathname) {
      case '/':
        return await handleRootRequest(request, USERNAME, PASSWORD, enableAuth);
      case `/${adminPath}`:
        return await handleAdminRequest(DATABASE, request, USERNAME, PASSWORD, adminPath);
      case '/upload':
        return request.method === 'POST' ? await handleUploadRequest(request, DATABASE, enableAuth, USERNAME, PASSWORD, domain, R2_BUCKET, maxSize) : new Response('Method Not Allowed', { status: 405 });
      case '/bing-images':
        return handleBingImagesRequest();
      case '/delete-images':
        return await handleDeleteImagesRequest(request, DATABASE, USERNAME, PASSWORD, R2_BUCKET);
      case '/api/albums':
        return await handleAlbumsAPI(request, DATABASE, USERNAME, PASSWORD);
      case '/api/move-to-album':
        return await handleMoveToAlbumAPI(request, DATABASE, USERNAME, PASSWORD);
      default:
        return await handleImageRequest(request, DATABASE, R2_BUCKET);
    }
  }
};

function authenticate(request, USERNAME, PASSWORD) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  return isValidCredentials(authHeader, USERNAME, PASSWORD);
}

async function handleRootRequest(request, USERNAME, PASSWORD, enableAuth) {
  const cache = caches.default;
  const cacheKey = new Request(request.url);
  if (enableAuth) {
      if (!authenticate(request, USERNAME, PASSWORD)) {
          return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
      }
  }
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
      return cachedResponse;
  }
  const response = new Response(`
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="JSimages-基于CloudFlare的图床服务">
  <meta name="keywords" content="JSimages,Workers图床, Pages图床,R2储存, Cloudflare, Workers, 图床">
  <title>JSimages-基于CloudFlare的图床服务</title>
  <link rel="icon" href="https://p1.meituan.net/csc/c195ee91001e783f39f41ffffbbcbd484286.ico" type="image/x-icon">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.1/css/bootstrap.min.css" integrity="sha512-T584yQ/tdRR5QwOpfvDfVQUidzfgc2339Lc8uBDtcp/wYu80d7jwBgAxbyMh0a9YM9F8N3tdErpFI8iaGx6x5g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-fileinput/5.2.7/css/fileinput.min.css" integrity="sha512-qPjB0hQKYTx1Za9Xip5h0PXcxaR1cRbHuZHo9z+gb5IgM6ZOTtIH4QLITCxcCp/8RMXtw2Z85MIZLv6LfGTLiw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.css" integrity="sha512-6S2HWzVFxruDlZxI3sXOZZ4/eJ8AcxkQH1+JjSe/ONCEqR9L4Ysq5JdT5ipqtzU7WHalNwzwBv+iE51gNHJNqQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>
      body {
          margin: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          position: relative;
      }
      .background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          z-index: -1;
          transition: opacity 1s ease-in-out;
          opacity: 1;
      }
      .card {
          background-color: rgba(255, 255, 255, 0.8);
          border: none;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          padding: 20px;
          width: 90%;
          max-width: 400px;
          text-align: center;
          margin: 0 auto;
          position: relative;
      }
      .uniform-height {
          margin-top: 20px;
      }
      #viewCacheBtn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          color: rgba(0, 0, 0, 0.1);
          cursor: pointer;
          font-size: 24px;
          transition: color 0.3s ease;
      }
      #viewCacheBtn:hover {
          color: rgba(0, 0, 0, 0.4);
      }
      #compressionToggleBtn {
          position: absolute;
          top: 10px;
          right: 50px;
          background: none;
          border: none;
          color: rgba(0, 0, 0, 0.1);
          cursor: pointer;
          font-size: 24px;
          transition: color 0.3s ease;
      }
      #compressionToggleBtn:hover {
          color: rgba(0, 0, 0, 0.4);
      }
      #cacheContent {
          margin-top: 20px;
          max-height: 200px;
          border-radius: 5px;
          overflow-y: auto;
      }
      .cache-title {
          text-align: left;
          margin-bottom: 10px;
      }
      .cache-item {
          display: block;
          cursor: pointer;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: background-color 0.3s ease;
          text-align: left;
          padding: 10px;
      }
      .cache-item:hover {
          background-color: #e9ecef;
      }
      .project-link {
          font-size: 14px;
          text-align: center;
          margin-top: 5px;
          margin-bottom: 0;
      }
      textarea.form-control {
          max-height: 200px;
          overflow-y: hidden;
          resize: none;
      }
  </style>
</head>
<body>
<div id="js-badge" style="position:fixed;bottom:12px;right:12px;z-index:9999;background:#c62828;color:#fff;padding:8px 10px;border-radius:12px;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.2);">JS 未运行（交互会失效）</div>
<div class="background" id="background"></div>
  <div class="card">
      <div class="title">JSimages</div>
      <button type="button" class="btn" id="viewCacheBtn" title="查看历史记录"><i class="fas fa-clock"></i></button>
      <button type="button" class="btn" id="compressionToggleBtn"><i class="fas fa-compress"></i></button>
      <div class="card-body">
          <form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data">
              <div class="file-input-container">
                  <input id="fileInput" name="file" type="file" class="form-control-file" data-browse-on-zone-click="true" multiple>
              </div>
              <div class="form-group mb-3 uniform-height" style="display: none;">
                  <button type="button" class="btn btn-light mr-2" id="urlBtn">URL</button>
                  <button type="button" class="btn btn-light mr-2" id="bbcodeBtn">BBCode</button>
                  <button type="button" class="btn btn-light" id="markdownBtn">Markdown</button>
              </div>
              <div class="form-group mb-3 uniform-height" style="display: none;">
                  <textarea class="form-control" id="fileLink" readonly></textarea>
              </div>
              <div id="cacheContent" style="display: none;"></div>
          </form>
      </div>
      <p class="project-link">项目开源于 GitHub - <a href="https://github.com/0-RTT/JSimages" target="_blank" rel="noopener noreferrer">0-RTT/JSimages</a></p>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" integrity="sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-fileinput/5.2.7/js/fileinput.min.js" integrity="sha512-CCLv901EuJXf3k0OrE5qix8s2HaCDpjeBERR2wVHUwzEIc7jfiK9wqJFssyMOc1lJ/KvYKsDenzxbDTAQ4nh1w==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-fileinput/5.2.7/js/locales/zh.min.js" integrity="sha512-IizKWmZY3aznnbFx/Gj8ybkRyKk7wm+d7MKmEgOMRQDN1D1wmnDRupfXn6X04pwIyKFWsmFVgrcl0j6W3Z5FDQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.js" integrity="sha512-lbwH47l/tPXJYG9AcFNoJaTMhGvYWhVM9YI43CT+uteTRRaiLCui8snIgyAN8XWgNjNhCqlAUdzZptso6OCoFQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script>
(function(){
  try{
    var b=document.getElementById("js-badge");
    if(b){b.textContent="JS 正常运行";b.style.background="#2e7d32";}
  }catch(e){}
})();
async function fetchBingImages() {
        const response = await fetch('/bing-images');
        const data = await response.json();
        return data.data.map(image => image.url);
      }
    
      async function setBackgroundImages() {
        const images = await fetchBingImages();
        const backgroundDiv = document.getElementById('background');
        if (images.length > 0) {
          backgroundDiv.style.backgroundImage = 'url(' + images[0] + ')';
        }
        let index = 0;
        let currentBackgroundDiv = backgroundDiv;
        setInterval(() => {
          const nextIndex = (index + 1) % images.length;
          const nextBackgroundDiv = document.createElement('div');
          nextBackgroundDiv.className = 'background next';
          nextBackgroundDiv.style.backgroundImage = 'url(' + images[nextIndex] + ')';
          document.body.appendChild(nextBackgroundDiv);
          nextBackgroundDiv.style.opacity = 0;
          setTimeout(() => {
            nextBackgroundDiv.style.opacity = 1;
          }, 50);
          setTimeout(() => {
            document.body.removeChild(currentBackgroundDiv);
            currentBackgroundDiv = nextBackgroundDiv;
            index = nextIndex;
          }, 1000);
        }, 5000);
      }
    
      $(document).ready(function() {
        let originalImageURLs = [];
        let isCacheVisible = false;
        let enableCompression = true;
        initFileInput();
        setBackgroundImages();
    
        const tooltipText = enableCompression ? '关闭压缩' : '开启压缩';
        $('#compressionToggleBtn').attr('title', tooltipText);
        $('#compressionToggleBtn').on('click', function() {
            enableCompression = !enableCompression;
            const icon = $(this).find('i');
            icon.toggleClass('fa-compress fa-expand');
            const tooltipText = enableCompression ? '关闭压缩' : '开启压缩';
            $(this).attr('title', tooltipText);
        });
    
        function initFileInput() {
          $("#fileInput").fileinput({
            theme: 'fa',
            language: 'zh',
            browseClass: "btn btn-primary",
            removeClass: "btn btn-danger",
            showUpload: false,
            showPreview: false,
          }).on('filebatchselected', handleFileSelection)
            .on('fileclear', handleFileClear);
        }
    
        async function handleFileSelection() {
          const files = $('#fileInput')[0].files;
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileHash = await calculateFileHash(file);
            const cachedData = getCachedData(fileHash);
            if (cachedData) {
                handleCachedFile(cachedData);
            } else {
                await uploadFile(file, fileHash);
            }
          }
        }
    
        function getCachedData(fileHash) {
            const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
            return cacheData.find(item => item.hash === fileHash);
        }
    
        function handleCachedFile(cachedData) {
            if (!originalImageURLs.includes(cachedData.url)) {
                originalImageURLs.push(cachedData.url);
                updateFileLinkDisplay();
                toastr.info('已从缓存中读取数据');
            }
        }
    
        function updateFileLinkDisplay() {
            $('#fileLink').val(originalImageURLs.join('\\n\\n'));
            $('.form-group').show();
            adjustTextareaHeight($('#fileLink')[0]);
        }
    
        async function calculateFileHash(file) {
          const arrayBuffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
    
        function isFileInCache(fileHash) {
          const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
          return cacheData.some(item => item.hash === fileHash);
        }
    
        async function uploadFile(file, fileHash) {
          try {
            toastr.info('上传中...', '', { timeOut: 0 });
            const interfaceInfo = {
              enableCompression: enableCompression
            };
            if (file.type.startsWith('image/') && file.type !== 'image/gif' && interfaceInfo.enableCompression) {
              toastr.info('正在压缩...', '', { timeOut: 0 });
              const compressedFile = await compressImage(file);
              file = compressedFile;
            }
            const formData = new FormData($('#uploadForm')[0]);
            formData.set('file', file, file.name);
            const uploadResponse = await fetch('/upload', { method: 'POST', body: formData });
            const responseData = await handleUploadResponse(uploadResponse);
            if (responseData.error) {
              toastr.error(responseData.error);
            } else {
              originalImageURLs.push(responseData.data);
              $('#fileLink').val(originalImageURLs.join('\\n\\n'));
              $('.form-group').show();
              adjustTextareaHeight($('#fileLink')[0]);
              toastr.success('文件上传成功！');
              saveToLocalCache(responseData.data, file.name, fileHash);
            }
          } catch (error) {
            console.error('处理文件时出现错误:', error);
            $('#fileLink').val('文件处理失败！');
            toastr.error('文件处理失败！');
          } finally {
            toastr.clear();
          }
        }
    
        async function handleUploadResponse(response) {
          if (response.ok) {
            return await response.json();
          } else {
            const errorData = await response.json();
            return { error: errorData.error };
          }
        }
    
        $(document).on('paste', async function(event) {
          const clipboardData = event.originalEvent.clipboardData;
          if (clipboardData && clipboardData.items) {
            for (let i = 0; i < clipboardData.items.length; i++) {
              const item = clipboardData.items[i];
              if (item.kind === 'file') {
                const pasteFile = item.getAsFile();
                const dataTransfer = new DataTransfer();
                const existingFiles = $('#fileInput')[0].files;
                for (let j = 0; j < existingFiles.length; j++) {
                  dataTransfer.items.add(existingFiles[j]);
                }
                dataTransfer.items.add(pasteFile);
                $('#fileInput')[0].files = dataTransfer.files;
                $('#fileInput').trigger('change');
                break;
              }
            }
          }
        });
    
        async function compressImage(file, quality = 0.85) {
          const MAX_SIZE = 4500; // 最大边长
          const MIME = 'image/jpeg';

          // 只压缩图片（GIF/非图片直接返回原文件）
          if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;

          try {
            const dataURL = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error('读取文件失败'));
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsDataURL(file);
            });

            const image = await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('图片解码失败'));
              img.src = dataURL;
            });

            let targetWidth = image.width;
            let targetHeight = image.height;

            // 按比例缩放：长边 <= 4500
            const maxSide = Math.max(targetWidth, targetHeight);
            if (maxSide > MAX_SIZE) {
              const scale = MAX_SIZE / maxSide;
              targetWidth = Math.max(1, Math.round(targetWidth * scale));
              targetHeight = Math.max(1, Math.round(targetHeight * scale));
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // JPG 不支持透明：铺白底避免透明 PNG 变黑
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const blob = await new Promise((resolve) => {
              canvas.toBlob((b) => resolve(b), MIME, quality);
            });

            if (!blob) {
              toastr.warning('图片压缩失败，已改为原图上传');
              return file;
            }

            const baseName = (file.name || 'image').replace(/\.[^/.]+$/, "");
            const fileName = baseName + '.jpg';

            const compressedFile = new File([blob], fileName, {
              type: MIME,
              lastModified: file.lastModified || Date.now()
            });

            toastr.success('图片已压缩为' + targetWidth + 'x' + targetHeight + '（JPG / 质量' + Math.round(quality * 100) + '%）');
            return compressedFile;
          } catch (err) {
            console.error(err);
            toastr.warning('图片压缩异常，已改为原图上传');
            return file;
          }
        }
    
        $('#urlBtn, #bbcodeBtn, #markdownBtn').on('click', function() {
          const fileLinks = originalImageURLs.map(url => url.trim()).filter(url => url !== '');
          if (fileLinks.length > 0) {
            let formattedLinks = '';
            switch ($(this).attr('id')) {
              case 'urlBtn':
                formattedLinks = fileLinks.join('\\n\\n');
                break;
              case 'bbcodeBtn':
                formattedLinks = fileLinks.map(url => '[img]' + url + '[/img]').join('\\n\\n');
                break;
              case 'markdownBtn':
                formattedLinks = fileLinks.map(url => '![image](' + url + ')').join('\\n\\n');
                break;
              default:
                formattedLinks = fileLinks.join('\\n');
            }
            $('#fileLink').val(formattedLinks);
            adjustTextareaHeight($('#fileLink')[0]);
            copyToClipboardWithToastr(formattedLinks);
          }
        });
    
        function handleFileClear(event) {
          $('#fileLink').val('');
          adjustTextareaHeight($('#fileLink')[0]);
          hideButtonsAndTextarea();
          originalImageURLs = [];
        }
    
        function adjustTextareaHeight(textarea) {
          textarea.style.height = '1px';
          textarea.style.height = (textarea.scrollHeight > 200 ? 200 : textarea.scrollHeight) + 'px';
    
          if (textarea.scrollHeight > 200) {
            textarea.style.overflowY = 'auto';
          } else {
            textarea.style.overflowY = 'hidden';
          }
        }
    
        function copyToClipboardWithToastr(text) {
          const input = document.createElement('textarea');
          input.value = text;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          toastr.success('已复制到剪贴板', '', { timeOut: 300 });
        }
    
        function hideButtonsAndTextarea() {
          $('#urlBtn, #bbcodeBtn, #markdownBtn, #fileLink').parent('.form-group').hide();
        }
    
        function saveToLocalCache(url, fileName, fileHash) {
          const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
          const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
          cacheData.push({ url, fileName, hash: fileHash, timestamp });
          localStorage.setItem('uploadCache', JSON.stringify(cacheData));
        }
    
        $('#viewCacheBtn').on('click', function() {
          const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
          const cacheContent = $('#cacheContent');
          cacheContent.empty();
          if (isCacheVisible) {
            cacheContent.hide();
            $('#fileLink').val('');
            $('#fileLink').parent('.form-group').hide();
            isCacheVisible = false;
          } else {
            if (cacheData.length > 0) {
              cacheData.reverse();
              cacheData.forEach((item) => {
                const listItem = $('<div class="cache-item"></div>')
                  .text(item.timestamp + ' - ' + item.fileName)
                  .data('url', item.url);
                cacheContent.append(listItem);
                cacheContent.append('<br>');
              });
              cacheContent.show();
            } else {
              cacheContent.append('<div>还没有记录哦！</div>').show();
            }
            isCacheVisible = true;
          }
        });
    
        $(document).on('click', '.cache-item', function() {
          const url = $(this).data('url');
          originalImageURLs = [];
          $('#fileLink').val('');
          originalImageURLs.push(url);
          $('#fileLink').val(originalImageURLs.map(url => url.trim()).join('\\n\\n'));
          $('.form-group').show();
          adjustTextareaHeight($('#fileLink')[0]);
        });
      });
    </script>    
</body>
</html>  
`, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Content-Security-Policy': "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src * data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self';" } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function handleAdminRequest(DATABASE, request, USERNAME, PASSWORD, adminPath) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  const url = new URL(request.url);
  const albumParam = url.searchParams.get('album'); // null | 'unassigned' | albumId
  return await generateAdminPage(DATABASE, adminPath, albumParam);
}

function isValidCredentials(authHeader, USERNAME, PASSWORD) {
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials).split(':');
  const username = credentials[0];
  const password = credentials[1];
  return username === USERNAME && password === PASSWORD;
}

async function generateAdminPage(DATABASE, adminPath, selectedAlbum = null) {
  const albums = await fetchAlbums(DATABASE);
  const mediaData = await fetchMediaData(DATABASE, selectedAlbum);

  const selectedAlbumName = (() => {
    if (!selectedAlbum) return '所有图片';
    if (selectedAlbum === 'unassigned') return '未分类';
    const found = albums.find(a => String(a.id) === String(selectedAlbum));
    return found ? found.name : '相册';
  })();

  const sidebarAlbumsHtml = albums.map(album => {
    const isSelected = selectedAlbum && String(album.id) === String(selectedAlbum);
    const cover = album.cover_url || 'https://via.placeholder.com/150/cccccc/666666?text=Album';
    const desc = album.description || '';
    const count = album.image_count || 0;
    return `
      <div class="album-item ${isSelected ? 'selected' : ''}" data-id="${album.id}">
        <div class="album-cover" style="background-image:url('${cover}')"></div>
        <div class="album-info">
          <div class="album-name" title="${album.name}">${album.name}</div>
          <div class="album-meta">${count} 张</div>
          ${desc ? `<div class="album-desc" title="${desc}">${desc}</div>` : ''}
        </div>
        <div class="album-actions">
          <button class="icon-btn" onclick="editAlbum(event, ${album.id})" title="编辑">✏️</button>
          <button class="icon-btn danger" onclick="deleteAlbum(event, ${album.id})" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  const mediaHtml = mediaData.map(({ url, album_id, album_name }) => {
    const fileExtension = url.split('.').pop().toLowerCase();
    const fileName = url.split('/').pop();
    const timestampStr = (fileName.split('.')[0] || '');
    const ts = /^\d+$/.test(timestampStr) ? parseInt(timestampStr, 10) : NaN;

    const supportedImageExtensions = ['jpg','jpeg','png','gif','webp','bmp','tiff','svg'];
    const supportedVideoExtensions = ['mp4','avi','mov','wmv','flv','mkv','webm'];
    const isSupported = [...supportedImageExtensions, ...supportedVideoExtensions].includes(fileExtension);
    const backgroundStyle = isSupported ? '' : `style="font-size:50px;display:flex;justify-content:center;align-items:center;"`;
    const icon = isSupported ? '' : '📁';
    const badge = album_id ? `<div class="album-badge" title="所在相册: ${album_name || ''}">${album_name || '相册'}</div>` : '';

    return `
      <div class="media-container" data-key="${url}" onclick="toggleImageSelection(this)" ${backgroundStyle}>
        <div class="media-type">${fileExtension}</div>
        ${badge}
        ${supportedVideoExtensions.includes(fileExtension) ? `
          <video class="gallery-video" preload="none" style="width:100%;height:100%;object-fit:contain;" controls>
            <source data-src="${url}" type="video/${fileExtension}">
          </video>
        ` : `
          ${isSupported ? `<img class="gallery-image lazy" data-src="${url}" alt="Image">` : icon}
        `}
        <div class="upload-time">上传时间: ${!Number.isNaN(ts) ? new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未知'}</div>
        <div class="album-selector" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
          <select class="album-select" onchange="moveToAlbum('${url}', this.value)">
            <option value="">移动到相册...</option>
            ${albums.map(a => `<option value="${a.id}" ${String(album_id) === String(a.id) ? 'selected' : ''}>${a.name}</option>`).join('')}
            <option value="remove">从相册移除</option>
          </select>
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
  <html><head>
    <title>图库管理</title>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f4;margin:0;padding:16px;}
      .top-nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
      .top-nav h1{margin:0;font-size:20px;color:#222;}
      .btn{background:#6c757d;color:#fff;border:none;padding:8px 12px;border-radius:10px;cursor:pointer;text-decoration:none;display:inline-block;}
      .btn.primary{background:#007bff;}
      .layout{display:flex;gap:16px;}
      .sidebar{width:300px;flex:0 0 300px;background:#fff;border-radius:14px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,.08);height:calc(100vh - 90px);overflow:auto;}
      .sidebar-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
      .sidebar-header h2{margin:0;font-size:16px;color:#333;}
      .album-item{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:12px;cursor:pointer;border:2px solid transparent;transition:.15s;}
      .album-item:hover{background:#f7f8fa;}
      .album-item.selected{border-color:#007bff;background:#eaf3ff;}
      .album-cover{width:44px;height:44px;border-radius:10px;background-size:cover;background-position:center;flex:0 0 44px;}
      .album-info{flex:1;min-width:0;}
      .album-name{font-weight:600;font-size:13px;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .album-meta{font-size:12px;color:#666;margin-top:2px;}
      .album-desc{font-size:12px;color:#888;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .album-actions{display:flex;gap:6px;}
      .icon-btn{border:none;background:transparent;cursor:pointer;font-size:14px;opacity:.75;}
      .icon-btn:hover{opacity:1;}
      .icon-btn.danger:hover{color:#c62828;}

      .main{flex:1;min-width:0;}
      .header{position:sticky;top:0;background:#fff;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.08);margin-bottom:14px;gap:10px;flex-wrap:wrap;}
      .header-left{color:#333;display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
      .header-right{display:flex;gap:10px;align-items:center;}
      .hidden{display:none;}
      .delete-button,.copy-button{background:#ff4d4d;color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer;}
      .delete-button:hover,.copy-button:hover{background:#ff1a1a;}
      .dropdown{position:relative;display:inline-block;}
      .dropdown-content{display:none;position:absolute;right:0;background:#fff;min-width:160px;border-radius:12px;box-shadow:0 10px 22px rgba(0,0,0,.12);overflow:hidden;z-index:20;}
      .dropdown-content button{width:100%;padding:10px 12px;border:none;background:#fff;text-align:left;cursor:pointer;}
      .dropdown-content button:hover{background:#f2f2f2;}
      .dropdown:hover .dropdown-content{display:block;}

      .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
      .media-container{position:relative;overflow:hidden;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.1);aspect-ratio:1/1;transition:transform .2s,box-shadow .2s;background:#fff;}
      .media-container:hover{transform:scale(1.03);box-shadow:0 4px 16px rgba(0,0,0,.18);}
      .media-type{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.7);color:#fff;padding:5px 7px;border-radius:8px;font-size:12px;z-index:3;}
      .album-badge{position:absolute;top:10px;right:10px;background:rgba(52,152,219,.92);color:#fff;padding:3px 8px;border-radius:999px;font-size:11px;z-index:3;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .upload-time{position:absolute;bottom:42px;left:10px;background:rgba(255,255,255,.92);padding:5px 7px;border-radius:10px;color:#111;font-size:12px;z-index:3;display:none;}
      .media-container:hover .upload-time{display:block;}
      .album-selector{position:absolute;bottom:8px;left:8px;right:8px;z-index:4;display:block;opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity .15s,transform .15s;}
      .media-container:hover .album-selector,.media-container:focus-within .album-selector{opacity:1;pointer-events:auto;transform:translateY(0);}
      .album-select{width:100%;padding:6px;border-radius:10px;border:1px solid #ddd;background:#fff;font-size:12px;}
      .gallery-image{width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .2s;}
      .gallery-image.loaded{opacity:1;}
      .media-container.selected{border:2px solid #007bff;background:rgba(0,123,255,.08);}
      .footer{margin-top:18px;text-align:center;font-size:16px;color:#666;}

      .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;}
      .modal-content{background:#fff;width:min(520px,92vw);margin:10vh auto;border-radius:16px;padding:16px;box-shadow:0 20px 45px rgba(0,0,0,.2);}
      .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
      .modal-header h3{margin:0;font-size:16px;}
      .close-btn{border:none;background:transparent;font-size:22px;cursor:pointer;opacity:.8;}
      .form-group{margin:10px 0;}
      .form-group label{display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#333;}
      .form-group input,.form-group textarea{width:100%;padding:9px 10px;border:1px solid #ddd;border-radius:12px;box-sizing:border-box;}
      .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px;}
      @media (max-width:900px){.layout{flex-direction:column;}.sidebar{width:auto;flex:1;height:auto;}}
    </style>
  </head><body>
    <div class="top-nav">
      <h1>图库管理</h1>
      <div style="display:flex;gap:10px;align-items:center;">
        <div style="color:#444;font-size:13px;">当前：<b>${selectedAlbumName}</b></div>
        <a class="btn" href="/">返回首页</a>
      </div>
    </div>

    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>相册</h2>
          <button class="btn primary" id="createAlbumBtn">新建</button>
        </div>

        <div class="album-item ${!selectedAlbum ? 'selected' : ''}" data-id="all">
          <div class="album-cover" style="background-image:url('https://via.placeholder.com/150/cccccc/666666?text=All')"></div>
          <div class="album-info">
            <div class="album-name">所有图片</div>
            <div class="album-meta">${mediaData.length} 张</div>
          </div>
        </div>

        <div class="album-item ${selectedAlbum === 'unassigned' ? 'selected' : ''}" data-id="unassigned">
          <div class="album-cover" style="background-image:url('https://via.placeholder.com/150/cccccc/666666?text=None')"></div>
          <div class="album-info">
            <div class="album-name">未分类</div>
            <div class="album-meta">只看未分配相册的图片</div>
          </div>
        </div>

        <div style="height:10px;"></div>
        ${sidebarAlbumsHtml || '<div style="color:#777;font-size:13px;padding:8px 2px;">暂无相册（点击右上角“新建”）</div>'}
      </aside>

      <main class="main">
        <div class="header">
          <div class="header-left">
            <span>媒体文件 ${mediaData.length} 个</span>
            <span>已选中: <span id="selected-count">0</span> 个</span>
          </div>
          <div class="header-right hidden">
            <div class="dropdown">
              <button class="copy-button">复制</button>
              <div class="dropdown-content">
                <button onclick="copyFormattedLinks('url')">URL</button>
                <button onclick="copyFormattedLinks('bbcode')">BBCode</button>
                <button onclick="copyFormattedLinks('markdown')">Markdown</button>
              </div>
            </div>
            <button id="select-all-button" class="delete-button" onclick="selectAllImages()">全选</button>
            <button id="delete-button" class="delete-button" onclick="deleteSelectedImages()">删除</button>
          </div>
        </div>

        <div class="gallery" id="gallery">${mediaHtml}</div>
        <div class="footer">${mediaData.length > 0 ? '到底啦' : '这里还没有图片'}</div>
      </main>
    </div>

    <div id="albumModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="albumModalTitle">新建相册</h3>
          <button class="close-btn" onclick="closeAlbumModal()">&times;</button>
        </div>
        <form id="albumForm">
          <input type="hidden" id="albumId" value="">
          <div class="form-group">
            <label>相册名称 *</label>
            <input type="text" id="albumName" maxlength="50" required>
          </div>
          <div class="form-group">
            <label>相册描述</label>
            <textarea id="albumDescription" rows="3" maxlength="200"></textarea>
          </div>
          <div class="form-group">
            <label>封面 URL</label>
            <input type="text" id="albumCover" placeholder="留空则用相册内第一张图">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" onclick="closeAlbumModal()">取消</button>
            <button type="submit" class="btn primary">保存</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      let selectedCount = 0;
      const selectedKeys = new Set();
      let isAllSelected = false;

      document.addEventListener('DOMContentLoaded', () => {
        // 如果脚本有语法/运行错误，至少给出明确提示（否则页面看起来“点了没反应”）
        window.addEventListener('error', (e) => {
          console.error('Admin page JS error:', e.error || e.message);
          const msg = (e && e.message) ? e.message : '未知错误';
          // 只提示一次，避免循环弹窗
          if (!window.__jsimages_admin_error_shown) {
            window.__jsimages_admin_error_shown = true;
            alert('后台脚本出错，导致点击无反应：\n' + msg + '\n\n请打开浏览器开发者工具 Console 查看详细报错。');
          }
        }, { once: true });


        const containers = document.querySelectorAll('.media-container[data-key]');
        const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const c = entry.target;
            const v = c.querySelector('video');
            if (v) {
              const s = v.querySelector('source');
              v.src = s.getAttribute('data-src');
              v.load();
            } else {
              const img = c.querySelector('img');
              if (img && !img.src) {
                img.src = img.getAttribute('data-src');
                img.onload = () => img.classList.add('loaded');
              }
            }
            obs.unobserve(c);
          });
        }, { threshold: 0.1 });
        containers.forEach(c => observer.observe(c));

        document.querySelectorAll('.album-item[data-id]').forEach(item => {
          item.addEventListener('click', (e) => {
            if (e.target.closest('.album-actions')) return;
            const id = item.getAttribute('data-id');
            const base = '/${adminPath}';
            if (id === 'all') window.location = base;
            else if (id === 'unassigned') window.location = base + '?album=unassigned';
            else window.location = base + '?album=' + encodeURIComponent(id);
          });
        });

        document.getElementById('createAlbumBtn').addEventListener('click', () => openAlbumModal());
        document.getElementById('albumForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          await saveAlbum();
        });
      });

      function toggleImageSelection(container) {
        const key = container.getAttribute('data-key');
        container.classList.toggle('selected');
        const uploadTime = container.querySelector('.upload-time');
        if (container.classList.contains('selected')) {
          selectedKeys.add(key);
          selectedCount++;
          if (uploadTime) uploadTime.style.display = 'block';
        } else {
          selectedKeys.delete(key);
          selectedCount--;
          if (uploadTime) uploadTime.style.display = 'none';
        }
        updateHeaderActions();
      }

      function updateHeaderActions() {
        document.getElementById('selected-count').textContent = selectedCount;
        const headerRight = document.querySelector('.header-right');
        if (selectedCount > 0) headerRight.classList.remove('hidden');
        else headerRight.classList.add('hidden');
      }

      async function deleteSelectedImages() {
        if (selectedKeys.size === 0) return;
        if (!confirm('你确定要删除选中的媒体文件吗？此操作无法撤回。')) return;

        const response = await fetch('/delete-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(Array.from(selectedKeys))
        });

        if (response.ok) {
          alert('选中的媒体已删除');
          location.reload();
        } else {
          alert('删除失败');
        }
      }

      function selectAllImages() {
        const mediaContainers = document.querySelectorAll('.media-container[data-key]');
        if (isAllSelected) {
          mediaContainers.forEach(container => {
            container.classList.remove('selected');
            selectedKeys.delete(container.getAttribute('data-key'));
            const ut = container.querySelector('.upload-time');
            if (ut) ut.style.display = 'none';
          });
          selectedCount = 0;
        } else {
          mediaContainers.forEach(container => {
            if (!container.classList.contains('selected')) {
              container.classList.add('selected');
              selectedKeys.add(container.getAttribute('data-key'));
              selectedCount++;
              const ut = container.querySelector('.upload-time');
              if (ut) ut.style.display = 'block';
            }
          });
        }
        isAllSelected = !isAllSelected;
        updateHeaderActions();
      }

      function copyFormattedLinks(format) {
        const urls = Array.from(selectedKeys).map(u => u.trim()).filter(Boolean);
        let out = '';
        if (format === 'url') out = urls.join('\n\n');
        if (format === 'bbcode') out = urls.map(u => '[img]' + u + '[/img]').join('\n\n');
        if (format === 'markdown') out = urls.map(u => '![image](' + u + ')').join('\n\n');
        navigator.clipboard.writeText(out).then(() => alert('复制成功')).catch(() => alert('复制失败'));
      }

      function openAlbumModal(album) {
        document.getElementById('albumModal').style.display = 'block';
        const title = document.getElementById('albumModalTitle');
        const form = document.getElementById('albumForm');
        if (album) {
          title.textContent = '编辑相册';
          document.getElementById('albumId').value = album.id;
          document.getElementById('albumName').value = album.name || '';
          document.getElementById('albumDescription').value = album.description || '';
          document.getElementById('albumCover').value = album.cover_url || '';
        } else {
          title.textContent = '新建相册';
          form.reset();
          document.getElementById('albumId').value = '';
        }
      }

      function closeAlbumModal() { document.getElementById('albumModal').style.display = 'none'; }

      async function saveAlbum() {
        const id = document.getElementById('albumId').value;
        const name = document.getElementById('albumName').value.trim();
        const description = document.getElementById('albumDescription').value.trim();
        const cover_url = document.getElementById('albumCover').value.trim();
        if (!name) return alert('相册名称不能为空');

        const method = id ? 'PUT' : 'POST';
        const url = '/api/albums' + (id ? ('?id=' + encodeURIComponent(id)) : '');

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, description, cover_url })
        });

        if (res.ok) { closeAlbumModal(); location.reload(); }
        else {
          let msg = '保存失败';
          try { const j = await res.json(); msg = j.error || msg; } catch {}
          alert(msg);
        }
      }

      async function editAlbum(ev, id) {
        ev.stopPropagation();
        const res = await fetch('/api/albums?id=' + encodeURIComponent(id), { credentials: 'same-origin' });
        if (!res.ok) return alert('获取相册信息失败');
        openAlbumModal(await res.json());
      }

      async function deleteAlbum(ev, id) {
        ev.stopPropagation();
        if (!confirm('确定删除该相册？相册内图片不会删除，但会变成未分类。')) return;

        const res = await fetch('/api/albums?id=' + encodeURIComponent(id), {
          method: 'DELETE',
          credentials: 'same-origin'
        });

        if (res.ok) { alert('相册已删除'); location.reload(); }
        else {
          let msg = '删除失败';
          try { const j = await res.json(); msg = j.error || msg; } catch {}
          alert(msg);
        }
      }

      async function moveToAlbum(imageUrl, albumId) {
        const payload = { imageUrl, albumId: (albumId === 'remove' || albumId === '') ? null : albumId };
        const res = await fetch('/api/move-to-album', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
        if (res.ok) location.reload();
        else {
          let msg = '移动失败';
          try { const j = await res.json(); msg = j.error || msg; } catch {}
          alert(msg);
        }
      }

      window.addEventListener('click', (e) => {
        const modal = document.getElementById('albumModal');
        if (e.target === modal) closeAlbumModal();
      });
    </script>
  </body></html>`;

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src * data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self';" } });
}

async function fetchAlbums(DATABASE) {
  try {
    const result = await DATABASE.prepare(`
      SELECT 
        a.id, a.name, a.description, a.cover_url, a.created_at, a.updated_at,
        COUNT(m.url) AS image_count
      FROM albums a
      LEFT JOIN media m ON a.id = m.album_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).all();
    return result.results || [];
  } catch (error) {
    console.error('获取相册列表失败:', error);
    return [];
  }
}

async function fetchMediaData(DATABASE, albumParam = null) {
  let sql = `
    SELECT 
      m.url,
      m.album_id,
      a.name AS album_name
    FROM media m
    LEFT JOIN albums a ON m.album_id = a.id
  `;
  const binds = [];
  if (albumParam === 'unassigned') {
    sql += ` WHERE m.album_id IS NULL `;
  } else if (albumParam) {
    sql += ` WHERE m.album_id = ? `;
    binds.push(albumParam);
  }
  sql += ` ORDER BY m.url DESC `;

  const result = binds.length
    ? await DATABASE.prepare(sql).bind(...binds).all()
    : await DATABASE.prepare(sql).all();

  const rows = (result.results || []).map(r => ({ url: r.url, album_id: r.album_id, album_name: r.album_name }));
  rows.sort((a, b) => {
    const aName = (a.url.split('/').pop() || '').split('.')[0] || '';
    const bName = (b.url.split('/').pop() || '').split('.')[0] || '';
    const at = /^\d+$/.test(aName) ? parseInt(aName, 10) : -1;
    const bt = /^\d+$/.test(bName) ? parseInt(bName, 10) : -1;
    return bt - at;
  });
  return rows;
}



// ====== Album APIs ======
async function handleAlbumsAPI(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }

  const url = new URL(request.url);
  const albumId = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (albumId) {
        const album = await DATABASE.prepare('SELECT * FROM albums WHERE id = ?').bind(albumId).first();
        if (!album) return json({ error: '相册不存在' }, 404);
        const countRow = await DATABASE.prepare('SELECT COUNT(url) AS image_count FROM media WHERE album_id = ?').bind(albumId).first();
        album.image_count = (countRow && countRow.image_count) ? countRow.image_count : 0;
        return json(album, 200);
      }
      const albums = await fetchAlbums(DATABASE);
      return json(albums, 200);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const name = (body?.name || '').trim();
      const description = (body?.description || '').trim();
      const cover_url = (body?.cover_url || '').trim();
      if (!name) return json({ error: '相册名称不能为空' }, 400);

      const r = await DATABASE.prepare(
        'INSERT INTO albums (name, description, cover_url) VALUES (?, ?, ?)'
      ).bind(name, description, cover_url).run();

      return json({ success: true, id: r?.meta?.last_row_id }, 200);
    }

    if (request.method === 'PUT') {
      if (!albumId) return json({ error: '缺少相册ID' }, 400);
      const body = await request.json();
      const name = (body?.name || '').trim();
      const description = (body?.description || '').trim();
      const cover_url = (body?.cover_url || '').trim();
      if (!name) return json({ error: '相册名称不能为空' }, 400);

      await DATABASE.prepare(
        'UPDATE albums SET name = ?, description = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(name, description, cover_url, albumId).run();

      return json({ success: true }, 200);
    }

    if (request.method === 'DELETE') {
      if (!albumId) return json({ error: '缺少相册ID' }, 400);

      // 先把图片设为未分类
      await DATABASE.prepare('UPDATE media SET album_id = NULL WHERE album_id = ?').bind(albumId).run();
      // 再删除相册
      await DATABASE.prepare('DELETE FROM albums WHERE id = ?').bind(albumId).run();

      return json({ success: true }, 200);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}

async function handleMoveToAlbumAPI(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { imageUrl, albumId } = await request.json();
    if (!imageUrl) return json({ error: '缺少图片URL' }, 400);

    // albumId 为 null 表示移除
    if (albumId !== null && albumId !== undefined && albumId !== '') {
      const exists = await DATABASE.prepare('SELECT 1 FROM albums WHERE id = ?').bind(albumId).first();
      if (!exists) return json({ error: '相册不存在' }, 404);
    }

    // 尝试写入 album_id（如果你的 media 表尚未加 album_id，会抛错）
    await DATABASE.prepare('UPDATE media SET album_id = ? WHERE url = ?').bind(albumId || null, imageUrl).run();

    // 自动封面：如果相册没有封面，则用第一张
    if (albumId) {
      const a = await DATABASE.prepare('SELECT cover_url FROM albums WHERE id = ?').bind(albumId).first();
      if (!a || !a.cover_url) {
        await DATABASE.prepare('UPDATE albums SET cover_url = ? WHERE id = ? AND (cover_url IS NULL OR cover_url = "")')
          .bind(imageUrl, albumId).run();
      }
    }

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function handleUploadRequest(request, DATABASE, enableAuth, USERNAME, PASSWORD, domain, R2_BUCKET, maxSize) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) throw new Error('缺少文件');
    
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: `文件大小超过${maxSize / (1024 * 1024)}MB限制` }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }
    if (enableAuth && !authenticate(request, USERNAME, PASSWORD)) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
    }
    const r2Key = `${Date.now()}`;
    await R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
    const fileExtension = file.name.split('.').pop();
    const imageURL = `https://${domain}/${r2Key}.${fileExtension}`;
    {
      // 可选：上传时带相册（如果前端没传 albumId，则为 null）
      const albumId = formData.get('albumId');
      try {
        await DATABASE.prepare('INSERT INTO media (url, album_id) VALUES (?, ?) ON CONFLICT(url) DO NOTHING')
          .bind(imageURL, albumId || null).run();
      } catch (e) {
        // 兼容旧表结构（还没加 album_id 字段）
        await DATABASE.prepare('INSERT INTO media (url) VALUES (?) ON CONFLICT(url) DO NOTHING')
          .bind(imageURL).run();
      }
    }
    return new Response(JSON.stringify({ data: imageURL }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('R2 上传错误:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleImageRequest(request, DATABASE, R2_BUCKET) {
  const requestedUrl = request.url;
  const cache = caches.default;
  const cacheKey = new Request(requestedUrl);
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) return cachedResponse;
  const result = await DATABASE.prepare('SELECT url FROM media WHERE url = ?').bind(requestedUrl).first();
  if (!result) {
    const notFoundResponse = new Response('资源不存在', { status: 404 });
    await cache.put(cacheKey, notFoundResponse.clone());
    return notFoundResponse;
  }
  const urlParts = requestedUrl.split('/');
  const fileName = urlParts[urlParts.length - 1];
  const [r2Key, fileExtension] = fileName.split('.');
  const object = await R2_BUCKET.get(r2Key);
  if (!object) {
    return new Response('获取文件内容失败', { status: 404 });
  }
  let contentType = 'text/plain';
  if (fileExtension === 'jpg' || fileExtension === 'jpeg') contentType = 'image/jpeg';
  if (fileExtension === 'png') contentType = 'image/png';
  if (fileExtension === 'gif') contentType = 'image/gif';
  if (fileExtension === 'webp') contentType = 'image/webp';
  if (fileExtension === 'mp4') contentType = 'video/mp4';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', 'inline');
  const responseToCache = new Response(object.body, { status: 200, headers });
  await cache.put(cacheKey, responseToCache.clone());
  return responseToCache;
}

async function handleBingImagesRequest(request) {
  const cache = caches.default;
  const cacheKey = new Request('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5');
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) return cachedResponse;
  const res = await fetch(cacheKey);
  if (!res.ok) {
    return new Response('请求 Bing API 失败', { status: res.status });
  }
  const bingData = await res.json();
  const images = bingData.images.map(image => ({ url: `https://cn.bing.com${image.url}` }));
  const returnData = { status: true, message: "操作成功", data: images };
  const response = new Response(JSON.stringify(returnData), { status: 200, headers: { 'Content-Type': 'application/json' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function handleDeleteImagesRequest(request, DATABASE, USERNAME, PASSWORD, R2_BUCKET) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    const keysToDelete = await request.json();
    if (!Array.isArray(keysToDelete) || keysToDelete.length === 0) {
      return new Response(JSON.stringify({ message: '没有要删除的项' }), { status: 400 });
    }
    const placeholders = keysToDelete.map(() => '?').join(',');
    const result = await DATABASE.prepare(`DELETE FROM media WHERE url IN (${placeholders})`).bind(...keysToDelete).run();
    if (result.changes === 0) {
      return new Response(JSON.stringify({ message: '未找到要删除的项' }), { status: 404 });
    }
    const cache = caches.default;
    for (const url of keysToDelete) {
      const cacheKey = new Request(url);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        await cache.delete(cacheKey);
      }
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const r2Key = fileName.split('.')[0];
      await R2_BUCKET.delete(r2Key);
    }
    return new Response(JSON.stringify({ message: '删除成功' }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: '删除失败', details: error.message }), { status: 500 });
  }
}
