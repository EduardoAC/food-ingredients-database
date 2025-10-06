import { defineConfig } from 'rollup'
import dotenv from 'dotenv'
import del from 'rollup-plugin-delete'
import { dts } from 'rollup-plugin-dts'
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import replace from '@rollup/plugin-replace'

dotenv.config();

const envReplacements = {
  preventAssignment: true,
  'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
}

const shouldMinify = process.env.BUILD_MINIFY !== 'false'

function createSharedPlugins() {
  return [
    replace(envReplacements),
    resolve({
      browser: true,
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    }),
    typescript({
      tsconfig: './tsconfig.json'
    }),
    ...createMinifyPlugins()
  ]
}

function createMinifyPlugins() {
  if (!shouldMinify) {
    return []
  }

  return [
    terser({
      module: true,
      compress: {
        defaults: true
      },
      format: {
        ecma: 2020
      }
    })
  ]
}

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: "esm",
        sourcemap: true,
      },
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.es.js',
        format: 'es',
        exports: 'named',
        sourcemap: true
      }
    ],
    plugins: [del({ targets: 'dist/*', hook: 'buildStart' }), ...createSharedPlugins()],
    external: [
      "react",
      "@tanstack/react-query",
    ],
  },
  {
    input: 'src/syncFoods.ts',
    output: [
      {
        file: 'dist/syncFoods.esm.js',
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [...createSharedPlugins()],
    external: [
      "react",
      "@tanstack/react-query",
    ],
  },
  {
    input: 'src/cli/index.ts',
    output: [
      {
        file: 'dist/cli/index.js',
        format: 'esm',
        sourcemap: true,
        banner: '#!/usr/bin/env node'
      }
    ],
    plugins: [...createSharedPlugins()],
    external: [
      '@stricli/core'
    ]
  },
  // {
  //   input: "dist/types/index.d.ts",
  //   output: [{ file: "dist/index.d.ts", format: "es" }],
  //   plugins: [
  //     dts(),
  //     del({ hook: "buildEnd", targets: "dist/types", verbose: true }),
  //   ],
  // },
]);
