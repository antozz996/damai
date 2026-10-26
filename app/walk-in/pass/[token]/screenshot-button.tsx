'use client';

import { useState } from 'react';

export default function ScreenshotButton() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="pass-actions">
      <button
        type="button"
        className={`btn-confirm-screenshot ${confirmed ? 'saved' : ''}`}
        onClick={() => setConfirmed(true)}
      >
        {confirmed ? '✓ Screenshot Registrato' : '📸 Ho fatto lo screenshot ✓'}
      </button>

      {confirmed && (
        <div className="screenshot-saved-msg">
          ✨ Ottimo! Il tuo QR è al sicuro nella galleria foto del telefono. Buona visita al Damai!
        </div>
      )}
    </div>
  );
}
