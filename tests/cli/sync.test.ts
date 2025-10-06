import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { runCli } from '../../src/cli'

const ORIGINAL_CWD = process.cwd()

describe('CLI sync commands', () => {
  let workdir: string

  beforeEach(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), 'food-cli-'))
    process.chdir(workdir)
  })

  afterEach(() => {
    process.chdir(ORIGINAL_CWD)
  })

  test('sync init creates data and state files', async () => {
    await runCli(['sync', 'init', '--dataFile', 'foods.json', '--stateFile', 'sync.json'])

    const foodsRaw = await readFile(path.join(workdir, 'foods.json'), 'utf-8')
    const stateRaw = await readFile(path.join(workdir, 'sync.json'), 'utf-8')

    expect(foodsRaw.trim()).toBe('[]')
    expect(stateRaw.trim()).toBe('{}')
  })

  test('sync run populates database and sync status reports results', async () => {
    process.env.API_KEY = 'test-key'

    // Prepare default files
    await runCli(['sync', 'init'])

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCli(['sync', 'run', '--pageLimit', '1', '--throttleMs', '0'])

    const foodsPath = path.join(workdir, 'database', 'foods.json')
    const foodsRaw = await readFile(foodsPath, 'utf-8')
    const foods = JSON.parse(foodsRaw)
    expect(foods).toHaveLength(2)

    logSpy.mockClear()
    await runCli(['sync', 'status'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('imported 2'))

    logSpy.mockRestore()
  })
})
