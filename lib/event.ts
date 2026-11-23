/**
 * Configurazione dell'edizione corrente.
 * Tutte le query su fasce e registrazioni filtrano per `EVENT.edition`,
 * così i dati delle edizioni precedenti (es. 'open-days-2026') restano
 * nel database ma non si mescolano con quelli dell'edizione in corso.
 */
export const EVENT = {
  /** Identificativo edizione salvato in open_day_slots.edition e registrations.edition. */
  edition: process.env.EVENT_EDITION || 'natale-2026',
  /** Prefisso dei codici di registrazione online. */
  codePrefix: 'N26-',
  name: 'Damai Christmas Village',
  shortName: 'Christmas Village',
  /** Giornate dell'evento (ISO, fuso Europe/Rome). */
  dates: ['2026-12-12', '2026-12-13'],
  datesLabel: 'sabato 12 e domenica 13 dicembre 2026',
  hoursLabel: 'dalle 16:00 alle 21:30',
  /** Capienza predefinita di ogni fascia (modificabile dallo staff fascia per fascia). */
  slotCapacity: 100,
  /** Permanenza prevista all'interno per ogni fascia. */
  visitMinutes: 30,
  visitLabel: '30 minuti di visita',
  lastEntryLabel: 'ultimo ingresso alle 21:00',
  venue: 'DAMAI Event Garden',
  address: 'Via Marina di Varcaturo 42, Castel Volturno (CE)',
  /** Valore di event_type quando l'ospite non indica un evento da organizzare. */
  defaultEventType: 'Solo Christmas Village',
  /** Pagina pubblica dell'evento (sito statico): è quella a cui punta il QR del volantino. */
  publicPageUrl: (process.env.PUBLIC_PAGE_URL || 'https://www.damaigarden.it/christmas-village/'),
  /** Registrazioni aperte solo con REGISTRATIONS_OPEN=true (letto a ogni richiesta). */
  get openRegistrations(): boolean {
    return process.env.REGISTRATIONS_OPEN === 'true';
  },
};

/** Strutture presso cui l'ospite può avere già un evento prenotato. */
export const BOOKING_VENUES = ['Playa Luna', 'Culto', 'Damai'] as const;
export type BookingVenue = (typeof BOOKING_VENUES)[number];

const FALLBACK_BASE_URL = 'https://damai-rouge.vercel.app';

/** Dominio pubblico di questo backend: base dei link al biglietto (`/ticket/<token>`). */
export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || FALLBACK_BASE_URL).replace(/\/$/, '');
}

/** Dominio usato dallo staff: è l'indirizzo codificato nel QR (`/admin/checkin/<token>`). */
export function staffBaseUrl(): string {
  return (process.env.STAFF_BASE_URL || process.env.PUBLIC_BASE_URL || FALLBACK_BASE_URL).replace(/\/$/, '');
}

export function ticketUrl(qrToken: string): string {
  return `${publicBaseUrl()}/ticket/${encodeURIComponent(qrToken)}`;
}

export function checkinUrl(qrToken: string): string {
  return `${staffBaseUrl()}/admin/checkin/${encodeURIComponent(qrToken)}`;
}

export const PLACEHOLDER_EMAIL_PATTERN = '%@no-email.damai.local';
