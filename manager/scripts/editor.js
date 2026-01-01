// 初始化日期
const dateInput = document.getElementById('date');
dateInput.value = new Date().toISOString().slice(0,16);

// Markdown 实时渲染
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

function render() {
  if (preview) {
    preview.innerHTML = marked.parse(editor.value);
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
  const path = `posts/${dateStr}-${author}.md`;
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
      alert("保存成功！\n\n你可以在「今天的事」页面查看今天的日记，或在「日记库」页面查看所有日记。");
      if (confirm("是否前往「今天的事」页面查看？")) {
        window.location.href = 'today.html';
      }
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
    newText = before + '标题';
  } else if (before === '- ' && !selectedText) {
    newText = before + '列表项';
  } else if (before === '> ' && !selectedText) {
    newText = before + '引用内容';
  } else {
    newText = before + selectedText + after;
  }
  
  textarea.value = text.substring(0, start) + newText + text.substring(end);
  textarea.focus();
  
  // 设置新的光标位置
  if (!selectedText) {
    if (before === '## ') {
      textarea.setSelectionRange(start + before.length + 2, start + before.length + 2);
    } else if (before === '- ') {
      textarea.setSelectionRange(start + before.length + 3, start + before.length + 3);
    } else if (before === '> ') {
      textarea.setSelectionRange(start + before.length + 5, start + before.length + 5);
    } else {
      textarea.setSelectionRange(start + before.length, start + before.length);
    }
  } else {
    textarea.setSelectionRange(start + before.length + selectedText.length + after.length, start + before.length + selectedText.length + after.length);
  }
  
  render();
}

// 预览切换功能
function togglePreview() {
  const previewContainer = document.querySelector('.preview-container');
  const previewToggle = document.getElementById('previewToggle');
  const icon = previewToggle.querySelector('i');
  
  if (previewContainer.style.display === 'none') {
    previewContainer.style.display = 'flex';
    icon.className = 'ri-eye-line';
  } else {
    previewContainer.style.display = 'none';
    icon.className = 'ri-eye-off-line';
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
editor.addEventListener('input', startAutoSave);
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

// 页面加载时恢复草稿
window.addEventListener('load', function() {
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
