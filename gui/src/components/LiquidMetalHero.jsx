import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { ArrowRight, Sparkle, Lightning, Shield } from '@phosphor-icons/react'

/*
 * Liquid Metal Hero Section
 * 
 * Tech Stack:
 * - React 18 + Vite
 * - Framer Motion: Spring physics for UI interactions
 * - Canvas 2D: High-viscosity fluid background simulation
 * - GSAP: Orchestrated initial load timeline
 * 
 * Design: "Liquid Metal" aesthetic with chrome/silver surfaces
 * featuring organic fluid motion and spring-based micro-interactions.
 */

// ── Canvas Fluid Background (Native 2D, no Paper.js dependency) ──
function FluidCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    // Create fluid blobs
    const blobCount = 5
    const blobs = []
    const colors = [
      'rgba(93, 135, 255, 0.12)',
      'rgba(123, 159, 255, 0.10)',
      'rgba(74, 115, 232, 0.08)',
      'rgba(147, 178, 255, 0.10)',
      'rgba(59, 95, 226, 0.08)'
    ]

    for (let i = 0; i < blobCount; i++) {
      const segments = 8
      const baseRadius = 150 + Math.random() * 250
      const centerX = width * (0.2 + Math.random() * 0.6)
      const centerY = height * (0.2 + Math.random() * 0.6)
      const points = []

      for (let j = 0; j < segments; j++) {
        const angle = (j / segments) * Math.PI * 2
        points.push({
          x: centerX + Math.cos(angle) * baseRadius,
          y: centerY + Math.sin(angle) * baseRadius,
          angle: angle,
          baseRadius: baseRadius
        })
      }

      blobs.push({
        points: points,
        centerX: centerX,
        centerY: centerY,
        baseRadius: baseRadius,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0003 + Math.random() * 0.0005,
        viscosity: 0.02 + Math.random() * 0.03,
        color: colors[i % colors.length]
      })
    }

    // Mouse tracking
    let mouseX = width / 2
    let mouseY = height / 2
    let targetMouseX = width / 2
    let targetMouseY = height / 2

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      targetMouseX = e.clientX - rect.left
      targetMouseY = e.clientY - rect.top
    }
    canvas.addEventListener('mousemove', onMouseMove)

    // Animation loop
    const animate = () => {
      const time = Date.now()

      // Smooth mouse following (high viscosity)
      mouseX += (targetMouseX - mouseX) * 0.03
      mouseY += (targetMouseY - mouseY) * 0.03

      ctx.clearRect(0, 0, width, height)

      blobs.forEach((blob) => {
        const timeOffset = time * blob.speed

        // Update points
        for (let i = 0; i < blob.points.length; i++) {
          const point = blob.points[i]
          const angle = point.angle + blob.phase

          // Organic wave motion
          const wave1 = Math.sin(angle * 2 + timeOffset) * blob.baseRadius * 0.15
          const wave2 = Math.cos(angle * 3 + timeOffset * 1.3) * blob.baseRadius * 0.1
          const wave3 = Math.sin(angle * 1.5 + timeOffset * 0.7) * blob.baseRadius * 0.08

          // Mouse repulsion
          const dx = point.x - mouseX
          const dy = point.y - mouseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = 300
          let repulsionX = 0
          let repulsionY = 0

          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 80
            repulsionX = (dx / dist) * force
            repulsionY = (dy / dist) * force
          }

          // Target position with viscosity interpolation
          const targetX = blob.centerX + Math.cos(angle) * (blob.baseRadius + wave1 + wave2 + wave3) + repulsionX
          const targetY = blob.centerY + Math.sin(angle) * (blob.baseRadius + wave1 + wave2 + wave3) + repulsionY

          point.x += (targetX - point.x) * blob.viscosity
          point.y += (targetY - point.y) * blob.viscosity
        }

        blob.phase += blob.speed * 0.5

        // Draw blob
        ctx.beginPath()
        const pts = blob.points
        const len = pts.length

        ctx.moveTo(
          (pts[0].x + pts[len - 1].x) / 2,
          (pts[0].y + pts[len - 1].y) / 2
        )

        for (let i = 0; i < len; i++) {
          const next = pts[(i + 1) % len]
          const midX = (pts[i].x + next.x) / 2
          const midY = (pts[i].y + next.y) / 2
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY)
        }

        ctx.closePath()
        ctx.fillStyle = blob.color
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'auto'
      }}
    />
  )
}

