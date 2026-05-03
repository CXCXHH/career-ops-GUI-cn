import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'

const README_CONTENT = `# Career Ops — AI 求职工作台

本地 AI 驱动。你只管输入原始资料，AI 负责结构化、分析、生成。所有数据保存在你的电脑上。

## 核心理念

你(自然语言) → 前端(采集+展示) → 后端(AI+存储)。前端不做业务判断，所有 AI 逻辑在后端。

## 七个页面

### 工作台
全局概览：岗位统计、健康状态、最近动态。每天打开看一眼。

### 简历
**AI 驱动的核心页面。** 在顶部大输入框粘贴旧简历、项目描述等任意文本，AI 自动提取结构化数据。下方各模块可手动检查和修改。支持预览和生成 PDF。

### 岗位
**使用频率最高。** 三种方式导入：粘贴 URL、AI 搜索（多平台）、拖拽 JSON。筛选栏支持有效/已关闭/未确认。对岗位可执行：提取 JD、AI 优化、AI 评分、加入投递。

### 投递
双 Tab 页面。投递记录 Tab 管理状态流转（已评估→已投递→面试中→已录取）。跟进提醒 Tab 按紧急度分级，系统自动计算跟进节奏。

### 面试
选择岗位，AI 生成完整面试材料：匹配度分析、技术题、项目深挖题、行为题、公司研究。

### 公司
维护目标公司库：名称、关键词、排除词。数据可自动从岗位导入提取。

### 设置
配置 AI API Key（DeepSeek / 豆包）。AI 功能异常时首先检查此处。

## 快速上手

1. 健康检查 → 2. 配置 AI Key → 3. 简历页粘贴资料（AI 自动提取）→ 4. 岗位页搜索/导入 → 5. AI 评分 → 6. 生成简历 → 7. 投递 → 8. 面试准备

## 启动方式

双击 start-gui.bat 或：npm run doctor → npm run api + npm run gui:dev

## 数据存储位置

| 岗位/公司 | data/job-radar/ |
| 投递记录 | data/applications.md |
| PDF简历 | output/ |
| AI配置 | .env |

## 常见问题

- 页面打不开：双击 restart-gui.bat
- AI 无反应：检查设置页 API Key
- PDF 失败：确认 Chrome/Edge 已安装`

const ITEMS_PER_PAGE = 80

function parseMarkdownToPages(content, itemsPerPage) {
  const lines = content.split('\n')
  const pages = []
  let currentPage = []
  let lineCount = 0

  for (const line of lines) {
    currentPage.push(line)
    lineCount++
    
    if (lineCount >= itemsPerPage) {
      pages.push(currentPage.join('\n'))
      currentPage = []
      lineCount = 0
    }
  }
  
  if (currentPage.length > 0) {
    pages.push(currentPage.join('\n'))
  }
  
  return pages
}

function renderMarkdown(text) {
  let html = text
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/\n\n/g, '</p><p>')
  
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
  html = html.replace(/<\/ul>\s*<ul>/g, '')
  
  return `<p>${html}</p>`
}

export default function AnnouncementModal({ isOpen, onClose }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [pageDirection, setPageDirection] = useState('next')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const bodyRef = useRef(null)
  const pages = parseMarkdownToPages(README_CONTENT, ITEMS_PER_PAGE)
  const totalPages = pages.length

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsClosing(false)
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        setIsOpening(true)
      })
    } else {
      setIsOpening(false)
      setIsClosing(true)
      document.body.style.overflow = ''
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 250)
      return () => clearTimeout(timer)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || isAnimating || isClosing) return
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        handlePageChange(currentPage - 1, 'prev')
      } else if (e.key === 'ArrowRight' && currentPage < totalPages - 1) {
        handlePageChange(currentPage + 1, 'next')
      } else if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentPage, totalPages, onClose, isAnimating, isClosing])

  const handleClose = () => {
    if (isClosing) return
    setIsClosing(true)
    setIsOpening(false)
    setTimeout(() => {
      onClose()
      setShouldRender(false)
      setIsClosing(false)
    }, 250)
  }

  const handlePageChange = (newPage, direction) => {
    if (isAnimating || newPage === currentPage) return
    setPageDirection(direction)
    setIsAnimating(true)
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setTimeout(() => {
      setCurrentPage(newPage)
      setTimeout(() => {
        setIsAnimating(false)
      }, 50)
    }, 200)
  }

  const getContentClassName = () => {
    let baseClass = 'announcement-content'
    if (isAnimating) {
      baseClass += pageDirection === 'next' ? ' page-exit-left' : ' page-exit-right'
    } else {
      baseClass += pageDirection === 'next' ? ' page-enter-right' : ' page-enter-left'
    }
    return baseClass
  }

  const getOverlayClassName = () => {
    let baseClass = 'announcement-overlay'
    if (isOpening) baseClass += ' announcement-overlay-open'
    if (isClosing) baseClass += ' announcement-overlay-close'
    return baseClass
  }

  const getModalClassName = () => {
    let baseClass = 'announcement-modal'
    if (isOpening) baseClass += ' announcement-modal-open'
    if (isClosing) baseClass += ' announcement-modal-close'
    return baseClass
  }

  if (!shouldRender) return null

  return (
    <div className={getOverlayClassName()} onClick={handleClose}>
      <div className={getModalClassName()} onClick={e => e.stopPropagation()}>
        <div className="announcement-header">
          <div className="announcement-title">
            <Megaphone className="announcement-icon" />
            <h3>系统公告 - 使用手册</h3>
          </div>
          <button className="announcement-close" onClick={handleClose}>
            <X />
          </button>
        </div>
        
        <div className="announcement-body" ref={bodyRef}>
          <div 
            className={getContentClassName()}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(pages[currentPage]) }}
          />
        </div>
        
        <div className="announcement-footer">
          <div className="announcement-pagination">
            <button 
              className="announcement-nav-btn"
              onClick={() => handlePageChange(currentPage - 1, 'prev')}
              disabled={currentPage === 0 || isAnimating}
            >
              <ChevronLeft />
              上一页
            </button>
            
            <span className="announcement-page-info">
              第 {currentPage + 1} / {totalPages} 页
            </span>
            
            <button 
              className="announcement-nav-btn"
              onClick={() => handlePageChange(currentPage + 1, 'next')}
              disabled={currentPage === totalPages - 1 || isAnimating}
            >
              下一页
              <ChevronRight />
            </button>
          </div>
          
          <div className="announcement-hint">
            使用 ← → 方向键翻页，Esc 关闭
          </div>
        </div>
      </div>
    </div>
  )
}
