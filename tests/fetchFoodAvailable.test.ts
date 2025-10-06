import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  createFdcDataSourceAdapter,
  createJsonDatabaseAdapter,
  runFoodSync
} from '../src/sync'

describe('runFoodSync (outside-in)', () => {
  test('synchronises foods into the local JSON database', async () => {
    process.env.API_KEY = 'test-key'

    const workdir = await mkdtemp(path.join(tmpdir(), 'food-sync-'))
    const database = createJsonDatabaseAdapter({
      cwd: workdir,
      dataFile: 'foods.json',
      stateFile: 'sync-state.json'
    })
    const dataSource = createFdcDataSourceAdapter({ pageLimit: 1 })

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

    const foodsRaw = await readFile(path.join(workdir, 'foods.json'), 'utf-8')
    const foods = JSON.parse(foodsRaw)
    expect(foods).toHaveLength(2)
    expect(foods[0]).toMatchObject({
      provider: 'fdc',
      nutrients: expect.any(Array)
    })

    const stateRaw = await readFile(
      path.join(workdir, 'sync-state.json'),
      'utf-8'
    )
    const state = JSON.parse(stateRaw)
    expect(state.fdc.totalImported).toBe(2)

    expect(logs.some((log) => log.includes('Imported'))).toBe(true)
  })
})
