#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = join(repoRoot, 'apps/mobile');
const appJsonPath = join(mobileRoot, 'app.json');
const packageJsonPath = join(mobileRoot, 'package.json');
const lockfilePath = join(repoRoot, 'package-lock.json');
const gradlePath = join(mobileRoot, 'android/app/build.gradle');

const LOCKFILE_MOBILE_VERSION =
  /("apps\/mobile": \{\n\s+"name": "meal-diary-mobile",\n\s+"version": ")([^"]+)(")/;

const USAGE = `Bump Meal Diary mobile release versions.

Usage:
  npm run bump-mobile-version -- --patch
  npm run bump-mobile-version -- --minor
  npm run bump-mobile-version -- --major

Options:
  --patch    1.1.1 → 1.1.2
  --minor    1.1.1 → 1.2.0
  --major    1.1.1 → 2.0.0
  --dry-run  Print changes without writing files

Always increments Android versionCode (and iOS buildNumber) by 1.
`;

export const parseBumpPart = (argv) => {
  const flags = argv.filter((arg) => arg.startsWith('--') && arg !== '--dry-run');
  const parts = flags.filter((flag) => ['--major', '--minor', '--patch'].includes(flag));

  if (parts.length !== 1) {
    throw new Error(USAGE.trim());
  }

  return parts[0].slice(2);
};

export const bumpSemver = (version, part) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected semver x.y.z, got "${version}"`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (part === 'major') {
    return `${major + 1}.0.0`;
  }
  if (part === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const writeJson = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const bumpNativeBuildNumber = (value) => {
  const current = Number.parseInt(String(value ?? '0'), 10);
  if (Number.isNaN(current) || current < 0) {
    throw new Error(`Expected a positive integer build number, got "${value}"`);
  }
  return current + 1;
};

export const applyBump = ({ appJson, packageJson, lockfile, gradle, part }) => {
  const currentVersion = appJson.expo?.version;
  const nextVersion = bumpSemver(currentVersion, part);
  const nextVersionCode = bumpNativeBuildNumber(appJson.expo?.android?.versionCode);
  const nextBuildNumber = String(
    bumpNativeBuildNumber(appJson.expo?.ios?.buildNumber ?? appJson.expo?.android?.versionCode)
  );

  const nextAppJson = structuredClone(appJson);
  nextAppJson.expo.version = nextVersion;
  nextAppJson.expo.android.versionCode = nextVersionCode;
  nextAppJson.expo.ios = {
    ...nextAppJson.expo.ios,
    buildNumber: nextBuildNumber,
  };

  const nextPackageJson = structuredClone(packageJson);
  nextPackageJson.version = nextVersion;

  let nextLockfile = lockfile;
  if (typeof lockfile === 'string') {
    if (!LOCKFILE_MOBILE_VERSION.test(lockfile)) {
      throw new Error('Could not find apps/mobile version in package-lock.json');
    }
    nextLockfile = lockfile.replace(LOCKFILE_MOBILE_VERSION, `$1${nextVersion}$3`);
  }

  let nextGradle = gradle;
  if (typeof gradle === 'string') {
    nextGradle = gradle
      .replace(/versionCode \d+/, `versionCode ${nextVersionCode}`)
      .replace(/versionName "[^"]+"/, `versionName "${nextVersion}"`);
  }

  return {
    currentVersion,
    nextVersion,
    nextVersionCode,
    nextBuildNumber,
    nextAppJson,
    nextPackageJson,
    nextLockfile,
    nextGradle,
  };
};

const main = () => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const part = parseBumpPart(argv);

  const appJson = readJson(appJsonPath);
  const packageJson = readJson(packageJsonPath);
  const lockfile = existsSync(lockfilePath) ? readFileSync(lockfilePath, 'utf8') : null;
  const gradle = existsSync(gradlePath) ? readFileSync(gradlePath, 'utf8') : null;

  const result = applyBump({ appJson, packageJson, lockfile, gradle, part });

  console.log(
    `${result.currentVersion} → ${result.nextVersion} (versionCode ${result.nextVersionCode}, iOS build ${result.nextBuildNumber})`
  );

  if (dryRun) {
    console.log('Dry run; no files written.');
    return;
  }

  writeJson(appJsonPath, result.nextAppJson);
  writeJson(packageJsonPath, result.nextPackageJson);
  if (typeof result.nextLockfile === 'string') {
    writeFileSync(lockfilePath, result.nextLockfile);
  }
  if (typeof result.nextGradle === 'string') {
    writeFileSync(gradlePath, result.nextGradle);
  } else {
    console.log('Skipped android/app/build.gradle (run expo prebuild if you need a local native project).');
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
