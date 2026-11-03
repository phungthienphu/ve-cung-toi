import assert from 'node:assert/strict';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import glob from 'fast-glob';
import selectorParser from 'postcss-selector-parser';
import config from '../tailwind.config';

async function main() {
  // Moving a component outside Tailwind's content globs silently drops its CSS,
  // even when both TypeScript and the Next production build succeed.
  const content = Array.isArray(config.content) ? config.content : config.content.files;
  const scanned = new Set(await glob(content.filter((entry): entry is string => typeof entry === 'string'), { absolute: true }));
  const components = await glob('src/features/**/*.tsx');
  for (const file of components) assert.ok(scanned.has(path.resolve(file)), `Tailwind must scan ${file}`);

  const css = await postcss([tailwindcss(config)]).process('@tailwind utilities;', { from: undefined });
  const classes = new Set<string>();
  css.root.walkRules(rule => {
    selectorParser(selectors => selectors.walkClasses(node => { classes.add(node.value); })).processSync(rule.selector);
  });
  for (const className of [
    'fixed', 'inset-0', 'h-full', 'min-h-0', 'overflow-hidden',
    'lg:grid-cols-[minmax(0,1fr)_320px]',
    'sm:w-[23rem]', 'sm:inset-x-auto', 'sm:top-16',
    'max-h-[62vh]', 'landscape:grid-cols-2',
  ]) assert.ok(classes.has(className), `Missing game layout CSS: ${className}`);
  console.log(`CSS layout passed: all ${components.length} feature components scanned; fullscreen, panels and responsive game grids generated.`);
}
void main();
