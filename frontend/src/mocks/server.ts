import { setupServer } from 'msw/node'
import { handlers, resetMockBackend } from './handlers.ts'

export const server = setupServer(...handlers)
export { resetMockBackend }
