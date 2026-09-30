import { query } from '@/lib/db';

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
  status: string | null;
};

type Guest = {
  id: string;
  registrationCode: string;
  firstName: string;
  lastName: string;
  email: string;
  companions: number;
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

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Presente',
  exited: 'Uscito',
  no_show: 'No show',
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function buildSlots(rows: SlotGuestRow[]) {
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
        status: row.status,
      });
      current.reservedPeople += 1 + companions;
      if (row.status === 'registered' || row.status === 'checked_in') current.activePeople += 1 + companions;
    }
    slots.set(row.slot_id, current);
  }
  return [...slots.values()];
}

export default async function SlotOverviewPage() {
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
      r.status
    FROM open_day_slots s
    LEFT JOIN registrations r
      ON r.slot_id = s.id
      AND r.status <> 'cancelled'
    ORDER BY s.event_date, s.start_time, r.last_name, r.first_name
  `);

  const slots = buildSlots(result.rows);
  const days = [...new Set(slots.map((slot) => slot.eventDate))];

  return (
    <main className="admin">
      <div className="admin-inner slot-overview-page">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Controllo presenze</div>
            <h1>Prenotati per slot</h1>
            <p className="admin-intro">Apri una fascia per vedere subito chi è prenotato. I record annullati o di test non entrano nei conteggi.</p>
          </div>
          <div className="admin-header-actions"><a className="admin-public-link" href="/admin">← Dashboard</a></div>
        </header>

        <div className="slot-overview-legend">
          <span><i className="legend-dot active" /> Persone che occupano la capienza</span>
          <span><i className="legend-dot neutral" /> Prenotazioni storiche dello slot</span>
          <a className="admin-text-link" href="/admin/slots">Modifica capienze →</a>
        </div>

        {days.map((day) => {
          const daySlots = slots.filter((slot) => slot.eventDate === day);
          const dayPeople = daySlots.reduce((sum, slot) => sum + slot.activePeople, 0);
          const dayReservations = daySlots.reduce((sum, slot) => sum + slot.guests.length, 0);
          return (
            <section className="slot-day-section" key={day} aria-labelledby={`day-${day}`}>
              <div className="slot-day-heading">
                <div>
                  <div className="eyebrow">Open Day</div>
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
                        <span className={`slot-summary-state ${isFull ? 'full' : !slot.isActive ? 'inactive' : ''}`}>{!slot.isActive ? 'Non attivo' : isFull ? 'Completo' : 'Disponibile'}</span>
                      </summary>
                      <div className="slot-progress"><span style={{ width: `${percentage}%` }} /></div>
                      <div className="slot-guests">
                        {!slot.guests.length && <p className="slot-empty">Nessuna prenotazione in questa fascia.</p>}
                        {slot.guests.map((guest) => (
                          <a className="slot-guest" href={`/admin/registrations/${guest.id}`} key={guest.id}>
                            <span><strong>{guest.firstName} {guest.lastName}</strong><small>{guest.email} · {1 + guest.companions} {1 + guest.companions === 1 ? 'persona' : 'persone'}</small></span>
                            <span className={`pill ${guest.status === 'checked_in' || guest.status === 'exited' ? 'ok' : ''}`}>{STATUS_LABELS[guest.status] || guest.status}</span>
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
        <div className="toolbar"><a href="/admin">← Dashboard</a><a href="/admin/registrations">Gestisci registrazioni</a><a href="/admin/checkin">Scanner QR</a></div>
      </div>
    </main>
  );
}
