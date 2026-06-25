import { Resend } from 'resend'
import { env } from '@/lib/env'

// Lazily instantiate so the app doesn't crash if the key is missing in dev.
let _resend: Resend | null = null

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}

// The "from" address. Falls back to RESEND_DEFAULT_FROM, then to Resend's shared sender.
const FROM_ADDRESS =
  env.resendDefaultFrom || process.env.RESEND_FROM_EMAIL || 'HyperCRM <noreply@email.hypercrm.ca>'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  // Optional verified sender, e.g. "Acme Sales <sales@acme.com>".
  // Falls back to the configured/default FROM_ADDRESS when omitted.
  from?: string
  // Optional reply-to address for inbound routing.
  replyTo?: string
  // Optional attachments — Resend accepts a path/URL or base64 content.
  attachments?: { filename: string; path?: string; content?: string }[]
}

export interface SendEmailResult {
  sent: boolean
  error: string | null
  messageId?: string
}

/**
 * Sends an email via Resend.
 * If RESEND_API_KEY is not configured, the email content is logged to the
 * console instead (development fallback) and `sent` is returned as false.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  attachments,
}: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResend()
  const fromAddress = from || FROM_ADDRESS
  console.log('[email] fromAddress:', JSON.stringify(fromAddress), '| replyTo:', JSON.stringify(replyTo ?? 'NONE'), '| FROM_ADDRESS:', JSON.stringify(FROM_ADDRESS))

  if (!resend) {
    console.warn(
      '[email] RESEND_API_KEY not set — logging email instead of sending.'
    )
    console.log('📧 EMAIL (not sent)')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('HTML:', html)
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachments && attachments.length > 0
        ? { attachments: attachments.map((a) => ({ filename: a.filename, ...(a.path ? { path: a.path } : {}), ...(a.content ? { content: a.content } : {}) })) }
        : {}),
    })

    if (error) {
      console.error('[email] Resend error:', error)
      return { sent: false, error: error.message }
    }

    return { sent: true, error: null, messageId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[email] Exception sending email:', message)
    return { sent: false, error: message }
  }
}
