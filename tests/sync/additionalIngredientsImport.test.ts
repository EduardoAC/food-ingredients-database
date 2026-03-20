import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { loadLocalFoods } from '../../src/local'
import { syncFoods } from '../../src/syncFoods'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.resolve(
  testDir,
  '..',
  '..',
  'database',
  'sources',
  'additional-ingredients.json'
)

async function loadSourceIds() {
  const document = JSON.parse(await readFile(sourcePath, 'utf-8')) as {
    ingredients: Array<{ id: string }>
  }

  return document.ingredients.map((ingredient) => ingredient.id).sort()
}

describe('additional ingredients import path', () => {
  test('imports the tracked source through the normal sync flow', async () => {
    const workdir = await mkdtemp(path.join(tmpdir(), 'food-additional-sync-'))
    const baseDir = path.join(workdir, 'database', 'fdc')
    const sourceIds = await loadSourceIds()

    const result = await syncFoods({
      providerId: 'additional-ingredients',
      databaseOptions: { baseDir },
      throttleMs: 0,
      logger: {
        log() {},
        error() {}
      }
    })

    const index = JSON.parse(
      await readFile(path.join(baseDir, 'index.json'), 'utf-8')
    ) as {
      shards: Array<{ shard: string; size: number }>
    }
    const syncState = JSON.parse(
      await readFile(path.join(baseDir, 'sync-state.json'), 'utf-8')
    ) as Record<
      string,
      { provider: string; totalImported?: number; lastExternalId?: string }
    >
    const foods = await loadLocalFoods({ baseDir })

    expect(result.runs).toHaveLength(1)
    expect(result.runs[0].provider).toBe('additional-ingredients')
    expect(result.runs[0].totalImported).toBe(sourceIds.length)
    expect(index.shards.length).toBeGreaterThan(0)
    expect(syncState).toEqual(
      expect.objectContaining({
        'additional-ingredients': expect.objectContaining({
          provider: 'additional-ingredients',
          totalImported: sourceIds.length,
          lastExternalId: expect.any(String)
        })
      })
    )
    expect(foods.map((food) => food.id).sort()).toEqual(sourceIds)
  })
})
