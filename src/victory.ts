import {Button,THEME,text,round,ornament,icon} from './ui.js';
import {jadeSprite} from './jade.js';
import {easeOut,reducedMotion,glint} from './feedback.js';

export interface VictoryOptions {
 title:string;subtitle:string;count:number;steps:number;stars:number;note:string;
 actions:{label:string;action:()=>void;primary:boolean}[];
}
// Dedicated result presentation. State and rewards are supplied by Game.win().
export class Victory {
 readonly card=new Laya.Sprite();
 private start=performance.now();private quiet=reducedMotion();
 private finished=false;
 private stars:{root:Laya.Sprite;lit:Laya.Sprite;shine:Laya.Sprite}[]=[];
 private ornaments=new Laya.Sprite();private medal=new Laya.Sprite();
 private detail:Laya.Text;private stepText:Laya.Text;private countText:Laya.Text;
 private buttons:Button[]=[];
 constructor(parent:Laya.Sprite,width:number,height:number,private options:VictoryOptions){
  const c=this.card,scale=Math.min(1,(height-80)/780);
  c.name='victory-card';c.size(620,780);c.scale(scale,scale);
  c.pos((width-620*scale)/2,(height-780*scale)/2);c.mouseEnabled=true;c.cacheAs='none';
  c.on(Laya.Event.CLICK,this,()=>{});parent.addChild(c);
  const g=c.graphics;
  round(g,0,7,620,780,32,'rgba(104,72,83,0.08)');
  round(g,0,0,620,780,32,THEME.white,THEME.line,1.6);
  round(g,12,12,596,756,24,THEME.white,THEME.faint,.8);
  // Reuse real jade artwork as the victory seal, keeping its texture intact.
  this.medal.pos(310,102);this.medal.mouseEnabled=false;c.addChild(this.medal);
  this.medal.graphics.drawCircle(0,0,78,'#f2eee3');
  this.medal.graphics.drawCircle(0,0,72,null,'#d9c9a5',1);
  this.medal.addChild(jadeSprite('ice',-22,0,.85,-130));
  this.medal.addChild(jadeSprite('peach',24,0,.85,55));
  this.ornaments.mouseEnabled=false;c.addChild(this.ornaments);
  text(c,options.title,26,193,568,58,38,THEME.ink,'center',true);
  text(c,options.subtitle,40,249,540,34,21,THEME.muted);
  ornament(c,180,295,260);
  for(let i=0;i<3;i++){
   const root=new Laya.Sprite();root.name='victory-star:'+i;root.pos(224+i*86,344);root.mouseEnabled=false;
   icon(root.graphics,'star',-30,-30,60,THEME.faint);
   const lit=new Laya.Sprite();lit.name='star-lit';lit.mouseEnabled=false;
   icon(lit.graphics,'star',-30,-30,60,'#c49a54');root.addChild(lit);
   const shine=new Laya.Sprite();shine.mouseEnabled=false;root.addChild(shine);
   c.addChild(root);this.stars.push({root,lit,shine});
  }
  round(g,64,403,492,100,18,'#f7eeeb');
  g.drawLine(310,424,310,482,THEME.faint,1);
  this.countText=text(c,String(options.count),72,410,226,49,37,THEME.ink,'center',true);
  this.stepText=text(c,String(options.steps),322,410,226,49,37,THEME.ink,'center',true);
  text(c,'玉镯已解开',72,460,226,28,19,THEME.muted);
  text(c,'本关转动次数',322,460,226,28,19,THEME.muted);
  this.detail=text(c,options.note,52,518,516,36,21,THEME.muted);
  for(let i=0;i<options.actions.length;i++){
   const a=options.actions[i],primary=i===0;
   const b=new Button(a.label,primary?64:64+(i-1)*254,primary?577:683,primary?492:238,primary?84:64,a.action,a.primary);
   b.label.fontSize=primary?30:24;
   b.name='button:'+a.label;c.addChild(b);this.buttons.push(b);
  }
  this.draw(this.start);
 }
 draw(now:number):void{
  if(this.finished)return;
  const t=this.quiet?2000:Math.max(0,now-this.start),c=this.card;
  c.alpha=Math.min(1,t/180);
  const m=easeOut(t/360);this.medal.scale(.92+.08*m,.92+.08*m);
  this.ornaments.graphics.clear();
  if(!this.quiet&&t<1150){
   const a=Math.sin(Math.min(1,t/1150)*Math.PI);
   for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,r=85+12*easeOut(t/700);
    glint(this.ornaments.graphics,310+Math.cos(angle)*r,102+Math.sin(angle)*r,(i%2?3:5)*a,'#d7bd8a');
   }
  }
  this.stars.forEach(({lit,shine},i)=>{
   const u=Math.max(0,Math.min(1,(t-240-i*180)/290)),earned=i<this.options.stars;
   lit.visible=earned&&u>0;lit.alpha=u;
   const s=u===0?1:u<.65?.5+.65*easeOut(u/.65):1+.15*(1-(u-.65)/.35);
   lit.scale(s,s);shine.graphics.clear();
   if(earned&&!this.quiet&&u>0&&u<1){
    const a=Math.sin(u*Math.PI);
    glint(shine.graphics,23+u*5,-23-u*7,8*a,'#e5c680');
    glint(shine.graphics,-24-u*5,14+u*3,4*a,'#b0cdbc');
   }
  });
  const detail=easeOut((t-660)/350);
  this.countText.text=String(Math.round(this.options.count*detail));
  this.stepText.text=String(Math.round(this.options.steps*detail));
  this.detail.alpha=detail;
  // Buttons remain usable throughout; no delayed callbacks can target a new run.
  this.buttons.forEach((b,i)=>b.alpha=.65+.35*easeOut((t-760-i*50)/300));
  if(t>=1200)this.finished=true;
 }
 destroy():void{this.card.destroy(true)}
}
