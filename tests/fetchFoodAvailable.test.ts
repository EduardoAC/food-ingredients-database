import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createJsonShardedDatabaseAdapter, runFoodSync } from '../src/sync'
import { createDefaultProviderRegistry } from '../src/providers'

describe('runFoodSync (outside-in)', () => {
  test('synchronises foods into the local JSON database', async () => {
    process.env.API_KEY = 'test-key'

    const workdir = await mkdtemp(path.join(tmpdir(), 'food-sync-'))
    const database = createJsonShardedDatabaseAdapter({
      baseDir: path.join(workdir, 'fdc-data'),
      stateFileName: 'sync-state.json'
    })
    const registry = createDefaultProviderRegistry()
    const dataSource = registry.createAdapter('fdc', { pageLimit: 1 })

    const logs: string[] = []
    const result = await runFoodSync(
      { dataSource, database },
      {
        pageSize: 200,
        throttleMs: 0,
        logger: {
          log: (message) => logs.push(message),
          error: (message) => logs.push(String(message))
        }
      }
    )

    expect(result.provider).toBe('fdc')
    expect(result.totalImported).toBe(2)
    expect(result.lastExternalId).toBe('102')

    const indexRaw = await readFile(
      path.join(workdir, 'fdc-data', 'index.json'),
      'utf-8'
    )
    const index = JSON.parse(indexRaw)
    expect(index.shards.length).toBeGreaterThan(0)

    const shardPath = path.join(workdir, 'fdc-data', 'shards', index.shards[0].shard)
    const shardFoods = JSON.parse(await readFile(shardPath, 'utf-8'))
    expect(shardFoods).toHaveLength(2)
    expect(shardFoods[0]).toMatchObject({
      id: expect.stringContaining('fdc:'),
      provider: 'fdc',
      externalId: expect.any(String),
      foodNutrients: expect.any(Array)
    })

    const stateRaw = await readFile(
      path.join(workdir, 'fdc-data', 'sync-state.json'),
      'utf-8'
    )
    const state = JSON.parse(stateRaw)
    expect(state.fdc.totalImported).toBe(2)

    expect(logs.some((log) => log.includes('Imported'))).toBe(true)
  })
})
