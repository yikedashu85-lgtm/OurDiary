// 初始化日期
const dateInput = document.getElementById('date');
dateInput.value = new Date().toISOString().slice(0,16);

// Markdown 实时渲染
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

let editingFilename = null;

function render() {
  if (preview) {
    preview.innerHTML = marked.parse(editor.value);
  }
}

async function loadDiaryForEdit(filename) {
  const token = getToken();
  if (!token) {
    showTokenModal();
    return;
  }

  try {
    const owner = "yikedashu85-lgtm";
    const repo = "OurDiary";

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/posts/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!res.ok) {
      throw new Error('无法加载日记');
    }
    const fileData = await res.json();
    const encryptedContent = atob(fileData.content);
    const decodedContent = decodeURIComponent(escape(encryptedContent));

    const keyHash = deriveKeyFromToken(token);
    const decryptedContent = decryptContent(decodedContent, keyHash);

    const frontMatterMatch = decryptedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontMatterMatch) {
      throw new Error('日记格式不正确');
    }

    const metadata = {};
    frontMatterMatch[1].split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        metadata[key.trim()] = valueParts.join(':').trim();
      }
    });

    document.getElementById('title').value = metadata.title || '';
    document.getElementById('author').value = metadata.author || '赵涵';
    setCurrentDateTime();
    editor.value = frontMatterMatch[2] || '';
    render();

    editingFilename = filename;
  } catch (e) {
    alert(e.message || '加载失败');
  }
}

editor.addEventListener('input', render);
render();

// 加密/解密工具函数
function deriveKeyFromToken(token) {
  const hash = CryptoJS.SHA256(token + 'OurDiarySalt2024');
  return hash;
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
  setTimeout(() => notification.remove(), 2000);
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

// 导出日记
async function exportDiary(format) {
  const dropdown = document.getElementById('exportDropdown');
  dropdown.classList.remove('show');
  
  const title = document.getElementById('title').value;
  const author = document.getElementById('author').value;
  const date = document.getElementById('date').value;
  const content = editor.value;
  const dateStr = date.split('T')[0];
  const filename = `${dateStr}-${author}`;
  
  if (format === 'md') {
    const metadata = `---\ntitle: ${title}\nauthor: ${author}\ndate: ${date}\n---\n\n`;
    const blob = new Blob([metadata + content], {type:'text/markdown;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'txt') {
    const text = `标题: ${title}\n作者: ${author}\n日期: ${date}\n\n${content}`;
    const blob = new Blob([text], {type:'text/plain;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const metadata = `标题: ${title}\n作者: ${author}\n日期: ${date}\n\n`;
    const fullText = metadata + content;
    const lines = doc.splitTextToSize(fullText, 180);
    doc.setFontSize(12);
    doc.text(lines, 14, 20);
    doc.save(`${filename}.pdf`);
  }
}

// 上传到 GitHub（加密内容）
async function uploadToGitHub() {
  const token = getToken();
  if(!token) {
    alert('请先设置 GitHub Token');
    showTokenModal();
    return;
  }

  const owner = "yikedashu85-lgtm";
  const repo = "OurDiary";
  
  const title = document.getElementById('title').value;
  const author = document.getElementById('author').value;
  const date = document.getElementById('date').value;
  const dateStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];
  const path = editingFilename ? `posts/${editingFilename}` : `posts/${dateStr}-${author}.md`;
  const content = editor.value;
  const markdown = `---\ntitle: ${title}\nauthor: ${author}\ndate: ${date}\n---\n\n${content}`;

  try {
    // 显示上传状态
    const uploadBtn = document.querySelector('.btn-primary');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> 上传中...';
    uploadBtn.disabled = true;

    // 加密内容
    const keyHash = deriveKeyFromToken(token);
    const encryptedContent = encryptContent(markdown, keyHash);
    
    // 先检查文件是否存在
    let sha = null;
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${token}` }
    });
    if(getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha;
    }

    // 上传加密后的内容
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add diary ${title}`,
        content: btoa(unescape(encodeURIComponent(encryptedContent))),
        sha: sha
      })
    });

    // 恢复按钮状态
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;

    if(res.ok) {
      showNotification('保存成功');
    } else {
      const err = await res.json();
      alert("保存失败: " + JSON.stringify(err));
    }
  } catch(e) { 
    // 恢复按钮状态
    const uploadBtn = document.querySelector('.btn-primary');
    uploadBtn.innerHTML = '<i class="ri-upload-cloud-2-line"></i> 保存';
    uploadBtn.disabled = false;
    
    alert("上传异常: "+e.message); 
  }
}

