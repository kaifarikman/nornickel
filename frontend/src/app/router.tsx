import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from '@/app/Layout/Layout.tsx'

export function createRouter() {
  return createBrowserRouter([
    {
      element: <Layout />,
      children: [
        { path: '/', element: <Navigate to="/setup" replace /> },
        {
          path: '/setup',
          lazy: async () => ({
            Component: (await import('@/features/setup/SetupView/SetupView.tsx')).SetupView,
          }),
        },
        {
          path: '/run',
          lazy: async () => ({
            Component: (await import('@/features/run/RunView/RunView.tsx')).RunView,
          }),
        },
        {
          path: '/diagnosis',
          lazy: async () => ({
            Component: (await import('@/features/diagnosis/DiagnosisView/DiagnosisView.tsx'))
              .DiagnosisView,
          }),
        },
        {
          path: '/hypotheses',
          lazy: async () => ({
            Component: (await import('@/features/hypotheses/HypothesisBoard/HypothesisBoard.tsx'))
              .HypothesisBoard,
          }),
        },
        {
          path: '/hypotheses/:id',
          lazy: async () => ({
            Component: (await import('@/features/hypotheses/HypothesisDetail/HypothesisDetail.tsx'))
              .HypothesisDetail,
          }),
        },
        {
          path: '/graph',
          lazy: async () => ({
            Component: (await import('@/features/graph/KnowledgeGraph/KnowledgeGraph.tsx'))
              .KnowledgeGraph,
          }),
        },
        {
          path: '/benchmark',
          lazy: async () => ({
            Component: (await import('@/features/benchmark/BenchmarkView/BenchmarkView.tsx'))
              .BenchmarkView,
          }),
        },
        {
          path: '/library',
          lazy: async () => ({
            Component: (await import('@/features/library/KnowledgeLibrary/KnowledgeLibrary.tsx'))
              .KnowledgeLibrary,
          }),
        },
        {
          path: '/report',
          lazy: async () => ({
            Component: (await import('@/features/report/ReportExport/ReportExport.tsx'))
              .ReportExport,
          }),
        },
        { path: '*', element: <Navigate to="/setup" replace /> },
      ],
    },
  ])
}
