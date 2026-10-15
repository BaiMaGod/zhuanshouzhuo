import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
const h=installHarness();
await import('../dist/js/main.js');
await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game,C=window.jadeDebug.Core;
g.audio.enabled=false;
test('正式场景导航、点击只选中、真实手势路径与逐关解锁',()=>{
 assert.equal(g.mode,'home');g.load(1);assert.equal(g.mode,'home','未解锁不能直接进入');
 g.load(0);assert.equal(g.mode,'game');assert.equal(g.modalOpen,false);assert.ok(g.guide,'New player gets in-board coach without a blocking modal');
 const ring=C.ring(g.model.state,'B'),startAngle=ring.a,p=g.board.toScreen(C.point(ring,70));
 const event=(q)=>({clientX:q.x/2,clientY:q.y/2,pointerId:8});
 g.down(event(p));g.up(event(p));assert.equal(ring.a,startAngle);assert.equal(g.model.state.steps,0);
 // Sweep on the actual ring hit area through the same controller used by pointers.
 g.down(event(p));
 for(let a=75;a<=185;a+=5)g.move(event(g.board.toScreen(C.point(ring,a))));
 g.up(event(p));
 assert.ok(g.model.cleared);assert.equal(g.model.state.steps,1);
 for(let i=0;i<25;i++)h.tick();
 assert.equal(g.save.data.unlocked,1);assert.ok(g.modalOpen);assert.ok(g.settled);
});
test('取消、重开与撤销解除指针捕获，恢复完整场景',()=>{
 g.load(1);const r=C.ring(g.model.state,'B'),p=g.board.toScreen(C.point(r,290));
 const e={clientX:p.x/2,clientY:p.y/2,pointerId:9};
 g.down(e);assert.equal(h.canvas.captured,9);g.cancel();assert.equal(g.drag,null);assert.equal(h.canvas.captured,null);
 g.manual(30);assert.ok(g.model.history.length);g.undo();
 assert.equal(g.model.state.steps,0);assert.deepEqual(C.validate(g.model.state),[]);
 g.load(1);assert.equal(g.busy,false);assert.equal(g.drag,null);
});
test('演示实际调用逐帧正常旋转入口，完成后才能结算',async()=>{
 g.load(1);await g.automatic(true);h.tick();
 assert.ok(g.model.cleared);assert.equal(g.busy,false);assert.ok(g.settled);
 assert.equal(g.save.data.unlocked,2);assert.equal(g.model.state.steps,2);
});
test('全屏板内缩放和输入坐标互逆',()=>{
 g.save.data.unlocked=9;
 for(let i=0;i<10;i++){
  g.load(i);
  for(const r of g.model.state.rings){
   const p=g.board.toScreen(r),q=g.board.toWorld(p);
   assert.ok(Math.abs(q.x-r.x)<1e-7&&Math.abs(q.y-r.y)<1e-7);
   assert.ok(p.x>30&&p.x<690&&p.y>235&&p.y<950);
  }
 }
});

test('新手引导跟随真实选择，可跳过/重学且保存标记不覆盖通关记录',()=>{
 g.load(0);g.startGuide();assert.equal(g.modalOpen,false);assert.equal(g.guide.phase,'choose');
 g.guideSelect('A');assert.equal(g.guide.phase,'choose');
 g.guideSelect('B');assert.equal(g.guide.phase,'turn');
 g.stopGuide(true);assert.equal(g.guide,null);assert.ok(g.save.data.tutorial>=1);
 const record=JSON.stringify(g.save.data.records);g.practice();assert.ok(g.guide);assert.equal(g.model.index,0);
 assert.equal(JSON.stringify(g.save.data.records),record);
 g.stopGuide(false);g.home();assert.equal(g.mode,'home');assert.equal(g.guide,null);
 g.settings();assert.equal(g.modalOpen,true);g.hideModal();assert.equal(g.modalOpen,false);
});

