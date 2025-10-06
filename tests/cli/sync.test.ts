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

  test('sync init creates sharded data structure', async () => {
    await runCli(['sync', 'init', '--dataDir', 'data/fdc', '--stateFile', 'state.json'])

    const indexRaw = await readFile(path.join(workdir, 'data', 'fdc', 'index.json'), 'utf-8')
    const stateRaw = await readFile(path.join(workdir, 'data', 'fdc', 'state.json'), 'utf-8')

    expect(JSON.parse(indexRaw)).toEqual(
      expect.objectContaining({ shards: expect.any(Array), lastUpdated: expect.any(String) })
    )
    expect(stateRaw.trim()).toBe('{}')
  })

  test('sync run populates database, supports search, and sync status reports results', async () => {
    process.env.API_KEY = 'test-key'

    // Prepare default files
    await runCli(['sync', 'init'])

    const initialIndexPath = path.join(workdir, 'database', 'fdc', 'index.json')
    await readFile(initialIndexPath, 'utf-8')

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCli(['sync', 'run', '--pageLimit', '1', '--throttleMs', '0'])

    const runLogs = [...logSpy.mock.calls]

    const foodsIndexPath = path.join(workdir, 'database', 'fdc', 'index.json')
    const indexContent = await readFile(foodsIndexPath, 'utf-8')
    const index = JSON.parse(indexContent)
    const stateContent = await readFile(path.join(workdir, 'database', 'fdc', 'sync-state.json'), 'utf-8')
    const state = JSON.parse(stateContent)
    expect(state).toEqual(expect.objectContaining({ fdc: expect.any(Object) }))
    expect(state.fdc.totalImported).toBe(2)
    expect(index.shards.length).toBeGreaterThan(0)

    const importLog = runLogs.find(([message]) => String(message).startsWith('[sync:fdc] Imported'))
    expect(importLog?.[0]).toContain('Imported 2')

    logSpy.mockClear()
    await runCli(['sync', 'status'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('imported 2'))

    logSpy.mockClear()
    await runCli(['search', '--query', 'apple', '--limit', '5'])
    expect(logSpy).toHaveBeenCalled()

    logSpy.mockRestore()
  })
})
