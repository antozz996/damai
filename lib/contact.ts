import { z } from 'zod';
import { normalizeMetaPhone } from '@/lib/meta-capi';

/**
 * Richieste dal form contatti del sito statico damaigarden.it:
 * validazione e invio dell'email al team (Resend).
 */

/** Stringa opzionale: assente/null/"" = assente, altrimenti tagliata e con lunghezza massima. */
function optionalText(max: number) {
  return z.preprocess(
    value => (value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

/** Normalizza il telefono: toglie spazi, trattini, punti e parentesi; mantiene un eventuale "+" iniziale. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

const phoneField = z.string().trim().max(40).transform(normalizePhone).refine(
  phone => /^\+?\d{6,15}$/.test(phone),
  { message: 'invalid_phone' },
);

const guestsField = z.preprocess(value => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : value;
  }
  return value;
}, z.number().int().min(1).max(3000).optional());

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneField,
  email: z.preprocess(
    value => (value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
    z.string().trim().max(200).email().optional(),
  ),
  eventType: z.string().trim().min(1).max(60),
  eventDate: optionalText(60),
  guests: guestsField,
  details: optionalText(2000),
  locale: z.preprocess(value => value ?? 'it', z.enum(['it', 'en'])),
  page: optionalText(200),
  ref: optionalText(120),
  source: optionalText(300),
  consentMarketing: z.boolean().optional(),
  metaEventId: optionalText(100),
  fbp: optionalText(300),
  fbc: optionalText(300),
});

export type ContactRequest = z.infer<typeof contactSchema>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Intestazioni email: niente a capo (anti header injection). */
function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function contactRecipient(): string {
  return (process.env.CONTACT_NOTIFY_TO || process.env.EMAIL_REPLY_TO || '').trim();
}

export function renderContactEmail(d: ContactRequest) {
  const waNumber = normalizeMetaPhone(d.phone);
  const telHref = `tel:${d.phone}`;
  const waHref = `https://wa.me/${waNumber}`;
  const subject = `Nuova richiesta dal sito: ${oneLine(d.eventType)} – ${oneLine(d.name)}`;

  const rows: Array<[string, string | undefined]> = [
    ['Nome', d.name],
    ['Telefono', d.phone],
    ['Email', d.email],
    ['Tipo di evento', d.eventType],
    ['Data', d.eventDate],
    ['Ospiti', d.guests !== undefined ? String(d.guests) : undefined],
    ['Dettagli', d.details],
    ['Lingua', d.locale],
    ['Pagina', d.page],
    ['Riferimento', d.ref],
    ['Origine', d.source],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const text = [
    'Nuova richiesta dal sito damaigarden.it',
    '',
    ...filled.map(([label, value]) => `${label}: ${value}`),
    '',
    `Chiama: ${telHref}`,
    `WhatsApp: ${waHref}`,
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.5;">
<h2 style="margin:0 0 12px;">Nuova richiesta dal sito</h2>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
${filled.map(([label, value]) => `<tr><td style="vertical-align:top;color:#666;white-space:nowrap;"><strong>${escapeHtml(label)}</strong></td><td style="white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`).join('\n')}
</table>
<p style="margin:16px 0 0;">
<a href="${escapeHtml(telHref)}" style="display:inline-block;padding:10px 16px;background:#222;color:#fff;text-decoration:none;border-radius:4px;">Chiama</a>
&nbsp;
<a href="${escapeHtml(waHref)}" style="display:inline-block;padding:10px 16px;background:#25d366;color:#fff;text-decoration:none;border-radius:4px;">Scrivi su WhatsApp</a>
</p>
</body></html>`;

  return { subject, text, html };
}

/** Invia l'email al team. Solleva se Resend risponde con errore; ritorna false se non configurata. */
export async function sendContactEmail(d: ContactRequest, idempotencyKey: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = contactRecipient();
  if (!apiKey || !from || !to) return false;
  const { subject, text, html } = renderContactEmail(d);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `damai-contact-${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(d.email ? { reply_to: d.email } : {}),
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}`);
  return true;
}
