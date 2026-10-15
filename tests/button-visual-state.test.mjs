import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

// Check the compiled production Button, not a second approximation.
// Rendering on actual GPU still needs a browser screenshot regression.
installHarness();
const {Button}=await import('../dist/js/ui.js');

function send(button,event){
 for(const callback of button.events[event]||[])callback();
}
function skinSnapshot(button){
 return {
  parent:button.skin.parent,
  x:button.skin.x,y:button.skin.y,width:button.skin.width,height:button.skin.height,
  sx:button.skin.scaleX,sy:button.skin.scaleY,alpha:button.skin.alpha,
  visible:button.skin.visible,commands:JSON.stringify(button.skin.graphics.ops)
 };
}

test('icon-only and labeled controls keep opaque, static artwork through 50 press/disable cycles',()=>{
 for(const [title,kind,w,h] of [
  ['', 'settings', 76,66],['','home',76,64],['','restart',76,64],
  ['','sound',76,64],['','help',76,64],['提示','hint',146,62],
  ['消除','erase',144,62],['第1关','play',496,88]
 ]){
  let clicks=0;
  const button=new Button(title,4,8,w,h,()=>{clicks++},false,kind);
  const initial=skinSnapshot(button);
  assert.equal(button.skin.cacheAs,'none');
  assert.equal(button.iconSprite.parent,button,'icon must not disappear with skin drawing');
  assert.equal(button.skin.width,w);
  assert.equal(button.skin.height,h);
  assert.ok(button.skin.graphics.ops.length>0,'background has draw commands');
  assert.ok(button.iconSprite.graphics.ops.length>0,'icon has draw commands');
  for(let n=0;n<50;n++){
   send(button,'mousedown');
   assert.equal(button.pressedCover.visible,true,'press feedback is independent');
   assert.equal(button.disabledCover.visible,false);
   assert.deepEqual(skinSnapshot(button),initial,'press never moves or fades button skin');
   send(button,n%2?'mouseup':'mouseout');
   assert.equal(button.pressedCover.visible,false);
   button.enabled=false;
   assert.equal(button.disabledCover.visible,true,'disabled state is a separate cover');
   assert.equal(button.alpha,1,'must not fade the entire button tree');
   button.click();
   assert.equal(clicks,n,'disabled control must not fire');
   button.enabled=true;
   assert.equal(button.disabledCover.visible,false);
   button.click();
   assert.equal(clicks,n+1);
   assert.deepEqual(skinSnapshot(button),initial,'all cycles retain the exact original background');
  }
 }
});

test('changing sound icon does not touch button skin or its parent',()=>{
 const button=new Button('',0,0,76,64,()=>{},false,'sound');
 const initial=skinSnapshot(button);
 for(let n=0;n<60;n++){
  button.setIcon(n%2?'sound':'mute');
  send(button,'mousedown');
  send(button,'mouseup');
  assert.deepEqual(skinSnapshot(button),initial);
  assert.equal(button.iconSprite.parent,button);
  assert.ok(button.iconSprite.graphics.ops.length>0);
 }
});
