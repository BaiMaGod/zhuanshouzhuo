import type {Board} from './renderer.js';

interface RenderTargetInfo {
 width?:number;height?:number;_width?:number;_height?:number;
}
interface RuntimeSprite extends Laya.Sprite {
 _drawOriRT?:RenderTargetInfo|null;
 _subStructRender?:{_rtRect?:{width?:number;height?:number}|null}|null;
}
interface RuntimeTexture extends Laya.Texture {
 bitmap?:{width?:number;height?:number}|null;
 source?:{width?:number;height?:number}|null;
}
interface RuntimeCanvas extends HTMLCanvasElement {}
interface DiagnosticGame {
 root:Laya.Sprite;
 board:Board|null;
}

function dimensions(value:{width?:number;height?:number}|null|undefined):{width:number|null;height:number|null}|null{
 if(!value)return null;
 const width=Number(value.width??0),height=Number(value.height??0);
 return {width:Number.isFinite(width)&&width>0?width:null,height:Number.isFinite(height)&&height>0?height:null};
}
function cacheInfo(sprite:Laya.Sprite):Record<string,unknown>{
 const runtime=sprite as RuntimeSprite,renderTarget=runtime._drawOriRT;
 return {
  mode:sprite.cacheAs||'none',
  renderTarget:dimensions(renderTarget?{
   width:renderTarget.width??renderTarget._width,
   height:renderTarget.height??renderTarget._height
  }:null),
  renderRect:dimensions(runtime._subStructRender?._rtRect)
 };
}
function textureInfo(url:string):{width:number|null;height:number|null}|null{
 try{
  const texture=Laya.loader.getRes(url) as RuntimeTexture|null;
  if(!texture)return null;
  return dimensions(texture)??dimensions(texture.bitmap)??dimensions(texture.source);
 }catch{return null}
}

/**
 * Read-only QA diagnostics. This deliberately does not change Laya's DPR,
 * canvas size, cache mode, or any gameplay coordinate.
 */
export function getRenderDiagnostics(
 game:DiagnosticGame,
 config:{designWidth:number;designHeight:number;renderWidth:number;renderScale:number}
):Record<string,unknown>{
 const canvas=(Laya.Browser.mainCanvas?.source as unknown as RuntimeCanvas|undefined)
  ??(typeof document!=='undefined'?document.querySelector('canvas')??undefined:undefined);
 const rect=canvas?.getBoundingClientRect();
 const dpr=typeof window!=='undefined'?(window.devicePixelRatio||1):1;
 const browser=Laya.Browser as unknown as {pixelRatio?:number;clientWidth:number;clientHeight:number};
 const rings=game.board?[...game.board.rings.entries()].slice(0,3):[];
 const stage=Laya.stage;
 const cssWidth=rect?.width??0,cssHeight=rect?.height??0;
 const backingWidth=canvas?.width??0,backingHeight=canvas?.height??0;
 return {
  device:{
   dpr,
   enginePixelRatio:browser.pixelRatio??null,
   hardwareConcurrency:typeof navigator!=='undefined'?navigator.hardwareConcurrency??null:null,
   deviceMemory:typeof navigator!=='undefined'?(navigator as Navigator&{deviceMemory?:number}).deviceMemory??null:null
  },
  viewportCss:{width:browser.clientWidth,height:browser.clientHeight,windowWidth:typeof window!=='undefined'?window.innerWidth:null,windowHeight:typeof window!=='undefined'?window.innerHeight:null},
  canvas:{
   css:{width:cssWidth,height:cssHeight,left:rect?.left??null,top:rect?.top??null},
   backing:{width:backingWidth,height:backingHeight},
   backingPerCss:{x:cssWidth>0?backingWidth/cssWidth:null,y:cssHeight>0?backingHeight/cssHeight:null},
   expectedBacking:{width:Math.round(cssWidth*dpr),height:Math.round(cssHeight*dpr)}
  },
  stage:{width:stage.width,height:stage.height,scaleX:stage.scaleX,scaleY:stage.scaleY},
  game:{designWidth:config.designWidth,designHeight:config.designHeight,virtualRenderWidth:config.renderWidth,rootScaleX:game.root.scaleX,rootScaleY:game.root.scaleY,renderScale:config.renderScale},
  cacheSamples:rings.map(([ringId,view])=>({
   ringId,
   body:cacheInfo(view.body),
   focus:cacheInfo(view.focus),
   halo:cacheInfo(view.halo)
  })),
  assets:{
   jadeAmber:textureInfo('assets/jade-v2/amber.png'),
   jadeCeladon:textureInfo('assets/jade-v2/celadon.png'),
   tray:textureInfo('assets/art-rose/tray.png'),
   petals:textureInfo('assets/art-rose/jade-petals-v2.png'),
   clasp:textureInfo('assets/art-v3/clasp.png')
  }
 };
}
