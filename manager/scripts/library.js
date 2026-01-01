// 日记库页面专用脚本
const owner = "yikedashu85-lgtm";
const repo = "OurDiary";
const diaryList = document.getElementById('diary-list');
let allDiaries = [];

let commentsData = {};
let currentDiaryId = null;

let pendingExportFormat = null;
let pendingExportIndexes = [];
let pendingSingleExportIndex = null;
let pendingSingleExportFormat = null;
let pendingIncludeCommentsCallback = null;

// 获取保存的 token（使用main.js中的函数）
function getToken() {
  return localStorage.getItem('github_token');
}

function toSafeId(input) {
  try {
    const bytes = unescape(encodeURIComponent(String(input)));
    const base64 = btoa(bytes);
    return base64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  } catch (e) {
    return String(input).replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

function getDiaryCommentId(diary) {
  const raw = (diary.filename || '').replace(/\.md$/i, '');
  return toSafeId(raw || `${diary.date}-${diary.author}`);
}

function loadCommentsData() {
  const saved = localStorage.getItem('diary_comments');
  if (saved) {
    try {
      commentsData = JSON.parse(saved) || {};
    } catch (e) {
      commentsData = {};
    }
  }
}

function persistCommentsData() {
  localStorage.setItem('diary_comments', JSON.stringify(commentsData));
}

function formatCommentTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffMins < 1440) {
    return `${Math.floor(diffMins / 60)}小时前`;
  }
  return date.toLocaleDateString('zh-CN');
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

// 加密/解密工具函数
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
  } catch(e) {
    throw new Error('解密失败，请检查 token 是否正确');
  }
}

// 从 GitHub 获取所有日记
async function loadDiariesFromGitHub() {
  const token = getToken();
  if (!token) {
    diaryList.innerHTML = `
      <div class="empty-state">
        <i class="ri-key-2-line"></i>
        <h3>需要设置 GitHub Token</h3>
        <p>请先设置 GitHub Token 来查看日记库</p>
        <button class="btn btn-primary" onclick="showTokenModal()">
          <i class="ri-key-2-line"></i>
          设置 Token
        </button>
      </div>`;
    return;
  }

  diaryList.innerHTML = `
    <div class="loading-state">
      <i class="ri-loader-4-line animate-spin"></i>
      <p>正在加载日记库...</p>
    </div>`;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts`, {
      headers: { Authorization: `token ${token}` }
    });

    if (!response.ok) {
      throw new Error('无法访问 GitHub 仓库');
    }

    const files = await response.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md'));
    
    if (mdFiles.length === 0) {
      diaryList.innerHTML = `
        <div class="empty-state">
          <i class="ri-book-line"></i>
          <h3>还没有日记</h3>
          <p>快去写下第一篇日记吧！</p>
          <button class="btn btn-primary" onclick="window.location.href='index.html'">
            <i class="ri-edit-line"></i>
            写日记
          </button>
        </div>`;
      return;
    }

    allDiaries = [];
    const keyHash = deriveKeyFromToken(token);

    // 获取所有文件内容
    for (const file of mdFiles) {
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${file.name}`, {
          headers: { Authorization: `token ${token}` }
        });
        const fileData = await fileResponse.json();
        const encryptedContent = atob(fileData.content);
        
        // 解码Base64内容（匹配index.html的编码方式）
        const decodedContent = decodeURIComponent(escape(encryptedContent));
        
        // 尝试解密
        const decryptedContent = decryptContent(decodedContent, keyHash);
        
        // 解析 front matter
        const frontMatterMatch = decryptedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
        if (frontMatterMatch) {
          const metadata = {};
          frontMatterMatch[1].split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
              metadata[key.trim()] = valueParts.join(':').trim();
            }
          });
          
          allDiaries.push({
            title: metadata.title || '无标题',
            author: metadata.author || '未知',
            date: metadata.date || file.name,
            content: frontMatterMatch[2],
            filename: file.name
          });
        }
      } catch(e) {
        console.error(`无法解密文件 ${file.name}:`, e);
      }
    }

    // 按日期排序
    allDiaries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    renderDiaries();
  } catch(e) {
    diaryList.innerHTML = `
      <div class="error-state">
        <i class="ri-error-warning-line"></i>
        <h3>加载失败</h3>
        <p>无法加载日记库: ${e.message}</p>
        <button class="btn btn-secondary" onclick="refreshLibrary()">
          <i class="ri-refresh-line"></i>
          重试
        </button>
      </div>`;
  }
}

