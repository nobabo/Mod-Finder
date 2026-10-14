export function nativeArtifactName(platform, version) {
  if (!['windows', 'android'].includes(platform) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid native artifact version or platform');
  return platform === 'windows' ? `ModFinder-${version}-Windows-x64-setup.exe` : `ModFinder-${version}-Android.apk`;
}
