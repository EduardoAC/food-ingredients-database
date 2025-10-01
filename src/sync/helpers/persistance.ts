import fs from 'fs/promises';
import { constants } from 'fs';
import { AbridgedFoodItem } from '../../';

const DATA_FILE = './database/foods.json';

export async function initJsonFile() {
  try {
    await fs.access(DATA_FILE, constants.F_OK);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf-8'); // create empty array
  }
}

export async function loadLocalData(filepath: string): Promise<AbridgedFoodItem[]> {
  try {
    return JSON.parse(await fs.readFile(filepath, 'utf-8'));
  } catch {
    return [];
  }
}

export async function appendFoods(fresh: AbridgedFoodItem[]) {
  if (fresh.length === 0) return;

  let file = await fs.readFile(DATA_FILE, 'utf-8');

  // Remove trailing "]"
  file = file.trim().replace(/\]\s*$/, '');

  // If file was just "[]", drop the "["
  if (file === '[') {
    file = '[';
  } else {
    file += ',';
  }

  // Append new items
  file += fresh.map(f => JSON.stringify(f)).join(',') + ']';

  await fs.writeFile(DATA_FILE, file, 'utf-8');
}
