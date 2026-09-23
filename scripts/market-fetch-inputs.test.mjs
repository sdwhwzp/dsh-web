/**
 * market-fetch-inputs contract: the lockfile is the only pin, an input is
 * "ok" only when the pinned commit is unpacked, and a check run never
 * downloads. Network fetching is covered by the real fetch in CI/deploy.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cacheDir,
  loadLockfile,
  planInputs,
  readStamp,
  stampPath,
  tarballUrl,
} from './market-fetch-inputs.mjs'

const SHA = 'a'.repeat(40)

function fixtureLock(inputs) {
  const root = mkdtempSync(join(tmpdir(), 'market-inputs-lock-'))
  writeFileSync(join(root, 'market-inputs.lock.json'), JSON.stringify({ version: 1, inputs }))
  return root
}

const GOOD = { skins: { repo: 'owner/dsh-skins', sha: SHA, path: 'skins', target: 'skins' } }

test('loadLockfile accepts a well-formed lockfile', () => {
  const root = fixtureLock(GOOD)
  try {
    const lock = loadLockfile(root)
    assert.equal(lock.inputs.skins.repo, 'owner/dsh-skins')
    assert.equal(lock.inputs.skins.sha, SHA)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('loadLockfile rejects a short sha, an unsafe path and an unknown version', () => {
  const cases = [
    [{ skins: { ...GOOD.skins, sha: 'abc1234' } }, /full 40-character/],
    [{ skins: { ...GOOD.skins, path: '../escape' } }, /unsafe path/],
    [{ skins: { ...GOOD.skins, repo: 'no-slash' } }, /invalid repo/],
  ]
  for (const [inputs, expected] of cases) {
    const root = fixtureLock(inputs)
    try {
      assert.throws(() => loadLockfile(root), expected)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test('planInputs reports missing, stale and ok against the cache stamp', () => {
  const root = fixtureLock(GOOD)
  const cache = mkdtempSync(join(tmpdir(), 'market-inputs-cache-'))
  try {
    const lock = loadLockfile(root)
    assert.equal(planInputs(lock, cache)[0].state, 'missing')

    // A stamp for a different commit with content on disk is stale, not ok.
    mkdirSync(join(cache, 'skins'), { recursive: true })
    writeFileSync(stampPath(cache, 'skins'), `${'b'.repeat(40)}\n`)
    assert.equal(planInputs(lock, cache)[0].state, 'stale')

    writeFileSync(stampPath(cache, 'skins'), `${SHA}\n`)
    const planned = planInputs(lock, cache)[0]
    assert.equal(planned.state, 'ok')
    assert.equal(planned.dir, join(cache, 'skins'))
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(cache, { recursive: true, force: true })
  }
})

test('planInputs honours the only filter', () => {
  const lock = {
    version: 1,
    inputs: {
      skins: GOOD.skins,
      pet: { repo: 'owner/dsh-pet', sha: SHA, path: 'assets', target: 'pet' },
    },
  }
  const names = planInputs(lock, '/nonexistent-cache', ['pet']).map(input => input.name)
  assert.deepEqual(names, ['pet'])
})

test('readStamp returns null when nothing was unpacked', () => {
  const cache = mkdtempSync(join(tmpdir(), 'market-inputs-empty-'))
  try {
    assert.equal(readStamp(cache, 'skins'), null)
  } finally {
    rmSync(cache, { recursive: true, force: true })
  }
})

test('cacheDir prefers MARKET_INPUTS_DIR and otherwise sits at the repository root', () => {
  assert.match(cacheDir({ MARKET_INPUTS_DIR: '/tmp/custom-inputs' }), /custom-inputs$/)
  assert.match(cacheDir({}), /[.]market-inputs$/)
})

test('tarballUrl addresses the codeload tarball for the pinned commit', () => {
  assert.equal(
    tarballUrl('owner/dsh-skins', SHA),
    `https://codeload.github.com/owner/dsh-skins/tar.gz/${SHA}`,
  )
})
