
import { build, buildSync } from 'esbuild';
import { exec, execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const watch = process.argv.includes('--watch');

const getPackageFile = () => {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
}

const main = () => {
  try {
    const pkgJson = getPackageFile()
    const packageName = pkgJson.name.split('/').pop();
    const external = [
      ...Object.keys(pkgJson.dependencies ?? {}),
      ...Object.keys(pkgJson.devDependencies ?? {}),
    ]

    buildSync({
      entryPoints: ['src/main.ts'],
      bundle: true,
      platform: 'node',
      target: 'es2022',
      format: 'esm',
      outfile: `bin/${packageName}`,
      external,
      banner: {
        js: '#!/usr/bin/env node',
      },
      //watch: watch,
      logLevel: 'info',
    })

    // Make the script executable
    execSync(`chmod +x bin/${packageName}`)

  } catch (error) {
    console.error('Build process failed:', error);
    process.exit(1);
  }
};

main();