// ── Magnetic Button with Spring Physics ──
function MagneticButton({ children, onClick, variant = 'primary' }) {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  const handleMouseMove = useCallback((e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distX = e.clientX - centerX
    const distY = e.clientY - centerY
    const distance = Math.sqrt(distX * distX + distY * distY)
    const maxDistance = 150

    if (distance < maxDistance) {
      const force = (1 - distance / maxDistance) * 20
      x.set(distX * force * 0.02)
      y.set(distY * force * 0.02)
    }
  }, [x, y])

  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
  }, [x, y])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const isPrimary = variant === 'primary'

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`liquid-btn ${isPrimary ? 'liquid-btn-primary' : 'liquid-btn-secondary'}`}
    >
      {children}
    </motion.button>
  )
}

// ── Floating Feature Card ──
function FeatureCard({ icon: Icon, title, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay: delay
      }}
      whileHover={{
        y: -8,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      className="liquid-feature-card"
    >
      <div className="liquid-feature-icon">
        <Icon weight="duotone" size={28} />
      </div>
      <h4 className="liquid-feature-title">{title}</h4>
      <p className="liquid-feature-desc">{description}</p>
    </motion.div>
  )
}

// ── Main Hero Section ──
export default function LiquidMetalHero() {
  const sectionRef = useRef(null)
  const titleRef = useRef(null)
  const subtitleRef = useRef(null)
  const ctaRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // GSAP orchestrated initial load timeline
  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => setIsLoaded(true)
    })

    tl.fromTo(
      titleRef.current,
      { opacity: 0, y: 60, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }
    )
      .fromTo(
        subtitleRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
        '-=0.6'
      )
      .fromTo(
        ctaRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.4)' },
        '-=0.4'
      )

    return () => tl.kill()
  }, [])

  const scrollToContent = () => {
    const dashboardSection = document.querySelector('.dashboard-content')
    if (dashboardSection) {
      dashboardSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section ref={sectionRef} className="liquid-hero">
      <FluidCanvas />

      <div className="liquid-hero-overlay" />

      <div className="liquid-hero-content">
        <motion.div
          className="liquid-hero-badge"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
        >
          <Sparkle weight="fill" size={16} />
          <span>AI 驱动的求职工作台</span>
        </motion.div>

        <h1 ref={titleRef} className="liquid-hero-title">
          <span className="liquid-title-line">发现理想岗位</span>
          <span className="liquid-title-line liquid-title-accent">
            掌控职业未来
          </span>
        </h1>

        <p ref={subtitleRef} className="liquid-hero-subtitle">
          从岗位发现、AI 智能评分、简历生成到投递追踪
          <br />
          一站式管理你的整个求职流程
        </p>

        <div ref={ctaRef} className="liquid-hero-cta">
          <MagneticButton onClick={scrollToContent} variant="primary">
            开始探索
            <ArrowRight weight="bold" size={18} />
          </MagneticButton>
          <MagneticButton onClick={scrollToContent} variant="secondary">
            了解更多
          </MagneticButton>
        </div>

        <AnimatePresence>
          {isLoaded && (
            <div className="liquid-features-grid">
              <FeatureCard
                icon={Lightning}
                title="AI 智能评分"
                description="多维度岗位匹配分析，精准定位最优投递目标"
                delay={0}
              />
              <FeatureCard
                icon={Shield}
                title="隐私安全"
                description="所有数据本地存储，不上传任何云端服务器"
                delay={0.15}
              />
              <FeatureCard
                icon={Sparkle}
                title="简历生成"
                description="一键生成定制化 PDF 简历，针对目标岗位精准优化"
                delay={0.3}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="liquid-hero-reflection" />
    </section>
  )
}
