#!/usr/bin/env node
import { statSync } from 'node:fs'
import path from 'node:path'

const bundlePath = path.resolve('dist/index.esm.js')
const limitKB = 800

let stats
try {
  stats = statSync(bundlePath)
} catch {
  console.error(`Bundle not found at ${bundlePath}. Did you run the build step?`)
  process.exit(1)
}

const sizeKB = stats.size / 1024
if (sizeKB > limitKB) {
  console.error(`Bundle size ${sizeKB.toFixed(2)} KB exceeds limit of ${limitKB} KB`)
  process.exit(1)
}

console.log(`Bundle size ${sizeKB.toFixed(2)} KB within limit (${limitKB} KB) ✅`)
