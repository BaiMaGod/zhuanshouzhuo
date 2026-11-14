from PIL import Image
import numpy as np
from pathlib import Path
import argparse
S=144
span=68
q=(np.arange(S)+.5-S/2)*2*span/S
x,y=np.meshgrid(q,q)
r=np.hypot(x,y)
a=np.arctan2(y,x)
gap=np.arcsin(9/68)
def smooth(l,h,v):
    z=np.clip((v-l)/(h-l),0,1)
    return z*z*(3-2*z)
def sample(src,x,y):
    x=np.clip(x,0,src.shape[1]-1.001)
    y=np.clip(y,0,src.shape[0]-1.001)
    i=x.astype(int);j=y.astype(int)
    u=(x-i)[...,None];v=(y-j)[...,None]
    return ((1-u)*src[j,i]+u*src[j,i+1])*(1-v)+((1-u)*src[j+1,i]+u*src[j+1,i+1])*v
def rgba(rgb,alpha):
    return Image.fromarray(np.uint8(np.clip(np.dstack((rgb,alpha))*255+.5,0,255)))
parser=argparse.ArgumentParser(description='Bake the painted fire ring into paired flame and jade-surface frames.')
parser.add_argument('master',type=Path,help='Transparent full-ring flame painting')
args=parser.parse_args()
src=np.asarray(Image.open(args.master).convert('RGBA')).astype(float)/255
src[:,:,:3]*=src[:,:,3:]
h,w=src.shape[:2]
# Centerline is estimated from the bright woven roots in the original ring art.
# Remap radial coordinates, preserving the broad C-shaped flame drawing.
atlas=Image.new('RGBA',(S*4,S*4))
for f in range(8):
    t=f*2*np.pi/8
    angle=a+np.pi + .035*np.sin(5*a+t)+.022*np.sin(11*a-t+(r-40)*.27)
    sway=(1+.45*np.sin(4*a))*np.sin(6*a+t-(r-40)*.26)
    d=r-40
    # Expose the incandescent roots directly beside both jade edges.
    # The jade itself occludes the transition between the two mappings.
    mapped=r-(5.3+1.15*np.sin(3*a+.7))*np.tanh(d/3.3)
    rad=(mapped+(2.4*sway+1.0*np.sin(9*a-t))*smooth(0,12,np.abs(d)))*9.2
    rx=.475*w+rad*np.cos(angle)
    ry=.477*h+rad*np.sin(angle)
    pix=sample(src,rx,ry)
    alpha=pix[:,:,3]
    rgb=pix[:,:,:3]/np.maximum(alpha[...,None],.001)
    rgb[:,:,1]=np.clip((rgb[:,:,1]-.15)*1.17+.15,0,1)
    rgb[:,:,2]*=.76
    mask=smooth(gap+.008,gap+.105,np.abs(a))
    fade=smooth(66,61,r)*smooth(9,17,r)
    lum=np.clip((rgb[:,:,1]-.13)/.67,0,1)
    # Restrict the diffuse red haze, leaving the painted folds intact.
    vivid=rgb.copy()
    vivid[:,:,0]=np.clip((rgb[:,:,0]-.21)*1.24,0,1)
    vivid[:,:,1]=np.clip((rgb[:,:,1]-.09)*1.19,0,1)
    vivid[:,:,2]*=.73
    fire_detail=smooth(.20,.76,alpha)*(.57+.43*smooth(.015,.45,lum))
    haze=alpha*.33
    back=rgba(vivid,(fire_detail+(1-fire_detail)*haze)*mask*fade)
    # Render portions of the actual fire drawing over the jade, confined
    # to the band. Broad alpha remains faint; only narrow hot folds brighten.
    jade=smooth(34.6,35.8,r)*smooth(45.4,44.2,r)
    # Offset the surface sampling so distinct narrow flames move over the
    # face, connected to the same bright roots as the surrounding fire.
    wrap_angle=angle+.043*np.sin(7*a-t)
    wrap_radius=(40+d*.63+2.6*np.sin(5*a-t+d*.2))*9.2
    front=sample(src,.475*w+wrap_radius*np.cos(wrap_angle),.477*h+wrap_radius*np.sin(wrap_angle))
    front_alpha=front[:,:,3]
    front_rgb=front[:,:,:3]/np.maximum(front_alpha[...,None],.001)
    ink=smooth(.30,.79,front_rgb[:,:,1])
    foreground=rgba(front_rgb,front_alpha*jade*mask*(.015+.43*ink))
    for layer,im in enumerate((back,foreground)):
        atlas.paste(im,((f%4)*S,(layer*2+f//4)*S))
out=Path(__file__).resolve().parents[1] / 'public/assets/art-rose/burst-fire.webp'
for q in (86,78,70,62,54,46,38,32,26,20,14):
    atlas.save(out,'WEBP',quality=q,alpha_quality=48,method=6)
    if out.stat().st_size<77700:
        print(out.stat().st_size,q)
        break
else:
    raise RuntimeError(f'Atlas exceeds image budget: {out.stat().st_size}')
