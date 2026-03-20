import { buildCommand, numberParser } from '@stricli/core'
import { syncFoods } from '../../syncFoods'
import type { CliContext } from '../context'

interface SyncRunFlags {
  pageSize?: number
  throttleMs?: number
  pageLimit?: number
  dataDir?: string
  stateFile?: string
  provider?: string
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
      },
      dataDir: {
        kind: 'parsed',
        brief: 'Override the base directory for sharded food data',
        optional: true,
        parse(input) {
          return input.trim()
        }
      },
      stateFile: {
        kind: 'parsed',
        brief: 'Override the sync state file name',
        optional: true,
        parse(input) {
          return input.trim()
        }
      },
      provider: {
        kind: 'parsed',
        brief: 'Provider identifier to sync from (default fdc)',
        optional: true,
        parse(input) {
          return input.trim()
        }
      }
    }
  },
  async func(flags) {
    const result = await syncFoods({
      providerId: flags.provider,
      providerOptions: {
        pageLimit: flags.pageLimit
      },
      databaseOptions: {
        baseDir: flags.dataDir,
        stateFileName: flags.stateFile
      },
      pageSize: flags.pageSize,
      throttleMs: flags.throttleMs,
      logger: this.logger
    })

    const providerLabel =
      result.runs.length === 1
        ? result.runs[0].provider
        : result.runs.map((run) => run.provider).join(', ')

    this.logger.log(
      `[cli] Sync completed for ${providerLabel}: imported ${result.totalImported} items`
    )
  }
})
