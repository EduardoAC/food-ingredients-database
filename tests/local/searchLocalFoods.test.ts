import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  loadLocalFoods,
  searchLocalFoods,
  findFoodById,
  findFoodByExternalId
} from '../../src/local'

const baseDir = new URL('../../database/fdc', import.meta.url).pathname
const originalCwd = process.cwd()

describe('local food repository', () => {
  test('loads foods from bundled shards when the default data dir is unavailable', async () => {
    const workdir = await mkdtemp(path.join(tmpdir(), 'food-local-bundled-'))
    process.chdir(workdir)

    try {
      const foods = await loadLocalFoods()
      expect(foods.length).toBeGreaterThan(0)

      const food = await findFoodById('fdc:2706337')
      expect(food?.description).toBe('Abalone')

      const byExternal = await findFoodByExternalId('2706337')
      expect(byExternal?.id).toBe('fdc:2706337')

      const results = await searchLocalFoods('abalone', {
        nutrientNumber: '203'
      })
      expect(results).toHaveLength(1)
      expect(
        results[0].foodNutrients.find((nutrient) => nutrient.number === '203')
          ?.amount
      ).toBe(21.2)
    } finally {
      process.chdir(originalCwd)
    }
  })

  test('loads foods from shards when baseDir is provided explicitly', async () => {
    const workdir = await mkdtemp(path.join(tmpdir(), 'food-local-fs-'))
    process.chdir(workdir)

    try {
      const foods = await loadLocalFoods({ baseDir })
      expect(foods.length).toBeGreaterThan(0)
    } finally {
      process.chdir(originalCwd)
    }
  })

  test('loads foods from explicit shard data in the repo dataset', async () => {
    const foods = await loadLocalFoods({ baseDir })
    expect(foods.length).toBeGreaterThan(0)
  })

  test('findFoodById and findFoodByExternalId return expected item', async () => {
    const food = await findFoodById('fdc:2706337', { baseDir })
    expect(food?.description).toBe('Abalone')
    expect(food?.foodNutrients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: '203',
          name: 'Protein',
          amount: 21.2
        })
      ])
    )
    expect(food?.externalId).toBe('2706337')

    const byExternal = await findFoodByExternalId('2706337', { baseDir })
    expect(byExternal?.id).toBe('fdc:2706337')
  })

  test('searchLocalFoods matches by description and nutrient', async () => {
    const results = await searchLocalFoods('abalone', {
      baseDir,
      nutrientNumber: '203'
    })
    expect(results).toHaveLength(1)
    expect(
      results[0].foodNutrients.find((nutrient) => nutrient.number === '203')
        ?.amount
    ).toBe(21.2)
  })

  test('searchLocalFoods can return all results when requested', async () => {
    const limited = await searchLocalFoods('', { baseDir, maxResults: 1 })
    const all = await searchLocalFoods('', { baseDir, includeAll: true })
    expect(limited.length).toBeLessThanOrEqual(all.length)
  })
})
