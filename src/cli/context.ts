import type { CommandContext, StricliDynamicCommandContext } from '@stricli/core'

export interface CliContext extends CommandContext {
  readonly cwd: string
  readonly logger: Console
}

function toWritable(stream: NodeJS.WriteStream) {
  return {
    write: (chunk: string) => stream.write(chunk),
    getColorDepth: stream.getColorDepth?.bind(stream)
  }
}

export function createDynamicContext(): StricliDynamicCommandContext<CliContext> {
  const stdout = toWritable(process.stdout)
  const stderr = toWritable(process.stderr)

  return {
    process: {
      stdout,
      stderr,
      env: process.env,
      get exitCode() {
        return process.exitCode
      },
      set exitCode(value) {
        process.exitCode = Number(value)
      }
    },
    locale:
      process.env.LC_ALL ??
      process.env.LC_MESSAGES ??
      process.env.LANG ??
      process.env.LANGUAGE ??
      'en-US',
    forCommand: async () => ({
      process: {
        stdout,
        stderr
      },
      cwd: process.cwd(),
      logger: console
    })
  }
}
