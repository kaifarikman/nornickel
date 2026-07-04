import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { KnowledgeGraph } from '@/features/graph/KnowledgeGraph/KnowledgeGraph.tsx'
import { renderWithProviders } from '../../utils/render.tsx'

describe('KnowledgeGraph', () => {
  it('renders the full knowledge graph with node/edge stats', async () => {
    renderWithProviders(<KnowledgeGraph />, { route: '/graph', path: '/graph' })
    const graph = await screen.findByRole('img', { name: 'Граф знаний' })
    expect(graph).toBeInTheDocument()
    expect(screen.getByText('узлов')).toBeInTheDocument()
    expect(screen.getByText('связей')).toBeInTheDocument()
    expect(screen.getByText('источников')).toBeInTheDocument()
  })
})
