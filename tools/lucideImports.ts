// Importing each icon from its own file instead of from 'lucide-react'.
//
// The package's main entry also exports every icon as one namespace (`icons`),
// so a single `import { X } from 'lucide-react'` puts all ~1,650 icon modules
// into the build graph. Rollup drops the unused ones from the output, but it
// still loads and transforms every one first. That was most of the modules in
// the build and enough memory to push it past the 400 MB Render allows it
// (NODE_OPTIONS in render.yaml), at which point the deploy fails with "heap out
// of memory". Pointing each import at the icon's own file keeps only the icons
// actually used in the graph. Build only: the dev server pre-bundles the
// package, where this does not matter.

/** Every icon export name, mapped to the file it comes from, read from the package's own entry. */
export const parseIconMap = (barrelSource: string): Map<string, string> => {
  const map = new Map<string, string>();
  const reExport = /export\s*\{([^}]*)\}\s*from\s*['"]\.\/icons\/([^'"]+)['"]/g;
  for (const m of barrelSource.matchAll(reExport)) {
    for (const part of m[1].split(',')) {
      const alias = part.trim().match(/^default\s+as\s+([A-Za-z0-9_$]+)$/);
      if (alias) map.set(alias[1], m[2]);
    }
  }
  return map;
};

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])lucide-react\2\s*;?/g;

/**
 * `code` with every `import { … } from 'lucide-react'` split into one default
 * import per icon from its own file. Anything that is not an icon (a type such
 * as LucideProps) stays imported from the package as before. Null when there was
 * nothing to change. `import type { … }` lines are left alone: they are erased.
 */
export const rewriteLucideImports = (
  code: string,
  icons: Map<string, string>,
  base = 'lucide-react/dist/esm/icons/',
): string | null => {
  let changed = false;
  const out = code.replace(IMPORT, (whole, specifiers: string) => {
    const lines: string[] = [];
    const rest: string[] = [];
    for (const raw of specifiers.split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      if (/^type\s/.test(spec)) { rest.push(spec); continue; }
      const m = spec.match(/^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/);
      const file = m ? icons.get(m[1]) : undefined;
      if (m && file) lines.push(`import ${m[2] || m[1]} from '${base}${file}';`);
      else rest.push(spec);
    }
    if (lines.length === 0) return whole;
    changed = true;
    if (rest.length > 0) lines.push(`import { ${rest.join(', ')} } from 'lucide-react';`);
    return lines.join(' ');
  });
  return changed ? out : null;
};
