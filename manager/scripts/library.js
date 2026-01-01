// 日记库页面专用脚本
const owner = "yikedashu85-lgtm";
const repo = "OurDiary";
const diaryList = document.getElementById('diary-list');
let allDiaries = [];

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
    const dateStr = diary.date.split('T')[0];
    
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
    `;
    
    diaryList.appendChild(card);
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
  const diary = allDiaries[index];
  const dateStr = diary.date.split('T')[0];
  const filename = `${dateStr}-${diary.author}`;
  
  if (format === 'md') {
    const metadata = `---\ntitle: ${diary.title}\nauthor: ${diary.author}\ndate: ${diary.date}\n---\n\n`;
    const blob = new Blob([metadata + diary.content], {type:'text/markdown;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'txt') {
    const text = `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n${diary.content}`;
    const blob = new Blob([text], {type:'text/plain;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const metadata = `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n`;
    const fullText = metadata + diary.content.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '');
    const lines = doc.splitTextToSize(fullText, 180);
    doc.setFontSize(12);
    doc.text(lines, 14, 20);
    doc.save(`${filename}.pdf`);
  }
}

// 导出所有日记
function exportAll(format) {
  const dropdown = document.getElementById('exportDropdown');
  dropdown.classList.remove('show');
  
  if (allDiaries.length === 0) {
    alert('没有可导出的日记');
    return;
  }
  
  if (format === 'md') {
    let allContent = '';
    allDiaries.forEach(diary => {
      const metadata = `---\ntitle: ${diary.title}\nauthor: ${diary.author}\ndate: ${diary.date}\n---\n\n`;
      allContent += metadata + diary.content + '\n\n---\n\n';
    });
    const blob = new Blob([allContent], {type:'text/markdown;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `all-diaries-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'txt') {
    let allContent = '';
    allDiaries.forEach(diary => {
      allContent += `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n${diary.content}\n\n${'='.repeat(50)}\n\n`;
    });
    const blob = new Blob([allContent], {type:'text/plain;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `all-diaries-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 20;
    
    allDiaries.forEach((diary, index) => {
      if (index > 0) {
        doc.addPage();
        yPos = 20;
      }
      const metadata = `标题: ${diary.title}\n作者: ${diary.author}\n日期: ${diary.date}\n\n`;
      const fullText = metadata + diary.content.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '');
      const lines = doc.splitTextToSize(fullText, 180);
      doc.setFontSize(12);
      doc.text(lines, 14, yPos);
    });
    
    doc.save(`all-diaries-${new Date().toISOString().split('T')[0]}.pdf`);
  }
}

// 导出下拉菜单
function toggleExportDropdown() {
  const dropdown = document.getElementById('exportDropdown');
  dropdown.classList.toggle('show');
}

// 点击外部关闭下拉菜单
window.onclick = function(event) {
  if (!event.target.matches('.export-dropdown button')) {
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
  loadDiariesFromGitHub();
}

// 页面加载时执行
window.addEventListener('load', function() {
  loadDiariesFromGitHub();
});
