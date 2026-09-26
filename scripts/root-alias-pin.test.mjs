/**
 * Tests for the root alias release contract (issue #1442): the root bundle's
 * dependency must name the exact released aggregate version, because a range
 * can resolve to an aggregate whose exports predate the shipped patch rows, and
 * the root's own version must follow the tag because a git or link install
 * reports it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rootAggregatePinMismatch, rootVersionMismatch } from './lib/root-alias-pin.mjs'

const manifest = spec => ({ dependencies: { '@linxin666/dsh-web-all': spec } })

test('accepts an exact pin on the tag version', () => {
  assert.equal(rootAggregatePinMismatch(manifest('0.3.20'), '0.3.20'), undefined)
})

test('rejects a range, a stale pin, and a missing dependency', () => {
  assert.match(rootAggregatePinMismatch(manifest('^0.3.6'), '0.3.20'), /\^0\.3\.6 does not match tag v0\.3\.20/)
  assert.match(rootAggregatePinMismatch(manifest('0.3.19'), '0.3.20'), /does not match/)
  assert.match(rootAggregatePinMismatch({ dependencies: {} }, '0.3.20'), /\(missing\)/)
  assert.match(rootAggregatePinMismatch({}, '0.3.20'), /\(missing\)/)
  assert.match(rootAggregatePinMismatch(null, '0.3.20'), /\(missing\)/)
})

/** The CLI checks prerelease candidates using the same family inventory as releases. */
test('version CLI accepts the current family tag and rejects an incomplete prerelease', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const pkg = JSON.parse(readFileSync(new URL('../packages/dsh-web-all/package.json', import.meta.url), 'utf8'))
  const run = version => spawnSync(process.execPath, ['scripts/verify-version.mjs', version], { cwd: root, encoding: 'utf8' })
  const accepted = run('v' + pkg.version)
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.match(accepted.stdout, /all \d+ packages, the root version and the root aggregate pin match/)
  const rejected = run('0.3.24-dsh.')
  assert.equal(rejected.status, 2)
  assert.match(rejected.stderr, /usage:/)
})

test('accepts a root version equal to the tag version', () => {
  assert.equal(rootVersionMismatch({ version: '0.3.20' }, '0.3.20'), undefined)
})

test('rejects a stale, missing, or unreadable root version', () => {
  assert.match(rootVersionMismatch({ version: '0.1.1' }, '0.3.20'), /root version 0\.1\.1 does not match tag v0\.3\.20/)
  assert.match(rootVersionMismatch({}, '0.3.20'), /root version \(missing\) does not match tag v0\.3\.20/)
  assert.match(rootVersionMismatch(null, '0.3.20'), /\(missing\)/)
})
