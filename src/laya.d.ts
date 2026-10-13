/* Minimal declarations for the bundled LayaAir 3.4 API used by this project. */
declare namespace Laya {
 const Browser:{width:number;height:number};
 const Event:{CLICK:string;MOUSE_DOWN:string;MOUSE_MOVE:string;MOUSE_UP:string;MOUSE_OUT:string;RESIZE:string};
 function init(width:number,height:number):Promise<void>;
 class Sprite {
  x:number;y:number;width:number;height:number;rotation:number;alpha:number;visible:boolean;
  mouseEnabled:boolean;mouseThrough:boolean;cacheAs:string;zOrder:number;name:string;
  scaleX:number;scaleY:number;texture:Texture|null;graphics:Graphics;
  parent:Sprite|null;
  constructor();
  addChild<T extends Sprite>(s:T):T;removeChildren():void;
  destroy(destroyChild?:boolean):void;removeSelf():this;
  pos(x:number,y:number):this;size(w:number,h:number):this;scale(x:number,y?:number):this;
  pivot(x:number,y:number):this;
  on(event:string,caller:unknown,fn:Function):this;off(event:string,caller:unknown,fn:Function):this;
  globalToLocal(p:Point):Point;
 }
 class Text extends Sprite {
  text:string;font:string;fontSize:number;color:string;bold:boolean;
  align:string;valign:string;wordWrap:boolean;leading:number;
 }
 class Point {x:number;y:number;constructor(x?:number,y?:number)}
 class Graphics {
  clear():void;drawRect(x:number,y:number,w:number,h:number,fill:string|null,line?:string|null,lineWidth?:number):void;
  drawCircle(x:number,y:number,r:number,fill:string|null,line?:string|null,lineWidth?:number):void;
  drawLine(x1:number,y1:number,x2:number,y2:number,color:string,width?:number):void;
  drawPoly(x:number,y:number,pts:number[],fill:string|null,line?:string|null,lineWidth?:number):void;
  drawImage(texture:Texture,x?:number,y?:number,width?:number,height?:number):void;
  drawTriangles(texture:Texture,x:number,y:number,vertices:Float32Array,uvs:Float32Array,indices:Uint16Array,matrix?:null,alpha?:number,color?:string):void;
  drawPath(x:number,y:number,paths:unknown[],brush?:{fillStyle:string},pen?:{strokeStyle:string;lineWidth:number}):void;
 }
 class Texture {width:number;height:number}
 class Stage extends Sprite {
  static SCALE_SHOWALL:string;static SCREEN_NONE:string;
  scaleMode:string;screenMode:string;alignH:string;alignV:string;bgColor:string;
  mouseX:number;mouseY:number;
 }
 const stage:Stage;
 const loader:{load(url:string|string[]):Promise<unknown>;getRes(url:string):Texture};
 const timer:{frameLoop(delay:number,caller:unknown,fn:Function):void;delta:number;clearAll(caller:unknown):void};
 const Tween:{to(target:unknown,props:unknown,duration:number,ease?:unknown,complete?:unknown,delay?:number):unknown;clearAll(target:unknown):void};
 const Ease:{backOut:unknown;sineIn:unknown;sineOut:unknown};
}
