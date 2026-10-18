"""Rebuild runtime PNGs from retained masters. Requires Pillow 9.1+.

Do not crop: full-image coordinates are part of the jade UV registration.
The tray is encoded losslessly at its original resolution.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source'
TARGET = ROOT / 'public/assets'
NAMES = ['amber', 'peach', 'celadon', 'ice', 'ivory']
sizes = {f'jade-v2/{name}.png': (512, 512) for name in NAMES}
sizes.update({'art-v3/clasp.png': (128, 49), 'shadow.png': (256, 256),
              'art-rose/tray.png': None})
for name, size in sizes.items():
    with Image.open(SOURCE / name) as original:
        image = original.convert('RGBA')
        if size:
            image = image.resize(size, Image.Resampling.LANCZOS)
        image.save(TARGET / name, optimize=True, compress_level=9)
        print(f'{name}: {original.size} -> {image.size}, '
              f'{(SOURCE / name).stat().st_size} -> {(TARGET / name).stat().st_size} bytes')

profiles = json.loads((SOURCE / 'jade-profiles.json').read_text())
for name, profile in profiles.items():
    width, height = sizes[f'jade-v2/{name}.png']
    sx, sy = width / profile['width'], height / profile['height']
    assert abs(sx - sy) < 1e-12, 'Radial profiles require uniform scaling'
    profile['cx'] *= sx
    profile['cy'] *= sy
    for edge in ['inner', 'outer']:
        profile[edge] = [radius * sx for radius in profile[edge]]
    profile['width'], profile['height'] = width, height
(ROOT / 'src/jade-profiles.js').write_text('export default ' +
    json.dumps(profiles, separators=(',', ':')) + ';\n')
