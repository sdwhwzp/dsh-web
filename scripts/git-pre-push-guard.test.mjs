import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const guard = new URL('./git-pre-push-guard.sh', import.meta.url)

for (const url of [
  'https://github.com/sdwhwzp/dsh-web',
  'https://github.com/sdwhwzp/dsh-web.git',
  'git@github.com:sdwhwzp/dsh-web.git',
  'ssh://git@github.com/sdwhwzp/dsh-web.git',
]) {
  test(`accepts owned fork URL ${url}`, () => {
    const result = spawnSync('bash', [guard.pathname, 'origin', url], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  })
}

for (const remote of ['origin', 'upstream', 'another-fork']) {
  for (const url of [
    'https://github.com/zhu1090093659/dsh-web',
    'git@github.com:someone-else/dsh-web.git',
    'https://github.com/sdwhwzp/dsh-web-redirect',
  ]) {
    test(`rejects ${remote} pushing outside the owned fork: ${url}`, () => {
      const result = spawnSync('bash', [guard.pathname, remote, url], { encoding: 'utf8' })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /BLOCKED/)
    })
  }
}
