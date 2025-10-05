import {
  AbridgedFoodItem,
  AbridgedFoodNutrient
} from '../../../api/model'
import { getFoodsList } from '../../../api/fdc/fdc'
import {
  DataSourceAdapter,
  FoodRecord,
  NutrientRecord,
  SyncBatch,
  SyncRequest
} from '../../ports'

interface FdcAdapterOptions {
  pageLimit?: number
}

const PROVIDER = 'fdc'

function mapNutrient(nutrient: AbridgedFoodNutrient): NutrientRecord {
  return {
    id: nutrient.number?.toString() ?? nutrient.name ?? 'unknown',
    name: nutrient.name ?? 'Unknown',
    unitName: nutrient.unitName ?? 'unit',
    value: nutrient.amount ?? 0
  }
}

function mapFood(item: AbridgedFoodItem): FoodRecord {
  return {
    id: `${PROVIDER}:${item.fdcId}`,
    externalId: item.fdcId?.toString() ?? '',
    provider: PROVIDER,
    name: item.description ?? 'Unknown food',
    dataType: item.dataType,
    brandOwner: item.brandOwner,
    publicationDate: item.publicationDate,
    nutrients: (item.foodNutrients ?? []).map(mapNutrient)
  }
}

export class FdcDataSourceAdapter implements DataSourceAdapter {
  readonly provider = PROVIDER
  private readonly pageLimit?: number

  constructor(options: FdcAdapterOptions = {}) {
    this.pageLimit = options.pageLimit
  }

  async fetchBatch(request: SyncRequest): Promise<SyncBatch> {
    const pageNumber = request.cursor?.page ?? 1

    if (this.pageLimit && pageNumber > this.pageLimit) {
      return { foods: [], hasMore: false }
    }

    const response = await getFoodsList({
      pageNumber,
      pageSize: request.pageSize
    })

    const items = response.data ?? []
    const records = items.map(mapFood)

    const lastExternalIdNumeric = request.lastExternalId
      ? Number(request.lastExternalId)
      : 0

    const filtered = records.filter((record) => {
      if (!record.externalId) return false
      const numericId = Number(record.externalId)
      return numericId > lastExternalIdNumeric
    })

    const highestInBatch = filtered.reduce((max, record) => {
      const numericId = Number(record.externalId)
      return Number.isNaN(numericId) ? max : Math.max(max, numericId)
    }, lastExternalIdNumeric)

    const reachedLimit = this.pageLimit
      ? pageNumber >= this.pageLimit
      : false

    const hasMore = !reachedLimit && items.length === request.pageSize

    const nextCursor = hasMore ? { page: pageNumber + 1 } : undefined

    return {
      foods: filtered,
      hasMore,
      cursor: nextCursor,
      lastExternalId:
        highestInBatch > lastExternalIdNumeric
          ? String(highestInBatch)
          : request.lastExternalId
    }
  }
}

export function createFdcDataSourceAdapter(
  options: FdcAdapterOptions = {}
): DataSourceAdapter {
  return new FdcDataSourceAdapter(options)
}
