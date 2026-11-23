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

/* ------------------------------------------------------------------ *
 * Edizioni consultabili dall'area staff (selettore `?ed=<id>`).
 * È l'unica allowlist: ogni parametro `ed` va risolto con
 * `resolveEdition`/`findEdition` e passato all'SQL solo come parametro $n.
 * ------------------------------------------------------------------ */
export type Edition = {
  /** Valore di open_day_slots.edition / registrations.edition. */
  id: string;
  name: string;
  shortName: string;
  /** Etichetta della pillola nel selettore. */
  tabLabel: string;
  dates: string[];
  datesLabel: string;
  /** true = edizione in corso (scrivibile); false = archivio in sola lettura. */
  current: boolean;
  /** Stati che occupano posti / contano come "persone" per l'edizione. */
  activeStatuses: string[];
};

export const EDITIONS: Edition[] = [
  {
    id: EVENT.edition,
    name: EVENT.name,
    shortName: EVENT.shortName,
    tabLabel: 'Christmas Village 2026',
    dates: EVENT.dates,
    datesLabel: EVENT.datesLabel,
    current: true,
    activeStatuses: ['registered', 'checked_in'],
  },
  {
    id: 'open-days-2026',
    name: 'La Dolce Vita · Open Days 2026',
    shortName: 'La Dolce Vita',
    tabLabel: 'La Dolce Vita 2026',
    dates: ['2026-10-30', '2026-10-31', '2026-11-01'],
    datesLabel: 'venerdì 30, sabato 31 ottobre e domenica 1 novembre 2026',
    current: false,
    activeStatuses: ['registered', 'checked_in', 'exited'],
  },
].filter((edition, index, all) => all.findIndex((other) => other.id === edition.id) === index);

export const CURRENT_EDITION: Edition = EDITIONS[0];
export const EDITION_IDS: string[] = EDITIONS.map((edition) => edition.id);

function firstValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

/** Edizione dell'allowlist con quell'id, altrimenti undefined (mai valori liberi). */
export function findEdition(value: unknown): Edition | undefined {
  const id = firstValue(value);
  return EDITIONS.find((edition) => edition.id === id);
}

/** Come findEdition, ma con ripiego sull'edizione corrente (parametro assente o non valido). */
export function resolveEdition(value: unknown): Edition {
  return findEdition(value) ?? CURRENT_EDITION;
}

/** Aggiunge `ed=<id>` a un link interno dell'admin quando si è in archivio. */
export function edHref(path: string, edition: Edition): string {
  if (edition.current) return path;
  return `${path}${path.includes('?') ? '&' : '?'}ed=${encodeURIComponent(edition.id)}`;
}

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Entrato',
  exited: 'Entrato',
  cancelled: 'Annullato',
  no_show: 'No show',
};

/** Etichetta dello stato: in archivio 'exited' è distinto ("Uscito"). */
export function statusLabel(status: string, edition: Edition = CURRENT_EDITION): string {
  if (!edition.current && status === 'exited') return 'Uscito';
  return STATUS_LABELS[status] || status;
}

export const LEAD_STAGES = [
  ['new', 'Nuovo'],
  ['hot', 'Hot lead'],
  ['potential', 'Potenziale'],
  ['evaluating', 'In valutazione'],
  ['follow_up', 'Follow up'],
  ['long_term', 'Lungo termine'],
  ['won', 'Convertito'],
  ['lost', 'Perso'],
] as const;

export function leadStageLabel(stage: string): string {
  return LEAD_STAGES.find(([value]) => value === stage)?.[1] ?? stage;
}