// Markdown 工具栏功能
function insertMarkdown(before, after) {
  const textarea = document.getElementById('editor');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  
  let newText;
  if (before === '## ' && !selectedText) {
    newText = before; // 只插入 ## 
  } else if (before === '- ' && !selectedText) {
    newText = before; // 只插入 - 
  } else if (before === '> ' && !selectedText) {
    newText = before; // 只插入 > 
  } else {
    newText = before + selectedText + after;
  }
  
  textarea.value = text.substring(0, start) + newText + text.substring(end);
  textarea.focus();
  
  // 设置新的光标位置
  if (!selectedText) {
    if (before === '## ') {
      textarea.setSelectionRange(start + before.length, start + before.length);
    } else if (before === '- ') {
      textarea.setSelectionRange(start + before.length, start + before.length);
    } else if (before === '> ') {
      textarea.setSelectionRange(start + before.length, start + before.length);
    } else {
      textarea.setSelectionRange(start + before.length, start + before.length);
    }
  } else {
    textarea.setSelectionRange(start + before.length + selectedText.length + after.length, start + before.length + selectedText.length + after.length);
  }
  
  updatePreview();
}

// 预览切换功能
function togglePreview() {
  const previewContent = document.getElementById('preview');
  const previewToggle = document.getElementById('previewToggle');
  const icon = previewToggle.querySelector('i');
  
  if (previewContent.classList.contains('hidden')) {
    // 显示预览
    previewContent.classList.remove('hidden');
    icon.className = 'ri-eye-line';
    previewToggle.title = '隐藏预览';
  } else {
    // 隐藏预览
    previewContent.classList.add('hidden');
    icon.className = 'ri-eye-off-line';
    previewToggle.title = '显示预览';
  }
}

// 更新预览内容
function updatePreview() {
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  if (editor && preview) {
    preview.innerHTML = marked.parse(editor.value);
  }
}

// 添加旋转动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);

// 自动保存功能（可选）
let autoSaveTimer;
function startAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  
  autoSaveTimer = setTimeout(() => {
    // 这里可以添加自动保存到本地的逻辑
    console.log('自动保存到本地存储');
    localStorage.setItem('diary_draft', JSON.stringify({
      title: document.getElementById('title').value,
      author: document.getElementById('author').value,
      date: document.getElementById('date').value,
      content: editor.value
    }));
  }, 30000); // 30秒后自动保存
}

// 监听输入变化，启动自动保存
editor.addEventListener('input', function() {
  startAutoSave();
  updatePreview();
});
document.getElementById('title').addEventListener('input', startAutoSave);
document.getElementById('author').addEventListener('change', startAutoSave);
document.getElementById('date').addEventListener('change', startAutoSave);

// 设置当前日期时间
function setCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
  document.getElementById('date').value = dateTimeString;
}

// 页面加载时设置默认日期时间
window.addEventListener('load', function() {
  setCurrentDateTime();
  updatePreview();
  startAutoSave();
});

window.addEventListener('load', function() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if (file) {
    loadDiaryForEdit(file);
  }
});

// 页面加载时恢复草稿
window.addEventListener('load', function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('file')) {
    return;
  }

  const draft = localStorage.getItem('diary_draft');
  if (draft) {
    try {
      const draftData = JSON.parse(draft);
      if (confirm('检测到未保存的草稿，是否恢复？')) {
        document.getElementById('title').value = draftData.title || '';
        document.getElementById('author').value = draftData.author || '赵涵';
        document.getElementById('date').value = draftData.date || new Date().toISOString().slice(0,16);
        editor.value = draftData.content || '# 写作开始\n在这里写下今天的内容。';
        render();
      }
      localStorage.removeItem('diary_draft');
    } catch(e) {
      console.error('恢复草稿失败:', e);
    }
  }
});
