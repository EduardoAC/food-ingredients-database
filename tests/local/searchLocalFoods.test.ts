import { describe, expect, test } from 'vitest'
import {
  loadLocalFoods,
  searchLocalFoods,
  findFoodById,
  findFoodByExternalId
} from '../../src/local'

const baseDir = new URL('../../database/fdc', import.meta.url).pathname

describe('local food repository', () => {
  test('loads foods from shards', async () => {
    const foods = await loadLocalFoods({ baseDir })
    expect(foods.length).toBeGreaterThan(0)
  })

  test('findFoodById returns expected item', async () => {
    const food = await findFoodById('fdc:2706337', { baseDir })
    expect(food?.description).toBe('Abalone')
    expect(food?.foodNutrients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ number: '203', name: 'Protein', amount: 21.2 })
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
    expect(results[0].foodNutrients.find((nutrient) => nutrient.number === '203')?.amount).toBe(21.2)
  })

  test('searchLocalFoods can return all results when requested', async () => {
    const limited = await searchLocalFoods('', { baseDir, maxResults: 1 })
    const all = await searchLocalFoods('', { baseDir, includeAll: true })
    expect(limited.length).toBeLessThanOrEqual(all.length)
  })
})
