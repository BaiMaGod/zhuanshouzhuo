// Visual fixtures only; real touch gameplay is exercised by browser-input.mjs.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
const out=process.env.JADE_REPORT||'tests/results/images';await mkdir(out,{recursive:true});
const root=resolve(process.env.JADE_DIST||'dist');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local'),file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+sep))throw Error('path');
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.wav':'audio/wav'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const report=[];
try{
 for(const [width,height] of [[390,844],[1280,720]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.goto((process.env.JADE_URL||'http://127.0.0.1:'+server.address().port+'/')+'?debug');
  await page.waitForFunction(()=>window.jadeDebug?.game&&!document.querySelector('#boot'));
  const shot=async name=>{await page.waitForTimeout(250);await page.mouse.move(0,0);await page.screenshot({path:`${out}/${width}-${name}.png`})};
  await shot('tutorial');
  async function click(label){
   const p=await page.evaluate(label=>{
    const g=jadeDebug.game;function find(n){if(n.visible===false)return null;if(n.name===label||n.label?.text===label)return n;for(let i=0;i<n.numChildren;i++){const b=find(n.getChildAt(i));if(b)return b}return null}
    const b=find(g.modalOpen?g.overlay:g.scene);if(!b)throw Error(label);
    const p=b.localToGlobal(new Laya.Point(b.width/2,b.height/2)),box=document.querySelector('canvas').getBoundingClientRect();
    return {x:box.left+p.x/Laya.stage.width*box.width,y:box.top+p.y/Laya.stage.height*box.height};
   },label);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);
  }
  await click('button:home');await shot('home');await click('第1关');await shot('formal1');
  for(let i=0;i<12;i++)await click('+');
  assert.ok(await page.evaluate(()=>Math.abs(jadeDebug.game.board.zoom-3.4)<1e-6));await shot('maximum-zoom');
  await click('全盘');await click('提示 ×1');await shot('hint');
  // A fixed high-density visual fixture; this does not count as a gameplay pass.
  await page.evaluate(()=>jadeDebug.game.load(109,true));await shot('formal100');
  const memory=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/assets\/.*\.(png|jpg)/.test(r.name)).reduce((n,r)=>n+r.decodedBodySize,0));
  assert.deepEqual(errors,[]);report.push({width,height,errors,downloadedImageBytes:memory});await page.close();
 }
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();server.close()}
