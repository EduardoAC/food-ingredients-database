import { setupServer } from 'msw/node'
import { fdcHandlers } from './handlers/fdcHandlers'

export const server = setupServer(...fdcHandlers)
