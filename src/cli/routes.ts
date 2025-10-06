import { buildRouteMap } from '@stricli/core'
import type { CliContext } from './context'
import { syncInitCommand } from './commands/syncInit'
import { syncRunCommand } from './commands/syncRun'
import { syncStatusCommand } from './commands/syncStatus'
import { searchFoodsCommand } from './commands/searchFoods'

export const rootRoutes = buildRouteMap<'sync' | 'search', CliContext>({
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
    }),
    search: searchFoodsCommand
  },
  docs: {
    brief: 'Food ingredients CLI'
  }
})
