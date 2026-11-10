// Real Laya canvas QA for the non-publishable source-driven 107 prototype.
// The fixture is injected only in a browser test; it is never added to levels.js.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import Core from '../src/core.js';
import {buildLevel107GeometryCandidate} from '../src/level107-geometry-candidate.js';

const source=JSON.parse(await readFile(new URL('../docs/levels-101-200-level107-source.json',import.meta.url),'utf8')).levels[0];
const candidate=buildLevel107GeometryCandidate(source);
const sample=Core.levels.push(candidate.level)-1,state=Core.make(sample),moves=[];
const progressive=JSON.parse(await readFile(new URL('./results/level107-progressive-physical-route.json',import.meta.url),'utf8'));
assert.equal(progressive.fullRouteVerified,false,'candidate is not a published level');
assert.ok(progressive.removedCount>=44&&progressive.actions.length>=42);

for(const id of ['R005','R006']){
 const piece=state.rods.find(z=>z.id==='F003'),end=Core.endpoints(state,piece).find(e=>e.id===id);
 const r=Core.ring(state,id),delta=Core.diff(Core.angle(r,end.p),r.a),result=Core.request(state,id,delta);
 assert.equal(result.blocked,null);
 assert.ok(result.removed.includes(id));
 moves.push({id,delta:result.done});
}
Core.levels.pop();
const dir=resolve(process.env.JADE_DIST||'dist'),out=resolve(process.env.JADE_REPORT||'tests/results/level107-browser');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://local').pathname;
  const file=resolve(dir,'.'+decodeURIComponent(name==='/'?'/index.html':name));
  if(!file.startsWith(dir+sep))throw Error('unsafe path');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const results=[];
async function drag(page,action){
 const points=await page.evaluate(a=>{
  const {game:g,Core:C}=window.jadeDebug,ring=C.ring(g.model.state,a.id);
  const initial=ring.a+50,canvas=document.querySelector('canvas').getBoundingClientRect();
  const n=Math.max(2,Math.ceil(Math.abs(a.delta)/3));
  return Array.from({length:n+1},(_,i)=>{
   const p=g.board.toScreen(C.point(ring,initial+a.delta*i/n));
   return{x:canvas.left+p.x/g.scene.width*canvas.width,y:canvas.top+p.y/g.scene.height*canvas.height};
  });
 },action);
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
 for(const p of points.slice(1))await page.mouse.move(p.x,p.y);
 await page.mouse.up();
 await page.waitForFunction(()=>!window.jadeDebug.game.board?.animating,null,{timeout:15000});
}
try{
 for(const [width,height] of [[390,844],[360,640]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror '+e.message));
  page.on('requestfailed',r=>errors.push('requestfailed '+r.url()));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug=1');
  await page.waitForFunction(()=>!!window.jadeDebug?.game&&!document.querySelector('#boot'),null,{timeout:60000});
  const initial=await page.evaluate(level=>{
   const {game:g,Core:C}=window.jadeDebug;
   // Only for QA: the unverified prototype does not have a verified hint DAG.
   level.hintGraph={kind:'dependency',order:level.points.map(p=>p[0]),
    nodes:level.points.map(p=>({id:p[0],requires:[]}))};
   const index=C.levels.push(level)-1;
   g.load(index,true);
   return{index,active:g.model?.state.rings.filter(r=>r.life==='active').length,
    rods:g.model?.state.rods.length,errors:C.validate(g.model.state)};
  },candidate.level);
  assert.equal(initial.active,109);
  assert.equal(initial.rods,139);
  assert.deepEqual(initial.errors,[]);
  await page.screenshot({path:resolve(out,width+'x'+height+'-initial.png')});
  for(const action of moves)await drag(page,action);
  const final=await page.evaluate(()=>{
   const {game:g,Core:C}=window.jadeDebug,s=g.model.state;
   return{active:s.rings.filter(r=>r.life==='active').length,
    removed:s.rings.filter(r=>r.life==='removed').map(r=>r.id),
    backgroundF003Exists:C.exists(s,s.rods.find(z=>z.id==='F003')),steps:s.steps};
  });
  assert.ok(final.removed.includes('R005')&&final.removed.includes('R006'),'physical canvas gesture must release both rings');
  assert.equal(final.backgroundF003Exists,false,'background clasp must disappear as a whole');
  assert.equal(final.active,107);
  assert.equal(errors.length,0,errors.join(' | '));
  await page.screenshot({path:resolve(out,width+'x'+height+'-after-two-real-drags.png')});
  let extended=null;
  if(width===390){
   // Replay the complete 42-action no-tool engine route through true canvas
   // pointer events, rather than changing model angles directly in the browser.
   for(const [step,action] of progressive.actions.slice(2).entries()){
    await drag(page,{id:action.ringId,delta:action.delta});
    const current=await page.evaluate(()=>{
     const g=window.jadeDebug.game;
     return{remaining:g.model.state.rings.filter(r=>r.life==='active').length,
      removed:g.model.state.rings.filter(r=>r.life==='removed').map(r=>r.id)};
    });
    const removedExpected=new Set(progressive.actions.slice(0,step+3).flatMap(action=>action.removed)).size;
    assert.equal(current.remaining,109-removedExpected,'browser action '+(step+3)+' disagrees with verified engine replay');
   }
   extended=await page.evaluate(()=>{
    const {game:g,Core:C}=window.jadeDebug,s=g.model.state;
    return{active:s.rings.filter(r=>r.life==='active').length,
      removed:s.rings.filter(r=>r.life==='removed').length,
      visibleBackground:s.rods.filter(z=>z.kind==='b'&&C.exists(s,z)).map(z=>z.id),
      steps:s.steps};
   });
   assert.equal(extended.active,progressive.activeRemaining,'browser must agree with physical replay after 42 actions');
   assert.equal(extended.removed,progressive.removedCount);
   assert.deepEqual(extended.visibleBackground,['F001','F002']);
   await page.screenshot({path:resolve(out,width+'x'+height+'-after-42-real-drags.png')});
  }
  results.push({width,height,...initial,after:final,extended});
  await page.close();
 }
 const report={stage:'development_preview_42_real_drags',fullRouteVerified:false,moves,progressiveVerifiedActions:progressive.actions.length,results};
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('LEVEL107_BROWSER_CANDIDATE='+JSON.stringify({viewports:results.length,drags:moves.length,complete:false}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
