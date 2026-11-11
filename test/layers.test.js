import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Layers from the inside out. A file may only import from its own layer or one further in.
const LAYERS = ['domain', 'application', 'infrastructure', 'host'];
const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function importsOf(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);
}

test('every import points inward: domain <- application <- infrastructure <- host', () => {
  const problems = [];
  for (const [rank, layer] of LAYERS.entries()) {
    for (const name of readdirSync(join(SRC, layer))) {
      for (const spec of importsOf(join(SRC, layer, name))) {
        const target = spec.startsWith('./') ? layer : spec.split('/')[1];
        if (LAYERS.indexOf(target) > rank) {
          problems.push(`${layer}/${name} imports outward from ${target}: ${spec}`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});
