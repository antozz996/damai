import { query } from '@/lib/db';
import { edHref, resolveEdition, statusLabel } from '@/lib/event';
import EditionBar from '../../edition-bar';

export const dynamic = 'force-dynamic';

type SlotGuestRow = {
  slot_id: string;
  event_date: string;
  start_time: string;
  capacity: number;
  is_active: boolean;
  guest_id: string | null;
  registration_code: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  companions: number | null;
  children: number | null;
  status: string | null;
};

type Guest = {
  id: string;
  registrationCode: string;
  firstName: string;
  lastName: string;
  email: string;
  companions: number;
  children: number;
  status: string;
};

type Slot = {
  id: string;
  eventDate: string;
  startTime: string;
  capacity: number;
  isActive: boolean;
  guests: Guest[];
  activePeople: number;
  reservedPeople: number;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function buildSlots(rows: SlotGuestRow[], activeStatuses: string[]) {
  const slots = new Map<string, Slot>();
  for (const row of rows) {
    const current = slots.get(row.slot_id) ?? {
      id: row.slot_id,
      eventDate: row.event_date,
      startTime: row.start_time,
      capacity: row.capacity,
      isActive: row.is_active,
      guests: [],
      activePeople: 0,
      reservedPeople: 0,
    };
    if (row.guest_id && row.registration_code && row.first_name && row.last_name && row.email && row.status) {
      const companions = row.companions ?? 0;
      current.guests.push({
        id: row.guest_id,
        registrationCode: row.registration_code,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        companions,
        children: row.children ?? 0,
        status: row.status,
      });
      current.reservedPeople += 1 + companions;
      if (activeStatuses.includes(row.status)) current.activePeople += 1 + companions;
    }
    slots.set(row.slot_id, current);
  }
  return [...slots.values()];
}

export default async function SlotOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const edition = resolveEdition((await searchParams).ed);
  const archive = !edition.current;
  const result = await query<SlotGuestRow>(`
    SELECT
      s.id::text AS slot_id,
      s.event_date::text,
      s.start_time::text,
      s.capacity,
      s.is_active,
      r.id::text AS guest_id,
      r.registration_code,
      r.first_name,
      r.last_name,
      r.email,
      r.companions,
      r.children,
      r.status
    FROM open_day_slots s
    LEFT JOIN registrations r
      ON r.slot_id = s.id
      AND r.status <> 'cancelled'
    WHERE s.edition = $1
    ORDER BY s.event_date, s.start_time, r.last_name, r.first_name
  `, [edition.id]);

  const slots = buildSlots(result.rows, edition.activeStatuses);
  const days = [...new Set(slots.map((slot) => slot.eventDate))];

  return (
    <main className="admin">
      <div className="admin-inner slot-overview-page">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Controllo presenze{archive ? ' · Archivio' : ''}</div>
            <h1>Prenotati per slot</h1>
            <p className="admin-intro">Apri una fascia per vedere subito chi è prenotato. I record annullati o di test non entrano nei conteggi.</p>
          </div>
          <div className="admin-header-actions"><a className="admin-public-link" href={edHref('/admin', edition)}>← Dashboard</a></div>
        </header>

        <EditionBar edition={edition} path="/admin/slots/overview" />

        <div className="slot-overview-legend">
          <span><i className="legend-dot active" /> {archive ? 'Persone registrate o presenti (no show esclusi)' : 'Persone che occupano la capienza'}</span>
          <span><i className="legend-dot neutral" /> Prenotazioni storiche dello slot</span>
          <a className="admin-text-link" href={edHref('/admin/slots', edition)}>{archive ? 'Vedi le fasce →' : 'Modifica capienze →'}</a>
        </div>

        {days.map((day) => {
          const daySlots = slots.filter((slot) => slot.eventDate === day);
          const dayPeople = daySlots.reduce((sum, slot) => sum + slot.activePeople, 0);
          const dayReservations = daySlots.reduce((sum, slot) => sum + slot.guests.length, 0);
          return (
            <section className="slot-day-section" key={day} aria-labelledby={`day-${day}`}>
              <div className="slot-day-heading">
                <div>
                  <div className="eyebrow">{edition.shortName}</div>
                  <h2 id={`day-${day}`}>{dateLabel(day)}</h2>
                </div>
                <div className="slot-day-totals"><strong>{dayPeople}</strong> persone attive · <strong>{dayReservations}</strong> prenotazioni</div>
              </div>
              <div className="slot-cards">
                {daySlots.map((slot) => {
                  const percentage = Math.min(100, Math.round((slot.activePeople / slot.capacity) * 100));
                  const isFull = slot.activePeople >= slot.capacity;
                  return (
                    <details className={`slot-summary-card ${!slot.isActive ? 'inactive' : ''}`} key={slot.id}>
                      <summary>
                        <span className="slot-summary-time">{slot.startTime.slice(0, 5)}</span>
                        <span className="slot-summary-count"><strong>{slot.activePeople}/{slot.capacity}</strong><small>persone attive</small></span>
                        <span className="slot-summary-reservations">{slot.guests.length} {slot.guests.length === 1 ? 'prenotazione' : 'prenotazioni'}</span>
                        <span className={`slot-summary-state ${isFull ? 'full' : !slot.isActive ? 'inactive' : ''}`}>{!slot.isActive ? 'Non attivo' : isFull ? 'Completo' : archive ? 'Concluso' : 'Disponibile'}</span>
                      </summary>
                      <div className="slot-progress"><span style={{ width: `${percentage}%` }} /></div>
                      <div className="slot-guests">
                        {!slot.guests.length && <p className="slot-empty">Nessuna prenotazione in questa fascia.</p>}
                        {slot.guests.map((guest) => (
                          <a className="slot-guest" href={edHref(`/admin/registrations/${guest.id}`, edition)} key={guest.id}>
                            <span><strong>{guest.firstName} {guest.lastName}</strong><small>{guest.email} · {1 + guest.companions} {1 + guest.companions === 1 ? 'persona' : 'persone'}{guest.children > 0 ? ` · ${guest.children} ${guest.children === 1 ? 'bambino' : 'bambini'}` : ''}</small></span>
                            <span className={`pill ${guest.status === 'checked_in' || guest.status === 'exited' ? 'ok' : ''}`}>{statusLabel(guest.status, edition)}</span>
                          </a>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          );
        })}

        {!slots.length && <div className="admin-footnote">Nessuna fascia configurata.</div>}
        <div className="toolbar"><a href={edHref('/admin', edition)}>← Dashboard</a><a href={edHref('/admin/registrations', edition)}>{archive ? 'Registrazioni' : 'Gestisci registrazioni'}</a>{!archive && <a href="/admin/checkin">Scanner QR</a>}</div>
      </div>
    </main>
  );
}
