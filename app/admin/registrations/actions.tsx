'use client';

import { FormEvent, useState } from 'react';

type Props = {
  id: string;
  status: string;
  registrationCode: string;
  qrToken: string;
};

export default function RegistrationActions({ id, status, registrationCode, qrToken }: Props) {
  const [busy, setBusy] = useState(false);

  function confirmSubmit(event: FormEvent<HTMLFormElement>, message: string) {
    if (!window.confirm(message)) {
      event.preventDefault();
      return;
    }
    setBusy(true);
  }

  return (
    <div className="row-actions">
      <a className="admin-action-link" href={`/admin/registrations/${id}`}>Modifica</a>
      <a className="admin-action-link" href={`/admin/checkin/${qrToken}`}>QR / scanner</a>
      {status === 'cancelled' ? (
        <form method="post" action={`/api/admin/registrations/${id}`} onSubmit={(event) => confirmSubmit(event, `Eliminare definitivamente ${registrationCode}? Questa operazione rimuove anche storico ed email del test.`)}>
          <input type="hidden" name="intent" value="delete" />
          <button className="admin-action-button danger" type="submit" disabled={busy}>{busy ? 'Elimino…' : 'Elimina definitivamente'}</button>
        </form>
      ) : (
        <form method="post" action={`/api/admin/registrations/${id}`} onSubmit={(event) => confirmSubmit(event, `Annullare la registrazione ${registrationCode}? Lo slot verrà liberato e il record resterà nello storico.`)}>
          <input type="hidden" name="intent" value="cancel" />
          <button className="admin-action-button warning" type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Annulla'}</button>
        </form>
      )}
    </div>
  );
}