test('首页只保留主标题和操作入口，设置弹窗关闭后按钮可反复使用',()=>{
 g.home();
 const texts=[];function collect(node){if(typeof node.text==='string')texts.push(node.text);if(node.label?.text)texts.push(node.label.text);for(const child of node.children)collect(child)}
 collect(g.scene);
 for(const slogan of ['玉  环  十  境','玉环十境','转一转，环环相扣','一扣入门 · 十境解谜','正式关卡 · 54 镯 · 超级困难','不限时，慢慢解','继续解镯'])assert.ok(!texts.some(s=>s.includes(slogan)),slogan+' 应从首页消失');
 assert.ok(texts.includes('转手镯消除'));
 const settings=g.scene.children.find(n=>n.name==='button:settings');
 assert.ok(settings);const overlay=g.overlay;
 for(let n=0;n<3;n++){
  settings.click();assert.equal(g.modalOpen,true);
  assert.ok(g.modalCard?.parent===overlay);
  assert.equal(g.modalCard.cacheAs,'none','含互动按钮的设置弹窗不能缓存成位图');
  const card=g.modalCard,shade=g.modalShade;
  const close=card.children.find(node=>node.label?.text==='关闭');
  assert.ok(close);close.click();assert.equal(g.modalOpen,false);
  assert.equal(g.overlay,overlay,'关闭设置不能销毁或换掉常驻弹窗容器');
  assert.equal(settings.parent,g.scene,'关闭设置不能移除首页设置按钮');
  assert.ok(g.scene.children.includes(settings));
  assert.equal(settings.visible,true,'设置按钮关闭弹窗后必须可见');
  assert.equal(settings.alpha,1,'设置按钮关闭弹窗后不能透明');
  assert.equal(settings.enabled,true);
  assert.equal(card.visible,false,'弹窗在当前点击事件内先隐藏');
  assert.equal(shade.visible,false,'遮罩在当前点击事件内先隐藏');
  assert.equal(card.parent,overlay,'弹窗不在点击事件内销毁，避免 Laya 点击状态异常');
  h.tick();
  assert.equal(card.parent,null,'下一帧移除关闭的弹窗');
  assert.equal(shade.parent,null,'下一帧移除关闭的遮罩');
 }
 settings.click();const sound=g.modalCard.children.find(node=>node.label?.text?.startsWith('音效 '));
 assert.ok(sound);const before=g.audio.enabled;sound.click();
 assert.equal(g.audio.enabled,!before);assert.equal(g.modalOpen,true);
 g.modalCard.children.find(node=>node.label?.text==='关闭').click();
 assert.equal(settings.parent,g.scene);
});

test('首页不显示继续解镯按钮，主按钮点击与禁用状态正常',()=>{
 g.home();const labels=g.scene.children.map(n=>n.label?.text);
 assert.ok(!labels.includes('继续解镯'));
 assert.ok(!labels.includes('开始解镯'));
 const b=g.scene.children.find(n=>n.label?.text==='第1关');
 assert.ok(b);for(const f of b.events.mousedown)f();assert.equal(b.skin.y,0);assert.equal(b.pressedCover.visible,true);
 for(const f of b.events.mouseout)f();assert.equal(b.skin.y,0);assert.equal(b.pressedCover.visible,false);
 b.enabled=false;assert.equal(b.disabledCover.visible,true);assert.equal(b.alpha,1);b.click();assert.equal(g.mode,'home');
 b.enabled=true;b.click();assert.equal(g.mode,'game');assert.ok(g.formal);
});


