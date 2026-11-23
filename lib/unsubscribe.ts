import { createHmac, timingSafeEqual } from 'crypto';
import { query } from '@/lib/db';
import { publicBaseUrl } from '@/lib/event';

/**
 * Disiscrizione dalle comunicazioni promozionali.
 * Il link contiene un token `<email base64url>.<firma HMAC-SHA256>`: non serve login
 * e non si può disiscrivere un indirizzo senza aver ricevuto l'email.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 160 && EMAIL_PATTERN.test(value) && !value.endsWith('@no-email.damai.local');
}

function secret(): string | null {
  const value = process.env.UNSUBSCRIBE_SECRET;
  return value && value.length >= 16 ? value : null;
}

/** true se UNSUBSCRIBE_SECRET è configurato (almeno 16 caratteri). */
export function unsubscribeConfigured(): boolean {
  return secret() !== null;
}

function sign(email: string, key: string): string {
  return createHmac('sha256', key).update(`unsubscribe:${email}`).digest('base64url');
}

export function unsubscribeToken(email: string): string {
  const key = secret();
  if (!key) throw new Error('UNSUBSCRIBE_SECRET non configurato');
  const normalized = normalizeEmail(email);
  return `${Buffer.from(normalized, 'utf8').toString('base64url')}.${sign(normalized, key)}`;
}

/** Email contenuta nel token, oppure null se il token è assente, alterato o non verificabile. */
export function verifyUnsubscribeToken(token: unknown): string | null {
  const key = secret();
  if (!key || typeof token !== 'string' || token.length > 600) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  let email: string;
  try {
    email = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (email !== normalizeEmail(email) || !EMAIL_PATTERN.test(email)) return null;
  const supplied = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(email, key));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return email;
}

export function unsubscribeUrl(email: string): string {
  return `${publicBaseUrl()}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email))}`;
}

/** Registra l'opt-out (idempotente). */
export async function suppressEmail(email: string, source: string): Promise<void> {
  await query(
    `INSERT INTO email_suppressions (email, source) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
    [normalizeEmail(email), source.slice(0, 60)],
  );
}

/** Nasconde la parte locale: `ma•••@dominio.it`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}•••${email.slice(at)}`;
}
