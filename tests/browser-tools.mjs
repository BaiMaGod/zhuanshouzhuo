// Browser-only pixel regression: Node scene mocks cannot catch Laya/WebGL skin loss.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const dist=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const file=path==='/'?resolve(dist,'index.html'):resolve(dist,'.'+path);
  if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403).end();return}
  const bytes=await readFile(file);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(bytes);
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'
]});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/?debug';
 await page.goto(url);await page.waitForFunction(()=>!!window.jadeDebug?.game);
 await page.evaluate(()=>window.jadeDebug.game.load(10,true));
 const clickTool=async(kind)=>{const p=await page.evaluate(kind=>{const g=window.jadeDebug.game,b=kind==='hint'?g.hintButton:g.eraseButton,r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(b.x+b.width/2)*r.width/720,y:r.top+(b.y+b.height/2)*r.height/g.scene.height}},kind);await page.mouse.click(p.x,p.y)};
 await clickTool('hint');await page.waitForFunction(()=>!window.jadeDebug.game.busy);
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.hintLeft),0);
 await clickTool('hint');assert.equal(await page.evaluate(()=>window.jadeDebug.game.eraseTip.text),'本关提示已用完');
 assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('erase')),0);
  await page.evaluate(()=>{const g=window.jadeDebug.game;g.save.claim(10,'erase');g.syncTools()});
  await clickTool('erase');await clickTool('erase');assert.equal(await page.evaluate(()=>window.jadeDebug.game.toolLeft('erase')),1);
 await clickTool('erase');await page.evaluate(()=>{const g=window.jadeDebug.game;g.chooseEraseTarget(g.model.state.rings.find(r=>r.life==='active').id)});
 const pt=await page.evaluate(()=>{const g=window.jadeDebug.game,b=g.modalCard.children.find(n=>n.label?.text==='确认消除'),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(g.modalCard.x+b.x+b.width/2)*r.width/720,y:r.top+(g.modalCard.y+b.y+b.height/2)*r.height/g.scene.height}});
 await page.mouse.click(pt.x,pt.y);assert.equal(await page.evaluate(()=>window.jadeDebug.game.eraseLeft),0);
 await page.reload();await page.waitForFunction(()=>!!window.jadeDebug?.game);await page.evaluate(()=>window.jadeDebug.game.load(10));
 assert.deepEqual(await page.evaluate(()=>[window.jadeDebug.game.hintLeft,window.jadeDebug.game.eraseLeft]),[0,0]);
 await page.evaluate(()=>window.jadeDebug.game.load(10,true));assert.deepEqual(await page.evaluate(()=>[window.jadeDebug.game.hintLeft,window.jadeDebug.game.eraseLeft]),[1,0]);
 assert.deepEqual(errors,[]);console.log('Real WebGL tool clicks, confirmation, refresh and restart passed');
 await page.close();
}finally{
 await browser.close();
 await new Promise(r=>server.close(r));
}

