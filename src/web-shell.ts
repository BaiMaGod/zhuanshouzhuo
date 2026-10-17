// Optional Web page shell. Gameplay does not depend on a DOM or Web Worker.
export function finishWebShell():void{if(typeof document!=='undefined')document.getElementById('boot')?.remove()}
export function failWebShell():void{
 if(typeof document==='undefined')return;
 const box=document.getElementById('boot');if(box){box.classList.add('error');box.textContent='玉盘暂时没有加载完成，请刷新再试。'}
}
export function debugEnabled():boolean{return typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug')}
// QA's legacy ?debug bridge stays passive; only an explicit opt-in moves rings.
export function debugHintEnabled():boolean{return typeof location!=='undefined'&&new URLSearchParams(location.search).get('debug')==='1'}
export function exposeDebug(value:unknown):void{
 // Preserve the existing browser QA bridge without giving gameplay a DOM dependency.
 const debug=value as {game?:object};
 if(debug.game&&typeof document!=='undefined')Object.defineProperty(debug.game,'canvas',{get:()=>document.querySelector('canvas')});
 (globalThis as {jadeDebug?:unknown}).jadeDebug=value;
}

/** Browser-only mouse cursor adapter; native/mini-game canvases have no CSS style. */
export function setGameCursorHidden(hidden:boolean):void{
 const canvas=Laya.Browser.mainCanvas?.source;
 if(canvas?.style)canvas.style.cursor=hidden?'none':'auto';
}