test('正式关独立开放且没有微调、演示，双指缩放不旋转玉镯',()=>{
 g.save.data.unlocked=0;g.home();g.load(10);assert.equal(g.model.index,10);assert.equal(g.controls.length,0);assert.equal(g.demoButton,null);assert.equal(g.guide,null);
 const before=C.clone(g.model.state),board=g.board,mid={x:board.rect.x+board.rect.w/2,y:board.rect.y+board.rect.h/2},event=(x,y,id)=>({clientX:x/2,clientY:y/2,pointerId:id,button:0});
 g.down(event(mid.x-50,mid.y,31));g.down(event(mid.x+50,mid.y,32));g.move(event(mid.x-100,mid.y,31));g.move(event(mid.x+100,mid.y,32));
 assert.ok(board.zoom>board.fitZoom*1.9);assert.deepEqual(g.model.state,before);assert.equal(g.drag,null);
 g.up(event(mid.x+100,mid.y,32));g.move(event(mid.x-90,mid.y+30,31));assert.deepEqual(g.model.state,before,'remaining pinch finger cannot accidentally rotate');g.up(event(mid.x-90,mid.y+30,31));assert.equal(g.viewGesture,null);
 g.panMode=true;const screen={...board.screen};g.down(event(mid.x,mid.y,33));g.move(event(mid.x+60,mid.y+40,33));g.up(event(mid.x+60,mid.y+40,33));assert.ok(board.screen.x!==screen.x||board.screen.y!==screen.y);assert.deepEqual(g.model.state,before);
 for(const r of g.model.state.rings){const q=board.toWorld(board.toScreen(r));assert.ok(Math.abs(q.x-r.x)<1e-7&&Math.abs(q.y-r.y)<1e-7)}
 g.manual(30);assert.deepEqual(g.model.state,before);g.releasePointers();board.resetView();assert.equal(board.zoom,board.fitZoom);g.load(10);assert.equal(g.panMode,false);assert.equal(g.pointers.size,0);
});


test('所有关卡没有旋转按钮、撤销、选中圆圈，正式关可用手势完整拆解',async()=>{
 const route=(await import('../dist/js/solutions.js')).default[LEGACY_FORMAL_INDEX];
 for(const i of [0,1,10]){g.load(i);const labels=[];function walk(n){if(n.label)labels.push(n.label.text);for(const c of n.children)walk(c)}walk(g.scene);for(const label of ['旋转手镯','移动棋盘','撤销','↶ 30°','30° ↷','↶ 微调','微调 ↷','演示'])assert.ok(!labels.includes(label));assert.equal(g.undoButton,null);for(const v of g.board.rings.values())assert.equal(v.halo.graphics.ops.length,0);}
 g.load(LEGACY_FORMAL_INDEX);const b=g.board;
 for(const a of route){const r=C.ring(g.model.state,a.id);b.zoomTo(b.fitZoom*3,{x:360,y:500});const delta=C.rot({x:r.x-b.center.x,y:r.y-b.center.y},b.turn);b.panTo({x:360-delta.x*b.zoom,y:500-delta.y*b.zoom});const start=r.a+50,event=q=>({clientX:q.x/2,clientY:q.y/2,pointerId:88,button:0});const first=b.toScreen(C.point(r,start));g.down(event(first));assert.equal(g.drag?.id,a.id);const n=Math.ceil(Math.abs(a.delta)/4);for(let k=1;k<=n;k++)g.move(event(b.toScreen(C.point(r,start+a.delta*k/n))));g.up(event(first));for(let k=0;k<40;k++)h.tick();assert.ok(!b.animating);for(const v of b.rings.values())assert.equal(v.halo.graphics.ops.length,0);}
 assert.ok(g.model.cleared);assert.ok(g.settled);assert.equal(g.model.state.steps,route.length);g.load(LEGACY_FORMAL_INDEX);assert.equal(g.model.state.rings.filter(r=>r.life==='active').length,54);
});

