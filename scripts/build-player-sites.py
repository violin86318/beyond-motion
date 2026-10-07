"""Stage only known public MV assets; never copy the parent deployment folder.

Usage: python3 scripts/build-player-sites.py sources.json
sources.json maps each work slug to its original public site directory.
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = {
    'dingying-fix': ['dingying.mp3'],
    'dingying-lanshai': ['mv.js', 'data.js', 'app/assets', 'assets/song.mp3', ('../src/app/fonts', 'fonts')],
    'tuigejian-mv': ['app.js', 'audio.mp3', 'fonts'],
    'lingdian-mv': ['env.js', 'gfx.js', 'video.mp4', 'song.mp3'],
}
sources = json.loads(Path(sys.argv[1]).read_text())
for slug, assets in ASSETS.items():
    source = Path(sources[slug])
    target = ROOT / '.local-deploy/players' / slug
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / 'player-sites' / slug / 'index.html', target / 'index.html')
    shutil.copy2(ROOT / 'player-sites/title-cover.css', target / 'title-cover.css')
    for name in ['cover.jpg', 'cover-portrait.jpg']:
        cover = ROOT / 'public/w' / slug / name
        if cover.exists():
            shutil.copy2(cover, target / name)
    for asset in assets:
        source_name, target_name = asset if isinstance(asset, tuple) else (asset, asset)
        src, dst = source / source_name, target / target_name
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    files = [f for f in target.rglob('*') if f.is_file()]
    for file in files:
        assert file.stat().st_size < 25 * 1024 * 1024, file
        assert not any(word in file.name.lower() for word in ['token', 'secret', '.env']), file
    print(f'{slug}: {len(files)} public files staged')
