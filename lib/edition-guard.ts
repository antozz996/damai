import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';

export const ARCHIVE_READ_ONLY_MESSAGE =
  'Edizione in archivio: sola lettura. L’operazione non è consentita su registrazioni o fasce di edizioni concluse.';

/**
 * Le API di scrittura cercano sempre il record con `edition = EVENT.edition`:
 * un record di un'altra edizione risulta quindi "non trovato" e non viene mai toccato.
 * Queste funzioni servono solo a dare una risposta più chiara (409 invece di 404).
 */
export async function isArchivedRegistration(by: 'id' | 'qr_token', value: string): Promise<boolean> {
  const result = by === 'id'
    ? await query(`SELECT 1 FROM registrations WHERE id=$1::uuid AND edition<>$2 LIMIT 1`, [value, EVENT.edition])
    : await query(`SELECT 1 FROM registrations WHERE qr_token=$1::uuid AND edition<>$2 LIMIT 1`, [value, EVENT.edition]);
  return Boolean(result.rowCount);
}

export async function isArchivedSlot(id: string): Promise<boolean> {
  const result = await query(`SELECT 1 FROM open_day_slots WHERE id=$1::uuid AND edition<>$2 LIMIT 1`, [id, EVENT.edition]);
  return Boolean(result.rowCount);
}
