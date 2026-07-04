import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ExtractResponse } from '@/contracts.ts'
import extractFixture from '@/mocks/fixtures/extract_response.json'
import { ForceGraph } from '@/components/ForceGraph/ForceGraph.tsx'

const extract = extractFixture as unknown as ExtractResponse

describe('ForceGraph', () => {
  it('renders every node with its label on the canvas', () => {
    render(
      <ForceGraph nodes={extract.entities} edges={extract.edges} ariaLabel="Knowledge graph" />,
    )
    const canvas = screen.getByRole('img', { name: 'Knowledge graph' })
    expect(canvas).toBeInTheDocument()
    expect(screen.getByText('время агитации в контактных чанах')).toBeInTheDocument()
    expect(screen.getByText('магнитная сепарация пирротиновой фракции')).toBeInTheDocument()
    expect(screen.getByText('извлекаемые потери элемента 28 с хвостами')).toBeInTheDocument()
    expect(canvas.querySelectorAll('line')).toHaveLength(extract.edges.length)
  })

  it('settles all nodes inside the viewport in static mode', () => {
    render(
      <ForceGraph
        nodes={extract.entities}
        edges={extract.edges}
        width={640}
        height={420}
        ariaLabel="Knowledge graph"
      />,
    )
    const canvas = screen.getByRole('img', { name: 'Knowledge graph' })
    const groups = [...canvas.querySelectorAll('g[data-kind]')]
    expect(groups).toHaveLength(extract.entities.length)
    for (const group of groups) {
      const transform = group.getAttribute('transform') ?? ''
      const match = /translate\(([\d.]+), ([\d.]+)\)/.exec(transform)
      expect(match).not.toBeNull()
      if (match !== null) {
        const x = Number(match[1])
        const y = Number(match[2])
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(640)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(420)
      }
    }
  })

  it('reveals the full graph immediately in static mode even with animateBuild', () => {
    render(
      <ForceGraph
        nodes={extract.entities}
        edges={extract.edges}
        ariaLabel="Knowledge graph"
        animateBuild
      />,
    )
    const canvas = screen.getByRole('img', { name: 'Knowledge graph' })
    expect(canvas.querySelectorAll('g[data-kind]')).toHaveLength(extract.entities.length)
  })
})
