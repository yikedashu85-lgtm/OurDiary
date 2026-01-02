// 日记库页面专用脚本
const owner = "yikedashu85-lgtm";
const repo = "OurDiary";
const diaryList = document.getElementById('diary-list');
let allDiaries = [];
let diariesByMonth = {}; // 按年月组织的日记数据

let commentsData = {};
let currentDiaryId = null;

let pendingExportFormat = null;
let pendingExportIndexes = [];
let pendingSingleExportIndex = null;
let pendingSingleExportFormat = null;
let pendingIncludeCommentsCallback = null;

let pendingDeleteIndex = null;

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

// 按年月组织日记数据
function organizeDiariesByMonth(diaries) {
  const organized = {};
  
  diaries.forEach(diary => {
    const date = new Date(diary.date);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    if (!organized[year]) {
      organized[year] = {};
    }
    
    if (!organized[year][month]) {
      organized[year][month] = [];
    }
    
    organized[year][month].push(diary);
  });
  
  // 对每个月的日记按日期排序（最新的在前）
  Object.keys(organized).forEach(year => {
    Object.keys(organized[year]).forEach(month => {
      organized[year][month].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
  });
  
  return organized;
}

// 获取年月统计信息
function getMonthStatistics() {
  const stats = {};
  
  Object.keys(diariesByMonth).forEach(year => {
    stats[year] = {};
    Object.keys(diariesByMonth[year]).forEach(month => {
      stats[year][month] = diariesByMonth[year][month].length;
    });
  });
  
  return stats;
}

// 获取所有年月列表（按时间倒序）
function getYearMonthList() {
  const yearMonths = [];
  
  Object.keys(diariesByMonth)
    .sort((a, b) => parseInt(b) - parseInt(a))
    .forEach(year => {
      Object.keys(diariesByMonth[year])
        .sort((a, b) => parseInt(b) - parseInt(a))
        .forEach(month => {
          yearMonths.push({
            year: year,
            month: month,
            count: diariesByMonth[year][month].length,
            label: `${year}年${parseInt(month)}月`
          });
        });
    });
  
  return yearMonths;
}

// 渲染按年月组织的日记库
function renderLibraryByMonth() {
  if (Object.keys(diariesByMonth).length === 0) {
    diaryList.innerHTML = `
      <div class="empty-state">
        <i class="ri-book-line"></i>
        <h3>还没有日记</h3>
        <p>开始写第一篇日记吧</p>
        <button class="btn btn-primary" onclick="window.location.href='index.html'">
          <i class="ri-edit-line"></i>
          写日常
        </button>
      </div>`;
    return;
  }

  const yearMonthList = getYearMonthList();
  const stats = getMonthStatistics();
  
  diaryList.innerHTML = `
    <div class="library-container">
      <div class="library-sidebar">
        <div class="sidebar-header">
          <h3><i class="ri-calendar-line"></i> 时间导航</h3>
        </div>
        <div class="year-month-nav">
          ${renderYearMonthNavigation(yearMonthList)}
        </div>
        <div class="library-stats">
          <h4><i class="ri-bar-chart-line"></i> 统计信息</h4>
          ${renderStatistics()}
        </div>
      </div>
      <div class="library-content">
        <div class="content-header">
          <h2><i class="ri-book-open-line"></i> 日常库</h2>
          <div class="header-actions">
            <div class="export-dropdown">
              <button class="btn btn-secondary" onclick="toggleExportDropdown()">
                <i class="ri-download-2-line"></i>
                导出
                <i class="ri-arrow-down-s-line"></i>
              </button>
              <div id="exportDropdown" class="dropdown-menu">
                <a href="#" onclick="openExportSelection('md'); return false;">
                  <i class="ri-markdown-line"></i>
                  导出为 Markdown
                </a>
                <a href="#" onclick="openExportSelection('txt'); return false;">
                  <i class="ri-file-text-line"></i>
                  导出为文本
                </a>
                <a href="#" onclick="openExportSelection('pdf'); return false;">
                  <i class="ri-file-pdf-line"></i>
                  导出为 PDF
                </a>
              </div>
            </div>
            <button class="btn btn-secondary" onclick="refreshLibrary()">
              <i class="ri-refresh-line"></i>
              刷新
            </button>
          </div>
        </div>
        <div class="diary-list">
          ${renderDiaryListByMonth(yearMonthList)}
        </div>
      </div>
    </div>
  `;
}

// 渲染年月导航
function renderYearMonthNavigation(yearMonthList) {
  const yearGroups = {};
  
  yearMonthList.forEach(item => {
    if (!yearGroups[item.year]) {
      yearGroups[item.year] = [];
    }
    yearGroups[item.year].push(item);
  });

  return Object.keys(yearGroups)
    .sort((a, b) => parseInt(b) - parseInt(a))
    .map(year => `
      <div class="year-group">
        <div class="year-header" onclick="toggleYear('${year}')">
          <i class="ri-arrow-down-s-line" id="year-arrow-${year}"></i>
          <span>${year}年</span>
          <span class="year-count">(${yearGroups[year].reduce((sum, item) => sum + item.count, 0)}篇)</span>
        </div>
        <div class="month-list" id="year-${year}">
          ${yearGroups[year].map(item => `
            <div class="month-item" onclick="scrollToMonth('${item.year}-${item.month}')">
              <span>${parseInt(item.month)}月</span>
              <span class="month-count">(${item.count}篇)</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
}

// 渲染统计信息
function renderStatistics() {
  const totalDiaries = allDiaries.length;
  const totalWords = allDiaries.reduce((sum, diary) => sum + (diary.content?.length || 0), 0);
  const authorCounts = {};
  const tagCounts = {};
  
  allDiaries.forEach(diary => {
    authorCounts[diary.author] = (authorCounts[diary.author] || 0) + 1;
    if (diary.tags) {
      diary.tags.split(/[,，\s]+/).forEach(tag => {
        if (tag.trim()) {
          tagCounts[tag.trim()] = (tagCounts[tag.trim()] || 0) + 1;
        }
      });
    }
  });
  
  const topAuthor = Object.keys(authorCounts).reduce((a, b) => authorCounts[a] > authorCounts[b] ? a : b, '');
  const topTag = Object.keys(tagCounts).reduce((a, b) => tagCounts[a] > tagCounts[b] ? a : b, '');
  const latestDate = allDiaries.length > 0 ? new Date(allDiaries[0].date).toLocaleDateString('zh-CN') : '无';
  
  return `
    <div class="stat-item">
      <span class="stat-label">总日记数</span>
      <span class="stat-value">${totalDiaries}篇</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">总字数</span>
      <span class="stat-value">${Math.round(totalWords / 1000)}k字</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">最活跃</span>
      <span class="stat-value">${topAuthor}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">最常标签</span>
      <span class="stat-value">${topTag || '无'}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">最近更新</span>
      <span class="stat-value">${latestDate}</span>
    </div>
  `;
}

// 渲染日记列表（按月分组）
function renderDiaryListByMonth(yearMonthList) {
  return yearMonthList.map(item => {
    const diaries = diariesByMonth[item.year][item.month];
    return `
      <div class="month-section" id="month-${item.year}-${item.month}">
        <h3 class="month-title">
          <i class="ri-calendar-2-line"></i>
          ${item.label}
          <span class="month-diary-count">(${diaries.length}篇)</span>
        </h3>
        <div class="month-diaries">
          ${diaries.map(diary => renderDiaryCard(diary)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// 切换年份展开/收起
function toggleYear(year) {
  const yearElement = document.getElementById(`year-${year}`);
  const arrow = document.getElementById(`year-arrow-${year}`);
  
  if (yearElement.style.display === 'none') {
    yearElement.style.display = 'block';
    arrow.style.transform = 'rotate(0deg)';
  } else {
    yearElement.style.display = 'none';
    arrow.style.transform = 'rotate(-90deg)';
  }
}

// 滚动到指定月份
function scrollToMonth(yearMonth) {
  const monthElement = document.getElementById(`month-${yearMonth}`);
  if (monthElement) {
    monthElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // 高亮效果
    monthElement.style.backgroundColor = 'rgba(134, 158, 92, 0.1)';
    setTimeout(() => {
      monthElement.style.backgroundColor = '';
    }, 1000);
  }
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
  console.log('deriveKeyFromToken called with token:', !!token, token?.length);
  if (!token) {
    console.error('Token is undefined or empty');
    return null;
  }
  
  try {
    const hash = CryptoJS.SHA256(token + 'OurDiarySalt2024');
    console.log('Key hash generated:', !!hash, hash.toString().length);
    return hash;
  } catch(e) {
    console.error('Error generating key hash:', e);
    return null;
  }
}

function encryptContent(content, keyHash) {
  const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
  const encrypted = CryptoJS.AES.encrypt(content, keyHash, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
}

function decryptContent(encryptedContent, keyHash) {
  try {
    // 检查输入
    if (!encryptedContent) {
      console.warn('解密失败：缺少加密内容');
      return null;
    }
    
    if (!keyHash) {
      console.warn('解密失败：缺少密钥哈希');
      return null;
    }

    console.log('Attempting decryption with keyHash:', !!keyHash, keyHash.toString().length);

    const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
    const decrypted = CryptoJS.AES.decrypt(encryptedContent, keyHash, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!result) {
      throw new Error('解密结果为空');
    }
    return result;
  } catch(e) {
    console.warn('解密失败详情:', {
      error: e.message,
      hasEncryptedContent: !!encryptedContent,
      hasKeyHash: !!keyHash,
      encryptedContentLength: encryptedContent?.length,
      keyHashLength: keyHash?.toString?.()?.length || 'undefined'
    });
    return null;
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

    // 并行获取所有文件内容
    const filePromises = mdFiles.map(async (file) => {
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${file.name}`, {
          headers: { Authorization: `token ${token}` }
        });
        const fileData = await fileResponse.json();
        const encryptedContent = atob(fileData.content);
        
        // 解码Base64内容（匹配editor.js的编码方式）
        const decodedContent = unescape(encodeURIComponent(encryptedContent));
        
        // 尝试解密
        const decryptedContent = decryptContent(decodedContent, keyHash);
        if (!decryptedContent) return null; // 跳过无法解密的文件
        
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
          
          return {
            title: metadata.title || '无标题',
            author: metadata.author || '未知',
            date: metadata.date || file.name,
            tags: metadata.tags || '',
            content: frontMatterMatch[2],
            filename: file.name
          };
        }
        return null;
      } catch(e) {
        console.error(`无法解密文件 ${file.name}:`, e);
        return null;
      }
    });

    // 等待所有文件加载完成
    const results = await Promise.all(filePromises);
    allDiaries = results.filter(diary => diary !== null);

    // 如果所有文件都解密失败，提示用户
    if (allDiaries.length === 0 && mdFiles.length > 0) {
      diaryList.innerHTML = `
        <div class="error-state">
          <i class="ri-lock-line"></i>
          <h3>解密失败</h3>
          <p>无法解密日记文件，可能的原因：</p>
          <ul style="text-align: left; max-width: 400px; margin: 1rem auto;">
            <li>GitHub Token 不匹配</li>
            <li>文件使用了不同的加密方式</li>
            <li>Token 权限不足</li>
          </ul>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="showTokenModal()">
              <i class="ri-key-2-line"></i>
              重新设置 Token
            </button>
            <button class="btn btn-secondary" onclick="refreshLibrary()">
              <i class="ri-refresh-line"></i>
              重试
            </button>
          </div>
        </div>`;
      return;
    }

    // 按日期排序
    allDiaries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 按年月组织数据
    diariesByMonth = organizeDiariesByMonth(allDiaries);
    
    // 渲染新的年月界面
    renderLibraryByMonth();
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
  
  // 获取搜索关键词
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // 过滤日记
  let filteredDiaries = allDiaries;
  if (query) {
    filteredDiaries = allDiaries.filter(diary => {
      const titleMatch = (diary.title || '').toLowerCase().includes(query);
      const authorMatch = (diary.author || '').toLowerCase().includes(query);
      const contentMatch = (diary.content || '').toLowerCase().includes(query);
      const tagsMatch = (diary.tags || '').toLowerCase().includes(query);
      return titleMatch || authorMatch || contentMatch || tagsMatch;
    });
  }
  
  if (filteredDiaries.length === 0) {
    diaryList.innerHTML = query ? `
      <div class="empty-state">
        <i class="ri-search-line"></i>
        <h3>没有找到匹配的日常</h3>
        <p>试试其他关键词吧</p>
      </div>` : `
      <div class="empty-state">
        <i class="ri-book-line"></i>
        <h3>还没有日常</h3>
        <p>快去写下第一篇日常吧！</p>
        <button class="btn btn-primary" onclick="window.location.href='index.html'">
          <i class="ri-edit-line"></i>
          写日常
        </button>
      </div>`;
    return;
  }

  filteredDiaries.forEach((diary, index) => {
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
          <button class="diary-action-btn" onclick="event.stopPropagation(); toggleDiary(${index})" title="展开/收起">
            <i class="ri-arrow-down-s-line"></i>
          </button>
          <div class="export-dropdown">
            <button class="diary-action-btn" onclick="event.stopPropagation(); toggleDiaryExportDropdown(${index})" title="导出">
              <i class="ri-download-2-line"></i>
            </button>
            <div id="exportDropdown-${index}" class="diary-export-menu">
              <a href="#" onclick="event.stopPropagation(); exportSingleDiary(${index}, 'md'); return false;">
                <i class="ri-markdown-line"></i>
                Markdown (.md)
              </a>
              <a href="#" onclick="event.stopPropagation(); exportSingleDiary(${index}, 'txt'); return false;">
                <i class="ri-file-text-line"></i>
                纯文本 (.txt)
              </a>
              <a href="#" onclick="event.stopPropagation(); exportSingleDiary(${index}, 'pdf'); return false;">
                <i class="ri-file-pdf-line"></i>
                PDF (.pdf)
              </a>
            </div>
          </div>
          <button class="diary-action-btn" onclick="event.stopPropagation(); showLibraryDeleteConfirm(${index})" title="删除">
            <i class="ri-delete-bin-6-line"></i>
          </button>
        </div>
      </div>
      <h2 class="diary-title">${diary.title}</h2>
      ${diary.tags ? `<div class="diary-tags">${diary.tags.split(/[,，\s]+/).filter(Boolean).map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
      <div class="diary-content" id="content-${index}" style="display: none;" onclick="event.stopPropagation()">
        ${marked.parse(diary.content)}
      </div>
      <div class="diary-comments" id="comments-${diaryId}" onclick="event.stopPropagation()">
        <div class="comments-header">
          <div class="comments-title">
            <i class="ri-chat-3-line"></i>
            评论
            <span class="comment-count">${commentCount}</span>
          </div>
          <button class="add-comment-btn" onclick="event.stopPropagation(); showCommentModal('${diaryId}')">
            <i class="ri-add-line"></i>
            添加评论
          </button>
        </div>
        <div class="comment-list"></div>
      </div>
    `;
    
    diaryList.appendChild(card);

    const headerEl = card.querySelector('.diary-header');
    const titleEl = card.querySelector('.diary-title');
    const actionsEl = card.querySelector('.diary-actions');
    if (headerEl) {
      headerEl.style.cursor = 'pointer';
      headerEl.addEventListener('click', (e) => {
        if (actionsEl && actionsEl.contains(e.target)) return;
        openDiaryPreview(index);
      });
    }
    if (titleEl) {
      titleEl.style.cursor = 'pointer';
      titleEl.addEventListener('click', () => {
        openDiaryPreview(index);
      });
    }

    // 批量并行加载所有评论
    const diaryIds = filteredDiaries.map(diary => getDiaryCommentId(diary));
    Promise.all(diaryIds.map(id => loadCommentsFromGitHub(id))).catch(console.error);
  });
}

function openDiaryPreview(index) {
  const diary = allDiaries[index];
  if (!diary || !diary.filename) return;
  window.location.href = `preview.html?file=${encodeURIComponent(diary.filename)}`;
}

function showLibraryDeleteConfirm(index) {
  pendingDeleteIndex = index;
  const modal = document.getElementById('libraryDeleteConfirmModal');
  if (modal) modal.style.display = 'flex';
}

function hideLibraryDeleteConfirm() {
  const modal = document.getElementById('libraryDeleteConfirmModal');
  if (modal) modal.style.display = 'none';
  pendingDeleteIndex = null;
}

async function confirmLibraryDelete() {
  const index = pendingDeleteIndex;
  if (index === null || index === undefined) return;
  const diary = allDiaries[index];
  if (!diary || !diary.filename) {
    hideLibraryDeleteConfirm();
    return;
  }

  const token = getToken();
  if (!token) {
    showTokenModal();
    return;
  }

  try {
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(diary.filename)}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!metaRes.ok) {
      throw new Error('无法获取文件信息');
    }
    const meta = await metaRes.json();
    const sha = meta.sha;

    const delRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(diary.filename)}`, {
      method: 'DELETE',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Delete diary ${diary.filename}`,
        sha: sha
      })
    });

    if (!delRes.ok) {
      const err = await delRes.json();
      throw new Error(err?.message || '删除失败');
    }

    hideLibraryDeleteConfirm();
    showNotification('删除成功');

    allDiaries.splice(index, 1);
    renderDiaries();
  } catch (e) {
    showNotification(e.message || '删除失败');
  }
}

