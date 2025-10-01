// orval.config.ts
// import { Config } from '@orval/core';
import { defineConfig } from 'orval';

export default defineConfig({
  foodIngredients: {
    input: './src/schema/fdc.schema.yml',
    output: {
      mode: 'tags-split',
      target: './src/api/fdc-client.ts', // generated client
      schemas: './src/api/model',        // types
      client: 'fetch',                   // or 'axios', your choice
      clean: true,
      mock: true,
      prettier: true,
      baseUrl: 'https://api.nal.usda.gov/fdc',
      override: {
        mutator: {
          path: './src/customFetch.ts',
          name: 'customFetch',
        }
      }
    },
  },
});
