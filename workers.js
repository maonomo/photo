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
        return await handleAdminRequest(DATABASE, request, USERNAME, PASSWORD);
      case '/upload':
        return request.method === 'POST' ? await handleUploadRequest(request, DATABASE, enableAuth, USERNAME, PASSWORD, domain, R2_BUCKET, maxSize) : new Response('Method Not Allowed', { status: 405 });
      case '/bing-images':
        return handleBingImagesRequest();
      case '/delete-images':
        return await handleDeleteImagesRequest(request, DATABASE, USERNAME, PASSWORD, R2_BUCKET);
      
      // ==================== 相册管理路由 ====================
      case '/api/albums':
        return request.method === 'GET' 
          ? await handleGetAlbums(DATABASE, request, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/create':
        return request.method === 'POST'
          ? await handleCreateAlbum(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/update':
        return request.method === 'POST'
          ? await handleUpdateAlbum(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/delete':
        return request.method === 'POST'
          ? await handleDeleteAlbum(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/add-image':
        return request.method === 'POST'
          ? await handleAddImageToAlbum(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/remove-image':
        return request.method === 'POST'
          ? await handleRemoveImageFromAlbum(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/api/albums/images':
        return request.method === 'GET'
          ? await handleGetAlbumImages(request, DATABASE, USERNAME, PASSWORD)
          : new Response('Method Not Allowed', { status: 405 });
      case '/albums':
        return await handleAlbumsPage(request, DATABASE, USERNAME, PASSWORD);
      // ==================== 相册管理路由结束 ====================
      
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
    
        async function compressImage(file, quality = 0.75) {
          return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
              const targetWidth = image.width;
              const targetHeight = image.height;
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
              canvas.toBlob((blob) => {
                const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                toastr.success('图片压缩成功！');
                resolve(compressedFile);
              }, 'image/jpeg', quality);
            };
            const reader = new FileReader();
            reader.onload = (event) => {
              image.src = event.target.result;
            };
            reader.readAsDataURL(file);
          });
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
`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function handleAdminRequest(DATABASE, request, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  return await generateAdminPage(DATABASE);
}

function isValidCredentials(authHeader, USERNAME, PASSWORD) {
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials).split(':');
  const username = credentials[0];
  const password = credentials[1];
  return username === USERNAME && password === PASSWORD;
}

async function generateAdminPage(DATABASE) {
  const mediaData = await fetchMediaData(DATABASE);
  const mediaHtml = mediaData.map(({ url }) => {
    const fileExtension = url.split('.').pop().toLowerCase();
    const timestamp = url.split('/').pop().split('.')[0];
    const mediaType = fileExtension;
    let displayUrl = url;
    const supportedImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'];
    const supportedVideoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'];
    const isSupported = [...supportedImageExtensions, ...supportedVideoExtensions].includes(fileExtension);
    const backgroundStyle = isSupported ? '' : `style="font-size: 50px; display: flex; justify-content: center; align-items: center;"`;
    const icon = isSupported ? '' : '📁';
    return `
    <div class="media-container" data-key="${url}" onclick="toggleImageSelection(this)" ${backgroundStyle}>
      <div class="media-type">${mediaType}</div>
      ${supportedVideoExtensions.includes(fileExtension) ? `
        <video class="gallery-video" preload="none" style="width: 100%; height: 100%; object-fit: contain;" controls>
          <source data-src="${displayUrl}" type="video/${fileExtension}">
          您的浏览器不支持视频标签。
        </video>
      ` : `
        ${isSupported ? `<img class="gallery-image lazy" data-src="${displayUrl}" alt="Image">` : icon}
      `}
      <div class="upload-time">上传时间: ${new Date(parseInt(timestamp)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
    </div>
    `;
  }).join('');
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>图库</title>
    <link rel="icon" href="https://p1.meituan.net/csc/c195ee91001e783f39f41ffffbbcbd484286.ico" type="image/x-icon">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 20px;
      }
      .header {
        position: sticky;
        top: 0;
        background-color: #ffffff;
        z-index: 1000;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        flex-wrap: wrap;
      }
      .header-left {
        flex: 1;
      }
      .header-right {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex: 1;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      .media-container {
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        aspect-ratio: 1 / 1;
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .media-type {
        position: absolute;
        top: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10;
        cursor: pointer;
      }
      .upload-time {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background-color: rgba(255, 255, 255, 0.7);
        padding: 5px;
        border-radius: 5px;
        color: #000;
        font-size: 14px;
        z-index: 10;
        display: none;
      }
      .media-container:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      .gallery-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        transition: opacity 0.3s;
        opacity: 0;
      }
      .gallery-image.loaded {
        opacity: 1;
      }
      .media-container.selected {
        border: 2px solid #007bff;
        background-color: rgba(0, 123, 255, 0.1);
      }
      .footer {
        margin-top: 20px;
        text-align: center;
        font-size: 18px;
        color: #555;
      }
      .delete-button, .copy-button {
        background-color: #ff4d4d;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 15px;
        cursor: pointer;
        transition: background-color 0.3s;
        width: auto;
      }
      .delete-button:hover, .copy-button:hover {
        background-color: #ff1a1a;
      }
      .hidden {
        display: none;
      }
      .dropdown {
        position: relative;
        display: inline-block;
      }
      .dropdown-content {
        display: none;
        position: absolute;
        background-color: #f9f9f9;
        min-width: 160px;
        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
        z-index: 1;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      .dropdown-content button {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
        background: none;
        border: none;
        width: 100%;
        text-align: left;
      }
      .dropdown-content button:hover {
        background-color: #f1f1f1;
      }
      .dropdown:hover .dropdown-content {
        display: block;
      }
      @media (max-width: 768px) {
        .header-left, .header-right {
          flex: 1 1 100%;
          justify-content: flex-start;
        }
        .header-right {
          margin-top: 10px;
        }
        .gallery {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    </style>
    <script>
    let selectedCount = 0;
    const selectedKeys = new Set();
    let isAllSelected = false;
  
    function toggleImageSelection(container) {
      const key = container.getAttribute('data-key');
      container.classList.toggle('selected');
      const uploadTime = container.querySelector('.upload-time');
      if (container.classList.contains('selected')) {
        selectedKeys.add(key);
        selectedCount++;
        uploadTime.style.display = 'block';
      } else {
        selectedKeys.delete(key);
        selectedCount--;
        uploadTime.style.display = 'none';
      }
      updateDeleteButton();
    }
  
    function updateDeleteButton() {
      const deleteButton = document.getElementById('delete-button');
      const countDisplay = document.getElementById('selected-count');
      countDisplay.textContent = selectedCount;
      const headerRight = document.querySelector('.header-right');
      if (selectedCount > 0) {
        headerRight.classList.remove('hidden');
      } else {
        headerRight.classList.add('hidden');
      }
    }
  
    async function deleteSelectedImages() {
      if (selectedKeys.size === 0) return;
      const confirmation = confirm('你确定要删除选中的媒体文件吗？此操作无法撤回。');
      if (!confirmation) return;
  
      const response = await fetch('/delete-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(Array.from(selectedKeys))
      });
      if (response.ok) {
        alert('选中的媒体已删除');
        location.reload();
      } else {
        alert('删除失败');
      }
    }
  
    function copyFormattedLinks(format) {
      const urls = Array.from(selectedKeys).map(url => url.trim()).filter(url => url !== '');
      let formattedLinks = '';
      switch (format) {
        case 'url':
          formattedLinks = urls.join('\\n\\n');
          break;
        case 'bbcode':
          formattedLinks = urls.map(url => '[img]' + url + '[/img]').join('\\n\\n');
          break;
        case 'markdown':
          formattedLinks = urls.map(url => '![image](' + url + ')').join('\\n\\n');
          break;
      }
      navigator.clipboard.writeText(formattedLinks).then(() => {
        alert('复制成功');
      }).catch((err) => {
        alert('复制失败');
      });
    }
  
    function selectAllImages() {
      const mediaContainers = document.querySelectorAll('.media-container');
      if (isAllSelected) {
        mediaContainers.forEach(container => {
          container.classList.remove('selected');
          const key = container.getAttribute('data-key');
          selectedKeys.delete(key);
          container.querySelector('.upload-time').style.display = 'none';
        });
        selectedCount = 0;
      } else {
        mediaContainers.forEach(container => {
          if (!container.classList.contains('selected')) {
            container.classList.add('selected');
            const key = container.getAttribute('data-key');
            selectedKeys.add(key);
            selectedCount++;
            container.querySelector('.upload-time').style.display = 'block';
          }
        });
      }
      isAllSelected = !isAllSelected;
      updateDeleteButton();
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      const mediaContainers = document.querySelectorAll('.media-container[data-key]');
      const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      };
      
      const mediaObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const container = entry.target;
            const video = container.querySelector('video');
            if (video) {
              const source = video.querySelector('source');
              video.src = source.getAttribute('data-src');
              video.load();
            } else {
              const img = container.querySelector('img');
              if (img && !img.src) {
                img.src = img.getAttribute('data-src');
                img.onload = () => img.classList.add('loaded');
              }
            }
            observer.unobserve(container);
          }
        });
      }, options);
  
      mediaContainers.forEach(container => {
        mediaObserver.observe(container);
      });
    });
  </script>
  </head>
  <body>
    <div class="header">
      <div class="header-left">
        <span>媒体文件 ${mediaData.length} 个</span>
        <span>已选中: <span id="selected-count">0</span>个</span>
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
    <div class="gallery">
      ${mediaHtml}
    </div>
    <div class="footer">
      到底啦
    </div>
  </body>
  </html>  
  `;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function fetchMediaData(DATABASE) {
  const result = await DATABASE.prepare('SELECT url FROM media').all();
  const mediaData = result.results.map(row => {
    const timestamp = parseInt(row.url.split('/').pop().split('.')[0]);
    return { url: row.url, timestamp: timestamp };
  });
  mediaData.sort((a, b) => b.timestamp - a.timestamp);
  return mediaData.map(({ url }) => ({ url }));
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
    await DATABASE.prepare('INSERT INTO media (url) VALUES (?) ON CONFLICT(url) DO NOTHING').bind(imageURL).run();
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

// ==================== 相册管理函数 ====================

// 获取相册列表
async function handleGetAlbums(DATABASE, request, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const result = await DATABASE.prepare(`
      SELECT a.*, 
             COUNT(ai.image_url) as image_count,
             COALESCE((
               SELECT image_url 
               FROM album_images 
               WHERE album_id = a.id 
               ORDER BY sort_order 
               LIMIT 1
             ), a.cover_url) as display_cover
      FROM albums a
      LEFT JOIN album_images ai ON a.id = ai.album_id
      GROUP BY a.id
      ORDER BY a.updated_at DESC
    `).all();
    
    return new Response(JSON.stringify({ 
      status: true, 
      data: result.results 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 创建相册
async function handleCreateAlbum(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { name, description, cover_url } = data;
    
    if (!name) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册名称不能为空' 
      }), { status: 400 });
    }
    
    const result = await DATABASE.prepare(`
      INSERT INTO albums (name, description, cover_url, created_at, updated_at)
      VALUES (?, ?, ?, unixepoch(), unixepoch())
    `).bind(name, description || null, cover_url || null).run();
    
    return new Response(JSON.stringify({ 
      status: true, 
      message: '相册创建成功',
      id: result.meta.last_row_id 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 更新相册
async function handleUpdateAlbum(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { id, name, description, cover_url } = data;
    
    if (!id) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册ID不能为空' 
      }), { status: 400 });
    }
    
    const result = await DATABASE.prepare(`
      UPDATE albums 
      SET name = ?, description = ?, cover_url = ?, updated_at = unixepoch()
      WHERE id = ?
    `).bind(name, description || null, cover_url || null, id).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册不存在' 
      }), { status: 404 });
    }
    
    return new Response(JSON.stringify({ 
      status: true, 
      message: '相册更新成功' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 删除相册
async function handleDeleteAlbum(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { id } = data;
    
    if (!id) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册ID不能为空' 
      }), { status: 400 });
    }
    
    const result = await DATABASE.prepare(`
      DELETE FROM albums WHERE id = ?
    `).bind(id).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册不存在' 
      }), { status: 404 });
    }
    
    return new Response(JSON.stringify({ 
      status: true, 
      message: '相册删除成功' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 添加图片到相册
async function handleAddImageToAlbum(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { album_id, image_url } = data;
    
    if (!album_id || !image_url) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册ID和图片URL不能为空' 
      }), { status: 400 });
    }
    
    // 检查图片是否存在于media表中
    const mediaResult = await DATABASE.prepare(
      'SELECT url FROM media WHERE url = ?'
    ).bind(image_url).first();
    
    if (!mediaResult) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '图片不存在于媒体库中' 
      }), { status: 404 });
    }
    
    // 添加图片到相册
    const result = await DATABASE.prepare(`
      INSERT OR REPLACE INTO album_images (album_id, image_url, added_at)
      VALUES (?, ?, unixepoch())
    `).bind(album_id, image_url).run();
    
    // 如果相册没有封面，设置第一张图片为封面
    const albumResult = await DATABASE.prepare(
      'SELECT cover_url FROM albums WHERE id = ?'
    ).bind(album_id).first();
    
    if (albumResult && !albumResult.cover_url) {
      await DATABASE.prepare(`
        UPDATE albums SET cover_url = ?, updated_at = unixepoch() WHERE id = ?
      `).bind(image_url, album_id).run();
    }
    
    return new Response(JSON.stringify({ 
      status: true, 
      message: '图片已添加到相册' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 从相册移除图片
async function handleRemoveImageFromAlbum(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { album_id, image_url } = data;
    
    if (!album_id || !image_url) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册ID和图片URL不能为空' 
      }), { status: 400 });
    }
    
    const result = await DATABASE.prepare(`
      DELETE FROM album_images WHERE album_id = ? AND image_url = ?
    `).bind(album_id, image_url).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '图片不存在于相册中' 
      }), { status: 404 });
    }
    
    // 如果删除的图片是相册封面，更新封面
    const albumResult = await DATABASE.prepare(
      'SELECT cover_url FROM albums WHERE id = ?'
    ).bind(album_id).first();
    
    if (albumResult && albumResult.cover_url === image_url) {
      // 设置第一张图片为新的封面
      const firstImage = await DATABASE.prepare(`
        SELECT image_url FROM album_images 
        WHERE album_id = ? 
        ORDER BY sort_order 
        LIMIT 1
      `).bind(album_id).first();
      
      if (firstImage) {
        await DATABASE.prepare(`
          UPDATE albums SET cover_url = ?, updated_at = unixepoch() WHERE id = ?
        `).bind(firstImage.image_url, album_id).run();
      } else {
        // 相册已空，清空封面
        await DATABASE.prepare(`
          UPDATE albums SET cover_url = NULL, updated_at = unixepoch() WHERE id = ?
        `).bind(album_id).run();
      }
    }
    
    return new Response(JSON.stringify({ 
      status: true, 
      message: '图片已从相册移除' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 获取相册内的图片
async function handleGetAlbumImages(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const url = new URL(request.url);
    const albumId = url.searchParams.get('album_id');
    
    if (!albumId) {
      return new Response(JSON.stringify({ 
        status: false, 
        error: '相册ID不能为空' 
      }), { status: 400 });
    }
    
    const result = await DATABASE.prepare(`
      SELECT ai.image_url, ai.sort_order, ai.added_at,
             m.url as media_url
      FROM album_images ai
      LEFT JOIN media m ON ai.image_url = m.url
      WHERE ai.album_id = ?
      ORDER BY ai.sort_order, ai.added_at DESC
    `).bind(albumId).all();
    
    return new Response(JSON.stringify({ 
      status: true, 
      data: result.results 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// 相册管理页面
async function handleAlbumsPage(request, DATABASE, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { 
      status: 401, 
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } 
    });
  }
  
  const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>相册管理 - JSimages</title>
    <link rel="icon" href="https://p1.meituan.net/csc/c195ee91001e783f39f41ffffbbcbd484286.ico" type="image/x-icon">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.6.1/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
      body {
        background-color: #f8f9fa;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .navbar {
        background-color: #343a40;
        margin-bottom: 30px;
      }
      .navbar-brand {
        color: #fff;
        font-weight: bold;
      }
      .nav-link {
        color: rgba(255,255,255,.5);
      }
      .nav-link:hover {
        color: rgba(255,255,255,.75);
      }
      .container {
        max-width: 1200px;
      }
      .card {
        border: none;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        transition: transform 0.2s;
      }
      .card:hover {
        transform: translateY(-5px);
      }
      .album-card {
        height: 100%;
      }
      .album-cover {
        height: 200px;
        overflow: hidden;
        border-radius: 10px 10px 0 0;
        background-color: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .album-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .no-cover {
        font-size: 60px;
        color: #6c757d;
      }
      .album-info {
        padding: 20px;
      }
      .album-title {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .album-meta {
        font-size: 0.9rem;
        color: #6c757d;
        margin-bottom: 10px;
      }
      .album-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      .btn-sm {
        padding: 5px 10px;
        font-size: 0.875rem;
      }
      .modal-header {
        background-color: #343a40;
        color: white;
      }
      #createAlbumBtn {
        margin-bottom: 20px;
      }
      .album-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .album-detail-title {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 0;
      }
      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .image-item {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
      }
      .image-item img {
        width: 100%;
        height: 200px;
        object-fit: cover;
        transition: transform 0.3s;
      }
      .image-item:hover img {
        transform: scale(1.05);
      }
      .image-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: none;
      }
      .image-item:hover .image-actions {
        display: block;
      }
      .back-btn {
        margin-bottom: 20px;
      }
      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #6c757d;
      }
      .empty-state i {
        font-size: 60px;
        margin-bottom: 20px;
        color: #dee2e6;
      }
    </style>
  </head>
  <body>
    <nav class="navbar navbar-expand-lg navbar-dark">
      <div class="container">
        <a class="navbar-brand" href="/">JSimages</a>
        <div class="collapse navbar-collapse">
          <ul class="navbar-nav mr-auto">
            <li class="nav-item">
              <a class="nav-link" href="/${adminPath}">图库管理</a>
            </li>
            <li class="nav-item active">
              <a class="nav-link" href="/albums">相册管理</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="container">
      <div id="albumListPage">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>相册管理</h2>
          <button class="btn btn-primary" id="createAlbumBtn">
            <i class="fas fa-plus"></i> 创建新相册
          </button>
        </div>
        
        <div id="albumsContainer" class="row">
          <!-- 相册将通过JS动态加载 -->
        </div>
        
        <div id="emptyState" class="empty-state" style="display: none;">
          <i class="fas fa-images"></i>
          <h4>还没有创建相册</h4>
          <p>点击上方的"创建新相册"按钮开始创建您的第一个相册</p>
        </div>
      </div>
      
      <div id="albumDetailPage" style="display: none;">
        <div class="back-btn">
          <button class="btn btn-secondary" id="backToAlbumsBtn">
            <i class="fas fa-arrow-left"></i> 返回相册列表
          </button>
        </div>
        
        <div class="album-detail-header">
          <div>
            <h3 class="album-detail-title" id="albumDetailTitle"></h3>
            <p class="album-detail-description text-muted" id="albumDetailDescription"></p>
          </div>
          <div class="album-detail-actions">
            <button class="btn btn-primary" id="addImagesBtn">
              <i class="fas fa-plus"></i> 添加图片
            </button>
            <button class="btn btn-warning" id="editAlbumBtn">
              <i class="fas fa-edit"></i> 编辑相册
            </button>
            <button class="btn btn-danger" id="deleteAlbumBtn">
              <i class="fas fa-trash"></i> 删除相册
            </button>
          </div>
        </div>
        
        <div id="albumImagesContainer" class="image-grid">
          <!-- 相册图片将通过JS动态加载 -->
        </div>
        
        <div id="emptyAlbumState" class="empty-state" style="display: none;">
          <i class="fas fa-image"></i>
          <h4>相册还没有图片</h4>
          <p>点击上方的"添加图片"按钮为相册添加图片</p>
        </div>
      </div>
    </div>

    <!-- 创建/编辑相册模态框 -->
    <div class="modal fade" id="albumModal" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modalTitle">创建相册</h5>
            <button type="button" class="close" data-dismiss="modal">
              <span style="color: white">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <form id="albumForm">
              <input type="hidden" id="albumId">
              <div class="form-group">
                <label for="albumName">相册名称 *</label>
                <input type="text" class="form-control" id="albumName" required>
              </div>
              <div class="form-group">
                <label for="albumDescription">相册描述</label>
                <textarea class="form-control" id="albumDescription" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label for="albumCoverUrl">封面图片URL</label>
                <input type="text" class="form-control" id="albumCoverUrl" placeholder="可选，可稍后设置">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" id="saveAlbumBtn">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加图片模态框 -->
    <div class="modal fade" id="addImagesModal" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">添加图片到相册</h5>
            <button type="button" class="close" data-dismiss="modal">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <div id="mediaGallery" class="row">
              <!-- 媒体库图片将通过JS动态加载 -->
            </div>
            <div id="mediaEmptyState" class="empty-state" style="display: none;">
              <i class="fas fa-images"></i>
              <h4>媒体库为空</h4>
              <p>请先上传一些图片到媒体库</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" id="addSelectedImagesBtn">添加选中图片</button>
          </div>
        </div>
      </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.1/js/bootstrap.bundle.min.js"></script>
    <script>
      let currentAlbumId = null;
      let selectedMediaImages = new Set();
      
      $(document).ready(function() {
        // 初始化页面
        loadAlbums();
        
        // 绑定事件
        $('#createAlbumBtn').click(showCreateAlbumModal);
        $('#backToAlbumsBtn').click(showAlbumList);
        $('#saveAlbumBtn').click(saveAlbum);
        $('#addImagesBtn').click(showAddImagesModal);
        $('#editAlbumBtn').click(showEditAlbumModal);
        $('#deleteAlbumBtn').click(deleteAlbum);
        $('#addSelectedImagesBtn').click(addSelectedImagesToAlbum);
        
        // 模态框关闭时重置
        $('#albumModal').on('hidden.bs.modal', function() {
          resetAlbumForm();
        });
        
        $('#addImagesModal').on('hidden.bs.modal', function() {
          selectedMediaImages.clear();
        });
      });
      
      // 加载相册列表
      async function loadAlbums() {
        try {
          const response = await fetch('/api/albums');
          const data = await response.json();
          
          if (data.status && data.data.length > 0) {
            renderAlbums(data.data);
            $('#emptyState').hide();
            $('#albumsContainer').show();
          } else {
            $('#albumsContainer').hide();
            $('#emptyState').show();
          }
        } catch (error) {
          console.error('加载相册失败:', error);
          alert('加载相册失败，请刷新页面重试');
        }
      }
      
      // 渲染相册列表
      function renderAlbums(albums) {
        const container = $('#albumsContainer');
        container.empty();
        
        albums.forEach(album => {
          const coverUrl = album.display_cover || album.cover_url;
          const coverHtml = coverUrl 
            ? `<img src="${coverUrl}" alt="${album.name}">`
            : `<div class="no-cover"><i class="fas fa-images"></i></div>`;
          
          const albumCard = `
            <div class="col-md-4 col-lg-3 mb-4">
              <div class="card album-card" data-album-id="${album.id}">
                <div class="album-cover">
                  ${coverHtml}
                </div>
                <div class="album-info">
                  <div class="album-title" title="${album.name}">${album.name}</div>
                  <div class="album-meta">
                    <div><i class="fas fa-image"></i> ${album.image_count || 0} 张图片</div>
                    <div><i class="fas fa-calendar"></i> ${formatTime(album.updated_at)}</div>
                  </div>
                  <div class="album-actions">
                    <button class="btn btn-primary btn-sm view-album-btn">
                      <i class="fas fa-eye"></i> 查看
                    </button>
                    <button class="btn btn-danger btn-sm delete-album-btn">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          container.append(albumCard);
        });
        
        // 绑定查看按钮事件
        $('.view-album-btn').click(function(e) {
          e.stopPropagation();
          const albumId = $(this).closest('.album-card').data('album-id');
          viewAlbum(albumId);
        });
        
        // 绑定删除按钮事件
        $('.delete-album-btn').click(function(e) {
          e.stopPropagation();
          const albumId = $(this).closest('.album-card').data('album-id');
          if (confirm('确定要删除这个相册吗？此操作不可恢复。')) {
            deleteAlbumById(albumId);
          }
        });
        
        // 绑定卡片点击事件
        $('.album-card').click(function() {
          const albumId = $(this).data('album-id');
          viewAlbum(albumId);
        });
      }
      
      // 查看相册详情
      async function viewAlbum(albumId) {
        try {
          currentAlbumId = albumId;
          
          // 获取相册信息
          const albumsResponse = await fetch('/api/albums');
          const albumsData = await albumsResponse.json();
          
          if (albumsData.status) {
            const album = albumsData.data.find(a => a.id == albumId);
            if (album) {
              $('#albumDetailTitle').text(album.name);
              $('#albumDetailDescription').text(album.description || '暂无描述');
            }
          }
          
          // 获取相册图片
          const imagesResponse = await fetch(\`/api/albums/images?album_id=\${albumId}\`);
          const imagesData = await imagesResponse.json();
          
          if (imagesData.status) {
            renderAlbumImages(imagesData.data);
            if (imagesData.data.length > 0) {
              $('#albumImagesContainer').show();
              $('#emptyAlbumState').hide();
            } else {
              $('#albumImagesContainer').hide();
              $('#emptyAlbumState').show();
            }
          }
          
          // 切换到相册详情页面
          $('#albumListPage').hide();
          $('#albumDetailPage').show();
        } catch (error) {
          console.error('加载相册详情失败:', error);
          alert('加载相册详情失败');
        }
      }
      
      // 渲染相册图片
      function renderAlbumImages(images) {
        const container = $('#albumImagesContainer');
        container.empty();
        
        images.forEach(image => {
          const imageUrl = image.image_url || image.media_url;
          const imageItem = `
            <div class="image-item" data-image-url="${imageUrl}">
              <img src="${imageUrl}" alt="相册图片" loading="lazy">
              <div class="image-actions">
                <button class="btn btn-danger btn-sm remove-image-btn" title="从相册中移除">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          `;
          container.append(imageItem);
        });
        
        // 绑定移除按钮事件
        $('.remove-image-btn').click(function(e) {
          e.stopPropagation();
          const imageUrl = $(this).closest('.image-item').data('image-url');
          removeImageFromAlbum(imageUrl);
        });
        
        // 绑定图片点击事件（查看大图）
        $('.image-item').click(function() {
          const imageUrl = $(this).data('image-url');
          window.open(imageUrl, '_blank');
        });
      }
      
      // 显示相册列表
      function showAlbumList() {
        $('#albumDetailPage').hide();
        $('#albumListPage').show();
        loadAlbums();
      }
      
      // 显示创建相册模态框
      function showCreateAlbumModal() {
        $('#modalTitle').text('创建相册');
        resetAlbumForm();
        $('#albumModal').modal('show');
      }
      
      // 显示编辑相册模态框
      async function showEditAlbumModal() {
        try {
          const response = await fetch('/api/albums');
          const data = await response.json();
          
          if (data.status) {
            const album = data.data.find(a => a.id == currentAlbumId);
            if (album) {
              $('#modalTitle').text('编辑相册');
              $('#albumId').val(album.id);
              $('#albumName').val(album.name);
              $('#albumDescription').val(album.description || '');
              $('#albumCoverUrl').val(album.cover_url || '');
              $('#albumModal').modal('show');
            }
          }
        } catch (error) {
          console.error('加载相册信息失败:', error);
        }
      }
      
      // 保存相册
      async function saveAlbum() {
        const albumId = $('#albumId').val();
        const name = $('#albumName').val().trim();
        const description = $('#albumDescription').val().trim();
        const coverUrl = $('#albumCoverUrl').val().trim();
        
        if (!name) {
          alert('相册名称不能为空');
          return;
        }
        
        try {
          const url = albumId ? '/api/albums/update' : '/api/albums/create';
          const data = albumId 
            ? { id: albumId, name, description, cover_url: coverUrl || null }
            : { name, description, cover_url: coverUrl || null };
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          
          if (result.status) {
            $('#albumModal').modal('hide');
            if (albumId && currentAlbumId == albumId) {
              viewAlbum(albumId); // 刷新当前相册
            } else {
              loadAlbums(); // 刷新相册列表
            }
            alert('保存成功！');
          } else {
            alert('保存失败：' + (result.error || '未知错误'));
          }
        } catch (error) {
          console.error('保存相册失败:', error);
          alert('保存失败，请重试');
        }
      }
      
      // 删除相册
      async function deleteAlbum() {
        if (!currentAlbumId || !confirm('确定要删除这个相册吗？相册内的所有图片关联将被移除。')) {
          return;
        }
        
        try {
          const response = await fetch('/api/albums/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentAlbumId })
          });
          
          const result = await response.json();
          
          if (result.status) {
            alert('相册删除成功！');
            showAlbumList();
          } else {
            alert('删除失败：' + (result.error || '未知错误'));
          }
        } catch (error) {
          console.error('删除相册失败:', error);
          alert('删除失败，请重试');
        }
      }
      
      // 通过ID删除相册
      async function deleteAlbumById(albumId) {
        try {
          const response = await fetch('/api/albums/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: albumId })
          });
          
          const result = await response.json();
          
          if (result.status) {
            loadAlbums(); // 刷新列表
            alert('相册删除成功！');
          } else {
            alert('删除失败：' + (result.error || '未知错误'));
          }
        } catch (error) {
          console.error('删除相册失败:', error);
          alert('删除失败，请重试');
        }
      }
      
      // 显示添加图片模态框
      async function showAddImagesModal() {
        try {
          // 加载媒体库图片
          const response = await fetch('/${adminPath}?json=1');
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          const mediaContainers = doc.querySelectorAll('.media-container[data-key]');
          const container = $('#mediaGallery');
          container.empty();
          
          if (mediaContainers.length > 0) {
            mediaContainers.forEach(container => {
              const imageUrl = container.getAttribute('data-key');
              const mediaType = container.querySelector('.media-type').textContent;
              
              // 获取图片元素
              const imgElement = container.querySelector('img');
              const src = imgElement ? imgElement.getAttribute('data-src') : '';
              
              if (src) {
                const mediaItem = `
                  <div class="col-md-4 mb-3">
                    <div class="card media-item" data-image-url="${imageUrl}">
                      <div class="album-cover">
                        <img src="${src}" alt="${mediaType}" loading="lazy">
                      </div>
                      <div class="card-body p-2">
                        <div class="form-check">
                          <input type="checkbox" class="form-check-input media-checkbox" value="${imageUrl}">
                          <label class="form-check-label">${mediaType}</label>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
                container.append(mediaItem);
              }
            });
            
            $('#mediaGallery').show();
            $('#mediaEmptyState').hide();
            
            // 绑定复选框事件
            $('.media-checkbox').change(function() {
              const imageUrl = $(this).val();
              if ($(this).is(':checked')) {
                selectedMediaImages.add(imageUrl);
              } else {
                selectedMediaImages.delete(imageUrl);
              }
            });
            
            // 绑定卡片点击事件
            $('.media-item').click(function(e) {
              if (!$(e.target).is('.form-check, .form-check-input, .form-check-label')) {
                const checkbox = $(this).find('.media-checkbox');
                checkbox.prop('checked', !checkbox.prop('checked'));
                checkbox.trigger('change');
              }
            });
          } else {
            $('#mediaGallery').hide();
            $('#mediaEmptyState').show();
          }
          
          $('#addImagesModal').modal('show');
        } catch (error) {
          console.error('加载媒体库失败:', error);
          alert('加载媒体库失败');
        }
      }
      
      // 添加选中图片到相册
      async function addSelectedImagesToAlbum() {
        if (selectedMediaImages.size === 0) {
          alert('请先选择要添加的图片');
          return;
        }
        
        try {
          const promises = Array.from(selectedMediaImages).map(imageUrl => {
            return fetch('/api/albums/add-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                album_id: currentAlbumId,
                image_url: imageUrl
              })
            });
          });
          
          const responses = await Promise.all(promises);
          const results = await Promise.all(responses.map(r => r.json()));
          
          const successCount = results.filter(r => r.status).length;
          
          if (successCount > 0) {
            alert(`成功添加 ${successCount} 张图片到相册`);
            $('#addImagesModal').modal('hide');
            viewAlbum(currentAlbumId); // 刷新相册详情
          } else {
            alert('添加图片失败');
          }
        } catch (error) {
          console.error('添加图片失败:', error);
          alert('添加图片失败');
        }
      }
      
      // 从相册移除图片
      async function removeImageFromAlbum(imageUrl) {
        if (!confirm('确定要从相册中移除这张图片吗？')) {
          return;
        }
        
        try {
          const response = await fetch('/api/albums/remove-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              album_id: currentAlbumId,
              image_url: imageUrl
            })
          });
          
          const result = await response.json();
          
          if (result.status) {
            alert('图片已从相册移除');
            viewAlbum(currentAlbumId); // 刷新相册详情
          } else {
            alert('移除失败：' + (result.error || '未知错误'));
          }
        } catch (error) {
          console.error('移除图片失败:', error);
          alert('移除失败，请重试');
        }
      }
      
      // 重置相册表单
      function resetAlbumForm() {
        $('#albumId').val('');
        $('#albumName').val('');
        $('#albumDescription').val('');
        $('#albumCoverUrl').val('');
      }
      
      // 格式化时间戳
      function formatTime(timestamp) {
        if (!timestamp) return '未知时间';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    </script>
  </body>
  </html>
  `;
  
  return new Response(html, { 
    status: 200, 
    headers: { 'Content-Type': 'text/html; charset=utf-8' } 
  });
                }
