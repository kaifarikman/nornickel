export interface ForceBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  pinned: boolean
  /** Half-width of the node's label text, in px — keeps long Cyrillic labels
   *  from overlapping (plain point-repulsion only spaces out the dots). */
  labelRadius: number
}

export interface ForceLink {
  source: string
  target: string
}

const REPULSION = 5600
const SPRING_LENGTH = 132
// Weaker than a typical force-graph spring on purpose: long Cyrillic labels
// need more room than the edge itself "wants", so the label-separation
// spring below has to be able to win this tug-of-war.
const SPRING_STRENGTH = 0.014
const GRAVITY = 0.011
const DAMPING = 0.82
const MAX_SPEED = 14
const GOLDEN_ANGLE = 2.39996

// Label-collision avoidance: approximate rendered half-width from character
// count (~5.6px/char at the graph's 11px label font) and push overlapping
// labels apart with a dedicated spring, on top of the point repulsion above.
const LABEL_MIN_RADIUS = 24
const PX_PER_CHAR = 5.6
const LABEL_SEPARATION_STRENGTH = 0.16

export function labelRadiusFor(label: string): number {
  return Math.max(LABEL_MIN_RADIUS, (label.length * PX_PER_CHAR) / 2)
}

export function createBodies(
  nodes: { id: string; label: string }[],
  width: number,
  height: number,
): Map<string, ForceBody> {
  const cx = width / 2
  const cy = height / 2
  const bodies = new Map<string, ForceBody>()
  nodes.forEach(({ id, label }, i) => {
    const r = 26 * Math.sqrt(i + 0.6)
    const angle = i * GOLDEN_ANGLE
    bodies.set(id, {
      id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      vx: 0,
      vy: 0,
      pinned: false,
      labelRadius: labelRadiusFor(label),
    })
  })
  return bodies
}

export function tick(
  bodies: Map<string, ForceBody>,
  links: ForceLink[],
  width: number,
  height: number,
): number {
  const list = [...bodies.values()]
  const cx = width / 2
  const cy = height / 2

  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    if (a === undefined) {
      continue
    }
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j]
      if (b === undefined) {
        continue
      }
      let dx = a.x - b.x
      let dy = a.y - b.y
      let distSq = dx * dx + dy * dy
      if (distSq < 1) {
        dx = (i - j) * 0.5 || 0.5
        dy = 0.5
        distSq = dx * dx + dy * dy
      }
      const force = REPULSION / distSq
      const dist = Math.sqrt(distSq)
      let fx = (dx / dist) * force
      let fy = (dy / dist) * force

      const minSep = a.labelRadius + b.labelRadius
      if (dist < minSep) {
        const push = (minSep - dist) * LABEL_SEPARATION_STRENGTH
        fx += (dx / dist) * push
        fy += (dy / dist) * push
      }

      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }

  for (const link of links) {
    const a = bodies.get(link.source)
    const b = bodies.get(link.target)
    if (a === undefined || b === undefined) {
      continue
    }
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
    const stretch = (dist - SPRING_LENGTH) * SPRING_STRENGTH
    const fx = (dx / dist) * stretch
    const fy = (dy / dist) * stretch
    a.vx += fx
    a.vy += fy
    b.vx -= fx
    b.vy -= fy
  }

  let energy = 0
  for (const body of list) {
    if (body.pinned) {
      body.vx = 0
      body.vy = 0
      continue
    }
    body.vx += (cx - body.x) * GRAVITY
    body.vy += (cy - body.y) * GRAVITY
    body.vx *= DAMPING
    body.vy *= DAMPING
    const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy)
    if (speed > MAX_SPEED) {
      body.vx = (body.vx / speed) * MAX_SPEED
      body.vy = (body.vy / speed) * MAX_SPEED
    }
    body.x += body.vx
    body.y += body.vy
    const margin = 24
    body.x = Math.min(Math.max(body.x, margin), width - margin)
    body.y = Math.min(Math.max(body.y, margin), height - margin)
    energy += body.vx * body.vx + body.vy * body.vy
  }
  return energy
}

export function wobble(bodies: Map<string, ForceBody>, timeMs: number): void {
  let index = 0
  for (const body of bodies.values()) {
    if (!body.pinned) {
      body.vx += Math.sin(timeMs / 1100 + index * 1.7) * 0.05
      body.vy += Math.cos(timeMs / 1300 + index * 2.3) * 0.05
    }
    index += 1
  }
}

export function settle(
  bodies: Map<string, ForceBody>,
  links: ForceLink[],
  width: number,
  height: number,
  maxTicks = 320,
): void {
  for (let i = 0; i < maxTicks; i += 1) {
    const energy = tick(bodies, links, width, height)
    if (energy < 0.02) {
      return
    }
  }
}
