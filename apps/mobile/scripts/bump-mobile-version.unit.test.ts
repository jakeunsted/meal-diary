import { describe, expect, it } from 'vitest';

import {
  applyBump,
  bumpSemver,
  parseBumpPart,
} from '../../../scripts/bump-mobile-version.mjs';

describe('bump-mobile-version', () => {
  it('parses a single semver flag', () => {
    expect(parseBumpPart(['--patch'])).toBe('patch');
    expect(parseBumpPart(['--dry-run', '--minor'])).toBe('minor');
    expect(() => parseBumpPart(['--patch', '--minor'])).toThrow(/Usage/);
    expect(() => parseBumpPart([])).toThrow(/Usage/);
  });

  it('bumps semver parts', () => {
    expect(bumpSemver('1.1.1', 'patch')).toBe('1.1.2');
    expect(bumpSemver('1.1.1', 'minor')).toBe('1.2.0');
    expect(bumpSemver('1.1.1', 'major')).toBe('2.0.0');
  });

  it('updates app, package, lockfile, and gradle versions together', () => {
    const result = applyBump({
      appJson: {
        expo: {
          version: '1.1.1',
          ios: { bundleIdentifier: 'com.mealdiary.app' },
          android: { versionCode: 5 },
        },
      },
      packageJson: { name: 'meal-diary-mobile', version: '1.1.1' },
      lockfile: `    "apps/mobile": {
      "name": "meal-diary-mobile",
      "version": "1.1.1",
    }`,
      gradle: '        versionCode 5\n        versionName "1.1.1"\n',
      part: 'patch',
    });

    expect(result.nextVersion).toBe('1.1.2');
    expect(result.nextVersionCode).toBe(6);
    expect(result.nextBuildNumber).toBe('6');
    expect(result.nextAppJson.expo.version).toBe('1.1.2');
    expect(result.nextAppJson.expo.android.versionCode).toBe(6);
    expect(result.nextAppJson.expo.ios.buildNumber).toBe('6');
    expect(result.nextPackageJson.version).toBe('1.1.2');
    expect(result.nextLockfile).toContain('"version": "1.1.2"');
    expect(result.nextGradle).toContain('versionCode 6');
    expect(result.nextGradle).toContain('versionName "1.1.2"');
  });
});
