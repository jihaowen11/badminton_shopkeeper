/**
 * 费用页背景：羽毛球数量与简易刚体碰撞（圆），受力来自加速度计。
 */

const MAX_BALLS = 30
const SHUTTLE_IMG = '/images/icon/badminton.png'

function sumShuttleQty(lineItems) {
  if (!Array.isArray(lineItems)) return 0
  return lineItems.reduce((s, it) => {
    if (it.type !== 'shuttle') return s
    return s + Math.max(0, Math.floor(Number(it.qty) || 0))
  }, 0)
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function resolvePair(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 1e-6
  const minD = a.r + b.r
  if (dist >= minD) return
  const nx = dx / dist
  const ny = dy / dist
  const overlap = (minD - dist) * 0.52
  a.x -= nx * overlap
  a.y -= ny * overlap
  b.x += nx * overlap
  b.y += ny * overlap
  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const vn = rvx * nx + rvy * ny
  if (vn >= 0) return
  const e = 0.72
  const impulse = (-(1 + e) * vn) / 2
  const ix = impulse * nx
  const iy = impulse * ny
  a.vx -= ix
  a.vy -= iy
  b.vx += ix
  b.vy += iy
}

class BallSim {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.dpr = 1
    this.w = 0
    this.h = 0
    this.balls = []
    this.count = -1
    this.img = null
    this.imgLoaded = false
    this.gravity = { x: 0, y: 0 }
    /** 陀螺仪角速度 rad/s，用于给球体施加额外旋转与微扰动 */
    this.gyro = { x: 0, y: 0, z: 0 }
    this.running = false
    this.rafId = null
    this.ballR = 20
    this._tickBound = this._tick.bind(this)
  }

  getShuttleQtySum(lineItems) {
    return sumShuttleQty(lineItems)
  }

  attachCanvas(canvasNode, widthPx, heightPx, dpr) {
    this.canvas = canvasNode
    this.ctx = canvasNode.getContext('2d')
    this.dpr = dpr || 1
    this.w = widthPx
    this.h = heightPx
    const wpx = Math.max(1, Math.floor(widthPx * this.dpr))
    const hpx = Math.max(1, Math.floor(heightPx * this.dpr))
    canvasNode.width = wpx
    canvasNode.height = hpx
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this._loadImage(canvasNode)
  }

  _loadImage(canvasNode) {
    const trySrc = (src, fallback) => {
      const img = canvasNode.createImage()
      img.onload = () => {
        this.img = img
        this.imgLoaded = true
      }
      img.onerror = () => {
        if (fallback) trySrc(fallback, null)
        else this.imgLoaded = false
      }
      img.src = src
    }
    trySrc(SHUTTLE_IMG, '/images/icon/yumaoqiu.png')
  }

  resize(widthPx, heightPx, dpr) {
    if (!this.canvas || !this.ctx) return
    this.w = widthPx
    this.h = heightPx
    if (dpr) this.dpr = dpr
    const wpx = Math.max(1, Math.floor(widthPx * this.dpr))
    const hpx = Math.max(1, Math.floor(heightPx * this.dpr))
    this.canvas.width = wpx
    this.canvas.height = hpx
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this._fitBallsInBounds()
  }

  setGravityFromAccel(ax, ay, az) {
    const gain = 1.85
    const nx = clamp((ax / 9.81) * gain, -2.2, 2.2)
    /** 竖直方向与加速度计 y 反向，贴合「手机朝上、球往上滚」的直觉 */
    const ny = -clamp((ay / 9.81) * gain, -2.2, 2.2)
    this.gravity.x = nx
    this.gravity.y = ny
    const tilt = Math.hypot(nx, ny)
    if (tilt < 0.12 && Math.abs(az || 0) < 11) {
      this.gravity.x *= 0.55
      this.gravity.y *= 0.55
    }
  }

  setGyro(wx, wy, wz) {
    this.gyro.x = clamp(wx || 0, -6, 6)
    this.gyro.y = clamp(wy || 0, -6, 6)
    this.gyro.z = clamp(wz || 0, -6, 6)
  }

  setCount(n) {
    const next = clamp(Math.floor(n) || 0, 0, MAX_BALLS)
    if (next === this.count && this.balls.length === next) return
    this.count = next
    this._regenerate()
  }

  _regenerate() {
    const w = this.w
    const h = this.h
    const n = this.count
    this.balls = []
    if (!w || !h || n <= 0) return
    const area = w * h
    const ideal = Math.sqrt(area / (n * 2.2))
    this.ballR = clamp(ideal, 14, 26)
    const r = this.ballR
    for (let i = 0; i < n; i++) {
      this.balls.push({
        x: r + Math.random() * Math.max(8, w - 2 * r),
        y: r + Math.random() * Math.max(8, h - 2 * r),
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        r,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
      })
    }
  }

  _fitBallsInBounds() {
    const w = this.w
    const h = this.h
    if (!w || !h) return
    for (const b of this.balls) {
      b.x = clamp(b.x, b.r, w - b.r)
      b.y = clamp(b.y, b.r, h - b.r)
    }
  }

  step(dt) {
    const w = this.w
    const h = this.h
    if (!w || !h || this.balls.length === 0) return
    const accelScale = 420
    const gx = this.gravity.x * accelScale * dt
    const gy = this.gravity.y * accelScale * dt
    const damp = Math.pow(0.988, dt * 60)

    const gxSpin = (this.gyro.x + this.gyro.z * 0.45) * 42 * dt
    const gySpin = (this.gyro.y - this.gyro.z * 0.32) * 42 * dt

    for (const b of this.balls) {
      b.vx += gx + gxSpin * 0.28
      b.vy += gy + gySpin * 0.28
      b.vx *= damp
      b.vy *= damp
      b.spin += (this.gyro.z * 0.85 + this.gyro.x * 0.22) * dt
      b.spin = clamp(b.spin, -8, 8)
      b.spin *= 0.995
      b.angle += b.spin * dt * 0.8 + this.gravity.x * 0.95 * dt + this.gravity.y * 0.35 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      const rest = 0.68
      if (b.x < b.r) {
        b.x = b.r
        b.vx *= -rest
      } else if (b.x > w - b.r) {
        b.x = w - b.r
        b.vx *= -rest
      }
      if (b.y < b.r) {
        b.y = b.r
        b.vy *= -rest
      } else if (b.y > h - b.r) {
        b.y = h - b.r
        b.vy *= -rest
      }
    }

    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          resolvePair(this.balls[i], this.balls[j])
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx
    if (!ctx || !this.w || !this.h) return
    const w = this.w
    const h = this.h
    ctx.clearRect(0, 0, w, h)

    if (!this.imgLoaded || !this.img || this.balls.length === 0) return

    for (const b of this.balls) {
      const s = b.r * 2.15
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.angle)
      ctx.drawImage(this.img, -s / 2, -s / 2, s, s)
      ctx.restore()
    }
  }

  _tick() {
    if (!this.running) return
    const dt = 1 / 60
    this.step(dt)
    this.draw()
    if (this.canvas && typeof this.canvas.requestAnimationFrame === 'function') {
      this.rafId = this.canvas.requestAnimationFrame(this._tickBound)
    }
  }

  start() {
    if (this.running || !this.canvas) return
    this.running = true
    this._tick()
  }

  stop() {
    this.running = false
    if (this.canvas && this.rafId != null && typeof this.canvas.cancelAnimationFrame === 'function') {
      this.canvas.cancelAnimationFrame(this.rafId)
    }
    this.rafId = null
  }
}

module.exports = {
  BallSim,
  sumShuttleQty,
  MAX_BALLS,
}
