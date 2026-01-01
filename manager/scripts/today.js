// 今天页面专用变量
const owner = "yikedashu85-lgtm";
const repo = "OurDiary";

// 获取保存的 token（使用main.js中的函数）
function getToken() {
  return localStorage.getItem('github_token');
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
    throw new Error('解密失败');
  }
}

// 获取今天的日期字符串 yyyy-mm-dd（使用本地时间）
function todayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当前时间显示（包含时区信息）
function getCurrentTimeDisplay() {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

// 更新页面标题显示当前日期
function updateCurrentDate() {
  const dateElement = document.getElementById('currentDate');
  if (dateElement) {
    const today = todayStr();
    const now = new Date();
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    dateElement.textContent = `${today} ${weekday} · ${getCurrentTimeDisplay()}`;
  }
}

// 从 GitHub 加载今天的日记
async function loadTodayDiaries() {
  const token = getToken();
  if (!token) {
    document.getElementById('diary-feed').innerHTML = `
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

  const feed = document.getElementById('diary-feed');
  const today = todayStr();
  
  feed.innerHTML = `
    <div class="loading-state">
      <i class="ri-loader-4-line animate-spin"></i>
      <p>正在加载今天的日记 (${today})...</p>
    </div>`;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts`, {
      headers: { Authorization: `token ${token}` }
    });

    if (!response.ok) {
      throw new Error('无法访问 GitHub 仓库');
    }

    const files = await response.json();
    
    // 更精确的文件匹配：以今天的日期开头，以.md结尾
    const todayFiles = files.filter(f => {
      const isMd = f.name.endsWith('.md');
      const startsWithToday = f.name.startsWith(today);
      return isMd && startsWithToday;
    });
    
    console.log(`今天日期: ${today}, 找到 ${todayFiles.length} 个今天的日记文件:`, todayFiles.map(f => f.name));
    
    if (todayFiles.length === 0) {
      feed.innerHTML = `
        <div class="empty-state">
          <i class="ri-calendar-2-line"></i>
          <h3>今天还没有日记</h3>
          <p>今天 (${today}) 还没有记录，快去写一篇吧！</p>
          <button class="btn btn-primary" onclick="window.location.href='index.html'">
            <i class="ri-edit-line"></i>
            写日记
          </button>
        </div>`;
      return;
    }

    feed.innerHTML = '';
    const keyHash = deriveKeyFromToken(token);
    const entries = [];

    // 获取所有今天的文件内容
    for (const file of todayFiles) {
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${file.name}`, {
          headers: { Authorization: `token ${token}` }
        });
        const fileData = await fileResponse.json();
        const encryptedContent = atob(fileData.content);
        // 解码Base64内容（匹配index.html的编码方式）
        const decodedContent = decodeURIComponent(escape(encryptedContent));
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
          
          entries.push({
            title: metadata.title || '无标题',
            author: metadata.author || '未知',
            date: metadata.date || file.name,
            content: frontMatterMatch[2]
          });
        }
      } catch(e) {
        console.error(`无法解密文件 ${file.name}:`, e);
      }
    }

    // 按时间倒序
    entries.sort((a,b)=>new Date(b.date) - new Date(a.date));

    if(entries.length === 0) {
      feed.innerHTML = `
        <div class="empty-state">
          <i class="ri-calendar-2-line"></i>
          <h3>今天还没有日记</h3>
          <p>今天 (${today}) 还没有记录，快去写一篇吧！</p>
          <button class="btn btn-primary" onclick="window.location.href='index.html'">
            <i class="ri-edit-line"></i>
            写日记
          </button>
        </div>`;
      return;
    }

    entries.forEach((entry, index) => {
      const card = document.createElement('div');
      card.className = 'diary-card';
      
      // 获取作者姓名首字母
      const authorInitial = entry.author.charAt(0);
      
      // 格式化时间
      const dateObj = new Date(entry.date);
      const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      card.innerHTML = `
        <div class="diary-header">
          <div class="diary-author">
            <div class="author-avatar">${authorInitial}</div>
            <div class="author-info">
              <div class="author-name">${entry.author}</div>
              <div class="diary-time">${timeStr}</div>
            </div>
          </div>
          <div class="diary-actions">
            <button class="diary-action-btn" onclick="copyDiary(${index})" title="复制">
              <i class="ri-file-copy-line"></i>
            </button>
            <button class="diary-action-btn" onclick="shareDiary(${index})" title="分享">
              <i class="ri-share-line"></i>
            </button>
          </div>
        </div>
        <h2 class="diary-title">${entry.title}</h2>
        <div class="diary-content">${marked.parse(entry.content)}</div>
      `;
      
      feed.appendChild(card);
    });
  } catch(e) {
    feed.innerHTML = `
      <div class="error-state">
        <i class="ri-error-warning-line"></i>
        <h3>加载失败</h3>
        <p>无法加载今天的日记: ${e.message}</p>
        <button class="btn btn-secondary" onclick="refreshFeed()">
          <i class="ri-refresh-line"></i>
          重试
        </button>
      </div>`;
  }
}

// 复制日记内容
function copyDiary(index) {
  const entries = document.querySelectorAll('.diary-card');
  const entry = entries[index];
  if (entry) {
    const title = entry.querySelector('.diary-title').textContent;
    const content = entry.querySelector('.diary-content').textContent;
    
    const text = `${title}\n\n${content}`;
    
    navigator.clipboard.writeText(text).then(() => {
      // 显示复制成功提示
      showNotification('日记已复制到剪贴板');
    }).catch(() => {
      showNotification('复制失败，请手动复制', 'error');
    });
  }
}

// 分享日记
function shareDiary(index) {
  const entries = document.querySelectorAll('.diary-card');
  const entry = entries[index];
  if (entry) {
    const title = entry.querySelector('.diary-title').textContent;
    const url = window.location.href;
    
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `查看今天的日记：${title}`,
        url: url
      });
    } else {
      // 复制链接到剪贴板
      navigator.clipboard.writeText(url).then(() => {
        showNotification('链接已复制到剪贴板');
      });
    }
  }
}

// 显示日记
function displayDiaries(diaries) {
  const feed = document.getElementById('diary-feed');
  
  console.log('显示日记，数量:', diaries.length);
  
  // 如果没有日记，创建一个测试日记来显示评论功能
  if (diaries.length === 0) {
    console.log('没有日记，创建测试日记');
    const testDiary = {
      title: '测试日记',
      author: '赵涵',
      date: todayStr(),
      content: '这是一个测试日记，用于展示评论功能。'
    };
    diaries = [testDiary];
  }
  
  console.log('开始渲染日记卡片...');
  
  // 渲染所有日记卡片
  feed.innerHTML = diaries.map((diary, index) => renderDiaryCard(diary, index)).join('');
  
  console.log('日记卡片渲染完成，开始更新评论显示...');
  
  // 更新所有评论显示
  diaries.forEach(diary => {
    const diaryId = `${diary.date}-${diary.author}`;
    updateCommentsDisplay(diaryId);
  });
  
  console.log('评论显示更新完成');
}

// 评论相关变量
let currentDiaryId = null;
let commentsData = {};

// 显示评论模态框
function showCommentModal(diaryId) {
  currentDiaryId = diaryId;
  document.getElementById('commentModal').style.display = 'flex';
  document.getElementById('commentAuthor').value = '赵涵';
  document.getElementById('commentContent').value = '';
}

// 隐藏评论模态框
function hideCommentModal() {
  document.getElementById('commentModal').style.display = 'none';
  currentDiaryId = null;
}

// 提交评论
function submitComment() {
  const author = document.getElementById('commentAuthor').value;
  const content = document.getElementById('commentContent').value.trim();
  
  if (!content) {
    alert('请输入评论内容');
    return;
  }
  
  if (!currentDiaryId) {
    alert('评论失败，请重试');
    return;
  }
  
  // 初始化评论数据
  if (!commentsData[currentDiaryId]) {
    commentsData[currentDiaryId] = [];
  }
  
  // 添加新评论
  const newComment = {
    author: author,
    content: content,
    time: new Date().toISOString()
  };
  
  commentsData[currentDiaryId].push(newComment);
  
  // 保存到本地存储
  localStorage.setItem('diary_comments', JSON.stringify(commentsData));
  
  // 更新界面
  updateCommentsDisplay(currentDiaryId);
  
  // 关闭模态框
  hideCommentModal();
  
  // 显示成功提示
  showNotification('评论发表成功！');
}

// 更新评论显示
function updateCommentsDisplay(diaryId) {
  const commentsContainer = document.getElementById(`comments-${diaryId}`);
  if (!commentsContainer) return;
  
  const comments = commentsData[diaryId] || [];
  const commentList = commentsContainer.querySelector('.comment-list');
  
  if (comments.length === 0) {
    commentList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">暂无评论</p>';
  } else {
    commentList.innerHTML = comments.map(comment => `
      <div class="comment-item">
        <div class="comment-avatar">${comment.author.charAt(0)}</div>
        <div class="comment-content">
          <div class="comment-author">${comment.author}</div>
          <div class="comment-time">${formatCommentTime(comment.time)}</div>
          <div class="comment-text">${comment.content}</div>
        </div>
      </div>
    `).join('');
  }
  
  // 更新评论数量
  const commentCount = commentsContainer.querySelector('.comment-count');
  if (commentCount) {
    commentCount.textContent = comments.length;
  }
}

// 格式化评论时间
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
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

// 加载评论数据
function loadCommentsData() {
  const saved = localStorage.getItem('diary_comments');
  if (saved) {
    try {
      commentsData = JSON.parse(saved);
    } catch (e) {
      console.error('加载评论数据失败:', e);
      commentsData = {};
    }
  }
}

// 显示通知
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--primary-color);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-medium);
    z-index: 3000;
    animation: slideIn 0.3s ease-out;
          <button class="add-comment-btn" onclick="showCommentModal('${diaryId}')">
            <i class="ri-add-line"></i>
            添加评论
          </button>
        </div>
        <div class="comment-list">
          <p style="color: var(--text-secondary); font-size: 0.875rem;">暂无评论</p>
        </div>
      </div>
    </div>
  `;
}
function refreshFeed() {
  const refreshBtn = document.querySelector('.btn-secondary i');
  if (refreshBtn) {
    refreshBtn.classList.add('refresh-spin');
    setTimeout(() => {
      refreshBtn.classList.remove('refresh-spin');
    }, 500);
  }
  loadTodayDiaries();
}

// 页面加载时执行
window.addEventListener('load', function() {
  updateCurrentDate();
  loadCommentsData(); // 加载评论数据
  
  // 直接在页面上添加测试评论功能
  setTimeout(() => {
    const feed = document.getElementById('diary-feed');
    if (feed && feed.innerHTML.includes('loading-state')) {
      console.log('直接注入测试评论功能');
      feed.innerHTML = `
        <div class="diary-card">
          <div class="diary-header">
            <div class="diary-author">
              <div class="author-avatar">赵</div>
              <div class="author-info">
                <div class="author-name">赵涵</div>
                <div class="diary-time">${todayStr()}</div>
              </div>
            </div>
            <div class="diary-actions">
              <button class="diary-action-btn" title="导出">
                <i class="ri-download-2-line"></i>
              </button>
            </div>
          </div>
          
          <h3 class="diary-title">测试日记</h3>
          <div class="diary-content">这是一个测试日记，用于展示评论功能。</div>
          
          <div class="diary-comments" id="comments-test">
            <div class="comments-header">
              <div class="comments-title">
                <i class="ri-chat-3-line"></i>
                评论
                <span class="comment-count">0</span>
              </div>
              <button class="add-comment-btn" onclick="showCommentModal('test')">
                <i class="ri-add-line"></i>
                添加评论
              </button>
            </div>
            <div class="comment-list">
              <p style="color: var(--text-secondary); font-size: 0.875rem;">暂无评论</p>
            </div>
          </div>
        </div>
      `;
    }
  }, 2000);
  
  loadTodayDiaries();
  
  // 每分钟更新一次时间显示
  setInterval(updateCurrentDate, 60000);
});

// 每分钟检查一次日期是否变化，自动刷新到新的一天
let lastDate = todayStr();
function checkDateChange() {
  const currentDate = todayStr();
  if (currentDate !== lastDate) {
    console.log(`日期已从 ${lastDate} 变为 ${currentDate}，自动刷新页面`);
    lastDate = currentDate;
    updateCurrentDate();
    loadTodayDiaries();
  }
}

// 每30秒检查一次日期变化
setInterval(checkDateChange, 30000);

// 每5分钟自动刷新一次内容（获取新日记）
setInterval(refreshFeed, 300000);

// 渲染日记卡片（包含评论功能）
function renderDiaryCard(diary, index) {
  const diaryId = `${diary.date}-${diary.author}`;
  
  return `
    <div class="diary-card">
      <div class="diary-header">
        <div class="diary-author">
          <div class="author-avatar">${diary.author.charAt(0)}</div>
          <div class="author-info">
            <div class="author-name">${diary.author}</div>
            <div class="diary-time">${formatDate(diary.date)}</div>
          </div>
        </div>
        <div class="diary-actions">
          <button class="diary-action-btn" onclick="exportDiary('${diary.date}', '${diary.author}')" title="导出">
            <i class="ri-download-2-line"></i>
          </button>
        </div>
      </div>
      
      <h3 class="diary-title">${diary.title}</h3>
      <div class="diary-content">${diary.content}</div>
      
      <div class="diary-comments" id="comments-${diaryId}">
        <div class="comments-header">
          <div class="comments-title">
            <i class="ri-chat-3-line"></i>
            评论
            <span class="comment-count">${(commentsData[diaryId] || []).length}</span>
          </div>
          <button class="add-comment-btn" onclick="showCommentModal('${diaryId}')">
            <i class="ri-add-line"></i>
            添加评论
          </button>
        </div>
        <div class="comment-list">
          <p style="color: var(--text-secondary); font-size: 0.875rem;">暂无评论</p>
        </div>
      </div>
    </div>
  `;
}
