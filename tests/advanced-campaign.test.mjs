import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import C from '../src/core.js';
import solutions from '../src/solutions.js';
import {FORMAL_INDEX} from '../src/levels.js';

const design=JSON.parse(readFileSync(new URL('../docs/levels-101-200-design.json',import.meta.url)));
for(const spec of design.levels.slice(0,7))test('正式第'+spec.level+'关满足配额、倒计时和爆裂顺序',()=>{
 const index=FORMAL_INDEX+spec.level-1,level=C.levels[index],state=C.make(index);
 const quota=Array(7).fill(0);
 for(const ring of state.rings)quota[state.rods.filter(z=>z.owner===ring.id).length]++;
 assert.equal(level.name,'第'+spec.level+'关');
 assert.equal(state.rings.length,109);
 assert.deepEqual(quota,spec.ownedClaspRingCounts);
 assert.equal(state.rods.filter(z=>z.kind==='b').length,spec.backgroundPieceCounts[0]);
 assert.equal(state.rings.filter(r=>r.burst).length,spec.burstOnly);
 assert.equal(!!level.timed,spec.timedChallenge);
 assert.equal(level.hintGraph.stages.length,solutions[index].length);
 if(level.timed)assert.equal(level.timed.durationSeconds,5*Math.ceil((3*solutions[index].length+20)/5));
});
