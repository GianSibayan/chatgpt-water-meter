import { build, context } from 'esbuild';

const entries = {
  'background.js': 'src/background.js',
  'content-script.js': 'src/content-script.js',
  'popup.js': 'src/popup.js',
};

const watch = process.argv.includes('--watch');

for (const [outfile, entryPoint] of Object.entries(entries)) {
  const options = {
    entryPoints: [entryPoint],
    bundle: true,
    outfile,
    format: 'iife',
    target: 'chrome110',
    minify: !watch,
    logLevel: 'info',
  };
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    await build(options);
  }
}

if (watch) console.log('Watching for changes... (reload the extension in chrome://extensions after each build)');
