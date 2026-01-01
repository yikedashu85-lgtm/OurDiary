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

// 显示通知
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="ri-${type === 'success' ? 'check' : 'error-warning'}-line"></i>
    <span>${message}</span>
  `;
  
  // 添加通知样式
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 1rem 1.5rem;
      border-radius: var(--border-radius);
      box-shadow: 0 8px 24px var(--shadow-medium);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      z-index: 3000;
      animation: slideIn 0.3s ease-out;
    }
    
    .notification-success {
      border-left: 4px solid var(--primary-color);
    }
    
    .notification-error {
      border-left: 4px solid #e74c3c;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  
  if (!document.querySelector('style[data-notifications]')) {
    style.setAttribute('data-notifications', '');
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // 3秒后自动移除
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// 刷新功能
function refreshFeed() {
  loadTodayDiaries();
}

// 页面加载时执行
window.addEventListener('load', function() {
  updateCurrentDate();
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
