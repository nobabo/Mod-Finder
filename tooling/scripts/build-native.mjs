import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAndroid } from './android.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [platform, ...options] = process.argv.slice(2);
const checkOnly = options.length === 1 && options[0] === '--check';
const signingNames = ['MODFINDER_KEYSTORE_PATH', 'MODFINDER_KEYSTORE_PASSWORD', 'MODFINDER_KEY_ALIAS', 'MODFINDER_KEY_PASSWORD'];
const env = {
  ...process.env,
  VITE_API_BASE_URL: 'https://modfinder.pages.dev',
  CARGO_TARGET_DIR: resolve(root, process.env.CARGO_TARGET_DIR || 'output/native'),
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || '2',
};

function requireFile(path, message) {
  if (!existsSync(path)) throw new Error(message);
  return path;
}

function run(executable, args, label) {
  const result = spawnSync(executable, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${label} 실패. 위 오류를 확인하세요.`);
}

function latestInstalled(directory, relativeFile, label) {
  const names = existsSync(directory) ? readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+(?:\.\d+)*$/.test(entry.name))
    .map(entry => entry.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) : [];
  const name = names.find(name => existsSync(join(directory, name, relativeFile)));
  if (!name) throw new Error(`Android SDK Manager에서 ${label}을 설치하세요.`);
  return join(directory, name);
}

function configureAndroid() {
  // Release builds must not leave a Gradle daemon holding generated DEX files on Windows.
  env.GRADLE_OPTS = `${env.GRADLE_OPTS || ''} -Dorg.gradle.daemon=false`.trim();
  env.ANDROID_HOME = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || join(env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), 'Android/Sdk');
  env.JAVA_HOME = env.JAVA_HOME || join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr');
  const java = requireFile(join(env.JAVA_HOME, 'bin/java.exe'), 'Android Studio를 설치하거나 JAVA_HOME을 지정하세요.');
  const buildTools = latestInstalled(join(env.ANDROID_HOME, 'build-tools'), 'lib/apksigner.jar', 'Build Tools');

  const supplied = signingNames.filter(name => env[name]?.trim());
  if (supplied.length && supplied.length !== signingNames.length) {
    throw new Error('Android 서명 환경변수 4개를 모두 지정하거나 모두 해제하세요.');
  }
  if (!supplied.length) {
    const signingDir = join(homedir(), '.mod-finder/signing');
    const settingsPath = join(signingDir, 'android.json');
    let settings;
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); }
    catch { throw new Error(`기존 Android 서명 설정을 복원하세요: ${settingsPath}`); }
    if (!settings || ['store', 'alias', 'password'].some(key => typeof settings[key] !== 'string' || !settings[key].trim())) {
      throw new Error('Android 서명 설정에 store, alias, password가 필요합니다. docs/RELEASE.md를 확인하세요.');
    }
    env.MODFINDER_KEYSTORE_PATH = resolve(signingDir, settings.store);
    env.MODFINDER_KEYSTORE_PASSWORD = settings.password;
    env.MODFINDER_KEY_ALIAS = settings.alias;
    env.MODFINDER_KEY_PASSWORD = settings.password;
  }
  env.MODFINDER_KEYSTORE_PATH = resolve(root, env.MODFINDER_KEYSTORE_PATH);
  requireFile(env.MODFINDER_KEYSTORE_PATH, '기존 Android 서명키 파일을 복원하세요. 새 키로 교체하면 기존 앱을 업데이트할 수 없습니다.');
  return { java, buildTools };
}

try {
  if (!['windows', 'android'].includes(platform) || (options.length && !checkOnly)) {
    throw new Error('사용법: node tooling/scripts/build-native.mjs windows|android [--check]');
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('이 생성기는 Windows x64에서 실행하세요.');
  requireFile(join(root, 'node_modules/tsx/dist/cli.mjs'), '먼저 프로젝트 루트에서 npm ci를 실행하세요.');
  const config = JSON.parse(readFileSync(join(root, 'src/native/tauri.conf.json'), 'utf8'));
  const version = platform === 'android' ? JSON.parse(readFileSync(join(root, 'tooling/config/android.json'), 'utf8')).version : config.version;
  const destination = join(root, 'output/releases', `v${version}`);
  const fileName = platform === 'windows'
    ? `ModFinder-${version}-Windows-x64-setup.exe` : `ModFinder-${version}-Android.apk`;
  const android = platform === 'android' ? configureAndroid() : null;
  console.log(`[Mod Finder] ${platform === 'windows' ? 'Windows NSIS 설치파일' : 'Kotlin 네이티브 Android APK'} 생성`);
  console.log(`[Mod Finder] API: ${new URL(android ? env.MODFINDER_API_URL || env.VITE_API_BASE_URL : env.VITE_API_BASE_URL).origin}`);
  console.log(`[Mod Finder] 저장 위치: ${join(destination, fileName)}`);
  if (checkOnly) {
    console.log('[Mod Finder] 경로와 설정 확인 완료. 빌드는 실행하지 않았습니다.');
  } else {
    // Do not pass Android signing credentials to the Windows build.
    if (!android) for (const name of signingNames) delete env[name];
    if (android) runAndroid([':app:testReleaseUnitTest', ':app:lintRelease', ':app:assembleRelease'], env);
    else run(process.execPath, [join(root, 'tooling/scripts/tauri.mjs'), 'build', '--bundles', 'nsis', '--ci'], '앱 빌드');
    const artifact = android
      ? join(root, 'output/android/gradle/app/outputs/apk/release/app-release.apk')
      : join(env.CARGO_TARGET_DIR, 'release/bundle/nsis', `${config.productName}_${version}_x64-setup.exe`);
    requireFile(artifact, '빌드 결과를 찾을 수 없습니다. 위 빌드 로그를 확인하세요.');
    if (android) {
      run(android.java, ['-jar', join(android.buildTools, 'lib/apksigner.jar'), 'verify', '--verbose', artifact], 'APK 서명 검사');
      run(join(android.buildTools, 'zipalign.exe'), ['-c', '-P', '16', '4', artifact], 'APK 정렬 검사');
    }
    mkdirSync(destination, { recursive: true });
    copyFileSync(artifact, join(destination, fileName));
    const checksums = readdirSync(destination).filter(name => /^ModFinder-.*\.(?:exe|apk)$/.test(name)).sort().map(name => {
      const hash = createHash('sha256').update(readFileSync(join(destination, name))).digest('hex');
      return `${hash}  ${name}`;
    });
    writeFileSync(join(destination, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
    console.log(`\n[Mod Finder] 완료: ${join(destination, fileName)}`);
  }
} catch (error) {
  console.error(`[Mod Finder] ${error.message}`);
  process.exitCode = 1;
}
