import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import gsap from 'gsap'

/*
 * Liquid Motion - Reusable Animation Components
 * 
 * Provides:
 * - FluidCanvas: Canvas 2D fluid blob background
 * - MagneticButton: Spring-physics magnetic hover button
 * - StaggerContainer: GSAP-staggered children reveal
 * - LiquidCard: Glassmorphism card with spring hover
 * - PageTransition: Page entrance animation wrapper
 */

// ── Fluid Canvas Background ──
export function FluidCanvas({ blobCount = 5, opacity = 0.12 }) {
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

    const colors = [
      `rgba(93, 135, 255, ${opacity})`,
      `rgba(123, 159, 255, ${opacity * 0.8})`,
      `rgba(74, 115, 232, ${opacity * 0.6})`,
      `rgba(147, 178, 255, ${opacity * 0.8})`,
      `rgba(59, 95, 226, ${opacity * 0.6})`
    ]

    const blobs = []
    for (let i = 0; i < blobCount; i++) {
      const segments = 8
      const baseRadius = 100 + Math.random() * 200
      const centerX = width * (0.15 + Math.random() * 0.7)
      const centerY = height * (0.15 + Math.random() * 0.7)
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

    const animate = () => {
      const time = Date.now()
      mouseX += (targetMouseX - mouseX) * 0.03
      mouseY += (targetMouseY - mouseY) * 0.03

      ctx.clearRect(0, 0, width, height)

      blobs.forEach((blob) => {
        const timeOffset = time * blob.speed

        for (let i = 0; i < blob.points.length; i++) {
          const point = blob.points[i]
          const angle = point.angle + blob.phase

          const wave1 = Math.sin(angle * 2 + timeOffset) * blob.baseRadius * 0.15
          const wave2 = Math.cos(angle * 3 + timeOffset * 1.3) * blob.baseRadius * 0.1
          const wave3 = Math.sin(angle * 1.5 + timeOffset * 0.7) * blob.baseRadius * 0.08

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

          const targetX = blob.centerX + Math.cos(angle) * (blob.baseRadius + wave1 + wave2 + wave3) + repulsionX
          const targetY = blob.centerY + Math.sin(angle) * (blob.baseRadius + wave1 + wave2 + wave3) + repulsionY

          point.x += (targetX - point.x) * blob.viscosity
          point.y += (targetY - point.y) * blob.viscosity
        }

        blob.phase += blob.speed * 0.5

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
  }, [blobCount, opacity])

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

// ── Magnetic Button ──
export function MagneticButton({ children, onClick, variant = 'primary', className = '' }) {
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
      className={`liquid-btn ${isPrimary ? 'liquid-btn-primary' : 'liquid-btn-secondary'} ${className}`}
    >
      {children}
    </motion.button>
  )
}

// ── Liquid Card ──
export function LiquidCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay: delay
      }}
      whileHover={{
        y: -6,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      className={`liquid-card ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ── Page Transition Wrapper ──
export function PageTransition({ children }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const tl = gsap.timeline()

    tl.fromTo(
      el.querySelectorAll('.page-title'),
      { opacity: 0, y: 40, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.1 }
    )
      .fromTo(
        el.querySelectorAll('.page-content > *'),
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 },
        '-=0.5'
      )

    return () => tl.kill()
  }, [])

  return (
    <div ref={containerRef} className="page-transition-container">
      {children}
    </div>
  )
}

// ── Stagger Container ──
export function StaggerContainer({ children, className = '', staggerDelay = 0.08 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const children = el.children
    if (children.length === 0) return

    gsap.fromTo(
      children,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: staggerDelay
      }
    )
  }, [staggerDelay])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}

// ── Liquid Section Header ──
export function LiquidSectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <motion.div
      className="liquid-section-header"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      {Icon && (
        <motion.div
          className="liquid-section-icon"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <Icon weight="duotone" size={28} />
        </motion.div>
      )}
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
    </motion.div>
  )
}

// ── Scroll Reveal Section ──
export function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`liquid-section ${isVisible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  )
}
