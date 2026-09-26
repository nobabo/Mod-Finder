import { describe, expect, it, vi } from 'vitest';
import { release } from '../scripts/release';

function harness(fail = '', dirty = true) {
  const calls: string[] = [];
  const tools = {
    run: (command: string, args: string[]) => {
      const call = [command, ...args].join(' ');
      calls.push(call);
      if (call === fail) throw new Error('simulated failure');
      if (call === 'git branch --show-current') return 'main';
      if (call === 'git remote get-url origin') return 'https://github.com/nobabo/Mod-Finder.git';
      if (call === 'git status --porcelain') return dirty ? ' M src/App.tsx' : '';
      if (args[0] === 'commit') dirty = false;
      if (call === 'git rev-parse HEAD') return 'abc123';
      if (call === 'git ls-remote origin refs/heads/main') return 'abc123\trefs/heads/main';
      return '';
    },
    fingerprint: vi.fn(() => 'stable'),
    verifyAssets: vi.fn(async () => { calls.push('verify assets'); }),
    log: vi.fn(),
  };
  return { tools, calls };
}

describe('release workflow', () => {
  it('checks without staging, committing, deploying or pushing', async () => {
    const { tools, calls } = harness();
    await release(true, '', tools);
    expect(calls).toContain('npm run worker:verify');
    expect(calls.some(call => /^(git (add|commit|push)|wrangler deploy)/.test(call))).toBe(false);
  });
  it('stops before committing when tests fail', async () => {
    const { tools, calls } = harness('npm test');
    await expect(release(false, 'release', tools)).rejects.toThrow();
    expect(calls.some(call => call.startsWith('git add'))).toBe(false);
  });
  it('blocks a behind or diverged branch', async () => {
    const { tools, calls } = harness('git merge-base --is-ancestor FETCH_HEAD HEAD');
    await expect(release(false, 'release', tools)).rejects.toThrow();
    expect(calls).not.toContain('npm test');
  });
  it('stops when files change during validation', async () => {
    const { tools, calls } = harness();
    tools.fingerprint.mockReturnValueOnce('before').mockReturnValue('after');
    await expect(release(false, 'release', tools)).rejects.toThrow('검증 중');
    expect(calls.some(call => call.startsWith('git add'))).toBe(false);
  });
  it.each(['wrangler deploy --strict --keep-vars --message abc123', 'node scripts/verify-deployment.mjs https://mod-finder.yjh802637.workers.dev'])('does not push if %s fails', async fail => {
    const { tools, calls } = harness(fail);
    await expect(release(false, 'release', tools)).rejects.toThrow();
    expect(calls.some(call => call.startsWith('git push'))).toBe(false);
  });
  it('verifies deployed assets before pushing the exact commit', async () => {
    const { tools, calls } = harness();
    await release(false, '한글 설명 업데이트', tools);
    expect(calls).toContain('git commit -m 한글 설명 업데이트');
    expect(calls.indexOf('verify assets')).toBeLessThan(calls.indexOf('git push origin abc123:refs/heads/main'));
    expect(calls.at(-1)).toBe('git ls-remote origin refs/heads/main');
  });
  it('retries with an existing commit without creating an empty commit', async () => {
    const { tools, calls } = harness('', false);
    await release(false, 'retry', tools);
    expect(calls.some(call => call.startsWith('git commit'))).toBe(false);
    expect(calls).toContain('git push origin abc123:refs/heads/main');
  });
  it('does not push if production serves old assets', async () => {
    const { tools, calls } = harness();
    tools.verifyAssets.mockRejectedValueOnce(new Error('stale assets'));
    await expect(release(false, 'release', tools)).rejects.toThrow('stale assets');
    expect(calls.some(call => call.startsWith('git push'))).toBe(false);
  });
});
