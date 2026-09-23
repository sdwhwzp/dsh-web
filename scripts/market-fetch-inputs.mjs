#!/usr/bin/env node
/**
 * market-fetch-inputs - materialize the market's content sources.
 *
 * The market build no longer reads the skin and pet assets out of this
 * monorepo: they live in their own repositories (dsh-skins, dsh-pet) and are
 * consumed here at the exact commit recorded in market-inputs.lock.json. This
 * script downloads that commit as a tarball and unpacks only the content
 * directory, so no history and no unrelated files are fetched.
 *
 * Usage:
 *   node scripts/market-fetch-inputs.mjs              # fetch missing/stale inputs
 *   node scripts/market-fetch-inputs.mjs --check      # verify only, never download
 *   node scripts/market-fetch-inputs.mjs --force      # refetch every input
 *   node scripts/market-fetch-inputs.mjs --only skins # fetch a subset
 *
 * Environment:
 *   MARKET_INPUTS_DIR   cache directory (default: <repo>/.market-inputs)
 *
 * Exit code is non-zero on any failure: a missing or stale input must never
 * let the market build silently ship a partial catalogue.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(SCRIPT_DIR, '..')
export const LOCKFILE = 'market-inputs.lock.json'
const SHA_RE = /^[0-9a-f]{40}$/
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
/** Records the commit currently unpacked beside the content directory. */
export const STAMP_SUFFIX = '.sha'

/** Cache directory for the unpacked content sources. */
export function cacheDir(env = process.env) {
  return env.MARKET_INPUTS_DIR ? resolve(env.MARKET_INPUTS_DIR) : join(REPO_ROOT, '.market-inputs')
}

/**
 * Read and validate market-inputs.lock.json.
 * @returns {{version: number, inputs: Record<string, {repo: string, sha: string, path: string, target: string}>}}
 */
export function loadLockfile(root = REPO_ROOT) {
  const file = join(root, LOCKFILE)
  if (!existsSync(file)) throw new Error(`${LOCKFILE} not found at ${file}`)
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  if (parsed.version !== 1) throw new Error(`${LOCKFILE}: unsupported version ${parsed.version}`)
  const inputs = parsed.inputs
  if (inputs === null || typeof inputs !== 'object' || Object.keys(inputs).length === 0) {
    throw new Error(`${LOCKFILE}: "inputs" must be a non-empty object`)
  }
  for (const [name, input] of Object.entries(inputs)) {
    if (input === null || typeof input !== 'object') throw new Error(`${LOCKFILE}: input "${name}" must be an object`)
    for (const key of ['repo', 'sha', 'path', 'target']) {
      if (typeof input[key] !== 'string' || input[key] === '') {
        throw new Error(`${LOCKFILE}: input "${name}" is missing a string "${key}"`)
      }
    }
    if (!REPO_RE.test(input.repo)) throw new Error(`${LOCKFILE}: input "${name}" has an invalid repo "${input.repo}"`)
    if (!SHA_RE.test(input.sha)) throw new Error(`${LOCKFILE}: input "${name}" must pin a full 40-character commit sha`)
    if (input.path.startsWith('/') || input.path.includes('..')) {
      throw new Error(`${LOCKFILE}: input "${name}" has an unsafe path "${input.path}"`)
    }
  }
  return parsed
}

/** Path of the stamp recording which commit is unpacked for one input. */
export function stampPath(cache, target) {
  return join(cache, `${target}${STAMP_SUFFIX}`)
}

/** The commit currently unpacked for one input, or null. */
export function readStamp(cache, target) {
  try {
    return readFileSync(stampPath(cache, target), 'utf8').trim()
  } catch {
    return null
  }
}

/**
 * Resolve every input against the cache: "ok" means the pinned commit is
 * already unpacked and the content directory is present.
 */
