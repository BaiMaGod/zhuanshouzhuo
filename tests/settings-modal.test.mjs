import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual hideModal method from src/main.ts without starting Laya.
function harness() {
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const start=source.indexOf(' hideModal():void{');
 assert.ok(start>=0,'Game.hideModal must exist');
 const opening=source.indexOf('{',start);
 let depth=1,end=opening+1;
 while(depth>0&&end<source.length){
  if(source[end]==='{')depth++;
  else if(source[end]==='}')depth--;
  end++;
 }
 assert.equal(depth,0,'Game.hideModal must have a complete body');
 const method=source.slice(start,end);
 const js=ts.transpileModule('class ModalHarness {'+method+'}',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
 }).outputText;
 const pending=[];
 const Laya={
  Tween:{clearAll(){}},
  timer:{frameOnce(frames,caller,callback){assert.equal(frames,1);pending.push(callback)}}
 };
 const ModalHarness=vm.runInNewContext(js+'\nModalHarness',{Laya});
 return {ModalHarness,pending};
}
function sprite() {
 return {
  visible:true,mouseEnabled:true,destroyed:false,
  destroy(deep){assert.equal(deep,true);this.destroyed=true}
 };
}
test('closing home settings restores the same visible, clickable settings button',()=>{
 const {ModalHarness,pending}=harness();
 const game=new ModalHarness();
 const card=sprite(),shade=sprite(),scene={};
 const settings={parent:scene,visible:false,enabled:false,alpha:0};
 Object.assign(game,{mode:'home',scene,homeSettingsButton:settings,modalCard:card,modalShade:shade,modalOpen:true,model:null,board:null});
 game.hideModal();
 assert.equal(game.modalOpen,false);
 assert.equal(game.modalCard,null);
 assert.equal(game.modalShade,null);
 assert.equal(settings.visible,true);
 assert.equal(settings.enabled,true);
 assert.equal(settings.alpha,1);
 assert.equal(card.visible,false);
 assert.equal(shade.visible,false);
 assert.equal(card.mouseEnabled,false);
 assert.equal(shade.mouseEnabled,false);
 assert.equal(card.destroyed,false,'do not destroy the clicked node during event dispatch');
 assert.equal(pending.length,1);
 pending.shift()();
 assert.equal(card.destroyed,true);
 assert.equal(shade.destroyed,true);
});
test('old modal cleanup cannot destroy a newly reopened modal',()=>{
 const {ModalHarness,pending}=harness();
 const game=new ModalHarness(),scene={};
 Object.assign(game,{mode:'home',scene,homeSettingsButton:null,modalCard:sprite(),modalShade:sprite(),modalOpen:true,model:null,board:null});
 game.hideModal();
 const reopenedCard=sprite(),reopenedShade=sprite();
 game.modalCard=reopenedCard;game.modalShade=reopenedShade;game.modalOpen=true;
 pending.shift()();
 assert.equal(reopenedCard.destroyed,false);
 assert.equal(reopenedShade.destroyed,false);
 assert.equal(game.modalOpen,true);
 game.hideModal();
 pending.shift()();
 assert.equal(reopenedCard.destroyed,true);
 assert.equal(reopenedShade.destroyed,true);
});
test('closing another scene modal does not revive an obsolete home button',()=>{
 const {ModalHarness}=harness();
 const game=new ModalHarness();
 const settings={parent:{},visible:false,enabled:false,alpha:0};
 Object.assign(game,{mode:'game',scene:{},homeSettingsButton:settings,modalCard:null,modalShade:null,modalOpen:true,model:null,board:null});
 game.hideModal();
 assert.equal(settings.visible,false);
 assert.equal(settings.enabled,false);
});

test('home settings button is reattached if the input engine detached it',()=>{
 const {ModalHarness}=harness();
 const game=new ModalHarness();
 const scene={children:[],addChild(node){this.children.push(node);node.parent=this}};
 const settings={parent:null,visible:false,enabled:false,alpha:0};
 Object.assign(game,{mode:'home',scene,homeSettingsButton:settings,modalCard:null,modalShade:null,modalOpen:true,model:null,board:null});
 game.hideModal();
 assert.equal(settings.parent,scene);
 assert.equal(scene.children[0],settings);
 assert.equal(settings.visible,true);
 assert.equal(settings.enabled,true);
 assert.equal(settings.alpha,1);
});
