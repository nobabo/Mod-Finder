import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function androidEnvironment(input = process.env) {
  const env = { ...input };
  env.ANDROID_HOME ||= env.ANDROID_SDK_ROOT || join(env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), 'Android/Sdk');
  env.JAVA_HOME ||= join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr');
  env.NODE_BINARY = process.execPath;
  const java = join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(java)) throw new Error('Android Studio의 JDK 또는 JAVA_HOME을 확인하세요.');
  if (!existsSync(join(env.ANDROID_HOME, 'platforms/android-36/android.jar'))) throw new Error('Android SDK Platform 36을 설치하세요.');
  return { env, java };
}
export function runAndroid(tasks, input = process.env) {
  const { env, java } = androidEnvironment(input);
  const result = spawnSync(java, ['-classpath', join(root, 'tooling/android/gradle/wrapper/gradle-wrapper.jar'), 'org.gradle.wrapper.GradleWrapperMain', '-p', join(root, 'tooling/android'), '--no-daemon', '--console=plain', ...tasks], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Android 빌드 실패 (${result.status ?? result.signal}).`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--check') { androidEnvironment(); console.log('[Android] Kotlin / Compose 빌드 환경 확인 완료.'); }
    else runAndroid(args.length ? args : [':app:assembleDebug']);
  } catch (error) { console.error(`[Android] ${error.message}`); process.exitCode = 1; }
}