// 渲染日记列表
function renderDiaries() {
  diaryList.innerHTML = '';
  
  if (allDiaries.length === 0) {
    diaryList.innerHTML = `
      <div class="empty-state">
        <i class="ri-book-line"></i>
        <h3>还没有日记</h3>
        <p>快去写下第一篇日记吧！</p>
        <button class="btn btn-primary" onclick="window.location.href='index.html'">
          <i class="ri-edit-line"></i>
          写日记
        </button>
      </div>`;
    return;
  }

  allDiaries.forEach((diary, index) => {
    const card = document.createElement('div');
    card.className = 'diary-card';
    
    // 获取作者姓名首字母
    const authorInitial = diary.author.charAt(0);
    
    // 格式化日期
    const dateStr = String(diary.date || '').split('T')[0];

    const diaryId = getDiaryCommentId(diary);
    const commentCount = (commentsData[diaryId] || []).length;
    
    card.innerHTML = `
      <div class="diary-header">
        <div class="diary-author">
          <div class="author-avatar">${authorInitial}</div>
          <div class="author-info">
            <div class="author-name">${diary.author}</div>
            <div class="diary-time">${dateStr}</div>
          </div>
        </div>
        <div class="diary-actions">
          <button class="diary-action-btn" onclick="toggleDiary(${index})" title="展开/收起">
            <i class="ri-arrow-down-s-line"></i>
          </button>
          <button class="diary-action-btn" onclick="exportSingleDiary(${index}, 'md')" title="导出">
            <i class="ri-download-2-line"></i>
          </button>
        </div>
      </div>
      <h2 class="diary-title">${diary.title}</h2>
      <div class="diary-content" id="content-${index}" style="display: none;">
        ${marked.parse(diary.content)}
      </div>
      <div class="diary-comments" id="comments-${diaryId}">
        <div class="comments-header">
          <div class="comments-title">
            <i class="ri-chat-3-line"></i>
            评论
            <span class="comment-count">${commentCount}</span>
          </div>
          <button class="add-comment-btn" onclick="showCommentModal('${diaryId}')">
            <i class="ri-add-line"></i>
            添加评论
          </button>
        </div>
        <div class="comment-list"></div>
      </div>
    `;
    
    diaryList.appendChild(card);

    updateCommentsDisplay(diaryId);
  });
}

// 切换日记展开/收起
function toggleDiary(index) {
  const content = document.getElementById(`content-${index}`);
  const isShowing = content.style.display !== 'none';
  
  if (isShowing) {
    content.style.display = 'none';
  } else {
    content.style.display = 'block';
  }
}

// 导出单个日记
function exportSingleDiary(index, format) {
  pendingSingleExportIndex = index;
  pendingSingleExportFormat = format;
  showExportCommentConfirmModal();
}

// 导出所有日记
function exportAll(format) {
  openExportSelection(format);
}