test('正式关复用首页背景图，但不会随玉盘一起缩放或覆盖手镯',()=>{
 const art='assets/art-rose/home-bg.jpg';
 g.home();
 assert.ok(g.scene.children.some(n=>n.graphics.ops.some(op=>op[0]==='image'&&op[1]===art)),'首页素材可用');
 g.load(10);
 const wallpaper=g.root.children.find(n=>n.name==='formal-wallpaper');
 assert.ok(wallpaper,'正式关加入首页背景图');
 assert.ok(wallpaper.graphics.ops.some(op=>op[0]==='image'&&op[1]===art));
 assert.equal(wallpaper.parent,g.root,'背景位于游戏场景外，绝不参与玉盘场景缓存');
 assert.equal(g.scene.parent,g.root,'游戏场景与壁纸为同一根节点的独立图层');
 assert.ok(wallpaper.zOrder<g.scene.zOrder,'固定背景始终绘制在玉盘场景下面');
 assert.ok(!g.board.backdrop.children.includes(wallpaper),'装饰底图不参与玉盘相机缩放');
 const tray=g.board.backdrop.children.find(n=>n.name==='board-tray');
 assert.ok(tray,'原有玉盘精灵必须保留');
 assert.equal(tray.parent,g.board.backdrop,'玉盘留在与手镯同步的相机层');
 assert.ok(tray.graphics.ops.some(op=>op[0]==='image'&&op[1]==='assets/art-rose/tray.png'),'玉盘依旧渲染原有珍珠白淡粉PNG');
 assert.equal(g.board.backdrop.parent,g.scene,'玉盘相机仍在墙纸上层');
 const original=[wallpaper.x,wallpaper.y,wallpaper.scaleX,wallpaper.scaleY,wallpaper.rotation];
 g.board.zoomTo(g.board.fitZoom*2,{x:360,y:500});
 g.board.panTo({x:400,y:560});
 assert.deepEqual([wallpaper.x,wallpaper.y,wallpaper.scaleX,wallpaper.scaleY,wallpaper.rotation],original);
 assert.equal(wallpaper.parent,g.root);
 g.load(10);
 assert.equal(g.root.children.filter(n=>n.name==='formal-wallpaper').length,1,'重开正式关不重复叠放壁纸');
 assert.equal(g.board.backdrop.children.filter(n=>n.name==='board-tray').length,1,'重开后只有一张玉盘');
 g.load(0);
 assert.equal(wallpaper.parent,null,'退出关卡后销毁旧背景');
 assert.ok(!g.root.children.some(n=>n.name==='formal-wallpaper'),'教学场景沿用纯色背景');
});

test('花园、玉盘与玉镯共用视角，缩放平移和撤销不会改变背景上的镯位',()=>{
 g.load(LEGACY_FORMAL_INDEX);const b=g.board,bg=b.backdrop,art=[...bg.children];
 assert.equal(art.length,2);assert.equal(art[0].name,'board-garden');assert.equal(art[1].name,'board-tray');
 const registered=art.map(n=>({x:n.x,y:n.y,scale:n.scaleX,rotation:n.rotation}));
 const check=()=>{assert.equal(bg.x,b.root.x+b.rect.x);assert.equal(bg.y,b.root.y+b.rect.y);assert.equal(bg.scaleX,b.root.scaleX);assert.equal(bg.scaleY,b.root.scaleY);assert.equal(bg.rotation,b.root.rotation);assert.deepEqual(art.map(n=>({x:n.x,y:n.y,scale:n.scaleX,rotation:n.rotation})),registered)};
 check();b.zoomTo(b.fitZoom*3,{x:200,y:400});check();b.panTo({x:440,y:550});check();
 g.model.begin();g.perform('9E',5);g.undo();check();b.resetView();check();
 g.home();assert.equal(bg.parent,null,'Background camera is destroyed when leaving play');
});

