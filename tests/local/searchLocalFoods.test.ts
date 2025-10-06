import { describe, expect, test } from 'vitest'
import { loadLocalFoods, searchLocalFoods, findFoodByFdcId } from '../../src/local'

const baseDir = new URL('../../database/fdc', import.meta.url).pathname

describe('local food repository', () => {
  test('loads foods from shards', async () => {
    const foods = await loadLocalFoods({ baseDir })
    expect(foods.length).toBeGreaterThan(0)
  })

  test('findFoodByFdcId returns expected item', async () => {
    const food = await findFoodByFdcId(2706337, { baseDir })
    expect(food?.description).toBe('Abalone')
    expect(food?.foodNutrients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ number: '203', name: 'Protein', amount: 21.2 })
      ])
    )
  })

  test('searchLocalFoods matches by description and nutrient', async () => {
    const results = await searchLocalFoods('abalone', {
      baseDir,
      nutrientNumber: '203'
    })
    expect(results).toHaveLength(1)
    expect(results[0].foodNutrients.find((nutrient) => nutrient.number === '203')?.amount).toBe(21.2)
  })
})