function openExportSelection(format) {
  const dropdown = document.getElementById('exportDropdown');
  if (dropdown) dropdown.classList.remove('show');

  if (allDiaries.length === 0) {
    alert('没有可导出的日记');
    return;
  }

  pendingExportFormat = format;
  const modal = document.getElementById('exportSelectModal');
  const list = document.getElementById('exportSelectList');
  if (!modal || !list) return;

  const selectAll = document.getElementById('exportSelectAll');
  if (selectAll) selectAll.checked = true;

  list.innerHTML = allDiaries.map((diary, idx) => {
    const dateStr = String(diary.date || '').split('T')[0];
    const checkboxId = `export-cb-${idx}`;
    return `
      <div class="export-select-item" onclick="toggleExportItem(${idx})">
        <input type="checkbox" id="${checkboxId}" class="square-checkbox" data-index="${idx}" checked onclick="event.stopPropagation(); syncSelectAllCheckbox()">
        <div class="meta">
          <div class="title">${diary.title}</div>
          <div class="sub">${diary.author} · ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');

  modal.style.display = 'flex';
}

function hideExportSelectModal() {
  const modal = document.getElementById('exportSelectModal');
  if (modal) modal.style.display = 'none';
  pendingExportFormat = null;
  pendingExportIndexes = [];
}

function hideExportSelectModalKeepState() {
  const modal = document.getElementById('exportSelectModal');
  if (modal) modal.style.display = 'none';
}

function toggleExportItem(index) {
  const cb = document.getElementById(`export-cb-${index}`);
  if (!cb) return;
  cb.checked = !cb.checked;
  syncSelectAllCheckbox();
}

function toggleSelectAllExportItems() {
  const selectAll = document.getElementById('exportSelectAll');
  if (!selectAll) return;
  selectAll.checked = !selectAll.checked;
  document.querySelectorAll('#exportSelectList input[type="checkbox"]').forEach(cb => {
    cb.checked = selectAll.checked;
  });
}

function syncSelectAllCheckbox() {
  const selectAll = document.getElementById('exportSelectAll');
  if (!selectAll) return;
  const items = Array.from(document.querySelectorAll('#exportSelectList input[type="checkbox"]'));
  if (items.length === 0) {
    selectAll.checked = false;
    return;
  }
  selectAll.checked = items.every(cb => cb.checked);
}

function confirmExportSelection() {
  const selected = Array.from(document.querySelectorAll('#exportSelectList input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => Number(cb.getAttribute('data-index')))
    .filter(n => !Number.isNaN(n));

  if (selected.length === 0) {
    alert('请至少选择一篇日记');
    return;
  }

  pendingExportIndexes = selected;
  hideExportSelectModalKeepState();
  showExportCommentConfirmModal();
}

function showExportCommentConfirmModal() {
  const modal = document.getElementById('exportCommentConfirmModal');
  if (modal) modal.style.display = 'flex';
}

function hideExportCommentConfirmModal() {
  const modal = document.getElementById('exportCommentConfirmModal');
  if (modal) modal.style.display = 'none';

  if (pendingSingleExportIndex !== null || pendingSingleExportFormat) {
    pendingSingleExportIndex = null;
    pendingSingleExportFormat = null;
  }

  if (pendingExportFormat && pendingExportIndexes.length > 0) {
    const exportSelectModal = document.getElementById('exportSelectModal');
    if (exportSelectModal) exportSelectModal.style.display = 'flex';
  }
}

function confirmExportWithComments(includeComments) {
  if (pendingSingleExportIndex !== null && pendingSingleExportFormat) {
    const diary = allDiaries[pendingSingleExportIndex];
    if (diary) {
      exportDiaryFile(diary, pendingSingleExportFormat, includeComments);
    }
    pendingSingleExportIndex = null;
    pendingSingleExportFormat = null;
    hideExportCommentConfirmModal();
    return;
  }

  if (pendingExportFormat && pendingExportIndexes.length > 0) {
    exportSelectedDiaries(pendingExportFormat, pendingExportIndexes, includeComments);
  }
  hideExportCommentConfirmModal();
  hideExportSelectModal();
}

function buildCommentsMarkdown(comments) {
  if (!comments || comments.length === 0) return '';
  let md = '\n\n## 评论\n\n';
  comments.forEach((c) => {
    md += `- **${c.author}** (${formatCommentTime(c.time)}): ${c.content}\n`;
  });
  return md;
}

function buildCommentsText(comments) {
  if (!comments || comments.length === 0) return '';
  let text = '\n\n评论:\n';
  comments.forEach((c) => {
    text += `- ${c.author} (${formatCommentTime(c.time)}): ${c.content}\n`;
  });
  return text;
}

function exportSelectedDiaries(format, selectedIndexes, includeComments) {
  selectedIndexes.forEach((idx) => {
    const diary = allDiaries[idx];
    if (!diary) return;

    exportDiaryFile(diary, format, includeComments);
  });

  showNotification('已开始导出所选日记');
}

function exportDiaryFile(diary, format, includeComments) {
  const dateStr = String(diary.date || '').split('T')[0];
  const filename = `${dateStr}-${diary.author}-${diary.title}`.replace(/[\\/:*?"<>|]/g, '_');

  const diaryId = getDiaryCommentId(diary);
  const comments = includeComments ? (commentsData[diaryId] || []) : [];

  if (format === 'md') {
    const metadata = `---\ntitle: ${diary.title}\nauthor: ${diary.author}\ndate: ${diary.date}\n---\n\n`;
    const extra = includeComments ? buildCommentsMarkdown(comments) : '';
    const blob = new Blob([metadata + diary.content + extra], { type: 'text/markdown;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'txt') {
    const text = `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n${diary.content}${includeComments ? buildCommentsText(comments) : ''}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const metadata = `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n`;
    const commentText = includeComments ? buildCommentsText(comments) : '';
    const fullText = metadata + String(diary.content || '').replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '') + commentText;
    const lines = doc.splitTextToSize(fullText, 180);
    doc.setFontSize(12);
    doc.text(lines, 14, 20);
    doc.save(`${filename}.pdf`);
  }
}

