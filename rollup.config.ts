import { defineConfig } from "rollup";
import { dts } from "rollup-plugin-dts";
import del from "rollup-plugin-delete";
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';

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
    plugins: [
      del({ targets: "dist/*", hook: "buildStart" }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        preventAssignment: true,
      }),
      resolve({
        browser: true,
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }),
      typescript({
        tsconfig: './tsconfig.json'      // Use this tsconfig file to configure TypeScript compilation
      }),
      terser()
    ],
    external: [
      "react",
      "@tanstack/react-query",
    ],
  },
  {
    input: "dist/types/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [
      dts(),
      del({ hook: "buildEnd", targets: "dist/types", verbose: true }),
    ],
  },
]);