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
import { PetService, type PetAccountScope } from '../src/service.ts'

const FRAME = Buffer.from('RIFF0000WEBP')

function fixture(root: string): { service: PetService; routes: ReturnType<typeof makePetRoutes> } {
  const packageRoot = join(root, 'package')
  const petsRoot = join(root, 'pets')
  const petRoot = join(petsRoot, 'skin-pet')
  mkdirSync(join(packageRoot, 'assets'), { recursive: true })
  mkdirSync(join(petRoot, 'thumb', 'idle'), { recursive: true })
  mkdirSync(join(petRoot, 'thumb', 'blue'), { recursive: true })
  mkdirSync(join(petRoot, 'thumb', 'red'), { recursive: true })
  writeFileSync(join(petRoot, 'thumb', 'idle', '1.webp'), FRAME)
  writeFileSync(join(petRoot, 'thumb', 'blue', '1.webp'), FRAME)
  writeFileSync(join(petRoot, 'thumb', 'red', '1.webp'), FRAME)
  writeFileSync(join(petRoot, 'pet.json'), JSON.stringify({
    petManifestVersion: 2,
    id: 'skin-pet',
    displayName: 'Skin Pet',
    license: 'MIT',
    renderer: 'frames2d',
    frames2d: {
      dir: 'thumb',
      tracks: { idle: { frames: ['1.webp'] }, blue: { frames: ['1.webp'] }, red: { frames: ['1.webp'] } },
      phases: { idle: 'idle' },
      skins: [
        { id: 'blue', label: 'Blue', idleTrack: 'blue' },
        { id: 'red', label: 'Red', idleTrack: 'red' },
      ],
    },
  }), 'utf8')
  const registry = loadPetRegistry({ packageRoot, petsDir: '', dshPetsDir: petsRoot })
  const ctx = new Context()
  const service = new PetService(ctx, { persistDir: join(root, 'home'), registry })
  return { service, routes: makePetRoutes({ service, ctx }) }
}

function principalContext(): Context {
  return {
    get: (name: string) => name === 'requestPrincipal' ? {
      authenticate: (request: Request) => {
        const id = request.headers.get('x-dsh-principal')
        const signature = request.headers.get('x-dsh-principal-signature')
        if (id === null && signature === null) return undefined
        if (id === null || signature !== 'trusted') throw new Error('invalid identity')
        return { source: 'dsh-passwords', id }
      },
    } : undefined,
  } as unknown as Context
}

describe('account-scoped pet skins', () => {
  let root: string | undefined
  let server: Server | undefined

  afterEach(async () => {
    if (server !== undefined) await new Promise<void>(resolve => server!.close(() => resolve()))
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
    server = undefined
    root = undefined
  })

  it('persists skins independently for two accounts and keeps the choice after reload', async () => {
    root = mkdtempSync(join(tmpdir(), 'dsh-pet-account-skin-'))
    const { service } = fixture(root)
    const alice: PetAccountScope = { source: 'dsh-passwords', id: 'alice' }
    const bob: PetAccountScope = { source: 'dsh-passwords', id: 'bob' }

    expect(await service.setSkin('blue', alice)).toEqual({ ok: true, skin: 'blue' })
    expect(await service.setSkin('red', bob)).toEqual({ ok: true, skin: 'red' })
    expect((await service.state(alice)).skin).toBe('blue')
    expect((await service.state(bob)).skin).toBe('red')

    const reloaded = fixture(root).service
    expect((await reloaded.state(alice)).skin).toBe('blue')
    expect((await reloaded.state(bob)).skin).toBe('red')
  })

  it('routes skin writes through the verified principal and rejects a tampered account', async () => {
    root = mkdtempSync(join(tmpdir(), 'dsh-pet-account-skin-route-'))
    const { service } = fixture(root)
    const ctx = principalContext()
    const routes = makePetRoutes({ service, ctx })
    server = createServer((req, res) => {
      const path = (req.url ?? '').split('?')[0]
      const route = routes.find(candidate => candidate.kind === 'exact' && candidate.path === path)
      if (route === undefined) { res.writeHead(404); res.end(); return }
      void route.handler(req, res)
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port
    const endpoint = (path: string): string => `http://127.0.0.1:${port}${path}`
    const headers = (id: string, signature = 'trusted'): Record<string, string> => ({
      'content-type': 'application/json',
      'x-dsh-principal': id,
      'x-dsh-principal-signature': signature,
    })

    const changed = await fetch(endpoint('/api/pet/set-skin'), {
      method: 'POST', headers: headers('alice'), body: JSON.stringify({ skin: 'blue' }),
    })
    expect(changed.status).toBe(200)
    const bobChanged = await fetch(endpoint('/api/pet/set-skin'), {
      method: 'POST', headers: headers('bob'), body: JSON.stringify({ skin: 'red' }),
    })
    expect(bobChanged.status).toBe(200)
    expect((await fetch(endpoint('/api/pet/state'), { headers: headers('alice') }).then(res => res.json())).skin).toBe('blue')
    expect((await fetch(endpoint('/api/pet/state'), { headers: headers('bob') }).then(res => res.json())).skin).toBe('red')

    const rejected = await fetch(endpoint('/api/pet/set-skin'), {
      method: 'POST', headers: headers('alice', 'tampered'), body: JSON.stringify({ skin: undefined }),
    })
    expect(rejected.status).toBe(403)
    expect((await fetch(endpoint('/api/pet/state'), { headers: headers('alice') }).then(res => res.json())).skin).toBe('blue')
  })
})