function showCommentModal(diaryId) {
  currentDiaryId = diaryId;
  const modal = document.getElementById('commentModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const author = document.getElementById('commentAuthor');
  const content = document.getElementById('commentContent');
  if (author) author.value = '赵涵';
  if (content) content.value = '';
}

function hideCommentModal() {
  const modal = document.getElementById('commentModal');
  if (modal) modal.style.display = 'none';
  currentDiaryId = null;
}

function submitComment() {
  const author = document.getElementById('commentAuthor')?.value;
  const content = document.getElementById('commentContent')?.value?.trim();

  if (!content) {
    alert('请输入评论内容');
    return;
  }
  if (!currentDiaryId) {
    alert('评论失败，请重试');
    return;
  }

  if (!commentsData[currentDiaryId]) {
    commentsData[currentDiaryId] = [];
  }
  commentsData[currentDiaryId].push({
    author: author,
    content: content,
    time: new Date().toISOString()
  });
  persistCommentsData();
  updateCommentsDisplay(currentDiaryId);
  hideCommentModal();
  showNotification('评论发表成功！');
}

function updateCommentsDisplay(diaryId) {
  const commentsContainer = document.getElementById(`comments-${diaryId}`);
  if (!commentsContainer) return;

  const list = commentsContainer.querySelector('.comment-list');
  if (!list) return;

  const comments = commentsData[diaryId] || [];
  const countEl = commentsContainer.querySelector('.comment-count');
  if (countEl) countEl.textContent = comments.length;

  if (comments.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">暂无评论</p>';
    return;
  }

  list.innerHTML = comments.map((comment) => `
    <div class="comment-item">
      <div class="comment-avatar">${String(comment.author || '').charAt(0)}</div>
      <div class="comment-content">
        <div class="comment-author">${comment.author}</div>
        <div class="comment-time">${formatCommentTime(comment.time)}</div>
        <div class="comment-text">${comment.content}</div>
      </div>
    </div>
  `).join('');
}

// 导出下拉菜单
function toggleExportDropdown() {
  const dropdown = document.getElementById('exportDropdown');
  dropdown.classList.toggle('show');
}

// 点击外部关闭下拉菜单
window.onclick = function(event) {
  const exportDropdown = document.querySelector('.export-dropdown');
  if (exportDropdown && !event.target.closest('.export-dropdown')) {
    const dropdowns = document.getElementsByClassName('dropdown-menu');
    for (let i = 0; i < dropdowns.length; i++) {
      if (dropdowns[i].classList.contains('show')) {
        dropdowns[i].classList.remove('show');
      }
    }
  }
}

// 刷新库页面
function refreshLibrary() {
  const refreshBtn = document.querySelector('.btn-secondary i');
  if (refreshBtn) {
    refreshBtn.classList.add('refresh-spin');
    setTimeout(() => {
      refreshBtn.classList.remove('refresh-spin');
    }, 500);
  }
  loadDiariesFromGitHub();
}

// 页面加载时执行
window.addEventListener('load', function() {
  loadCommentsData();
  loadDiariesFromGitHub();
});
