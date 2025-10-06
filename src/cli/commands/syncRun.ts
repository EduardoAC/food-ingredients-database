import { buildCommand, numberParser } from '@stricli/core'
import {
  createFdcDataSourceAdapter,
  createJsonDatabaseAdapter,
  syncFoodsWithDefaults
} from '../../sync'
import type { CliContext } from '../context'

interface SyncRunFlags {
  pageSize?: number
  throttleMs?: number
  pageLimit?: number
}

export const syncRunCommand = buildCommand<SyncRunFlags, [], CliContext>({
  docs: {
    brief: 'Run a food sync cycle against configured providers',
    fullDescription:
      'Fetches food data from third-party providers and writes it to the local database. Flags control batching behaviour.'
  },
  parameters: {
    flags: {
      pageSize: {
        kind: 'parsed',
        brief: 'Number of items to request per page (default 200)',
        optional: true,
        parse: numberParser
      },
      throttleMs: {
        kind: 'parsed',
        brief: 'Delay between page fetches in milliseconds (default 1500)',
        optional: true,
        parse: numberParser
      },
      pageLimit: {
        kind: 'parsed',
        brief: 'Limit the number of FDC pages fetched (primarily for testing)',
        optional: true,
        parse: numberParser
      }
    }
  },
  async func(flags) {
    const dataSource = createFdcDataSourceAdapter({
      pageLimit: flags.pageLimit
    })
    const database = createJsonDatabaseAdapter()

    const result = await syncFoodsWithDefaults(dataSource, database, {
      pageSize: flags.pageSize,
      throttleMs: flags.throttleMs,
      logger: this.logger
    })

    this.logger.log(
      `[cli] Sync completed for ${result.provider}: imported ${result.totalImported} items (last ID ${result.lastExternalId ?? 'n/a'})`
    )
  }
})
