"""Refresh bundled WOFFs from official Noto sources; requires fonttools.
Usage: python3 scripts/subset-fonts.py --song /path/NotoSerifSC.ttf --text /path/NotoSansCJKsc-Regular.otf
Use --check to verify Chinese source coverage without rebuilding.
"""
import argparse
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
parser=argparse.ArgumentParser()
parser.add_argument('--song');parser.add_argument('--text');parser.add_argument('--check',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
source=''.join(p.read_text() for p in (root/'src').glob('*.ts'))
required={ord(c) for c in source if '\u4e00'<=c<='\u9fff'}
for name,path in [('song',args.song),('text',args.text)]:
 target=root/'public/assets/fonts'/('jade-'+name+'.woff')
 old=TTFont(target)
 if not args.check:
  if not path:parser.error('--song and --text are required for refresh')
  font=TTFont(path);options=subset.Options();options.layout_features=['*']
  tool=subset.Subsetter(options=options);tool.populate(unicodes=set(old.getBestCmap())|required);tool.subset(font)
  if 'fvar' in font:font=instantiateVariableFont(font,{'wght':200},inplace=True)
  font.flavor='woff';font.save(target)
 actual=TTFont(target).getBestCmap();missing=required-set(actual)
 if missing:raise SystemExit(name+' missing: '+''.join(chr(c) for c in sorted(missing)))
 print(name+': all '+str(len(required))+' Chinese source characters covered; '+str(target.stat().st_size)+' bytes')
