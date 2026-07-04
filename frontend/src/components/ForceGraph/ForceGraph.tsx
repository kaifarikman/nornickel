import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GraphEdge, GraphNode } from '@/contracts.ts'
import { createBodies, settle, tick, wobble } from '@/lib/force.ts'
import type { ForceBody, ForceLink } from '@/lib/force.ts'
import { cx } from '@/lib/cx.ts'
import { NODE_KIND_ORDER } from '@/lib/domain.ts'
import styles from './ForceGraph.module.css'

interface ForceGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
  ariaLabel: string
  animateBuild?: boolean
  buildStepMs?: number
  onRevealProgress?: (revealed: number, total: number) => void
}

const NODE_ORDER: Record<GraphNode['kind'], number> = Object.fromEntries(
  NODE_KIND_ORDER.map((kind, i) => [kind, i]),
) as Record<GraphNode['kind'], number>

function isStaticEnvironment(): boolean {
  if (import.meta.env.MODE === 'test') {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ForceGraph({
  nodes,
  edges,
  width = 640,
  height = 420,
  ariaLabel,
  animateBuild = false,
  buildStepMs = 300,
  onRevealProgress,
}: ForceGraphProps) {
  const staticMode = useMemo(isStaticEnvironment, [])
  const orderedNodes = useMemo(
    () => [...nodes].sort((a, b) => NODE_ORDER[a.kind] - NODE_ORDER[b.kind]),
    [nodes],
  )
  const links = useMemo<ForceLink[]>(
    () => edges.map((e) => ({ source: e.src, target: e.dst })),
    [edges],
  )
  const degree = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of edges) {
      map.set(edge.src, (map.get(edge.src) ?? 0) + 1)
      map.set(edge.dst, (map.get(edge.dst) ?? 0) + 1)
    }
    return map
  }, [edges])

  const bodiesRef = useRef<Map<string, ForceBody>>(new Map())
  const [revealed, setRevealed] = useState(animateBuild && !staticMode ? 0 : orderedNodes.length)
  const [, setFrame] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    bodiesRef.current = createBodies(
      orderedNodes.map((n) => ({ id: n.id, label: n.label })),
      width,
      height,
    )
    if (staticMode) {
      settle(bodiesRef.current, links, width, height)
      setRevealed(orderedNodes.length)
      setFrame((f) => f + 1)
      return
    }
    if (animateBuild) {
      setRevealed(0)
    }
  }, [orderedNodes, links, width, height, staticMode, animateBuild])

  useEffect(() => {
    if (staticMode || !animateBuild || revealed >= orderedNodes.length) {
      return
    }
    const timer = setTimeout(() => setRevealed((r) => r + 1), buildStepMs)
    return () => clearTimeout(timer)
  }, [staticMode, animateBuild, revealed, orderedNodes.length, buildStepMs])

  useEffect(() => {
    onRevealProgress?.(revealed, orderedNodes.length)
  }, [revealed, orderedNodes.length, onRevealProgress])

  useEffect(() => {
    if (staticMode) {
      return
    }
    let raf = 0
    const loop = (time: number) => {
      const visibleIds = new Set(orderedNodes.slice(0, revealed).map((n) => n.id))
      const activeBodies = new Map([...bodiesRef.current].filter(([id]) => visibleIds.has(id)))
      const activeLinks = links.filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
      wobble(activeBodies, time)
      tick(activeBodies, activeLinks, width, height)
      setFrame((f) => f + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [staticMode, revealed, orderedNodes, links, width, height])

  const toLocalPoint = (event: ReactPointerEvent) => {
    const svg = svgRef.current
    if (svg === null) {
      return { x: 0, y: 0 }
    }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    }
  }

  const handlePointerDown = (id: string) => (event: ReactPointerEvent) => {
    dragRef.current = id
    const body = bodiesRef.current.get(id)
    if (body !== undefined) {
      body.pinned = true
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setFrame((f) => f + 1)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    const id = dragRef.current
    if (id === null) {
      return
    }
    const body = bodiesRef.current.get(id)
    if (body !== undefined) {
      const point = toLocalPoint(event)
      body.x = point.x
      body.y = point.y
    }
  }

  const handlePointerUp = () => {
    const id = dragRef.current
    if (id !== null) {
      const body = bodiesRef.current.get(id)
      if (body !== undefined) {
        body.pinned = false
      }
    }
    dragRef.current = null
    setFrame((f) => f + 1)
  }

  const visibleNodes = orderedNodes.slice(0, revealed)
  const visibleIds = new Set(visibleNodes.map((n) => n.id))
  const neighborIds = new Set<string>()
  if (hoverId !== null) {
    neighborIds.add(hoverId)
    for (const edge of edges) {
      if (edge.src === hoverId) {
        neighborIds.add(edge.dst)
      }
      if (edge.dst === hoverId) {
        neighborIds.add(edge.src)
      }
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.canvas}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {edges.map((edge) => {
        const a = bodiesRef.current.get(edge.src)
        const b = bodiesRef.current.get(edge.dst)
        if (
          a === undefined ||
          b === undefined ||
          !visibleIds.has(edge.src) ||
          !visibleIds.has(edge.dst)
        ) {
          return null
        }
        const dimmed = hoverId !== null && edge.src !== hoverId && edge.dst !== hoverId
        return (
          <line
            key={edge.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={cx(styles.edge, dimmed && styles.edgeDimmed)}
            strokeDasharray={edge.edge_type === 'substitution' ? '6 4' : undefined}
          >
            <title>{`${edge.edge_type}: ${edge.mechanism} (${edge.polarity})`}</title>
          </line>
        )
      })}
      {visibleNodes.map((node) => {
        const body = bodiesRef.current.get(node.id)
        if (body === undefined) {
          return null
        }
        const radius = Math.min(7 + (degree.get(node.id) ?? 0) * 2, 15)
        const dimmed = hoverId !== null && !neighborIds.has(node.id)
        return (
          <g
            key={node.id}
            className={cx(styles.node, dimmed && styles.nodeDimmed)}
            data-kind={node.kind}
            transform={`translate(${body.x}, ${body.y})`}
            onPointerDown={handlePointerDown(node.id)}
            onPointerEnter={() => setHoverId(node.id)}
            onPointerLeave={() => setHoverId(null)}
          >
            {node.kind === 'kpi' && <circle r={radius + 4.5} className={styles.kpiRing} />}
            <circle r={radius} className={styles.dot} />
            <text y={radius + 14} className={styles.label}>
              {node.label}
            </text>
            <title>{`${node.label} · ${node.kind}${node.tags.length > 0 ? ` [${node.tags.join(', ')}]` : ''}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
