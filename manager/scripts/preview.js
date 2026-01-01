const owner = "yikedashu85-lgtm";
const repo = "OurDiary";

let currentFilename = null;

function getToken() {
  return localStorage.getItem('github_token');
}

function deriveKeyFromToken(token) {
  const hash = CryptoJS.SHA256(token + 'OurDiarySalt2024');
  return hash;
}

function decryptContent(encryptedContent, keyHash) {
  try {
    const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
    const decrypted = CryptoJS.AES.decrypt(encryptedContent, keyHash, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) {
      throw new Error('解密失败');
    }
    return result;
  } catch (e) {
    throw new Error('解密失败，请检查 token 是否正确');
  }
}

function parseFrontMatter(decryptedContent) {
  const frontMatterMatch = decryptedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!frontMatterMatch) {
    return null;
  }

  const metadata = {};
  frontMatterMatch[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      metadata[key.trim()] = valueParts.join(':').trim();
    }
  });

  return {
    metadata,
    content: frontMatterMatch[2]
  };
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = [
    'position:fixed',
    'top:20px',
    'right:20px',
    'background:var(--primary-color)',
    'color:#fff',
    'padding:12px 16px',
    'border-radius:12px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.12)',
    'z-index:3000'
  ].join(';');
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2500);
}

async function loadDiary() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  currentFilename = file;

  const container = document.getElementById('previewContainer');
  if (!file) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-file-warning-line"></i>
        <h3>未指定日记</h3>
        <p>请从日记库进入预览页</p>
        <button class="btn btn-primary" onclick="goBackToLibrary()">
          <i class="ri-arrow-left-line"></i>
          返回日记库
        </button>
      </div>`;
    return;
  }

  const token = getToken();
  if (!token) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-key-2-line"></i>
        <h3>需要设置 GitHub Token</h3>
        <p>请先设置 GitHub Token 来查看日记</p>
        <button class="btn btn-primary" onclick="showTokenModal()">
          <i class="ri-key-2-line"></i>
          设置 Token
        </button>
      </div>`;
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(file)}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!res.ok) {
      throw new Error('无法加载日记');
    }
    const fileData = await res.json();
    const encryptedContent = atob(fileData.content);
    const decodedContent = decodeURIComponent(escape(encryptedContent));

    const keyHash = deriveKeyFromToken(token);
    const decrypted = decryptContent(decodedContent, keyHash);
    const parsed = parseFrontMatter(decrypted);

    if (!parsed) {
      throw new Error('日记格式不正确');
    }

    const title = parsed.metadata.title || '无标题';
    const author = parsed.metadata.author || '未知';
    const date = parsed.metadata.date || '';

    const titleEl = document.getElementById('previewTitle');
    const metaEl = document.getElementById('previewMeta');
    if (titleEl) titleEl.textContent = title;
    if (metaEl) metaEl.textContent = `${author} · ${String(date).split('T')[0]}`;

    container.innerHTML = `
      <div class="diary-card">
        <div class="diary-header">
          <div class="diary-author">
            <div class="author-avatar">${String(author).charAt(0)}</div>
            <div class="author-info">
              <div class="author-name">${author}</div>
              <div class="diary-time">${String(date).split('T')[0]}</div>
            </div>
          </div>
        </div>
        <h2 class="diary-title">${title}</h2>
        <div class="diary-content">${marked.parse(parsed.content || '')}</div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `
      <div class="error-state">
        <i class="ri-error-warning-line"></i>
        <h3>加载失败</h3>
        <p>${e.message}</p>
        <button class="btn btn-secondary" onclick="goBackToLibrary()">
          <i class="ri-arrow-left-line"></i>
          返回
        </button>
      </div>`;
  }
}

function goBackToLibrary() {
  window.location.href = 'library.html';
}

function goEdit() {
  if (!currentFilename) return;
  window.location.href = `index.html?file=${encodeURIComponent(currentFilename)}`;
}

function showDeleteConfirm() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.style.display = 'flex';
}

function hideDeleteConfirm() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.style.display = 'none';
}

async function confirmDelete() {
  if (!currentFilename) return;

  const token = getToken();
  if (!token) {
    showTokenModal();
    return;
  }

  try {
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(currentFilename)}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!metaRes.ok) {
      throw new Error('无法获取文件信息');
    }
    const meta = await metaRes.json();
    const sha = meta.sha;

    const delRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(currentFilename)}`, {
      method: 'DELETE',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Delete diary ${currentFilename}`,
        sha: sha
      })
    });

    if (!delRes.ok) {
      const err = await delRes.json();
      throw new Error(err?.message || '删除失败');
    }

    hideDeleteConfirm();
    showNotification('删除成功');
    setTimeout(() => {
      goBackToLibrary();
    }, 600);
  } catch (e) {
    showNotification(e.message || '删除失败');
  }
}

window.addEventListener('load', loadDiary);
