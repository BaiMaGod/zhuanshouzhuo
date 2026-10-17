import {HINT_HAND_ASSET,HINT_HAND_TIP_X,HINT_HAND_TIP_Y} from './guide.js';
import type {Point} from './types.js';

/** Visual-only input hand. Its pivot is the fingertip, never the wrist. */
export class GestureHand {
 readonly sprite=new Laya.Sprite();
 constructor(parent:Laya.Sprite){
  const hand=this.sprite;
  hand.name='player-gesture-hand';
  hand.texture=Laya.loader.getRes(HINT_HAND_ASSET);
  hand.size(118,118);
  hand.pivot(118*HINT_HAND_TIP_X,118*HINT_HAND_TIP_Y);
  hand.zOrder=100;
  hand.mouseEnabled=false;
  hand.visible=false;
  parent.addChild(hand);
 }
 place(p:Point,angle?:number):void{
  this.sprite.pos(p.x,p.y);
  if(angle!==undefined)this.sprite.rotation=angle;
  this.sprite.visible=true;
 }
 rotate(delta:number):void{if(this.sprite.visible)this.sprite.rotation+=delta}
 hide():void{this.sprite.visible=false;this.sprite.rotation=0}
}