test('正式提示只显示方向手指，不改步数或扣位；跟随视角且拖动和重开清理',async()=>{
 g.load(LEGACY_FORMAL_INDEX);const before=C.clone(g.model.state);
 await g.hint();assert.ok(g.guide?.action);assert.equal(g.guide.id,'9D');
 assert.equal(g.modalOpen,false);assert.deepEqual(g.model.state,before);
 for(let k=0;k<10;k++)h.tick();assert.equal(g.guide.hand.visible,true);
 const x=g.guide.hand.x;g.board.zoomTo(g.board.fitZoom*2,{x:360,y:600});
 for(let k=0;k<10;k++)h.tick();assert.notEqual(g.guide.hand.x,x);
 assert.deepEqual(g.model.state,before);
 const r=C.ring(g.model.state,g.guide.id),p=g.board.toScreen(C.point(r,r.a+50));
 g.board.panTo({x:360-(r.x-g.board.center.x)*g.board.zoom,y:600-(r.y-g.board.center.y)*g.board.zoom});
 const q=g.board.toScreen(C.point(r,r.a+50));g.down({clientX:q.x/2,clientY:q.y/2,pointerId:94,button:0});
 assert.equal(g.guide,null);g.releasePointers();g.load(10);assert.equal(g.guide,null);assert.equal(g.model.state.steps,0);
});

test('新手练习可返回首页，图谱只列正式关卡并统一编号',()=>{
 g.home();g.practice();assert.equal(g.model.index,0);
 const home=g.scene.children.find(n=>n.name==='button:home');assert.ok(home,'教学界面有首页图标');
 home.click();assert.equal(g.mode,'home');
 const homeLabels=[];function labels(n,into){if(n.text)into.push(n.text);if(n.label?.text)into.push(n.label.text);for(const c of n.children)labels(c,into)}
 labels(g.scene,homeLabels);assert.ok(homeLabels.includes('第1关'));assert.ok(!homeLabels.some(x=>x.includes('九宫锁玉阵')));
 g.levels();assert.equal(g.mode,'levels');const pageLabels=[];labels(g.scene,pageLabels);
 assert.ok(pageLabels.includes('第1关'));assert.ok(!pageLabels.some(x=>x.includes('初识双镯')||x.includes('教学十关')||x.includes('九宫锁玉阵')));
 assert.equal(g.scene.children.filter(n=>n.name?.startsWith('formal-level:')).length,8);
 const formal=g.scene.children.find(n=>n.name==='formal-level:1');assert.ok(formal);formal.click();
 assert.equal(g.model.index,10);assert.equal(g.formal,true);
});

test('教学顶部进入独立教程关卡，图文按钮对齐且玉盘上方有操作气泡',()=>{
 g.load(0);
 const nav=g.scene.children.find(n=>n.name==='button:teaching-levels');
 assert.ok(nav);assert.equal(nav.label.text,'教程关卡');
 for(const b of [nav,g.scene.children.find(n=>n.name==='button:sound'),g.scene.children.find(n=>n.name==='button:help')]){
  assert.ok(b);
  assert.ok(Math.abs((b.iconSprite.y+13)-(b.label.y+b.label.height/2))<1,'图标与文字共用垂直中线');
  assert.ok(b.iconSprite.x+26<b.label.x,'图标在文字左侧且无重叠');
 }
 const words=[];const walk=n=>{if(typeof n.text==='string')words.push(n.text);for(const c of n.children)walk(c)};walk(g.scene);
 assert.ok(words.includes('手指按住玉镯转动，让玉镯缺口对准锁扣'));
 assert.ok(!words.some(v=>v.includes('拖动环体旋转')||v.includes('用手指沿玉镯拖动')));
 assert.ok(g.scene.children.some(n=>n.name==='tutorial-instruction'));
 assert.ok(g.board.rect.h>690,'教程盘面应向下延展');
 nav.click();assert.equal(g.mode,'levels');assert.equal(g.scene.children.filter(n=>n.name?.startsWith('teaching-level:')).length,10);
 const first=g.scene.children.find(n=>n.name==='teaching-level:1');
 assert.ok(first?.enabled);first.click();assert.equal(g.model.index,0);
});
test('教程提示在盘面绘制手指和正确转动方向，不弹窗也不修改关卡',async()=>{
 g.load(0);const before=C.clone(g.model.state);
 await g.hint();assert.equal(g.modalOpen,false);
 assert.ok(g.guide?.action,'教程提示使用带合法旋转动作的引导手');
 assert.equal(g.guide.phase,'turn');assert.equal(g.guide.id,'B');
 for(let i=0;i<8;i++)h.tick();
 assert.equal(g.guide.hand.visible,true);
 assert.deepEqual(g.model.state,before);
 assert.equal(g.hintButton?.label.text,'提示');
 g.load(0);assert.equal(g.guide?.action,undefined,'重开后清理手指提示');
});

