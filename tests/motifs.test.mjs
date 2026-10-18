import test from 'node:test';
import assert from 'node:assert/strict';
import Core from '../dist/js/core.js';
import seeds from '../dist/js/formal-templates.js';
import motifs from '../dist/js/formal-motifs.js';
import {campaignLayout} from '../dist/js/campaign-layout.js';

// Structural safeguards. Continuous collision and route correctness are
// checked separately by tests/full/campaign-route.test.mjs.
test('five offline motif families really change 89 campaign levels',()=>{
 assert.equal(Object.keys(motifs).length,89);
 assert.deepEqual([...new Set(Object.values(motifs).map(m=>m.family))].sort(),
  ['alternating','branch','focal','sparse','weave']);
 let cutMounts=0,baseMounts=0,cutPairs=0,basePairs=0;
 let changed=0,largeHubs=0,owners=0;
 for(let n=11;n<=100;n++){
  if(n===45)continue;
  const seed=seeds[n],mask=motifs[n],layout=campaignLayout(n+9);
  assert.ok(seed&&mask,n);
  const allMounts=seed.centers.flatMap(c=>layout.map((p,r)=>
   Math.abs(Math.hypot(layout[c].x-p.x,layout[c].y-p.y)-92.0001)<.01?[c,r]:null).filter(Boolean));
  assert.equal(mask.mounts.length,allMounts.length,n+' mount mask');
  assert.equal(mask.pairs.length,seed.pairs.length,n+' pair mask');
  assert.match(mask.mounts,/^[01]+$/);
  assert.match(mask.pairs,/^[01]+$/);
  const kept=allMounts.filter((_,i)=>mask.mounts[i]==='1');
  const pairs=seed.pairs.filter((_,i)=>mask.pairs[i]==='1');
  const level=Core.levels[n+9],state=Core.make(n+9);
  assert.equal(level.revision,2,n+' saved game revision');
  assert.equal(level.difficulty.motif,mask.family);
  assert.equal(state.rods.filter(r=>r.kind==='m').length,kept.length);
  assert.equal(state.rods.filter(r=>r.kind==='b').length,pairs.length);
  assert.equal(state.rods.length,kept.length+pairs.length);
  assert.ok(kept.length<allMounts.length,n+' must not reuse full hub neighborhood');
  const outDegree=seed.centers.map(c=>kept.filter(([owner])=>owner===c).length);
  largeHubs+=outDegree.filter(x=>x>=5).length;
  owners+=outDegree.length;
  assert.ok(outDegree.every(x=>x>=1),n+' orphan owner');
  const inDegree=new Map();
  for(const [,receiver] of kept)inDegree.set(receiver,(inDegree.get(receiver)||0)+1);
  assert.ok([...inDegree.values()].some(x=>x>=2),n+' lacks shared receiver');
  assert.ok(layout.every((_,i)=>seed.centers.includes(i)||inDegree.has(i)),n+' uncovered receiver');
  const degree=new Map();
  for(const [a,b] of pairs)for(const i of [a,b])degree.set(i,(degree.get(i)||0)+1);
  assert.ok([...degree.values()].every(v=>v<=1),n+' two fixed clasps on one gap');
  const holds=seed.centers.filter(c=>kept.filter(([a,b])=>a===c&&degree.has(b)).length>=2);
  assert.ok(holds.length>=2,n+' lost hold puzzles');
  assert.deepEqual(Core.validate(state),[],n+' initial physical geometry');
  assert.deepEqual(Core.settle(Core.clone(state)),[],n+' initial empty-clear');
  const seen=new Set([layout[0].id]);
  for(let pass=0;pass<layout.length;pass++)
   for(const rod of state.rods){
    const ids=rod.kind==='m'?[rod.owner,...rod.targets]:rod.targets;
    if(ids.some(id=>seen.has(id)))ids.forEach(id=>seen.add(id));
   }
  assert.equal(seen.size,layout.length,n+' disconnected board');
  cutMounts+=allMounts.length-kept.length;
  cutPairs+=seed.pairs.length-pairs.length;
  baseMounts+=allMounts.length;basePairs+=seed.pairs.length;changed++;
 }
 assert.equal(changed,89);
 assert.ok(cutMounts/baseMounts>.2,'activity diversity must remove at least 20% of repeated mounts');
 assert.ok(cutPairs/basePairs>.15,'fixed pairs need variant-dependent distribution');
 assert.ok(largeHubs/owners<.35,'five/six sleeve full-hub repetition stays too high');
});

test('intro and special 45 stay unchanged',()=>{
 assert.equal(motifs[1],undefined);
 assert.equal(motifs[45],undefined);
 assert.equal(Core.levels[10].revision,2);
 assert.equal(Core.make(10).rods.length,9);
 assert.equal(Core.make(54).rods.length,62);
 for(let n=2;n<=10;n++)assert.equal(Core.levels[n+9].revision,1);
});
