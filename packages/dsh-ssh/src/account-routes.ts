/** Authenticate every HTTP and terminal request before selecting its SSH engine. */
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import { SshAccounts } from './accounts.ts'
import { makeRoutes, type SshRoutesDeps } from './routes.ts'
import { writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import type { SshEngine } from './engine.ts'

/** Mount one route family while account engines remain private to their verified identities. */
export function makeAccountRoutes(accounts: SshAccounts, local: SshRoutesDeps, enabled: () => boolean): {
  routes: WebRoute[]; upgrade: WebUpgradeRoute
} {
  const base = makeRoutes(local)
  const scopes = new WeakMap<SshEngine, ReturnType<typeof makeRoutes>>()
  const resolve = (req: Parameters<WebRoute['handler']>[0]) => {
    if (!isLoopbackRequest(req)) throw new Error('SSH requires a trusted local gateway')
    if (!enabled()) {
      if (req.headers['x-dsh-principal'] !== undefined || req.headers['x-dsh-principal-signature'] !== undefined) {
        throw new Error('Enable SSH accountIsolation before using an authenticated gateway')
      }
      return base
    }
    const scope = accounts.resolve(accounts.request(req))
    let routes = scopes.get(scope.engine)
    if (routes === undefined) {
      routes = makeRoutes({ ...local, ...scope, accountScoped: true })
      scopes.set(scope.engine, routes)
    }
    return routes
  }
  return {
    routes: base.routes.map((route, index) => ({ ...route, handler: async (req, res) => {
      let routes: ReturnType<typeof makeRoutes>
      try { routes = resolve(req) } catch (error) {
        writeJson(res, 403, { error: error instanceof Error ? error.message : 'SSH access denied' })
        return
      }
      await routes.routes[index].handler(req, res)
    } })),
    upgrade: { ...base.upgrade, handler: (req, socket, head) => {
      let routes: ReturnType<typeof makeRoutes>
      try { routes = resolve(req) } catch {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        return
      }
      return routes.upgrade.handler(req, socket, head)
    } },
  }
}