export function planInputs(lock, cache, only) {
  const plan = []
  for (const [name, input] of Object.entries(lock.inputs)) {
    if (only !== undefined && !only.includes(name)) continue
    const dir = join(cache, input.target)
    const stamp = readStamp(cache, input.target)
    let state = 'missing'
    if (stamp === input.sha && existsSync(dir)) state = 'ok'
    else if (stamp !== null && stamp !== input.sha) state = 'stale'
    plan.push({ name, ...input, dir, stamp, state })
  }
  return plan
}

/** Tarball URL for a repository commit (no history, no unrelated blobs). */
export function tarballUrl(repo, sha) {
  return `https://codeload.github.com/${repo}/tar.gz/${sha}`
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} failed: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

/** Fetch one input: download the pinned commit, unpack its content directory. */
export async function fetchInput(input, cache) {
  const work = join(cache, `.work-${input.target}`)
  const tarball = join(work, 'source.tgz')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  try {
    await download(tarballUrl(input.repo, input.sha), tarball)
    const untar = spawnSync('tar', ['-xzf', tarball, '-C', work], { stdio: 'inherit' })
    if (untar.status !== 0) throw new Error(`tar failed for ${input.repo}@${input.sha.slice(0, 9)}`)
    const repoName = input.repo.split('/').pop()
    const unpacked = readdirSync(work).find(entry => entry.startsWith(`${repoName}-`))
    if (unpacked === undefined) throw new Error(`unexpected tarball layout for ${input.repo}`)
    const source = join(work, unpacked, input.path)
    if (!existsSync(source)) {
      throw new Error(`${input.repo}@${input.sha.slice(0, 9)} has no "${input.path}" directory`)
    }
    rmSync(input.dir, { recursive: true, force: true })
    mkdirSync(dirname(input.dir), { recursive: true })
    renameSync(source, input.dir)
    writeFileSync(stampPath(cache, input.target), `${input.sha}\n`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/** Fetch every planned input that is not already at the pinned commit. */
export async function fetchAll(plan, cache, { force = false, log = console } = {}) {
  const fetched = []
  for (const input of plan) {
    if (input.state === 'ok' && !force) {
      log.log(`[market-inputs] ${input.name}: ${input.sha.slice(0, 9)} already unpacked`)
      continue
    }
    log.log(`[market-inputs] ${input.name}: fetching ${input.repo}@${input.sha.slice(0, 9)}`)
    await fetchInput(input, cache)
    log.log(`[market-inputs] ${input.name}: unpacked into ${input.dir}`)
    fetched.push(input.name)
  }
  return fetched
}

async function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const force = args.includes('--force')
  const onlyIndex = args.indexOf('--only')
  const only = onlyIndex === -1 ? undefined : args.slice(onlyIndex + 1).filter(a => !a.startsWith('--'))
  const cache = cacheDir()

  let lock
  try {
    lock = loadLockfile()
  } catch (error) {
    console.error(`market-fetch-inputs: ${error.message}`)
    process.exit(1)
  }
  if (only !== undefined) {
    const unknown = only.filter(name => !(name in lock.inputs))
    if (unknown.length > 0) {
      console.error(`market-fetch-inputs: unknown input(s): ${unknown.join(', ')}`)
      process.exit(1)
    }
  }

  const plan = planInputs(lock, cache, only)
  if (check) {
    const broken = plan.filter(input => input.state !== 'ok')
    for (const input of plan) {
      const detail = input.state === 'ok' ? input.sha.slice(0, 9) : `${input.state} (have ${input.stamp === null ? 'nothing' : input.stamp.slice(0, 9)})`
      console.log(`[market-inputs] ${input.name}: ${detail}`)
    }
    if (broken.length > 0) {
      console.error(`market-fetch-inputs: run "node scripts/market-fetch-inputs.mjs" first`)
      process.exit(1)
    }
    console.log('[market-inputs] check OK')
    return
  }

  try {
    await fetchAll(plan, cache, { force })
  } catch (error) {
    console.error(`market-fetch-inputs: ${error.message}`)
    process.exit(1)
  }
  console.log(`[market-inputs] ready in ${cache}`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main()
}
