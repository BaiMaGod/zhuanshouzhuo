import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const start=source.indexOf(' modal(title:string,lines:string[],actions:');
assert.ok(start>=0);
const opening=source.indexOf('):void{',start)+6;
let end=opening+1,depth=1;
while(depth>0){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++}
const method=source.slice(start,end);

class Sprite {
 constructor(){this.children=[];this.graphics={clear(){},drawRect(){}};this.name='';this.width=0;this.height=0;this.x=0;this.y=0}
 get numChildren(){return this.children.length}
 getChildAt(i){return this.children[i]}
 addChild(child){this.children.push(child);child.parent=this;return child}
 pos(x,y){this.x=x;this.y=y;return this}
 size(w,h){this.width=w;this.height=h;return this}
 on(){return this}
}
class Text extends Sprite {
 get textHeight(){
  if(!this.text)return 0;
  const units=Array.from(this.text).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?.55:1),0);
  return Math.ceil(units*this.fontSize/this.width)*(this.fontSize+8);
 }
}
class Button extends Sprite {
 constructor(label,x,y,w,h){super();this.name='button:'+label;this.pos(x,y).size(w,h);this.label={text:label}}
}
const text=(parent,value,x,y,w,h,fontSize)=>{
 const t=new Text();t.text=value;t.fontSize=fontSize;t.pos(x,y).size(w,h);parent.addChild(t);return t;
};
const panel=(parent,x,y,w,h)=>parent.addChild(new Sprite().pos(x,y).size(w,h));
const Laya={Sprite,Text,Event:{CLICK:'click',MOUSE_DOWN:'down',MOUSE_MOVE:'move',MOUSE_UP:'up',MOUSE_OUT:'out',MOUSE_WHEEL:'wheel'},Rectangle:class{constructor(x,y,w,h){Object.assign(this,{x,y,w,h})}}};
const js=ts.transpileModule('class TestGame {constructor(){this.overlay=new Laya.Sprite();this.guide=null}hideModal(){}releasePointers(){}setSystemCursor(){}sync(){}'+method+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const TestGame=vm.runInNewContext(js+'\nTestGame',{Laya,Button,text,panel,round(){},ornament(){},THEME:{white:'white',line:'line'},COLORS:{ink:'ink',gold:'gold',muted:'muted'},W:720,H:1180,RENDER_SCALE:1});
const children=node=>Array.from({length:node.numChildren},(_,i)=>node.getChildAt(i));
const layout=(lines,actions)=>{
 const game=new TestGame();
 game.modal('云存档已安全恢复',lines,actions.map(label=>({label,action(){},primary:true})));
 const card=game.modalCard,body=children(card).find(child=>child.name==='modal-body');
 return {card,body,rows:children(body).filter(c=>c instanceof Text),buttons:children(card).filter(c=>c instanceof Button)};
};

test('multi-line warnings have sufficient real height and do not cover action buttons',()=>{
 const {card,body,rows,buttons}=layout([
  '发现 1 局旧版未完成盘面与当前关卡不兼容（第13关）。已备份原始云档并隔离不兼容盘面；已通关成绩、星星、道具和其他有效盘面均保留。',
  '备份文件：tapfile://usr/jade_recovery_2c399d09eed45d1b005c5d80cde5ada_3feda25fcc404fcdba74f798f6fe1'
 ],['知道了']);
 assert.ok(rows[0].height>78,'long warning must grow beyond its old fixed row height');
 assert.ok(rows[0].y+rows[0].height<=rows[1].y);
 assert.ok(body.y+body.height<=buttons[0].y);
 assert.ok(card.y>=0&&card.y+card.height<=1180);
});

test('very long diagnostics scroll inside the modal while action buttons remain visible',()=>{
 const {card,body,buttons}=layout(Array(14).fill('云档诊断详细信息：远端状态与本地同步返回的完整错误描述'),['复制诊断','返回']);
 assert.ok(body.scrollRect,'overflowing messages need a clipped scrolling viewport');
 assert.ok(body.height<children(body).at(-1).y+children(body).at(-1).height);
 assert.ok(body.y+body.height<=buttons[0].y);
 assert.ok(buttons.at(-1).y+buttons.at(-1).height<card.height);
});
