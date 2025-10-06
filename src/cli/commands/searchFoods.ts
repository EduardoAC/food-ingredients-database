import { buildCommand } from '@stricli/core'
import { searchLocalFoods } from '../../local'
import type { CliContext } from '../context'

interface SearchFlags {
  query?: string
  nutrientNumber?: string
  nutrientName?: string
  json?: boolean
  limit?: number
  dataDir?: string
}

export const searchFoodsCommand = buildCommand<SearchFlags, [], CliContext>({
  docs: {
    brief: 'Search the local food database',
    fullDescription: 'Queries the synced food data stored on disk, matching by description, tags, or nutrient metadata.'
  },
  parameters: {
    flags: {
      query: {
        kind: 'parsed',
        brief: 'Text query to match against descriptions and tags',
        optional: true,
        parse(input) {
          return input.trim()
        }
      },
      nutrientNumber: {
        kind: 'parsed',
        brief: 'Filter by nutrient identifier (e.g. 203 for protein)',
        optional: true,
        parse(input) {
          return input.trim()
        }
      },
      nutrientName: {
        kind: 'parsed',
        brief: 'Filter by nutrient name fragment',
        optional: true,
        parse(input) {
          return input.trim()
        }
      },
      json: {
        kind: 'boolean',
        brief: 'Return raw JSON instead of formatted text',
        optional: true
      },
      limit: {
        kind: 'parsed',
        brief: 'Maximum number of results to print (default 10)',
        optional: true,
        parse(input) {
          const value = Number(input)
          if (Number.isNaN(value) || value <= 0) {
            throw new Error('limit must be a positive number')
          }
          return value
        }
      },
      dataDir: {
        kind: 'parsed',
        brief: 'Override the base directory for local food shards',
        optional: true,
        parse(input) {
          return input.trim()
        }
      }
    }
  },
  async func(flags) {
    const results = await searchLocalFoods(flags.query ?? '', {
      baseDir: flags.dataDir,
      nutrientNumber: flags.nutrientNumber,
      nutrientName: flags.nutrientName,
      maxResults: flags.limit ?? 10
    })

    if (flags.json) {
      this.logger.log(JSON.stringify(results, null, 2))
      return
    }

    if (results.length === 0) {
      this.logger.log('[cli] No foods matched the query')
      return
    }

    for (const food of results) {
      this.logger.log(
        `[cli] ${food.description} (fdcId ${food.fdcId}) — ${food.foodNutrients
          .map((nutrient) => `${nutrient.name}: ${nutrient.amount}${nutrient.unitName}`)
          .slice(0, 3)
          .join(', ')}${food.foodNutrients.length > 3 ? ', …' : ''}`
      )
    }
  }
})
