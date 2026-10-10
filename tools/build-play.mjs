// Builds play.html: the whole game (HTML, CSS, JS) in ONE file that opens by double-click, with no server and no install.
// Run `npm run build` after changing the game, then send play.html (or the folder).
import { build } from 'esbuild';
import fs from 'node:fs';

const js = (await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' })).outputFiles[0].text;
const css = fs.readFileSync('styles.css', 'utf8');
const fav = 'data:image/svg+xml;base64,' + fs.readFileSync('favicon.svg').toString('base64');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${fav}" type="image/svg+xml" />`);
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="src\/main\.js"><\/script>/, () => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (html.includes('src/main.js') || html.includes('styles.css')) throw new Error('build: something was not inlined');
fs.writeFileSync('play.html', html);
console.log(`play.html written: ${(html.length / 1024).toFixed(0)} KB`);
