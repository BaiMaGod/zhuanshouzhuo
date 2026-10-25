// Painted surfaces derived from the approved peach-blossom UI references.
// The images contain no copy, counts or claim states; those remain live UI.
export const FEATURE_ART={
 signin:'assets/art-rose/signin-shortcut.webp',
 bag:'assets/art-rose/bag-shortcut.webp',
 calendar:'assets/art-rose/signin-panel.webp',
 inventory:'assets/art-rose/bag-panel.webp'
};
export const FEATURE_ASSETS=Object.values(FEATURE_ART);
export function paintFeature(g:Laya.Graphics,url:string,w:number,h:number):void{
 g.drawImage(Laya.loader.getRes(url),0,0,w,h);
}
