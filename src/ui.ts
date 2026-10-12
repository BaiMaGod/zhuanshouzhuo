export const COLORS={ink:'#435d48',muted:'#8d9172',gold:'#b2924b',jade:'#4b7b60',cream:'#fff9e5'};
export function round(g:Laya.Graphics,x:number,y:number,w:number,h:number,r:number,fill:string,line?:string,width=1):void{
 g.drawPath(x,y,[['moveTo',r,0],['lineTo',w-r,0],['arcTo',w,0,w,r,r],
  ['lineTo',w,h-r],['arcTo',w,h,w-r,h,r],['lineTo',r,h],['arcTo',0,h,0,h-r,r],
  ['lineTo',0,r],['arcTo',0,0,r,0,r],['closePath']],{fillStyle:fill},line?{strokeStyle:line,lineWidth:width}:undefined);
}
export function text(parent:Laya.Sprite,content:string,x:number,y:number,w:number,h:number,size=24,color=COLORS.ink,align='center',serif=false):Laya.Text{
 const t=new Laya.Text();t.text=content;t.pos(x,y);t.size(w,h);t.font=serif?'Noto Serif CJK SC, Songti SC, SimSun, serif':'Noto Sans CJK SC, Microsoft YaHei, sans-serif';t.fontSize=size;t.color=color;t.align=align;t.valign='middle';t.wordWrap=true;t.leading=8;t.mouseEnabled=false;parent.addChild(t);return t;
}
export function panel(parent:Laya.Sprite,x:number,y:number,w:number,h:number,r=24,fill=COLORS.cream,line='#d3c096'):Laya.Sprite{
 const s=new Laya.Sprite();s.pos(x,y);s.size(w,h);round(s.graphics,0,4,w,h,r,'#d5caa1');round(s.graphics,0,0,w,h,r,fill,line,1.5);parent.addChild(s);return s;
}
export class Button extends Laya.Sprite {
 label:Laya.Text; private enabled_=true;
 constructor(title:string,x:number,y:number,w:number,h:number,callback:()=>void,primary=false){
  super();this.pos(x,y);this.size(w,h);this.mouseEnabled=true;
  round(this.graphics,0,4,w,h,16,primary?'#355844':'#d2c7a5');
  round(this.graphics,0,0,w,h,16,primary?'#537e61':'#fffae8',primary?'#799978':'#cbb98b',2);
  this.graphics.drawLine(20,4,w-20,4,primary?'#90a284':'#fffef6',1);
  this.label=text(this,title,0,-1,w,h,23,primary?'#fff5d6':COLORS.ink);
  this.on(Laya.Event.CLICK,this,()=>{if(this.enabled_)callback()});
 }
 set enabled(v:boolean){this.enabled_=v;this.alpha=v?1:.38}
 get enabled():boolean{return this.enabled_}
}
export function ornament(parent:Laya.Sprite,x:number,y:number,w:number):void{
 const g=parent.graphics;g.drawLine(x,y,x+w*.42,y,'#c5a970',1);g.drawLine(x+w*.58,y,x+w,y,'#c5a970',1);
 const cx=x+w/2;g.drawPoly(cx,y,[0,-7,7,0,0,7,-7,0],null,'#b79651',1.4);g.drawCircle(cx,y,2,'#c4a15d');
}
