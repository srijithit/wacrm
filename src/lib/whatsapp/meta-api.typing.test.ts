import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendTypingIndicator, markMessageAsRead } from './meta-api'

/**
 * Meta's typing indicator is a field on the read-status update: one
 * POST to /{phone_number_id}/messages both marks the inbound read and
 * shows "typing…" for up to 25 s (or until the business replies). The
 * endpoint answers `{ success: true }` — no message id (issue #527).
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators
 */

let capturedUrl: string | null = null
let capturedInit: RequestInit | null = null

const BASE = { phoneNumberId: 'pn-1', accessToken: 'tok' } as const

beforeEach(() => {
  capturedUrl = null
  capturedInit = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendTypingIndicator', () => {
  it('posts the read-status + typing_indicator envelope for the inbound wamid', async () => {
    await sendTypingIndicator({ ...BASE, messageId: 'wamid.inbound-1' })
    expect(capturedUrl).toBe('https://graph.facebook.com/v21.0/pn-1/messages')
    expect(capturedInit?.method).toBe('POST')
    expect(capturedInit?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.inbound-1',
      typing_indicator: { type: 'text' },
    })
  })

  it('surfaces Meta error messages so the caller can log them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { message: '(#100) Invalid message id', code: 100 } }),
          { status: 400 },
        ),
      ),
    )
    await expect(
      sendTypingIndicator({ ...BASE, messageId: 'wamid.bogus' }),
    ).rejects.toThrow('(#100) Invalid message id')
  })

  it('falls back to plain read status if typing_indicator is rejected', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const parsedBody = JSON.parse(String(init.body))
        calls.push({ url, body: parsedBody })
        if (calls.length === 1) {
          // First call with typing_indicator fails
          return new Response(
            JSON.stringify({ error: { message: '(#100) Param typing_indicator is not valid', code: 100 } }),
            { status: 400 },
          )
        }
        // Second call with plain read succeeds
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }),
    )

    await expect(
      sendTypingIndicator({ ...BASE, messageId: 'wamid.inbound-1' }),
    ).resolves.toBeUndefined()

    expect(calls).toHaveLength(2)
    expect(calls[0].body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.inbound-1',
      typing_indicator: { type: 'text' },
    })
    expect(calls[1].body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.inbound-1',
    })
  })
})

describe('markMessageAsRead', () => {
  it('posts the plain read status envelope', async () => {
    await markMessageAsRead({ ...BASE, messageId: 'wamid.inbound-2' })
    expect(capturedUrl).toBe('https://graph.facebook.com/v21.0/pn-1/messages')
    expect(capturedInit?.method).toBe('POST')
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.inbound-2',
    })
  })
})
