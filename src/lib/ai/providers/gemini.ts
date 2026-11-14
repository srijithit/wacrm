import { AiError, type ChatMessage, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'
import { getT } from '@/lib/i18n/translate'

const t = getT('LibErrors')

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiPart {
  text?: string
}

interface GeminiContent {
  role?: string
  parts?: GeminiPart[]
}

interface GeminiCandidate {
  content?: GeminiContent
  finishReason?: string
}

interface GeminiUsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  usageMetadata?: GeminiUsageMetadata
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

/**
 * Gemini's generateContent endpoint requires:
 * 1. Alternating user / model roles that start with user.
 * 2. Roles mapped to 'user' and 'model' (not 'assistant').
 */
function normalizeForGemini(messages: ChatMessage[]): GeminiContent[] {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [
      {
        role: 'user',
        parts: [{ text: '(The customer has not sent a message yet.)' }],
      },
    ]
  }
  return merged.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '(empty)' }],
  }))
}

/**
 * Call Google Gemini's generateContent endpoint with the caller's own key.
 * Returns the raw assistant text + token usage (handoff parsing happens
 * in `generateReply`).
 */
export async function generateGemini(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  const cleanModel = model.replace(/^models\//, '')
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(cleanModel)}:generateContent`

  const body: Record<string, unknown> = {
    contents: normalizeForGemini(messages),
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  }

  if (systemPrompt && systemPrompt.trim()) {
    body.system_instruction = {
      parts: [{ text: systemPrompt.trim() }],
    }
  }

  let res: Response | undefined
  const effectiveTimeout = timeoutMs && timeoutMs > 0 ? timeoutMs : 25000
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(effectiveTimeout),
      })
    } catch (err) {
      if (attempt === maxAttempts) throw toNetworkError(err)
      await new Promise((r) => setTimeout(r, 600 * attempt))
      continue
    }

    if ((res.status === 503 || res.status === 429) && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * attempt))
      continue
    }
    break
  }

  if (!res || !res.ok) {
    throw await providerHttpError('Gemini', res!)
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((b) => b.text)
    .filter((b): b is string => typeof b === 'string')
    .join('')
    .trim()

  if (!text) {
    throw new AiError(t('ai.emptyResponse', { provider: 'Gemini' }), {
      code: 'empty_response',
    })
  }

  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  })

  return { text, usage }
}
