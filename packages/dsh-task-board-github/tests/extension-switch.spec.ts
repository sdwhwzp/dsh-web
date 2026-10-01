/**
 * The provider's master switch, against the board's own gate.
 *
 * The board gates a provider on its own master switch AND the provider's
 * `enabled()` (its registry's documented rule); this extension's own gate is
 * that it never admits itself while off. The fake board mirrors the board's
 * rule and the board's own suite proves that rule against the real registry —
 * together these cases pin what an operator gets: no polling, no write-back, no
 * tools, no seats, and no data lost.
 *
 * The wiring itself — what happens when the board's service is published after
 * this extension activates, and how a switch flip reaches the registration —
 * is driven on a real cordis registry in `extension-injection.spec.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { TaskBoardExtensionHost } from '../src/core/contract.ts'
import type { TaskBoardExtension } from '../src/core/contract.ts'
import type { GitHubRepoConfig } from '../src/core/types.ts'
import { GitHubApiClient } from '../src/host/client.ts'
import { createGitHubExtension } from '../src/host/extension.ts'
import { FakeBoard, recordingTimers } from './support/fake-board.ts'
import { FakeGitHubBackend, issueFixture } from './support/fake-github.ts'

const REPO: GitHubRepoConfig = { owner: 'deepseek-ai', repository: 'dsh', inclusionLabel: 'dsh' }

/** Build a provider bound to a live switch the test can flip. */
function provider(options: {
  enabled: () => boolean
  backend: FakeGitHubBackend
  timers: ReturnType<typeof recordingTimers>['timers']
}): TaskBoardExtension {
  return createGitHubExtension({
    enabled: options.enabled,
    repositories: [REPO],
    client: new GitHubApiClient({ token: 'test-token', fetch: options.backend.fetch }),
    timers: options.timers,
    now: () => 100,
  })
}

describe('GitHub extension master switch', () => {
  it('operator tool access is checked again on every invocation after account revocation', async () => {
    // Given a live provider whose Host authorization can be revoked without remounting.
    const board = new FakeBoard()
    const tools: ToolDefinition[] = []
    let allowed = true
    let host: TaskBoardExtensionHost | undefined
    board.admit({ id: 'github', apiVersion: 1, start: value => { host = value } })
    if (host === undefined) throw new Error('missing fixture capability')
    const extension = createGitHubExtension({
      repositories: [],
      assertAccess: () => { if (!allowed) throw new Error('account revoked') },
    })
    extension.start?.({ ...host, registerTool: tool => { tools.push(tool); return () => {} } })
    try {
      // When the same five tools run before and after revocation, then all reject the revoked account.
      expect(tools).toHaveLength(5)
      const cases: Record<string, Record<string, unknown>> = {
        task_board_github_list: {},
        task_board_github_get: { taskId: 'missing' },
        task_board_github_refresh: {},
        task_board_github_create_pr: { taskId: 'missing', headBranch: 'dev' },
        task_board_github_link_pr: { taskId: 'missing', pullRequestNumber: 1 },
      }
      for (const tool of tools) {
        allowed = true
        const result = await tool.execute(cases[tool.name], {} as never) as { tasks?: unknown[]; code?: string }
        if (tool.name === 'task_board_github_list') expect(result.tasks).toEqual([])
        else expect(result.code).toBe(tool.name === 'task_board_github_get' ? 'not-found' : tool.name === 'task_board_github_refresh' ? 'not-configured' : 'not-github-task')
        allowed = false
        await expect(tool.execute(cases[tool.name], {} as never)).rejects.toThrow('account revoked')
      }
    } finally {
      extension.stop?.()
    }
  })

  it('operator with the extension switched off gets no provider surface and keeps the stored data', () => {
    // Given a board holding a synchronized card and a provider whose switch is off
    const board = new FakeBoard()
    const backend = new FakeGitHubBackend()
    backend.issues = [issueFixture(10, ['dsh'])]
    const recorder = recordingTimers()
    const stored = board.seed({
      id: 'task-stored',
      title: 'Already synchronized',
      integrations: {
        github: {
          provider: 'github',
          owner: 'deepseek-ai',
          repository: 'dsh',
          issueNumber: 10,
          issueUrl: 'https://github.com/deepseek-ai/dsh/issues/10',
          remoteLabels: ['dsh'],
        },
      },
    })
    const extension = provider({ enabled: () => false, backend, timers: recorder.timers })

    // When the board applies its own gate to the provider
    board.admit(extension)

    // Then nothing about the provider is running: no poll timer, no tool, no
    // published summary, no HTTP, and the switch reads off to the board
    expect(board.isActive('github')).toBe(false)
    expect(recorder.armed).toEqual([])
    expect(board.toolNames).toEqual([])
    expect(board.published).toEqual({})
    expect(backend.requests).toBe(0)
    expect(extension.enabled?.()).toBe(false)

    // And the data already on the board is untouched
    expect(board.records.get(stored.id)?.integrations).toEqual(stored.integrations)
  })

  it('operator switching the extension off after it ran stops polling, write-back and the tools', async () => {
    // Given a running provider with one synchronized card
    const board = new FakeBoard()
    const backend = new FakeGitHubBackend()
    backend.issues = [issueFixture(20, ['dsh'])]
    const recorder = recordingTimers()
    let live = true
    const extension = provider({ enabled: () => live, backend, timers: recorder.timers })
    board.admit(extension)
    expect(board.isActive('github')).toBe(true)
    expect(board.toolNames).toHaveLength(5)
    expect(recorder.armed).toEqual([{ kind: 'interval', delay: 300_000 }])

    // When the operator turns the switch off and the board re-applies its gate
    live = false
    board.reconcile()

    // Then polling is released, the tools are unregistered, the published
    // summary clears, and a later status change no longer reaches GitHub
    expect(recorder.cancelledCount()).toBe(1)
    expect(board.toolNames).toEqual([])
    expect(board.published).toEqual({})
    const requestsWhileRunning = backend.requests
    board.emitStatusChanged({ taskId: 'task-stored', status: 'done', previous: 'todo' })
    expect(backend.requests).toBe(requestsWhileRunning)
  })
})
