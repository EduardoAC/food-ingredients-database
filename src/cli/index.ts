import { buildApplication, run } from '@stricli/core'
import { createDynamicContext } from './context'
import { rootRoutes } from './routes'

const currentVersion = process.env.npm_package_version ?? '0.0.0'

const application = buildApplication(rootRoutes, {
  name: 'food-ingredients',
  versionInfo: {
    currentVersion,
    async getLatestVersion() {
      return currentVersion
    }
  }
})

export async function runCli(argv: readonly string[] = process.argv.slice(2)) {
  const context = createDynamicContext()
  await run(application, argv, context)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('[cli] Failed to execute command', error)
    process.exitCode = 1
  })
}
