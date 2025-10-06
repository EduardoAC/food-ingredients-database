import { buildRouteMap } from '@stricli/core'
import type { CliContext } from './context'
import { syncInitCommand } from './commands/syncInit'
import { syncRunCommand } from './commands/syncRun'
import { syncStatusCommand } from './commands/syncStatus'

export const rootRoutes = buildRouteMap<'sync', CliContext>({
  routes: {
    sync: buildRouteMap<'init' | 'run' | 'status', CliContext>({
      routes: {
        init: syncInitCommand,
        run: syncRunCommand,
        status: syncStatusCommand
      },
      docs: {
        brief: 'Manage local food database synchronisation'
      }
    })
  },
  docs: {
    brief: 'Food ingredients CLI'
  }
})
