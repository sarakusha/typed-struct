import { defineConfig, type UserConfig } from 'tsdown';

const nodeConfig: UserConfig = {
  name: 'node',
  platform: 'node',
  entry: ['src/node.ts'],
  clean: true,
  dts: process.env.NODE_ENV === 'production',
  format: ['cjs', 'esm'],
  minify: false,
  outDir: 'build',
  // replaceNodeEnv: true,
  // splitting: false,
  target: 'es2020',
  treeshake: true,
  sourcemap: true,
};

const browserConfig: UserConfig = {
  name: 'browser',
  platform: 'browser',
  entry: ['src/browser.ts'],
  clean: true,
  dts: process.env.NODE_ENV === 'production',
  format: 'esm',
  minify: false,
  outDir: 'build',
  // replaceNodeEnv: true,
  skipNodeModulesBundle: true,
  // splitting: false,
  target: 'es2020',
  treeshake: true,
  sourcemap: true,
};

export default defineConfig([nodeConfig, browserConfig]);
