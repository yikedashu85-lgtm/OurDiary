// Token 管理
const TOKEN_STORAGE_KEY = 'github_token';

// 获取保存的 token
function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// 保存 token
function saveToken() {
  const tokenInput = document.getElementById('tokenInput');
  const token = tokenInput.value.trim();
  if (!token) {
    alert('请输入有效的 Token');
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  hideTokenModal();
  alert('Token 已保存！');
}

// 显示 token 输入模态框
function showTokenModal() {
  const modal = document.getElementById('tokenModal');
  const tokenInput = document.getElementById('tokenInput');
  const savedToken = getToken();
  if (savedToken) {
    tokenInput.value = savedToken;
  } else {
    tokenInput.value = '';
  }
  modal.classList.add('show');
  tokenInput.focus();
}

// 隐藏 token 输入模态框
function hideTokenModal() {
  const modal = document.getElementById('tokenModal');
  modal.classList.remove('show');
}

// 点击模态框背景关闭
document.getElementById('tokenModal').addEventListener('click', function(e) {
  if (e.target === this) {
    hideTokenModal();
  }
});

// 回车键保存 token
document.getElementById('tokenInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    saveToken();
  }
});

// 照片轮播功能
function initPhotoCarousel() {
  const cards = Array.from(document.querySelectorAll('.deck .card'));
  if (cards.length === 0) return;
  
  let order = [0, 1, 2];
  
  // 自动处理路径：本地开发用 /，部署到 GitHub 用 /OurDiary/
  const isProd = window.location.hostname !== 'localhost';
  const baseUrl = isProd ? '/OurDiary/' : '/';

  // 1. 图片加载
  cards.forEach((card, i) => {
    const bgPath = card.getAttribute('data-bg');
    const cleanBgPath = bgPath.startsWith('/') ? bgPath.slice(1) : bgPath;
    card.style.backgroundImage = `url(${baseUrl}${cleanBgPath})`;
  });

  // 2. 轮播动画
  function updateClasses() {
    cards.forEach((card, i) => {
      card.className = 'card';
      card.classList.add(`pos-${order[i]}`);
    });
  }

  updateClasses();

  setInterval(() => {
    if(cards.length < 3) return;
    const topCardIndex = order.indexOf(0);
    cards[topCardIndex].classList.add('moving');
    
    setTimeout(() => {
      order = order.map(pos => (pos === 0 ? 2 : pos - 1));
      updateClasses();
    }, 450);
  }, 4500);
}

// 加载最近日记
async function loadRecentDiaries() {
  const token = getToken();
  if (!token) {
    return;
  }

  try {
    const owner = "yikedashu85-lgtm";
    const repo = "OurDiary";
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts`, {
      headers: { Authorization: `token ${token}` }
    });

    if (!response.ok) {
      throw new Error('无法访问 GitHub 仓库');
    }

    const files = await response.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md'));
    
    // 按文件名排序（日期降序）
    mdFiles.sort((a, b) => b.name.localeCompare(a.name));
    
    // 只取前4个最近的文件
    const recentFiles = mdFiles.slice(0, 4);
    
    if (recentFiles.length === 0) {
      return;
    }

    const recentDiariesContainer = document.getElementById('recentDiaries');
    if (!recentDiariesContainer) return;

    recentDiariesContainer.innerHTML = '';

    // 获取文件内容
    for (const file of recentFiles) {
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${file.name}`, {
          headers: { Authorization: `token ${token}` }
        });
        
        const fileData = await fileResponse.json();
        const encryptedContent = atob(fileData.content);
        
        // 解密内容
        const decryptedContent = decryptContent(encryptedContent, token);
        
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
          
          const content = frontMatterMatch[2];
          const excerpt = content.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '').substring(0, 100) + '...';
          
          const card = document.createElement('div');
          card.className = 'recent-card';
          card.innerHTML = `
            <div class="recent-meta">
              <span class="recent-author">${metadata.author || '未知'}</span>
              <span class="recent-date">${(metadata.date || file.name).split('T')[0]}</span>
            </div>
            <h3 class="recent-title">${metadata.title || '无标题'}</h3>
            <p class="recent-excerpt">${excerpt}</p>
          `;
          
          card.onclick = () => {
            window.location.href = `manager/library.html`;
          };
          
          recentDiariesContainer.appendChild(card);
        }
      } catch(e) {
        console.error(`无法加载文件 ${file.name}:`, e);
      }
    }
  } catch(e) {
    console.error('加载最近日记失败:', e);
  }
}

// 解密内容（简化版本，仅用于首页预览）
function decryptContent(encryptedContent, token) {
  try {
    // 这里使用简化的解密逻辑，或者直接返回加密内容
    // 在首页预览中，我们可能不需要完全解密
    return encryptedContent;
  } catch(e) {
    return '内容加载中...';
  }
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', function() {
  // 初始化照片轮播
  initPhotoCarousel();
  
  // 检查是否有token，如果没有则提示设置
  const token = getToken();
  if (!token) {
    // 可以在这里添加提示，但不要自动弹出模态框
    console.log('尚未设置 GitHub Token');
  }
});

// 添加页面切换动画
document.addEventListener('DOMContentLoaded', function() {
  // 为所有菜单项添加点击效果
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // 移除所有active类
      menuItems.forEach(mi => mi.classList.remove('active'));
      // 添加active类到当前项
      this.classList.add('active');
    });
  });
});