test('正式关音效与玩法按钮反复点击不消失，提示按钮保留完整背景',async()=>{
 g.load(10);
 const sound=g.scene.children.find(n=>n.name==='button:sound');
 const help=g.scene.children.find(n=>n.name==='button:help');
 const hint=g.hintButton;
 for(const button of [sound,help,hint]){
  assert.ok(button,'正式关按钮存在');
  assert.equal(button.skin.cacheAs,'none','按钮皮肤不能使用易丢失的位图缓存');
  assert.ok(button.skin.graphics.ops.length>0,'按钮拥有背景绘制指令');
 }
 assert.equal(g.scene.cacheAs,'none','正式关按钮不应被整个场景缓存');
 const initial=g.audio.enabled;
 sound.click();
 assert.equal(g.audio.enabled,!initial);
 assert.equal(sound.parent,g.scene);
 assert.equal(sound.visible,true);
 assert.ok(sound.skin.graphics.ops.length);
 help.click();
 assert.equal(g.modalOpen,true);
 const close=g.modalCard.children.find(node=>node.label?.text==='继续拆解');
 assert.ok(close);close.click();
 h.tick();
 for(const button of [sound,help]){
  assert.equal(button.parent,g.scene);
  assert.equal(button.visible,true);
  assert.equal(button.alpha,1);
  assert.ok(button.skin.graphics.ops.length);
 }
 await g.hint();
 assert.equal(hint.parent,g.scene);
 assert.equal(hint.visible,true);
 assert.ok(hint.skin.graphics.ops.length,'提示结束后背景不消失');
 assert.equal(hint.skin.cacheAs,'none');
 assert.equal(g.modalOpen,false,'提示应出现手指而不是遮挡弹窗');
});

test('正式关返回和重开都必须二次确认，取消不会损失进度',()=>{
 g.load(10);
 const home=g.scene.children.find(n=>n.name==='button:home');
 const restart=g.scene.children.find(n=>n.name==='button:restart');
 assert.ok(home&&restart);
 g.model.begin();const steps=g.model.state.steps;
 home.click();
 assert.equal(g.mode,'game');
 assert.equal(g.modalOpen,true);
 assert.ok(g.modalCard.children.some(n=>n.label?.text==='确认返回'));
 g.modalCard.children.find(n=>n.label?.text==='继续解镯').click();
 assert.equal(g.mode,'game');assert.equal(g.model.state.steps,steps);
 restart.click();
 assert.equal(g.mode,'game');
 assert.equal(g.modalOpen,true);
 assert.ok(g.modalCard.children.some(n=>n.label?.text==='确认重开'));
 g.modalCard.children.find(n=>n.label?.text==='继续解镯').click();
 assert.equal(g.model.state.steps,steps);
 restart.click();
 g.modalCard.children.find(n=>n.label?.text==='确认重开').click();
 assert.equal(g.mode,'game');
 assert.equal(g.model.state.steps,0);
 const homeAgain=g.scene.children.find(n=>n.name==='button:home');
 homeAgain.click();g.modalCard.children.find(n=>n.label?.text==='确认返回').click();
 assert.equal(g.mode,'home');
});

