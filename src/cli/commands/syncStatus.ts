import { buildCommand } from '@stricli/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CliContext } from '../context'

interface SyncStatusFlags {
  json?: boolean
  stateFile?: string
}

type ProviderState = {
  provider: string
  lastExternalId?: string
  totalImported?: number
  lastSyncedAt?: string
}

type SyncStateFile = Record<string, ProviderState>

export const syncStatusCommand = buildCommand<SyncStatusFlags, [], CliContext>({
  docs: {
    brief: 'Print the latest sync state tracked on disk',
    fullDescription:
      'Reads the sync-state JSON file and prints a summary of known providers. Use --json for raw output.'
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Return raw JSON instead of formatted text',
        optional: true
      },
      stateFile: {
        kind: 'parsed',
        brief: 'Path to sync-state JSON file (default database/sync-state.json)',
        optional: true,
        parse(input) {
          return input
        }
      }
    }
  },
  async func(flags) {
    const statePath = path.resolve(this.cwd, flags.stateFile ?? 'database/sync-state.json')

    let state: SyncStateFile = {}
    try {
      const raw = await fs.readFile(statePath, 'utf-8')
      state = JSON.parse(raw) as SyncStateFile
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.log('[cli] No sync state found yet')
        return
      }
      throw error
    }

    if (flags.json) {
      this.logger.log(JSON.stringify(state, null, 2))
      return
    }

    const entries = Object.values(state)
    if (entries.length === 0) {
      this.logger.log('[cli] Sync state file is empty')
      return
    }

    for (const entry of entries) {
      this.logger.log(
        `[cli] ${entry.provider}: imported ${entry.totalImported ?? 0} (last ID ${entry.lastExternalId ?? 'n/a'}, last synced ${entry.lastSyncedAt ?? 'n/a'})`
      )
    }
  }
})
