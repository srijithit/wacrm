import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDrain = vi.fn().mockResolvedValue(1)
const mockExpire = vi.fn().mockResolvedValue(0)
const mockRequeue = vi.fn().mockResolvedValue(0)

vi.mock('@/lib/automations/engine', () => ({
  drainDuePendingExecutions: () => mockDrain(),
  expireAwaitingReplies: () => mockExpire(),
  requeueStalledExecutions: () => mockRequeue(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}))

import { GET } from './route'

describe('GET /api/automations/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AUTOMATION_CRON_SECRET
    delete process.env.CRON_SECRET
  })

  it('answers 503 when cron secrets are not configured and unauthenticated', async () => {
    const req = new Request('http://localhost/api/automations/cron')
    const res = await GET(req)
    expect(res.status).toBe(503)
  })

  it('answers 401 when supplied secret does not match', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'correct-secret'
    const req = new Request('http://localhost/api/automations/cron', {
      headers: { 'x-cron-secret': 'wrong-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('runs drain when x-cron-secret matches', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'correct-secret'
    const req = new Request('http://localhost/api/automations/cron', {
      headers: { 'x-cron-secret': 'correct-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(1)
    expect(mockDrain).toHaveBeenCalled()
  })

  it('runs drain when Bearer token matches CRON_SECRET (Vercel Cron)', async () => {
    process.env.CRON_SECRET = 'vercel-cron-secret'
    const req = new Request('http://localhost/api/automations/cron', {
      headers: { authorization: 'Bearer vercel-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(1)
    expect(mockDrain).toHaveBeenCalled()
  })
})
