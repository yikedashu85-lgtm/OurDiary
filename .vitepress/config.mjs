import { defineConfig } from 'vitepress'

export default defineConfig({
  // 核心：GitHub Pages 要求的子路径
  base: '/OurDiary/', 

  title: "我们的日记本",
  description: "记录生活",
  
  srcDir: '.',
  outDir: '.vitepress/dist',
  
  cleanUrls: true,

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { 
        text: '管理后台', 
        link: '/admin/index.html', 
        target: '_self' 
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yikedashu85-lgtm/OurDiary' }
    ]
  },

  vite: {
    publicDir: 'public',
    build: {
      chunkSizeWarningLimit: 1600,
    }
  }
})
