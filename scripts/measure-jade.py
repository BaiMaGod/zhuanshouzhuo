"""Read generated PNG alpha to record texture UV bounds. Does not modify the images."""
from pathlib import Path
from PIL import Image
import numpy as np
import json

root=Path(__file__).resolve().parents[1]
profiles={}
for name in ['amber','peach','celadon','ice','ivory']:
    im=Image.open(root/'public/assets/jade-v2'/f'{name}.png').convert('RGBA')
    a=np.asarray(im)[:,:,3];h,w=a.shape
    ys,xs=np.where(a>192)
    cx=(np.quantile(xs,.002)+np.quantile(xs,.998))/2
    cy=(np.quantile(ys,.002)+np.quantile(ys,.998))/2
    inner=[];outer=[]
    for angle in np.linspace(0,2*np.pi,128,endpoint=False):
        r=np.arange(0,min(w,h)*.55,.5)
        xx=np.clip(np.rint(cx+np.cos(angle)*r).astype(int),0,w-1)
        yy=np.clip(np.rint(cy+np.sin(angle)*r).astype(int),0,h-1)
        on=a[yy,xx]>128
        edges=np.diff(np.r_[False,on,False].astype(int))
        starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0]
        k=np.argmax(ends-starts)
        inner.append(float(r[starts[k]]+1));outer.append(float(r[ends[k]-1]-1))
    def smooth(v):
        arr=np.asarray(v)
        return [round(float(n),2) for n in sum(np.roll(arr,k) for k in [-2,-1,0,1,2])/5]
    profiles[name]={'width':w,'height':h,'cx':round(float(cx),2),'cy':round(float(cy),2),
                    'inner':smooth(inner),'outer':smooth(outer)}
    assert min(np.asarray(outer)-np.asarray(inner))>90
    print(name,'alpha center',int(a[h//2,w//2]),'band radius',round(np.median(inner),1),round(np.median(outer),1))
(root/'src/jade-profiles.js').write_text('export default '+json.dumps(profiles,separators=(',',':'))+';\n')
