import { describe, expect, it } from 'vitest'
import { currentSessionIdOf } from '../client/current-session.ts'

describe('currentSessionIdOf', () => {
  it('reads the pre-alpha.2 current field first', () => {
    expect(currentSessionIdOf({ current: 's-1', byId: { 's-2': { retainedBy: { mainView: 1 } } } })).toBe('s-1')
  })

  it('falls back to the row retained by the main view on 0.1.6-alpha.2', () => {
    const list = {
      byId: {
        's-1': { retainedBy: { sidebarChat: 1 } },
        's-2': { retainedBy: { mainView: 1, sidebarChat: 2 } },
        's-3': { retainedBy: {} },
      },
    }
    expect(currentSessionIdOf(list)).toBe('s-2')
  })

  it('returns undefined without a selection, rows, or list', () => {
    expect(currentSessionIdOf(undefined)).toBeUndefined()
    expect(currentSessionIdOf({})).toBeUndefined()
    expect(currentSessionIdOf({ current: undefined, byId: { 's-1': { retainedBy: { mainView: 0 } }, 's-2': undefined } })).toBeUndefined()
  })
})
