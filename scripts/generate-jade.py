"""Generate geometry-driven PBR-style jade surfaces; all cutouts match V3.2 dimensions.

This is a reproducible material generator, not a modification of the reference image.
The reference supplies amber/peach/green colors, rounded polish and cloudy inclusions.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT=Path(__file__).resolve().parents[1]/'public/assets'
OUT.mkdir(parents=True,exist_ok=True)
N=768
y,x=np.mgrid[0:N,0:N].astype(float)
x=(x-N/2)/N*110;y=(y-N/2)/N*110
r=np.hypot(x,y);a=np.arctan2(y,x)
cross=(r-40)/6
bevel=np.sqrt(np.maximum(0,1-cross**2))
half=np.arcsin(9/(2*34))
mask=(np.abs(cross)<1)&(np.abs(a)>half)
aa=np.clip((6-np.abs(r-40))*N/110,0,1)*np.clip((np.abs(a)-half)*r*N/110,0,1)
nx=cross*x/np.maximum(r,1);ny=cross*y/np.maximum(r,1)
light=np.clip(-nx*.45-ny*.55+bevel*.78,0,1)
cloud=(np.sin(x*.43+np.sin(y*.22)*2)+np.cos(y*.31+x*.12)+np.sin((x+y)*.18)*1.4)/3.4
grain=np.sin(x*2.3+np.cos(y*1.7))*np.cos(y*2.8)*.024
inclusion=np.clip((cloud+.3)*.28,0,.38)
palette={'amber':([209,152,22],[255,241,160]),'peach':([221,137,109],[255,230,211]),
 'celadon':([65,133,108],[218,239,185]),'ice':([85,158,171],[221,246,233]),
 'ivory':([184,168,103],[255,246,203])}
for name,(base,trans) in palette.items():
 base=np.array(base);trans=np.array(trans)
 col=base[None,None,:]*(.58+.48*light[:,:,None])+trans[None,None,:]*inclusion[:,:,None]
 # Thick curved highlights and small bright glints along the polished surface.
 spec=np.clip((light-.80)/.2,0,1)**5*.85
 stripe=np.exp(-((cross+.36)/.13)**2)*(.3+.7*np.clip(-np.sin(a),0,1))
 col=col*(1-spec[:,:,None]*.75)+255*spec[:,:,None]*.75
 col=col*(1-stripe[:,:,None]*.16)+255*stripe[:,:,None]*.16
 col+=grain[:,:,None]*45
 # Soft translucent rim, backed by darker inner/lower bevel.
 rim=np.exp(-((np.abs(cross)-.91)/.08)**2)*.16
 col=col*(1-rim[:,:,None])+trans[None,None,:]*rim[:,:,None]
 alpha=(aa*mask*255).astype('uint8')
 rgba=np.dstack([np.clip(col,0,255).astype('uint8'),alpha])
 im=Image.fromarray(rgba)
 im.save(OUT/(name+'.png'),optimize=True)
 # A separate, unrotated support shadow is placed under each jade sprite.
sh=Image.fromarray((aa*mask*90).astype('uint8'),'L').filter(ImageFilter.GaussianBlur(10))
shadow=Image.new('RGBA',(N,N),(49,61,39,0));shadow.putalpha(sh)
shadow.save(OUT/'shadow.png',optimize=True)

W,H=1000,1500
yy,xx=np.mgrid[0:H,0:W]
d=((xx-W*.40)/W)**2+((yy-H*.25)/H)**2
bg=np.zeros((H,W,3),dtype=np.uint8)
for i,(hi,lo) in enumerate(zip([255,253,237],[229,220,180])):
 bg[:,:,i]=np.clip(hi-(hi-lo)*np.minimum(1,d*1.45)+np.sin(xx*.09+yy*.04)*.7,0,255)
back=Image.fromarray(bg).convert('RGBA')
deco=Image.new('RGBA',(W,H));q=ImageDraw.Draw(deco)
def leaf(cx,cy,w,h,tilt,color):
 layer=Image.new('RGBA',(w+8,h+8));p=ImageDraw.Draw(layer)
 p.ellipse((4,4,w+4,h+4),fill=color,outline=(73,95,59,160),width=2)
 p.line((w/2+4,10,w/2+4,h-6),fill=(221,224,164,175),width=2)
 for v in range(25,h-10,18):
  p.line((w/2+4,v,w*.23,v-12),fill=(224,226,170,80),width=1)
  p.line((w/2+4,v,w*.77,v-12),fill=(224,226,170,80),width=1)
 layer=layer.rotate(tilt,expand=True,resample=Image.Resampling.BICUBIC)
 deco.alpha_composite(layer,(int(cx-layer.width/2),int(cy-layer.height/2)))
for side in [0,1]:
 for i in range(8):
  leaf(40+i*28 if side==0 else W-40-i*28,35+i*24,70+i*4,145-i*5,
    (-55+i*13)*(1 if side==0 else -1),(97+i*6,132+i*4,91+i*2,150-i*8))
 for i in range(5):
  leaf(15+i*25 if side==0 else W-15-i*25,H-140+i*30,65,140,(-45+i*22)*(1 if side==0 else -1),(104,137,94,90))
back.alpha_composite(deco)
back.save(OUT/'garden.png',optimize=True)

plate=Image.new('RGBA',(1000,1200));p=ImageDraw.Draw(plate)
p.ellipse((33,46,973,1177),fill=(55,65,42,24))
plate=plate.filter(ImageFilter.GaussianBlur(14));p=ImageDraw.Draw(plate)
p.ellipse((20,20,980,1180),fill=(250,244,218,255),outline=(183,148,78,255),width=4)
p.ellipse((31,31,969,1169),outline=(255,254,235,255),width=9)
p.ellipse((45,45,955,1155),outline=(209,177,110,255),width=3)
p.ellipse((60,60,940,1140),fill=(255,252,235,255),outline=(228,216,174,255),width=2)
p.arc((70,70,930,1130),205,320,fill=(255,255,250,255),width=7)
p.arc((93,99,907,1101),20,160,fill=(223,213,177,80),width=2)
plate.save(OUT/'tray.png',optimize=True)
print('Generated five polished jade materials, shadows, garden and tray.')
