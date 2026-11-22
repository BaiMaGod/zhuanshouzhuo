import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const out=resolve('tests/results/heart-links/browser');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.wav':'audio/wav','.mp3':'audio/mpeg'})[extname(path==='/'?'/index.html':path)]||'application/octet-stream');res.end(await readFile(resolve('dist','.'+(path==='/'?'/index.html':path))));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||chromium.executablePath(),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const report={errors:[],profiles:[]};
async function button(page,name){
 const p=await page.evaluate(name=>{const g=jadeDebug.game;const walk=(n,x=0,y=0,k=1)=>{if(!n.visible)return null;x+=n.x*k;y+=n.y*k;k*=n.scaleX;if(n.name===name||n.label?.text===name)return{x:x+n.width*k/2,y:y+n.height*k/2};for(let i=0;i<n.numChildren;i++){const p=walk(n.getChildAt(i),x,y,k);if(p)return p;}return null;};const p=walk(g.modalOpen?g.overlay:g.scene);if(!p)throw Error('Missing '+name);const box=document.querySelector('canvas').getBoundingClientRect();return{x:box.left+p.x/g.scene.width*box.width,y:box.top+p.y/g.scene.height*box.height};},name);
 await page.mouse.click(p.x,p.y);
}
try{
 for(const [width,height,quiet] of [[390,844,false],[360,640,true]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,recordVideo:{dir:out,size:{width,height}},reducedMotion:quiet?'reduce':'no-preference'});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+'/?debug');
  await p.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot')&&!document.querySelector('#splash'));
  // Fixture setup only; all removal, victory and restart go through real input.
  const index=await p.evaluate(()=>{const {Core:C,game:g}=jadeDebug;const h=92.0001;const index=C.levels.push({name:'连心玉镯样板',kind:'formal',revision:1,tip:'解开任意一只，触发整组连消',points:[['A',-h,0,150],['B',0,0,25],['C',h,0,25]],links:[['b','A','B'],['b','B','C']],special:{linked:true,rings:[{id:'B',attribute:'silk',silkLayers:2}],silkEdges:[{sourceId:'A',targetId:'B'},{sourceId:'C',targetId:'B'}]},hintGraph:{kind:'stages',stages:[{id:'S1',ringId:'A',targetAngle:0,requires:[]}]}})-1;g.load(index,true);return index;});
  await p.waitForTimeout(450);await p.screenshot({path:resolve(out,width+'-opening.png')});
  await p.waitForTimeout(1200);await p.screenshot({path:resolve(out,width+'-idle.png')});
  assert.equal(await p.evaluate(()=>jadeDebug.game.model.state.rings.every(r=>r.silkRemaining===0)),true);
  const points=await p.evaluate(()=>{const {game:g,Core:C}=jadeDebug,r=C.ring(g.model.state,'A'),box=document.querySelector('canvas').getBoundingClientRect();return Array.from({length:61},(_,i)=>{const q=g.board.toScreen(C.point(r,200-i*2.5));return{x:box.left+q.x/g.scene.width*box.width,y:box.top+q.y/g.scene.height*box.height};});});
  await p.mouse.move(points[0].x,points[0].y);await p.mouse.down();for(const q of points.slice(1)){await p.mouse.move(q.x,q.y);}
  await p.mouse.up();
  await p.waitForFunction(()=>jadeDebug.game.model.cleared,null,{timeout:5000});
  await p.screenshot({path:resolve(out,width+'-chain.png')});
  await p.waitForFunction(()=>jadeDebug.game.settled&&jadeDebug.game.modalOpen);
  await p.screenshot({path:resolve(out,width+'-win.png')});
  await button(p,'再挑战一次');
  await p.waitForFunction(index=>jadeDebug.game.model.index===index&&!jadeDebug.game.modalOpen&&jadeDebug.game.model.state.rings.every(r=>r.life==='active'),index);
  await p.evaluate(()=>jadeDebug.game.load(140,true));
  await p.waitForTimeout(1600);await p.screenshot({path:resolve(out,width+'-level131.png')});
  report.profiles.push({width,height,quiet,realDragCleared:true,restart:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
