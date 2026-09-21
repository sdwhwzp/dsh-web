/**
 * The loopback reverse proxy's connection lifecycle over real HTTP servers:
 * an outer-client abort must stop the inner request, an inner reset must tear
 * the outer leg down without an unhandled error, and normal completion must
 * keep reusing the upstream keep-alive connection.
 */
import { createServer, request as httpRequest, type Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { proxyLoopbackHttp } from '../src/loopback-proxy.ts'

interface TestServer {
  port: number
  close: () => Promise<void>
}

async function listen(server: Server): Promise<TestServer> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return {
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined || error === null) resolve()
        else reject(error)
      })
    }),
  }
}

/** Outer server whose every request is proxied to the given port. */
async function serveProxy(port: number): Promise<TestServer> {
  const server: Server = createServer((req, res) => { proxyLoopbackHttp(req, res, port, req.url ?? '/') })
  return await listen(server)
}

/** One client request; resolves with status, collected body, and the abort error if any. */
function call(port: number, opts: { method?: string; chunked?: boolean; onData?: () => void } = {}): Promise<{
  status: number | undefined
  body: string
  premature: boolean
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, method: opts.method ?? 'GET', ...(opts.chunked === true ? {} : {}) },
      (res) => {
        const chunks: Buffer[] = []
        let premature = false
        res.on('data', (chunk) => { chunks.push(chunk as Buffer); opts.onData?.() })
        res.on('error', () => { premature = true })
        res.on('close', () => {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), premature })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

describe('loopback proxy connection lifecycle', () => {
  it('user aborts an upload after the upstream receives its partial body', async () => {
    // Given a proxied upload, when the client aborts after its body reaches the upstream, then upstream processing aborts without completing.
    let receivedBody!: () => void
    const bodyReceived = new Promise<void>(resolve => { receivedBody = resolve })
    let markAborted!: () => void
    const requestAborted = new Promise<void>(resolve => { markAborted = resolve })
    let innerCompleted = false
    const upstream: Server = createServer((req, res) => {
      req.on('data', receivedBody)
      req.on('end', () => {
        innerCompleted = true
        res.writeHead(200)
        res.end('ok')
      })
      // A proxy-side reset surfaces as ECONNRESET / 'aborted' on the inner request.
      req.on('error', markAborted)
      req.on('aborted', markAborted)
    })
    const up = await listen(upstream)
    const proxy = await serveProxy(up.port)
    const req = httpRequest({ host: '127.0.0.1', port: proxy.port, method: 'POST' })
    req.on('error', () => {})
    try {
      req.write('partial-body-half')
      await bodyReceived
      req.destroy()
      await expect(requestAborted).resolves.toBeUndefined()
      expect(innerCompleted).toBe(false)
    } finally {
      req.destroy()
      upstream.closeAllConnections()
      await proxy.close()
      await up.close()
    }
  })

  it('user receives a premature response when the upstream truncates its body', async () => {
    // Given a response longer than its partial body, when the client receives that part and the upstream resets, then the outer response reports truncation.
    let truncate!: () => void
    const upstream: Server = createServer((req, res) => {
      // Announce a longer body than will ever be sent, then truncate.
      res.writeHead(200, { 'content-length': '64' })
      res.write('half-')
      truncate = () => { res.destroy() }
    })
    const up = await listen(upstream)
    const proxy = await serveProxy(up.port)
    try {
      const result = await call(proxy.port, { onData: () => { truncate() } })
      expect(result.status).toBe(200)
      expect(result.body).toBe('half-')
      expect(result.premature).toBe(true)
    } finally {
      await proxy.close()
      await up.close()
    }
  })

  it('keeps the upstream keep-alive connection across sequential proxied requests', async () => {
    let connections = 0
    const upstream: Server = createServer((req, res) => {
      req.on('data', () => {})
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('hello')
      })
    })
    upstream.on('connection', () => { connections += 1 })
    const up = await listen(upstream)
    const proxy = await serveProxy(up.port)
    try {
      for (let i = 0; i < 5; i += 1) {
        const result = await call(proxy.port)
        expect(result.status).toBe(200)
        expect(result.body).toBe('hello')
        expect(result.premature).toBe(false)
      }
      // One pooled socket serves every request: a naive close-hook that
      // destroyed the upstream on normal completion would open five.
      expect(connections).toBe(1)
    } finally {
      await proxy.close()
      await up.close()
    }
  })
})