test('正式关消除道具选定手镯后确认生效，取消不生效，按钮可恢复',()=>{
 g.load(10,true);
 const button=g.eraseButton;
 assert.ok(button);
 assert.equal(button.name,'button:erase');
 assert.equal(button.visible,true);
 assert.equal(button.label.text,'消除 ×1');
 const initial=g.model.state.rings.filter(r=>r.life==='active').length;
 button.click();
 assert.equal(g.eraseMode,true);
 assert.equal(button.label.text,'取消');
 assert.equal(g.eraseTip.visible,true);
 button.click();
 assert.equal(g.eraseMode,false,'再次点击道具退出选择模式');
 button.click();
 const ring=g.model.state.rings[0];
 const b=g.board;
 b.zoomTo(b.fitZoom*3,{x:360,y:500});
 const offset=C.rot({x:ring.x-b.center.x,y:ring.y-b.center.y},b.turn);
 b.panTo({x:360-offset.x*b.zoom,y:500-offset.y*b.zoom});
 const p=b.toScreen(C.point(ring,ring.a+70));
 const tap={clientX:p.x/2,clientY:p.y/2,pointerId:76,button:0};
 g.down(tap);
 assert.equal(g.modalOpen,false,'按下时不应立即消除，避免误触');
 g.up(tap);
 assert.equal(g.modalOpen,true,'轻点并松手后出现确认弹窗');
 assert.equal(g.drag,null,'道具选择不能开始转动');
 assert.equal(g.model.state.rings[0].life,'active','确认前不改变目标');
 g.modalCard.children.find(n=>n.label?.text==='取消').click();
 assert.equal(g.model.state.rings.filter(r=>r.life==='active').length,initial);
 assert.equal(g.model.state.steps,0);
 button.click();
 g.chooseEraseTarget(ring.id);
 g.modalCard.children.find(n=>n.label?.text==='确认消除').click();
 assert.equal(C.ring(g.model.state,ring.id).life,'removed');
 assert.ok(g.model.state.rings.filter(r=>r.life==='active').length<initial);
 assert.equal(g.model.state.steps,0,'道具不应计入转动次数');
 assert.equal(g.eraseMode,false);
 assert.equal(button.label.text,'消除 ×0');
 assert.ok(button.skin.graphics.ops.length);
 assert.equal(g.modalOpen,false);
 assert.ok(g.board.ghosts.length>0,'保留玉镯移除动画');
 assert.ok(g.model.state.rods.filter(z=>z.owner===ring.id).every(z=>!C.exists(g.model.state,z)),'活动锁扣随消除的手镯消失');
 const saved=g.model.state.rings.map(r=>r.life);
 const fresh=g.model.removeWithTool(ring.id);
 assert.equal(fresh.length,0,'已消除手镯不会重复消除');
 assert.deepEqual(g.model.state.rings.map(r=>r.life),saved);
});

test('消除道具选镯时拖动画面不触发消除，双指缩放不会误确认',()=>{
 g.load(10,true);g.eraseButton.click();
 const r=g.model.state.rings[0],b=g.board;
 const ringPoint=b.toScreen(C.point(r,r.a+55));
 const p={clientX:ringPoint.x/2,clientY:ringPoint.y/2,pointerId:202,button:0};
 g.down(p);
 g.move({...p,clientX:p.clientX+20});
 g.up({...p,clientX:p.clientX+20});
 assert.equal(g.modalOpen,false,'拖动不能作为选镯点击');
 assert.equal(g.eraseMode,true);
 assert.equal(r.life,'active');
 g.down(p);
 const other={clientX:p.clientX+40,clientY:p.clientY,pointerId:203,button:0};
 g.down(other);
 g.move({...other,clientX:other.clientX+35});
 g.up(other);g.up(p);
 assert.equal(g.modalOpen,false,'双指缩放不能触发消除确认');
 assert.equal(g.eraseMode,true);
 assert.equal(r.life,'active');
});


