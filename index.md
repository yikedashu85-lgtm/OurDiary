---
layout: home

hero:
  name: "《日常的日常》"
  text: "2016 - 2026"
  tagline: "2016 - 2026，我们认识十年了！"
  actions: []

features:
  - title: 🍃 纸墨传情
    details: 像在精美的信纸上书写，让文字带上温度。
  - title: 🔒 私密守护
    details: 只有被邀请的好友才能开启这扇大门。
  - title: 📱 随时随地
    details: 无论是手机还是电脑，记录从不缺席。
---

<div class="photo-container">
  <div id="deck" class="deck">
    <div class="card" data-bg="/images/photo1.jpg"></div>
    <div class="card" data-bg="/images/photo2.jpg"></div>
    <div class="card" data-bg="/images/photo3.jpg"></div>
  </div>
</div>

<div class="custom-hero-actions">
  <button id="btn-write" class="btn-primary">✍️ 写日常</button>
  <a href="./markdown-examples" class="btn-secondary">📖 翻阅</a>
</div>

<style>
:root {
  --vp-c-bg: #fdfaf5; 
  --brand-green: #5b7052; 
}

/* 布局调整 */
.photo-container {
  width: 100%;
  height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  overflow: visible;
}

.deck {
  position: relative;
  width: 380px; 
  height: 280px;
  transform-style: preserve-3d;
}

/* 照片样式优化 */
.card {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #fff;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 10px solid #fff;
  border-bottom: 40px solid #fff; 
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  transition: all 0.9s cubic-bezier(0.34, 1.3, 0.64, 1);
  border-radius: 2px;
}

.pos-0 { transform: translate3d(0, 0, 30px) rotate(0deg); z-index: 3; opacity: 1; }
.pos-1 { transform: translate3d(80px, 30px, 20px) rotate(6deg); z-index: 2; opacity: 0.9; }
.pos-2 { transform: translate3d(-80px, 35px, 10px) rotate(-8deg); z-index: 1; opacity: 0.8; }

.card.moving {
  transform: translate3d(160%, -50px, 100px) rotate(30deg) !important;
  opacity: 0;
}

/* 按钮风格美化 */
.custom-hero-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 40px;
  margin-bottom: 60px;
}

.btn-primary { 
  background-color: var(--brand-green); 
  color: white !important; 
  border: none; 
  cursor: pointer; 
  padding: 0 40px; 
  line-height: 50px; 
  border-radius: 4px; 
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-primary:hover { opacity: 0.9; }

.btn-secondary { 
  background-color: transparent; 
  color: #666 !important; 
  padding: 0 40px; 
  line-height: 50px; 
  border-radius: 4px; 
  text-decoration: none;
  border: 1px solid #dcd3c1;
  text-align: center;
}

/* 背景纹理微调 */
.VPHero, .VPFeatures {
  background-image: radial-gradient(#dcd3c1 1.2px, transparent 1.2px);
  background-size: 30px 30px;
}
</style>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const cards = Array.from(document.querySelectorAll('.card'));
  let order = [0, 1, 2];
  
  // 自动处理路径：本地开发用 /，部署到 GitHub 用 /OurDiary/
  const isProd = import.meta.env.PROD;
  const baseUrl = isProd ? '/OurDiary/' : '/';

  // 1. 图片加载
  cards.forEach((card, i) => {
    const bgPath = card.getAttribute('data-bg');
    const cleanBgPath = bgPath.startsWith('/') ? bgPath.slice(1) : bgPath;
    card.style.backgroundImage = `url(${baseUrl}${cleanBgPath})`;
  });

  // 2. 跳转到管理后台 (manager)
  const btnWrite = document.getElementById('btn-write');
  if (btnWrite) {
    btnWrite.onclick = () => {
      window.location.href = baseUrl + 'manager/index.html';
    };
  }

  // 3. 轮播动画
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
})
</script>
