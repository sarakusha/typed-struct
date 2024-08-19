import { defineConfig, type Options } from 'tsup';

const nodeConfig: Options = {
  name: 'node',
  platform: 'node',
  entry: ['src/node.ts'],
  clean: true,
  dts: process.env.NODE_ENV === 'production',
  format: ['cjs', 'esm'],
  minify: true,
  outDir: 'build',
  replaceNodeEnv: true,
  splitting: false,
  target: 'es2020',
  treeshake: true,
};

const browserConfig: Options = {
  name: 'browser',
  platform: 'browser',
  entry: ['src/browser.ts'],
  clean: true,
  dts: process.env.NODE_ENV === 'production',
  format: 'esm',
  minify: true,
  outDir: 'build',
  replaceNodeEnv: true,
  skipNodeModulesBundle: true,
  splitting: false,
  target: 'es2020',
  treeshake: true,
};

export default defineConfig([nodeConfig, browserConfig]);
