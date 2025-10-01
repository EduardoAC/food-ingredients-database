// src/syncFoods.ts
import fs from 'fs/promises';
import { getFoodsList, AbridgedFoodItem } from '.';

const DATA_FILE = './database/foods.json';

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function loadLocalData(): Promise<AbridgedFoodItem[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function saveLocalData(data: AbridgedFoodItem[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function syncFoods() {
  const localData = await loadLocalData();
  const maxExistingId = Math.max(0, ...localData.map((f) => f.fdcId));

  let page = 1;
  let totalNew = 0;

  while (page < 200) {
    console.log(`Fetching page ${page}`);
    const foodListResponse = await getFoodsList({
      pageNumber: page,
      pageSize: 200,
    });

    const foods = foodListResponse.data;


    if (!foods || foods.length === 0) break;

    const fresh = foods.filter((f) => f.fdcId > maxExistingId);

    if (fresh.length > 0) {
      localData.push(...fresh);
      totalNew += fresh.length;

      // ✅ Save after every page
      await saveLocalData(localData);
      console.log(`Saved ${fresh.length} new foods (total new so far: ${totalNew})`);
    }

    if (foods.length < 200) break;
    page++;

    await delay(1500); // stay under 1000 req/hr
  }
}

syncFoods();
