import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const changelogJsonPath = path.join(rootDir, 'src', 'data', 'changelog.json');

const args = process.argv.slice(2);
const shouldCommit = args.includes('--commit');
const shouldPush = args.includes('--push');
const isDryRun = args.includes('--dry-run');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch (err) {
    console.error(`Error running command: "${cmd}"`, err);
    throw err;
  }
}

// 1. Get latest commit information
const lastCommitMsg = run('git log -1 --pretty=format:"%s"');
const lastCommitHash = run('git rev-parse --short HEAD');
const today = new Date().toISOString().split('T')[0];

console.log(`Analyzing latest commit: [${lastCommitHash}] "${lastCommitMsg}"`);

// Skip if this is already a release commit or contains [skip ci]
if (lastCommitMsg.includes('[skip ci]') || lastCommitMsg.startsWith('chore(release):')) {
  console.log('Commit contains [skip ci] or is a release commit. Skipping version bump.');
  process.exit(0);
}

// 2. Read package.json and calculate next patch version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version || '0.3.1';
const versionParts = currentVersion.split('.').map(Number);

if (versionParts.length !== 3 || versionParts.some(isNaN)) {
  console.error(`Invalid semver version in package.json: ${currentVersion}`);
  process.exit(1);
}

const nextPatch = versionParts[2] + 1;
const nextVersion = `${versionParts[0]}.${versionParts[1]}.${nextPatch}`;
console.log(`Bumping patch version: ${currentVersion} -> ${nextVersion}`);

// 3. Update package.json
packageJson.version = nextVersion;
if (!isDryRun) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
}

// 4. Update changelog.json
if (fs.existsSync(changelogJsonPath)) {
  const changelog = JSON.parse(fs.readFileSync(changelogJsonPath, 'utf-8'));
  const currentMinorBase = `${versionParts[0]}.${versionParts[1]}.0`;

  let targetRelease = changelog.find(
    (r) => r.version === currentMinorBase || r.version === currentVersion
  );

  if (!targetRelease && changelog.length > 0) {
    targetRelease = changelog[0];
  }

  if (targetRelease) {
    if (!targetRelease.patches) {
      targetRelease.patches = [];
    }

    // Prepend the new patch to the release
    targetRelease.patches.unshift({
      patch: nextVersion,
      date: today,
      commitHash: lastCommitHash,
      changes: [lastCommitMsg],
    });

    console.log(`Added patch entry for v${nextVersion} to changelog.json`);
    if (!isDryRun) {
      fs.writeFileSync(changelogJsonPath, JSON.stringify(changelog, null, 2) + '\n', 'utf-8');
    }
  }
}

// 5. Commit and tag if requested
if (shouldCommit && !isDryRun) {
  console.log(`Creating release commit and tag for v${nextVersion}...`);
  run(`git add "${packageJsonPath}" "${changelogJsonPath}"`);
  run(`git commit -m "chore(release): v${nextVersion} [skip ci]"`);
  run(`git tag -a "v${nextVersion}" -m "Release v${nextVersion}"`);
  console.log(`Successfully committed and tagged v${nextVersion}`);

  if (shouldPush) {
    console.log('Pushing release commit and tags to origin main...');
    run('git push origin main --follow-tags');
    console.log('Push complete.');
  }
}