test('对齐音只在扣位从未对齐进入对齐时播放',()=>{
 g.save.data.unlocked=10;g.load(1);
 const z=g.model.state.rods.find(z=>C.exists(g.model.state,z));
 const e=C.endpoints(g.model.state,z)[0],id=e.id;
 const originalTurn=g.model.turn,originalPlay=g.audio.play;
 const calls=[];g.audio.play=kind=>calls.push(kind);
 const result={done:.1,removed:[],blocked:null};
 try{
  g.model.state.states[z.id][0]='locked';
  g.model.turn=()=>{g.model.state.states[z.id][0]='aligned';return result};
  g.perform(id,.1);assert.equal(calls.filter(k=>k==='align').length,1);
  g.perform(id,.1);assert.equal(calls.filter(k=>k==='align').length,1,'保持对齐时不重复响');
  g.model.turn=()=>{g.model.state.states[z.id][0]='locked';return result};g.perform(id,.1);
  g.model.turn=()=>{g.model.state.states[z.id][0]='aligned';return result};g.perform(id,.1);
  assert.equal(calls.filter(k=>k==='align').length,2,'离开再进入可重新提示');
 }finally{g.model.turn=originalTurn;g.audio.play=originalPlay;g.audio.enabled=false}
});

test('导航按钮先切场景再播放点击反馈，声音不会被场景清理截断',()=>{
 const originalPlay=g.audio.play,originalStop=g.audio.stopAll,events=[];
 g.audio.play=kind=>events.push(kind);g.audio.stopAll=()=>events.push('stop');
 try{g.home();events.length=0;g.scene.children.find(n=>n.name==='button:第1关').click();assert.equal(g.mode,'game');assert.equal(events.at(-1),'button');assert.ok(events.indexOf('stop')<events.lastIndexOf('button'))}
 finally{g.audio.play=originalPlay;g.audio.stopAll=originalStop;g.audio.enabled=false}
});

test('正式图谱13页覆盖100关，末页可进入第100关且隐藏编号',()=>{
 const ids=[];
 for(let page=0;page<13;page++){
  g.levels(page);const entries=g.scene.children.filter(n=>n.name?.startsWith('formal-level:'));
  assert.equal(entries.length,page===12?4:8);ids.push(...entries.map(n=>n.name));
 }
 assert.equal(new Set(ids).size,100);
 const last=g.scene.children.find(n=>n.name==='formal-level:100');assert.ok(last);last.click();
 assert.equal(g.model.index,109);assert.equal(g.model.state.rings.length,109);assert.equal(g.formal,true);
 assert.ok(g.scene.children.some(n=>n.text==='第100关'));
 assert.ok([...g.board.rings.values()].every(v=>v.label.text===''));
 assert.ok(g.board.fitZoom>0);g.load(110);assert.equal(g.model.index,109);
});

test('正式关结算能进入下一关，第100关结算返回图谱',()=>{
 g.load(10);g.win();assert.ok(g.modalCard.children.some(n=>n.text==='第1关 · 全部解开'));
 g.modalCard.children.find(n=>n.label?.text==='下一关').click();
 assert.equal(g.model.index,11);assert.equal(g.model.state.rings.length,11);assert.equal(g.modalOpen,false);
 g.load(109);g.win();assert.ok(!g.modalCard.children.some(n=>n.label?.text==='下一关'));
 g.modalCard.children.find(n=>n.label?.text==='关卡图谱').click();assert.equal(g.mode,'levels');
});


test('正式图谱翻页按钮、页码与最后一行卡片互不遮挡',()=>{
 g.levels(6);
 const previous=g.scene.children.find(n=>n.label?.text==='上一页'),next=g.scene.children.find(n=>n.label?.text==='下一页');
 const counter=g.scene.children.find(n=>n.text==='7 / 13');
 assert.ok(previous.x+previous.width<counter.x);assert.ok(counter.x+counter.width<next.x);
 const cards=g.scene.children.filter(n=>n.name?.startsWith('formal-level:'));
 assert.ok(Math.max(...cards.map(n=>n.y+n.height))<previous.y);
});

