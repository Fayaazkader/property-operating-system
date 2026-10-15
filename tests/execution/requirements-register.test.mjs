import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('docs/requirements/source-20260930.md','utf8');
const register=readFileSync('docs/ASSETFLOW_REQUIREMENTS.md','utf8');
test('master register preserves all 221 original IDs and exact requirement titles',()=>{
  const original=[...source.matchAll(/^\| (\d+) \| (.*?) \| (.*?) \|$/gm)];
  const imported=[...register.matchAll(/^\| (\d+) \| ([^|]+) \| (.*?) \|/gm)];
  assert.equal(original.length,221);assert.equal(imported.length,221);
  assert.deepEqual(imported.map(m=>[Number(m[1]),m[3]]),original.map(m=>[Number(m[1]),m[2]]));
  assert.deepEqual(imported.map(m=>Number(m[1])),Array.from({length:221},(_,i)=>i+1));
});
test('additions and source follow-ups have separate stable namespaces',()=>{
  const ids=[...register.matchAll(/^\| (AF-(?:ADD|SOURCE)-\d+) \|/gm)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);assert.equal(ids.filter(id=>id.startsWith('AF-ADD')).length,32);
  assert.equal(ids.filter(id=>id.startsWith('AF-SOURCE')).length,58);
  assert.match(register,/not fully reconciled/);assert.match(register,/FLO.*original intended definition/);
});
