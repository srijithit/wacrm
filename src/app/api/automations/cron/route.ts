import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  drainDuePendingExecutions,
  expireAwaitingReplies,
  requeueStalledExecutions,
} from '@/lib/automations/engine'

/**
 * Drain due `automation_pending_executions` rows. Can be called on schedule
 * via Vercel Cron, external pingers, or from active CRM client sessions.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET
  const supplied = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = supplied || bearerToken

  let authorized = false

  if (cronSecret && token) {
    const suppliedBuf = Buffer.from(token)
    const expectedBuf = Buffer.from(cronSecret)
    if (
      suppliedBuf.length === expectedBuf.length &&
      timingSafeEqual(suppliedBuf, expectedBuf)
    ) {
      authorized = true
    }
  }

  // Also check AUTOMATION_CRON_SECRET specifically if CRON_SECRET is different
  if (
    !authorized &&
    process.env.AUTOMATION_CRON_SECRET &&
    token
  ) {
    const suppliedBuf = Buffer.from(token)
    const expectedBuf = Buffer.from(process.env.AUTOMATION_CRON_SECRET)
    if (
      suppliedBuf.length === expectedBuf.length &&
      timingSafeEqual(suppliedBuf, expectedBuf)
    ) {
      authorized = true
    }
  }

  // If no secret matched, check if an authenticated CRM user is making the request
  if (!authorized) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        authorized = true
      }
    } catch {
      // Unauthenticated visitor
    }
  }

  if (!authorized) {
    if (!cronSecret) {
      return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Close out wait_for_reply runs whose 24h reply window lapsed.
  const expired = await expireAwaitingReplies()
  const requeued = await requeueStalledExecutions()

  // Drain due pending executions
  const processed = await drainDuePendingExecutions(50)

  return NextResponse.json({ processed, expired, requeued })
}
