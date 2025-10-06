import { http, HttpResponse } from 'msw'

const foodsPage1 = [
  {
    dataType: 'Survey (FNDDS)',
    description: 'Test Apple',
    fdcId: 101,
    foodNutrients: [
      { number: 1008, name: 'Energy', amount: 52, unitName: 'KCAL' },
      { number: 1003, name: 'Protein', amount: 0.3, unitName: 'G' }
    ],
    publicationDate: '2020-01-01'
  },
  {
    dataType: 'Survey (FNDDS)',
    description: 'Test Banana',
    fdcId: 102,
    foodNutrients: [
      { number: 1008, name: 'Energy', amount: 96, unitName: 'KCAL' },
      { number: 1003, name: 'Protein', amount: 1.3, unitName: 'G' }
    ],
    publicationDate: '2020-01-02'
  }
]

const foodsPage2: typeof foodsPage1 = []

export const fdcHandlers = [
  http.get('https://api.nal.usda.gov/fdc/v1/foods/list', ({ request }) => {
    const url = new URL(request.url)
    const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1')

    if (pageNumber <= 1) {
      return HttpResponse.json(foodsPage1)
    }

    return HttpResponse.json(foodsPage2)
  })
]
