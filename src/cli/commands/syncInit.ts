import { buildCommand } from '@stricli/core'
import { createJsonDatabaseAdapter } from '../../sync'
import type { CliContext } from '../context'

interface SyncInitFlags {
  dataFile?: string
  stateFile?: string
}

export const syncInitCommand = buildCommand<SyncInitFlags, [], CliContext>({
  docs: {
    brief: 'Initialise the local food database files',
    fullDescription:
      'Creates the data and sync-state JSON files if they do not exist. You can override the default locations with flags.'
  },
  parameters: {
    flags: {
      dataFile: {
        kind: 'parsed',
        brief: 'Override the foods data JSON file path',
        optional: true,
        parse(input) {
          return input
        }
      },
      stateFile: {
        kind: 'parsed',
        brief: 'Override the sync state JSON file path',
        optional: true,
        parse(input) {
          return input
        }
      }
    }
  },
  async func(flags) {
    const database = createJsonDatabaseAdapter({
      dataFile: flags.dataFile,
      stateFile: flags.stateFile
    })

    await database.init()
    this.logger.log('[cli] Local database initialised')
  }
})