// 切换日常库导出下拉菜单
function toggleDiaryExportDropdown(index) {
  const dropdown = document.getElementById(`exportDropdown-${index}`);
  if (dropdown) {
    // 关闭其他所有日常库导出下拉菜单
    document.querySelectorAll('.diary-export-menu').forEach(menu => {
      if (menu.id !== `exportDropdown-${index}`) {
        menu.classList.remove('show');
      }
    });
    
    // 切换当前下拉菜单
    dropdown.classList.toggle('show');
  }
}

// 点击其他地方关闭下拉菜单
document.addEventListener('click', function(e) {
  if (!e.target.closest('.diary-actions .export-dropdown')) {
    document.querySelectorAll('.diary-export-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

// 切换展开/收起
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
  pendingExportFormat = format;
  const modal = document.getElementById('exportSelectModal');
  const list = document.getElementById('exportSelectList');
  if (!modal || !list) return;

  const selectAll = document.getElementById('exportSelectAll');
  if (selectAll) selectAll.checked = true;

  // 初始化作者筛选列表
  initAuthorFilters();

  // 绑定筛选事件
  bindExportFilterEvents();

  // 初始渲染
  renderExportSelectList();

  modal.style.display = 'flex';
}

function initAuthorFilters() {
  const container = document.getElementById('exportAuthorFilters');
  if (!container) return;

  const authors = Array.from(new Set(allDiaries.map(diary => diary.author).filter(Boolean)));
  container.innerHTML = authors.map(author => `
    <label>
      <input type="checkbox" value="${author}" checked>
      ${author}
    </label>
  `).join('');
}

function bindExportFilterEvents() {
  const searchInput = document.getElementById('exportSearchInput');
  const dateFrom = document.getElementById('exportDateFrom');
  const dateTo = document.getElementById('exportDateTo');
  const authorContainer = document.getElementById('exportAuthorFilters');

  const applyFilters = () => renderExportSelectList();

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (dateFrom) dateFrom.addEventListener('change', applyFilters);
  if (dateTo) dateTo.addEventListener('change', applyFilters);
  if (authorContainer) authorContainer.addEventListener('change', applyFilters);
}

function renderExportSelectList() {
  const list = document.getElementById('exportSelectList');
  if (!list) return;

  // 获取筛选条件
  const searchQuery = (document.getElementById('exportSearchInput')?.value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('exportDateFrom')?.value || '';
  const dateTo = document.getElementById('exportDateTo')?.value || '';
  const selectedAuthors = Array.from(document.querySelectorAll('#exportAuthorFilters input:checked'))
    .map(cb => cb.value);

  // 过滤
  const filtered = allDiaries.filter((diary, idx) => {
    // 搜索
    if (searchQuery) {
      const titleMatch = (diary.title || '').toLowerCase().includes(searchQuery);
      const authorMatch = (diary.author || '').toLowerCase().includes(searchQuery);
      const contentMatch = (diary.content || '').toLowerCase().includes(searchQuery);
      const tagsMatch = (diary.tags || '').toLowerCase().includes(searchQuery);
      if (!titleMatch && !authorMatch && !contentMatch && !tagsMatch) return false;
    }

    // 日期范围
    const diaryDate = String(diary.date || '').split('T')[0];
    if (dateFrom && diaryDate < dateFrom) return false;
    if (dateTo && diaryDate > dateTo) return false;

    // 作者
    if (selectedAuthors.length > 0 && !selectedAuthors.includes(diary.author)) return false;

    return true;
  });

  // 渲染列表
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-secondary);">
      <i class="ri-filter-off-line"></i>
      <p>没有符合条件的日常</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map((diary, idx) => {
    const originalIdx = allDiaries.indexOf(diary);
    const dateStr = String(diary.date || '').split('T')[0];
    const checkboxId = `export-cb-${originalIdx}`;
    return `
      <div class="export-select-item" onclick="toggleExportItem(${originalIdx})">
        <input type="checkbox" id="${checkboxId}" class="square-checkbox" data-index="${originalIdx}" checked onclick="event.stopPropagation(); syncSelectAllCheckbox()">
        <div class="meta">
          <div class="title">${diary.title}</div>
          <div class="sub">${diary.author} · ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');

  syncSelectAllCheckbox();
}

function hideExportSelectModal() {
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
    showNotification('请至少选择一篇日常');
    return;
  }

  pendingExportIndexes = selected;
  hideExportSelectModal();
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
  
  // 提前保存 currentDiaryId，避免被 hideCommentModal 清空
  const diaryId = currentDiaryId;
  console.log('准备发表评论:', { diaryId, author, content });

  if (!content) {
    showNotification('请输入评论内容');
    return;
  }
  if (!diaryId) {
    showNotification('评论失败，请重试');
    return;
  }

  if (!commentsData[diaryId]) {
    commentsData[diaryId] = [];
  }
  commentsData[diaryId].push({
    author: author,
    content: content,
    time: new Date().toISOString()
  });
  persistCommentsData();
  updateCommentsDisplay(diaryId);
  hideCommentModal();
  showNotification('评论发表成功！');

  // 同步评论到 GitHub
  syncCommentsToGitHub(diaryId);
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
  
  // 搜索框实时监听
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderDiaries);
  }
});

// 评论同步到 GitHub（加密存储，复用正文逻辑）
async function syncCommentsToGitHub(diaryId) {
  const token = getToken();
  if (!token) return;

  const comments = commentsData[diaryId] || [];
  const content = JSON.stringify(comments, null, 2);
  const path = `posts/comments/${diaryId}.json`;

  try {
    // 加密内容（复用正文的加密方式）
    const keyHash = deriveKeyFromToken(token);
    const encryptedContent = encryptContent(content, keyHash);
    
    // 检查文件是否存在
    let sha = null;
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      console.error('获取评论文件失败:', getRes.status, await getRes.text());
      return;
    }

    // 上传加密内容（复用正文的上传方式）
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Update comments for ${diaryId}`,
        content: btoa(unescape(encodeURIComponent(encryptedContent))),
        sha: sha
      })
    });

    if (!res.ok) {
      console.error('评论同步失败:', res.status, await res.text());
    }
  } catch (e) {
    console.error('评论同步异常:', e);
  }
}

// 从 GitHub 加载评论（解密读取，复用正文逻辑）
async function loadCommentsFromGitHub(diaryId) {
  const token = getToken();
  if (!token) return;

  const path = `posts/comments/${diaryId}.json`;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      headers: { Authorization: `token ${token}` }
    });

    if (res.status === 200) {
      const fileData = await res.json();
      const encryptedContent = atob(fileData.content);
      
      // 解码并解密（复用正文的解密方式）
      const decodedContent = decodeURIComponent(escape(encryptedContent));
      const keyHash = deriveKeyFromToken(token);
      const decryptedContent = decryptContent(decodedContent, keyHash);
      
      if (!decryptedContent) {
        console.warn('评论解密失败，可能文件不是用当前 token 加密的');
        return;
      }

      const comments = JSON.parse(decryptedContent);
      commentsData[diaryId] = comments;
      persistCommentsData(); // 同步到本地
      updateCommentsDisplay(diaryId);
    } else if (res.status === 404) {
      // 静默，无评论文件
      updateCommentsDisplay(diaryId);
    } else {
      console.error('加载评论失败:', res.status, await res.text());
    }
  } catch (e) {
    console.error('加载评论异常:', e);
  }
}
