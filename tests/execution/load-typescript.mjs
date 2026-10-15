import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
/** Test-only loader: execute repository TypeScript without bundling Next.js. */
export function loadTypeScript(filename, overrides = {}, cache = new Map()) {
  const path = resolve(filename);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path,module);
  const compiled = ts.transpileModule(readFileSync(path,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  new Function('require','module','exports',compiled)(name => {
    if (name === 'server-only') return {};
    if (Object.hasOwn(overrides,name)) return overrides[name];
    if (name.startsWith('@/')) return loadTypeScript(resolve(name.slice(2)+'.ts'),overrides,cache);
    if (name.startsWith('.')) return loadTypeScript(resolve(dirname(path),name+'.ts'),overrides,cache);
    return require(name);
  },module,module.exports);
  return module.exports;
}
