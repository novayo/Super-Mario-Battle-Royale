import { describe, it, expect } from 'vitest';
import { ASSETS } from './assets';
import fs from 'fs';
import path from 'path';

describe('ASSETS', () => {
  const assetKeys = Object.keys(ASSETS) as (keyof typeof ASSETS)[];

  assetKeys.forEach(assetType => {
    const assets = ASSETS[assetType];
    const assetNames = Object.keys(assets) as (keyof typeof assets)[];

    assetNames.forEach(assetName => {
      const assetCategory = assets[assetName as keyof typeof assets] as any;
      const assetCategoryNames = Object.keys(assetCategory);

      assetCategoryNames.forEach(assetKey => {
        const asset = assetCategory[assetKey];
        if (asset && typeof asset.path === 'string') {
          it(`should have a valid path for ${assetType}/${String(assetName)}/${assetKey}`, () => {
            const assetPath = path.join(__dirname, '../../..', 'public', asset.path);
            expect(fs.existsSync(assetPath)).toBe(true);
          });
        }
      });
    });
  });
});
