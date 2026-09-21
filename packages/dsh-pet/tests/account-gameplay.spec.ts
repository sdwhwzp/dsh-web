/** Declared gameplay modes use the authenticated account's selected pet. */
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { loadPetRegistry } from '../src/registry.ts'
import { makePetRoutes } from '../src/routes.ts'
import { PetService } from '../src/service.ts'

const ALICE = { source: 'dsh-passwords', id: 'alice' }
const BOB = { source: 'dsh-passwords', id: 'bob' }

function fixture(root: string): PetService {
  for (const [id, mode] of [['plain', 'rest'], ['washing', 'wash']] as const) {
    const petRoot = join(root, 'assets', id)
    mkdirSync(join(petRoot, 'thumb', 'idle'), { recursive: true })
    writeFileSync(join(petRoot, 'thumb', 'idle', '1.webp'), Buffer.from('RIFF0000WEBP'))
    writeFileSync(join(petRoot, 'pet.json'), JSON.stringify({
      petManifestVersion: 2, id, displayName: id, license: 'MIT', renderer: 'frames2d',
      frames2d: { dir: 'thumb', tracks: { idle: { frames: ['1.webp'] } }, phases: { idle: 'idle' } },
      gameplay: { stats: { mood: { max: 100 } }, modes: { [mode]: { label: mode, state: 'idle' } } },
    }))
  }
  return new PetService(new Context(), {
    persistDir: join(root, 'home'),
    registry: loadPetRegistry({ packageRoot: root, petsDir: '', dshPetsDir: '' }),
  })
}

describe('account-scoped declared gameplay modes', () => {
  let root: string | undefined
  let server: Server | undefined

  afterEach(async () => {
    if (server !== undefined) await new Promise<void>(resolve => server!.close(() => resolve()))
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
    server = undefined
    root = undefined
  })

  it('user retains the selected pet mode across responses and reloads without changing other accounts', async () => {
    // Given accounts with different selected pets and declared modes.
    root = mkdtempSync(join(tmpdir(), 'dsh-pet-account-gameplay-'))
    const service = fixture(root)
    await service.setPetId('plain')
    await service.setPetId('plain', BOB)
    await service.setPetId('washing', ALICE)

    // When Alice enters her pet's declared mode.
    const entered = await service.gameplaySetMode('wash', ALICE)

    // Then both the immediate response and persisted view use Alice's manifest.
    expect(entered).toMatchObject({ ok: true, view: { mode: 'wash' } })
    expect((await service.state(ALICE)).gameplay?.mode).toBe('wash')
    expect((await service.state(BOB)).gameplay?.mode).toBeNull()
    expect((await service.state()).gameplay?.mode).toBeNull()
    expect(await service.gameplaySetMode('wash', BOB)).toEqual({ ok: false, error: 'unknown-mode' })
    const reloaded = fixture(root)
    expect((await reloaded.state(ALICE)).gameplay?.mode).toBe('wash')
    expect((await reloaded.state(BOB)).gameplay?.mode).toBeNull()
  })

  it('user changes declared modes only through the verified request principal', async () => {
    // Given the real HTTP routes and a verifier that rejects forged identities.
    root = mkdtempSync(join(tmpdir(), 'dsh-pet-account-mode-route-'))
    const service = fixture(root)
    await service.setPetId('plain')
    await service.setPetId('washing', ALICE)
    const ctx = {
      get: (name: string) => name === 'requestPrincipal' ? {
        authenticate: (request: Request) => {
          const id = request.headers.get('x-dsh-principal')
          if (id === null || request.headers.get('x-dsh-principal-signature') !== 'trusted') throw new Error('invalid identity')
          return { source: 'dsh-passwords', id }
        },
      } : undefined,
    } as unknown as Context
    const routes = makePetRoutes({ service, ctx })
    server = createServer((req, res) => {
      const route = routes.find(candidate => candidate.kind === 'exact' && candidate.path === req.url)
      if (route === undefined) { res.writeHead(404); res.end(); return }
      void route.handler(req, res)
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port
    const post = (mode: string | null, signature: string): Promise<Response> => fetch(`http://127.0.0.1:${port}/api/pet/gameplay/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-principal': 'alice', 'x-dsh-principal-signature': signature },
      body: JSON.stringify({ mode }),
    })

    // When an authenticated change is followed by a forged change.
    const accepted = await post('wash', 'trusted')
    const rejected = await post(null, 'tampered')

    // Then the route preserves Alice's mode and does not select the desktop account.
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ ok: true, view: { mode: 'wash' } })
    expect(rejected.status).toBe(403)
    expect((await service.state(ALICE)).gameplay?.mode).toBe('wash')
    expect((await service.state()).gameplay?.mode).toBeNull()
  })
})
