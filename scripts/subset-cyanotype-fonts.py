"""Usage: python scripts/subset-cyanotype-fonts.py <original-blue-site-directory>

Optional tooling: fonttools and brotli. Output includes only glyphs used by
the original MV code/data and our player, with the upstream OFL licenses.
"""
import shutil
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
site = Path(sys.argv[1])
fonts = site.parent / 'src/app/fonts'
target = ROOT / 'player-sites/dingying-lanshai/fonts'
target.mkdir(parents=True, exist_ok=True)
text = ''.join((site / name).read_text() for name in ['mv.js', 'data.js', 'index.html'])
text += (ROOT / 'player-sites/dingying-lanshai/index.html').read_text()
for original, name, glyphs in [
    ('NotoSerifSC-VF.ttf', 'NotoSerifSC-subset.woff2', text),
    ('CormorantGaramond-Italic-VF.ttf', 'CormorantGaramond-Italic-subset.woff2', ''.join(map(chr, list(range(256)) + list(range(0x2010, 0x2027))))),
]:
    font = TTFont(fonts / original)
    options = subset.Options()
    options.hinting = False
    sub = subset.Subsetter(options=options)
    sub.populate(text=glyphs)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(target / name)
    print(name, (target / name).stat().st_size, 'bytes')
for license in fonts.glob('OFL_*.txt'):
    shutil.copy2(license, target / license.name)
