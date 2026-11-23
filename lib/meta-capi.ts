import { createHash } from 'crypto';
import { after } from 'next/server';
import { query } from '@/lib/db';

/**
 * Meta Conversions API (tracciamento lato server).
 * Spento finché META_CAPI_TOKEN è vuoto. Chi chiama decide SE inviare (solo con
 * consenso marketing): questo modulo si occupa di hash, invio e registrazione dell'esito.
 * Non blocca mai la risposta all'utente e non solleva mai errori verso chi chiama.
 */

const DEFAULT_PIXEL_ID = '1509117827731348';
const DEFAULT_GRAPH_VERSION = 'v24.0';
const TIMEOUT_MS = 3000;

export function metaCapiEnabled(): boolean {
  return Boolean((process.env.META_CAPI_TOKEN || '').trim());
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Solo cifre, con prefisso internazionale: 39 se manca (numeri italiani). */
export function normalizeMetaPhone(phone: string): string {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  // "39…" è già un prefisso solo se il numero è abbastanza lungo: i cellulari 39x hanno 10 cifre.
  if (!(digits.startsWith('39') && digits.length >= 11)) digits = `39${digits}`;
  return digits;
}

export type MetaUser = { email?: string; phone?: string; firstName?: string; lastName?: string };

/** Dati dell'ospite in SHA-256, come richiesto da Meta (mai in chiaro). */
export function hashMetaUser(user: MetaUser): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const email = (user.email || '').trim().toLowerCase();
  if (email && !email.endsWith('@no-email.damai.local')) out.em = [sha256(email)];
  const phone = normalizeMetaPhone(user.phone || '');
  if (phone) out.ph = [sha256(phone)];
  const firstName = (user.firstName || '').trim().toLowerCase();
  if (firstName) out.fn = [sha256(firstName)];
  const lastName = (user.lastName || '').trim().toLowerCase();
  if (lastName) out.ln = [sha256(lastName)];
  return out;
}

export type MetaEvent = {
  eventName: string;
  eventId: string;
  /** 'website' per le azioni sul sito, 'physical_store' per ciò che avviene di persona in sede. */
  actionSource: 'website' | 'physical_store';
  eventSourceUrl?: string;
  user: MetaUser;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  customData?: Record<string, string | number | boolean>;
};

export type MetaResult = { ok: boolean; status: number; error?: string };

export function buildMetaPayload(event: MetaEvent) {
  const userData: Record<string, unknown> = hashMetaUser(event.user);
  if (event.clientIp && event.clientIp !== 'unknown') userData.client_ip_address = event.clientIp;
  if (event.userAgent) userData.client_user_agent = event.userAgent.slice(0, 500);
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  const testCode = (process.env.META_TEST_EVENT_CODE || '').trim();
  return {
    data: [{
      event_name: event.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      action_source: event.actionSource,
      ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
      user_data: userData,
      ...(event.customData ? { custom_data: event.customData } : {}),
    }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

/** Invio a Meta con timeout breve. Non solleva: l'esito è nel valore restituito. */
export async function sendMetaEvent(event: MetaEvent): Promise<MetaResult> {
  const token = (process.env.META_CAPI_TOKEN || '').trim();
  if (!token) return { ok: false, status: 0, error: 'disabled' };
  const pixel = (process.env.META_PIXEL_ID || '').trim() || DEFAULT_PIXEL_ID;
  const version = (process.env.META_GRAPH_VERSION || '').trim() || DEFAULT_GRAPH_VERSION;
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(pixel)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildMetaPayload(event)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return { ok: true, status: response.status };
    const data = await response.json().catch(() => ({})) as { error?: { code?: number; type?: string; message?: string } };
    const detail = data.error ? `${data.error.type || 'error'} ${data.error.code ?? ''}: ${data.error.message || ''}` : 'errore';
    return { ok: false, status: response.status, error: detail.trim().slice(0, 300) };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { ok: false, status: 0, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error' };
  }
}

/**
 * Invia l'evento e ne registra l'esito in `registration_events`
 * ('capi_sent' / 'capi_failed', senza dati personali). Non solleva mai.
 */
export async function deliverMetaEvent(registrationId: string, event: MetaEvent): Promise<void> {
  try {
    const result = await sendMetaEvent(event);
    if (!result.ok) console.error('Meta CAPI failed', event.eventName, result.status, result.error);
    await query(
      `INSERT INTO registration_events (registration_id, event_type, metadata) VALUES ($1, $2, $3::jsonb)`,
      [registrationId, result.ok ? 'capi_sent' : 'capi_failed', JSON.stringify({
        event: event.eventName,
        eventId: event.eventId,
        http: result.status,
        ...(result.error ? { error: result.error } : {}),
      })],
    );
  } catch (error) {
    console.error('Meta CAPI outcome not recorded', error instanceof Error ? error.message : error);
  }
}

/**
 * Fire-and-forget: l'invio parte dopo che la risposta è stata mandata all'utente
 * (`after` tiene viva la funzione serverless fino al termine). Senza token non fa nulla.
 */
export function trackMetaEvent(registrationId: string, event: MetaEvent): void {
  if (!metaCapiEnabled()) return;
  const task = () => deliverMetaEvent(registrationId, event);
  try {
    after(task);
  } catch {
    // Fuori da una richiesta Next (es. test): esecuzione immediata, comunque non attesa.
    void task();
  }
}
