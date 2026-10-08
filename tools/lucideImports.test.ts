import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseIconMap, rewriteLucideImports } from './lucideImports';

const barrel = `
import * as index from './icons/index.js';
export { index as icons };
export { default as Edit3, default as Edit3Icon, default as PenLine } from './icons/pen-line.js';
export { default as Dumbbell, default as DumbbellIcon } from './icons/dumbbell.js';
export { default as createLucideIcon } from './createLucideIcon.js';
`;
const icons = parseIconMap(barrel);

describe('reading the icon names from the package entry', () => {
  it('maps every name an icon goes by to its file', () => {
    expect(icons.get('Edit3')).toBe('pen-line.js');
    expect(icons.get('PenLine')).toBe('pen-line.js');
    expect(icons.get('DumbbellIcon')).toBe('dumbbell.js');
  });

  it('leaves out what is not an icon', () => {
    expect(icons.has('createLucideIcon')).toBe(false);
    expect(icons.has('icons')).toBe(false);
  });
});

describe('rewriting the imports', () => {
  it('imports each icon from its own file', () => {
    expect(rewriteLucideImports(`import { Edit3, Dumbbell } from 'lucide-react';\nfoo();`, icons)).toBe(
      `import Edit3 from 'lucide-react/dist/esm/icons/pen-line.js'; import Dumbbell from 'lucide-react/dist/esm/icons/dumbbell.js';\nfoo();`,
    );
  });

  it('keeps a renamed import\'s local name', () => {
    expect(rewriteLucideImports(`import { Dumbbell as Weights } from "lucide-react"`, icons)).toBe(
      `import Weights from 'lucide-react/dist/esm/icons/dumbbell.js';`,
    );
  });

  it('keeps what is not an icon imported from the package', () => {
    expect(rewriteLucideImports(`import {\n  Dumbbell,\n  LucideProps,\n} from 'lucide-react';`, icons)).toBe(
      `import Dumbbell from 'lucide-react/dist/esm/icons/dumbbell.js'; import { LucideProps } from 'lucide-react';`,
    );
    expect(rewriteLucideImports(`import { Dumbbell, type LucideProps } from 'lucide-react';`, icons)).toBe(
      `import Dumbbell from 'lucide-react/dist/esm/icons/dumbbell.js'; import { type LucideProps } from 'lucide-react';`,
    );
  });

  it('changes nothing when there is nothing to change', () => {
    expect(rewriteLucideImports(`import type { LucideProps } from 'lucide-react';`, icons)).toBeNull();
    expect(rewriteLucideImports(`import { LucideProps } from 'lucide-react';`, icons)).toBeNull();
    expect(rewriteLucideImports(`import { useState } from 'react';`, icons)).toBeNull();
    expect(rewriteLucideImports(`import { Dumbbell } from 'lucide-react-native';`, icons)).toBeNull();
  });
});

// Every icon this app imports has to be found, or the build quietly falls back to
// pulling the whole package in again.
describe('the icons this app uses', () => {
  const root = path.resolve(__dirname, '..');
  const real = parseIconMap(fs.readFileSync(path.join(root, 'node_modules/lucide-react/dist/esm/lucide-react.js'), 'utf8'));
  const sources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? sources(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(dir, e.name)] : []);

  it('are all real icons in the installed package', () => {
    const files = [path.join(root, 'App.tsx'), ...['components', 'utils', 'services'].flatMap(d => sources(path.join(root, d)))];
    const missing: string[] = [];
    let seen = 0;
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');
      for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
        for (const spec of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
          const name = spec.split(/\s+as\s+/)[0];
          if (name === 'LucideProps' || name.startsWith('type ')) continue;
          seen++;
          if (!real.has(name)) missing.push(`${path.relative(root, file)}: ${name}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });
});
