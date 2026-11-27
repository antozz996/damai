import { z } from 'zod';
import { BOOKING_VENUES, EVENT } from '@/lib/event';

/** Il form della pagina statica può inviare '' o null per i campi facoltativi. */
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/** Data di calendario reale in formato AAAA-MM-GG (rifiuta ad esempio 2027-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const optionalDate = z.preprocess(emptyToUndefined, z.string().trim().refine(isIsoDate).optional());

export const BOOKING_DATE_ERROR = 'Indica la data dell’evento che hai già prenotato.';
export const CHILDREN_ERROR = 'Il numero di bambini non può superare quello degli accompagnatori.';

export const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(160),
  // Facoltativo: chi viene solo per il Christmas Village non deve indicare un evento.
  eventType: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(80).default(EVENT.defaultEventType)),
  // Facoltativi: servono come lead per eventi futuri.
  plannedEventDate: optionalDate,
  guestCount: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(1000).optional()),
  // Accompagnatori totali, bambini INCLUSI: è il numero che conta per la capienza.
  companions: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(10).default(0)),
  // Solo informativo: quanti degli accompagnatori sono bambini.
  children: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(10).default(0)),
  // Evento già prenotato presso una delle strutture: struttura (valore esatto) + data.
  existingBookingVenue: z.preprocess(emptyToUndefined, z.enum(BOOKING_VENUES).optional()),
  existingBookingDate: optionalDate,
  slotId: z.string().uuid(),
  source: optionalText(100),
  notes: optionalText(1000),
  privacyConsent: z.literal(true),
  marketingConsent: z.preprocess(emptyToUndefined, z.boolean().default(false)),
  // Consenso separato agli annunci personalizzati Meta (audit LP-06). Assente nei client
  // vecchi, che chiedevano un consenso unico: in quel caso vale marketingConsent.
  adsConsent: z.preprocess(emptyToUndefined, z.boolean().optional()),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(120),
  // Tracciamento (Meta Conversions API): facoltativi. Un valore non valido viene scartato,
  // non deve mai far fallire la registrazione.
  fbp: z.preprocess(emptyToUndefined, z.string().trim().max(200).regex(/^fb\.\d+\.\d+\.[A-Za-z0-9_.-]+$/).optional()).catch(undefined),
  fbc: z.preprocess(emptyToUndefined, z.string().trim().max(600).regex(/^fb\.\d+\.\d+\.[A-Za-z0-9_.-]+$/).optional()).catch(undefined),
  eventSourceUrl: z.preprocess(emptyToUndefined, z.string().trim().max(600).regex(/^https?:\/\/[^\s<>"']+$/i).optional()).catch(undefined),
})
  .refine(data => data.children <= data.companions, { path: ['children'], message: CHILDREN_ERROR })
  .refine(data => !data.existingBookingVenue || Boolean(data.existingBookingDate), { path: ['existingBookingDate'], message: BOOKING_DATE_ERROR });

export type RegistrationInput = z.infer<typeof registrationSchema>;
