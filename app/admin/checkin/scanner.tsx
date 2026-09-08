'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenFromValue(value: string) {
  const trimmed = value.trim();
  if (TOKEN_PATTERN.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/admin\/checkin\/([^/]+)\/?$/i);
    return match && TOKEN_PATTERN.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastValueRef = useRef('');
  const navigatingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [message, setMessage] = useState('Premi “Attiva fotocamera” e inquadra il QR del cliente.');

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) window.clearInterval(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const openToken = useCallback((value: string) => {
    const token = tokenFromValue(value);
    if (!token) {
      setError('QR non riconosciuto. Inquadra il pass DAMAI oppure inserisci il link completo.');
      setMessage('Il codice non appartiene a una registrazione DAMAI.');
      return;
    }
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    stopCamera();
    setError('');
    setMessage('QR riconosciuto. Apro la scheda del cliente…');
    router.push(`/admin/checkin/${token}`);
  }, [router, stopCamera]);

  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || navigatingRef.current) return;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue?.trim();
        if (value && value !== lastValueRef.current) {
          lastValueRef.current = value;
          openToken(value);
          return;
        }
      }
    } catch {
      // Frames without a readable QR are expected while the camera is moving.
    }
  }, [openToken]);

  const startCamera = useCallback(async () => {
    setError('');
    setMessage('Richiesta accesso alla fotocamera…');
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      setError('Questo browser non permette l’accesso alla fotocamera. Usa il campo manuale qui sotto.');
      return;
    }
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      setError('La scansione automatica non è disponibile in questo browser. Usa Chrome su Android oppure il campo manuale qui sotto.');
      return;
    }
    try {
      const BarcodeDetectorCtor = (window as Window & { BarcodeDetector: new (options?: { formats: string[] }) => typeof detectorRef.current }).BarcodeDetector;
      detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      lastValueRef.current = '';
      navigatingRef.current = false;
      setActive(true);
      setMessage('Fotocamera attiva. Posiziona il QR dentro il riquadro.');
      frameRef.current = window.setInterval(() => void detectFrame(), 250);
    } catch (cause) {
      stopCamera();
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Permesso fotocamera negato. Abilitalo dalle impostazioni del browser e riprova.' : 'Non riesco ad avviare la fotocamera. Controlla che non sia già utilizzata da un’altra app.');
      setMessage('Puoi comunque aprire la scheda inserendo manualmente il link del QR.');
    }
  }, [detectFrame, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openToken(manualValue);
  }

  return (
    <div className="scanner-layout">
      <section className="scanner-card scanner-camera-card" aria-label="Scansione QR">
        <div className="scanner-card-top"><span className="scanner-number">01</span><div><h2>Inquadra il pass</h2><p>La scheda del cliente si aprirà automaticamente dopo la lettura.</p></div></div>
        <div className={`scanner-viewport ${active ? 'is-active' : ''}`}>
          <video ref={videoRef} className="scanner-video" playsInline muted aria-label="Anteprima fotocamera per la scansione QR" />
          <div className="scanner-frame" aria-hidden="true"><i/><i/><i/><i/><b/></div>
          {!active && <div className="scanner-placeholder"><div className="scanner-qr-icon">⌁</div><strong>Fotocamera non attiva</strong><span>Premi il pulsante per iniziare la scansione</span></div>}
        </div>
        <div className="scanner-controls">
          <button type="button" className="scanner-primary" onClick={() => void (active ? stopCamera() : startCamera())}>{active ? 'Disattiva fotocamera' : 'Attiva fotocamera'} <span>{active ? '×' : '↗'}</span></button>
          <div className="scanner-status" aria-live="polite"><span className={active ? 'status-dot live' : 'status-dot'} />{message}</div>
        </div>
        {error && <div className="scanner-error" role="alert">{error}</div>}
        {!supported && <div className="scanner-browser-note">Per una scansione più rapida usa <strong>Google Chrome su Android</strong>. In alternativa incolla qui il link del QR.</div>}
      </section>

      <section className="scanner-card scanner-manual-card" aria-label="Apertura manuale QR">
        <div className="scanner-card-top"><span className="scanner-number">02</span><div><h2>Apri con link</h2><p>Fallback utile se la fotocamera non è disponibile.</p></div></div>
        <form className="scanner-manual" onSubmit={submitManual}>
          <label htmlFor="qr-link">Link o codice del pass</label>
          <input id="qr-link" value={manualValue} onChange={event => setManualValue(event.target.value)} placeholder="https://…/admin/checkin/…" autoComplete="off" />
          <button type="submit" className="scanner-secondary">Apri scheda cliente <span>↗</span></button>
        </form>
        <div className="scanner-help"><strong>Procedura all&apos;ingresso</strong><ol><li>Chiedi al cliente di mostrare il QR ricevuto.</li><li>Inquadralo senza scattare una foto.</li><li>Nella scheda premi “Conferma ingresso”.</li></ol></div>
        <a className="scanner-dashboard-link" href="/admin">Torna alla dashboard →</a>
      </section>
    </div>
  );
}
