import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { getSites } from '../src/lib/sites.mjs';

// Kept asynchronous and separate from the synchronous catalogue/fixture interface.
export async function checkSiteCoverArtwork(root = path.resolve(import.meta.dirname, '..'), records = getSites()) {
  const published = records.filter(site => site.status === 'public');
  assert.equal(new Set(published.map(site => site.cover)).size, published.length, '公开小站须各有专用封面');
  for (const site of published) {
    assert(site.cover && site.coverSmall, `公开小站缺少两档封面：${site.id}`);
    for (const [cover, width] of [[site.cover, 1200], [site.coverSmall, 600]]) {
      const file = path.join(root, 'public', cover.replace(/^\/+/, ''));
      const { info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, width, `${site.id}封面宽度`);
      assert.equal(info.height, width * 2 / 3, `${site.id}封面应为3:2`);
    }
  }
  return { entries: published.length, images: published.length * 2 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkSiteCoverArtwork().then(report => console.log(`封面解码通过：${report.entries}站 / ${report.images}图`)).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
