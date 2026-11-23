type CommunicationType = 'registration_confirmation' | 'reminder_48h' | 'reminder_24h' | 'thank_you' | 'exit_thank_you';

import QRCode from 'qrcode';

type Guest = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  registrationCode: string;
  qrToken: string;
  eventDate: string;
  startTime: string;
};

import {
  EVENT,
  checkinUrl as eventCheckinUrl,
  publicBaseUrl as baseUrl,
  ticketUrl as eventTicketUrl,
} from '@/lib/event';

// Palette Christmas Village: bordeaux, oro e crema. Solo colori pieni e font di sistema:
// niente webfont, niente SVG, layout a tabelle (compatibile con Gmail, Apple Mail, Outlook).
const BRAND = {
  night: '#1a0307',
  bordeaux: '#4b0610',
  gold: '#e6c27a',
  cream: '#fbf1dc',
  soft: '#e9d9bd',
  line: '#7d3a35',
};
const SERIF = "Georgia,'Times New Roman',Times,serif";

/** Biglietto pubblico con QR: `${PUBLIC_BASE_URL}/ticket/<token>`. */
function ticketUrl(guest: Guest) {
  return eventTicketUrl(guest.qrToken);
}

/** Indirizzo codificato nel QR: apre la scheda di check-in dello staff. */
function checkinUrl(guest: Guest) {
  return eventCheckinUrl(guest.qrToken);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long' }).format(new Date(`${value}T12:00:00`));
}

function isThankYou(type: CommunicationType) {
  return type === 'thank_you' || type === 'exit_thank_you';
}

function isReminder(type: CommunicationType) {
  return type === 'reminder_24h' || type === 'reminder_48h';
}

function emailCopy(type: CommunicationType, guest: Guest) {
  const date = prettyDate(guest.eventDate);
  const time = guest.startTime.slice(0,5);
  const link = ticketUrl(guest);
  if (isThankYou(type)) return {
    subject: `${EVENT.name} · Grazie per essere stati con noi`,
    eyebrow: 'Grazie di cuore',
    heading: 'Grazie per aver condiviso con noi la magia del Natale',
    text: `È stato un piacere accoglierti al ${EVENT.name}. Speriamo che le luci, i profumi e i sorrisi di questi giorni ti accompagnino fino alle feste. Se stai pensando a un evento da festeggiare al Damai, il nostro team è a tua disposizione.`,
    preheader: 'Grazie per aver condiviso con noi la magia del Natale.',
    cta: 'Scrivi al team Damai', link: 'https://www.damaigarden.it/#contatti',
  };
  // Il promemoria parte dal cron giornaliero: il testo non dice "domani" perché
  // può arrivare anche la mattina stessa dell'evento.
  if (isReminder(type)) return {
    subject: `${EVENT.name} · Ti aspettiamo`,
    eyebrow: 'Manca poco',
    heading: 'Il Christmas Village ti aspetta',
    text: `Ti ricordiamo la tua visita di ${date}: la tua fascia è alle ${time} e prevede ${EVENT.visitMinutes} minuti di permanenza all’interno del villaggio. Presentati in orario e mostra all’ingresso il QR del tuo biglietto.`,
    preheader: `Manca poco al ${EVENT.name}: tieni pronto il QR del biglietto.`,
    cta: 'Apri il tuo biglietto', link,
  };
  return {
    subject: `${EVENT.name} · Il tuo biglietto`,
    eyebrow: 'Registrazione confermata',
    heading: 'Il tuo posto al Christmas Village è confermato',
    text: `Siamo felici di accoglierti ${date}. La tua fascia è alle ${time} e prevede ${EVENT.visitMinutes} minuti di permanenza all’interno del villaggio: ti chiediamo di presentarti in orario e di mostrare all’ingresso il QR del tuo biglietto.`,
    preheader: `Il tuo biglietto gratuito per il ${EVENT.name}: mostra il QR all’ingresso.`,
    cta: 'Apri il tuo biglietto', link,
  };
}

/**
 * HTML dell'email. `qrSrc` è l'origine dell'immagine del QR: `cid:…` nell'invio reale
 * (immagine allegata), un data URL nell'anteprima dell'area staff.
 */
function renderEmailHtml(type: CommunicationType, guest: Guest, copy: ReturnType<typeof emailCopy>, qrSrc: string) {
  const thanks = isThankYou(type);
  const firstName = escapeHtml(guest.firstName);
  const registrationCode = escapeHtml(guest.registrationCode);
  const link = escapeHtml(copy.link);
  const heading = escapeHtml(copy.heading);
  const text = escapeHtml(copy.text);
  const cta = escapeHtml(copy.cta);
  const date = escapeHtml(prettyDate(guest.eventDate));
  const time = escapeHtml(guest.startTime.slice(0,5));
  const imageBase = baseUrl();
  const label = `font-family:${SERIF};font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};`;
  const detail = (name: string, value: string, last = false) => `<tr><td width="34%" valign="top" style="padding:13px 10px 13px 0;${last ? '' : `border-bottom:1px solid ${BRAND.line};`}${label}">${name}</td><td valign="top" style="padding:13px 0;${last ? '' : `border-bottom:1px solid ${BRAND.line};`}font-family:${SERIF};font-size:16px;line-height:1.45;color:${BRAND.cream};">${value}</td></tr>`;

  const qrBlock = thanks ? '' : `
            <tr>
              <td class="email-pad" align="center" style="padding:30px 48px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${BRAND.night}" style="background:${BRAND.night};border:1px solid ${BRAND.gold};">
                  <tr>
                    <td align="center" style="padding:26px 26px 8px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:12px;line-height:0;">
                        <img src="${qrSrc}" width="220" height="220" alt="QR code del tuo biglietto" style="display:block;width:220px;height:220px;border:0;">
                      </td></tr></table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:10px 26px 24px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${BRAND.soft};">
                      <strong style="color:${BRAND.gold};font-weight:normal;">Mostra questo QR all’ingresso</strong><br>
                      Codice ${registrationCode}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:26px 48px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};">
                  ${detail('Giorno', date)}
                  ${detail('Fascia', `${time} · ${escapeHtml(EVENT.visitLabel)}`)}
                  ${detail('Ingresso', 'Gratuito, con il QR del biglietto')}
                  ${detail('Dove', `${escapeHtml(EVENT.venue)}<br>${escapeHtml(EVENT.address)}`, true)}
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:20px 48px 0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${BRAND.soft};">
                Il Christmas Village è aperto il 12 e 13 dicembre 2026, ${escapeHtml(EVENT.hoursLabel)}.<br>
                Ti aspettano Babbo Natale, il laboratorio con la letterina e la foto, bevande tipiche, delizie natalizie e i mercatini.
              </td>
            </tr>`;

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${heading}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .email-title { font-size: 28px !important; }
        .email-logo { width: 230px !important; }
      }
    </style>
  </head>
  <body bgcolor="${BRAND.night}" style="margin:0;padding:0;background:${BRAND.night};color:${BRAND.cream};font-family:${SERIF};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.night}" style="background:${BRAND.night};">
      <tr>
        <td align="center" style="padding:24px 10px;">
          <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bordeaux}" style="width:100%;max-width:600px;background:${BRAND.bordeaux};border:1px solid ${BRAND.gold};">
            <tr>
              <td class="email-pad" align="center" style="padding:34px 48px 0;">
                <img src="${imageBase}/email/dcv-monogramma.png" width="60" height="115" alt="" style="display:block;width:60px;height:115px;margin:0 auto;border:0;">
                <img class="email-logo" src="${imageBase}/email/dcv-logo.png" width="280" height="103" alt="Damai Christmas Village" style="display:block;width:280px;max-width:100%;height:auto;margin:14px auto 0;border:0;font-family:${SERIF};font-size:24px;color:${BRAND.gold};">
                <div style="margin-top:14px;${label}">12 e 13 dicembre 2026 &middot; Ingresso gratuito</div>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:30px 48px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="72" height="1" bgcolor="${BRAND.gold}" style="width:72px;height:1px;font-size:0;line-height:0;background:${BRAND.gold};">&nbsp;</td></tr></table>
                <div style="margin-top:26px;${label}">${escapeHtml(copy.eyebrow)}</div>
                <h1 class="email-title" style="margin:14px 0 18px;font-family:${SERIF};font-size:34px;line-height:1.18;font-weight:normal;color:${BRAND.cream};">${heading}</h1>
                <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.65;color:${BRAND.cream};">Ciao ${firstName},<br>${text}</p>
              </td>
            </tr>${qrBlock}
            <tr>
              <td class="email-pad" align="center" style="padding:32px 48px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td align="center" bgcolor="${BRAND.gold}" style="background:${BRAND.gold};">
                      <a href="${link}" style="display:inline-block;padding:17px 34px;font-family:${SERIF};font-size:14px;line-height:1.2;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${BRAND.night};text-decoration:none;">${cta}</a>
                    </td>
                  </tr>
                </table>
                ${thanks ? '' : `<p style="margin:16px 0 0;font-family:${SERIF};font-size:12px;line-height:1.5;color:${BRAND.soft};">Se il pulsante non funziona, apri questo indirizzo:<br><a href="${link}" style="color:${BRAND.gold};text-decoration:underline;word-break:break-all;">${link}</a></p>`}
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:34px 48px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="72" height="1" bgcolor="${BRAND.gold}" style="width:72px;height:1px;font-size:0;line-height:0;background:${BRAND.gold};">&nbsp;</td></tr></table>
                <p style="margin:22px 0 0;font-family:${SERIF};font-size:13px;line-height:1.6;color:${BRAND.soft};">${escapeHtml(EVENT.venue)}<br>${escapeHtml(EVENT.address)}</p>
                <p style="margin:10px 0 0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${BRAND.soft};">${thanks ? 'A presto, il team Damai' : `Codice registrazione: <span style="color:${BRAND.gold};">${registrationCode}</span>`}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const QR_OPTIONS = { width: 520, margin: 1, errorCorrectionLevel: 'M' } as const;

/** Anteprima (oggetto + HTML) senza invio: il QR è incorporato come data URL. */
export async function renderEmailPreview(type: CommunicationType, guest: Guest) {
  const copy = emailCopy(type, guest);
  const qrSrc = isThankYou(type) ? '' : await QRCode.toDataURL(checkinUrl(guest), QR_OPTIONS);
  return { subject: copy.subject, html: renderEmailHtml(type, guest, copy, qrSrc) };
}

export async function sendEmail(type: CommunicationType, guest: Guest, options: { idempotencyKey?: string } = {}) {
  if (guest.email && guest.email.toLowerCase().endsWith('@no-email.damai.local')) {
    return { sent: false, reason: 'placeholder_email' };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !baseUrl()) return { sent:false, reason:'email_not_configured' };
  const copy = emailCopy(type, guest);
  const qrCid = 'damai-qr-code';
  const includeQr = !isThankYou(type);
  const qrContent = includeQr
    ? (await QRCode.toDataURL(checkinUrl(guest), QR_OPTIONS)).replace(/^data:image\/png;base64,/, '')
    : '';
  const html = renderEmailHtml(type, guest, copy, `cid:${qrCid}`);
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{
      Authorization:`Bearer ${apiKey}`,
      'Content-Type':'application/json',
      'Idempotency-Key':options.idempotencyKey || `damai-${type}-${guest.registrationCode}`,
    },
    body:JSON.stringify({
      from,
      to:[guest.email],
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      subject:copy.subject,
      html,
      ...(includeQr ? { attachments:[{
        filename:'DAMAI-QR.png',
        content:qrContent,
        content_type:'image/png',
        content_id:qrCid,
      }] } : {}),
    }),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(data)}`);
  return { sent:true, providerId:String(data.id || '') };
}

/* ------------------------------------------------------------------ *
 * Invito al Christmas Village per i contatti de La Dolce Vita · Open Days.
 * Comunicazione promozionale inviata UNA sola volta (art. 130 c. 4 Codice privacy):
 * mittente riconoscibile, motivo della ricezione e disiscrizione ben visibile.
 * Non parte mai da sola: la invia lo staff da /admin/campaigns/ldv-natale.
 * ------------------------------------------------------------------ */
export const LDV_INVITE_SUBJECT = 'Ti aspettiamo al Damai Christmas Village · 12 e 13 dicembre';
export const LDV_INVITE_SUBJECT_ALT = 'Dopo La Dolce Vita, il Natale al Damai: 12 e 13 dicembre, ingresso gratuito';
const LDV_CONTROLLER = 'Fiordacqua S.r.l., Vicoletto dei Cinesi 56, 80136 Napoli (NA), P.IVA 10239921215';

type LdvInvite = {
  firstName: string;
  /** true se risulta entrato agli Open Days; false se si era solo registrato. */
  attended: boolean;
  unsubscribeUrl: string;
};

/** Oggetto in uso: quello predefinito, oppure LDV_CAMPAIGN_SUBJECT se impostato. */
export function ldvInviteSubject(): string {
  return (process.env.LDV_CAMPAIGN_SUBJECT || '').trim() || LDV_INVITE_SUBJECT;
}

export function ldvInviteRegisterUrl(): string {
  const page = EVENT.publicPageUrl;
  return `${page}${page.includes('?') ? '&' : '?'}utm_source=email&utm_medium=email&utm_campaign=dcv26-ldv`;
}

/** Oggetto, HTML e versione testo dell'invito (nessun invio). */
export function renderLdvInvite(invite: LdvInvite) {
  const subject = ldvInviteSubject();
  const name = invite.firstName.trim();
  const greeting = name ? `Ciao ${name},` : 'Ciao,';
  const recall = invite.attended
    ? 'hai partecipato a La Dolce Vita · Open Days al Damai Event Garden'
    : 'hai prenotato la tua visita a La Dolce Vita · Open Days al Damai Event Garden';
  const intro = `${recall}: per questo ci fa piacere invitarti al nostro prossimo appuntamento, il ${EVENT.name}.`;
  const body = `Sabato 12 e domenica 13 dicembre 2026, ${EVENT.hoursLabel}, il giardino del Damai diventa un villaggio di Natale: Babbo Natale, il laboratorio con la letterina e la foto, i mercatini, bevande tipiche e delizie natalizie.`;
  const seats = `L’ingresso è gratuito, su registrazione. I posti sono limitati: ${EVENT.slotCapacity} persone per ogni fascia oraria, con ${EVENT.visitMinutes} minuti di visita. Scegli il giorno e l’orario che preferisci.`;
  const why = 'Ricevi questa email perché hai partecipato o ti sei registrato agli Open Days «La Dolce Vita» di Damai Event Garden e in quell’occasione ci hai lasciato questo indirizzo. È un invito a un evento analogo, inviato una sola volta.';
  const preheader = 'Sabato 12 e domenica 13 dicembre: ingresso gratuito su registrazione, posti limitati per fascia.';
  const registerUrl = ldvInviteRegisterUrl();
  const privacyUrl = `${baseUrl()}/privacy`;

  const text = [
    greeting,
    '',
    intro,
    '',
    body,
    '',
    seats,
    '',
    `Registrati: ${registerUrl}`,
    '',
    `${EVENT.venue} · ${EVENT.address}`,
    '',
    '--',
    why,
    `Titolare del trattamento: ${LDV_CONTROLLER}. Informativa privacy: ${privacyUrl}`,
    `Non vuoi ricevere altre comunicazioni promozionali? Disiscriviti qui: ${invite.unsubscribeUrl}`,
  ].join('\n');

  const imageBase = baseUrl();
  const label = `font-family:${SERIF};font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:${BRAND.gold};`;
  const paragraph = `margin:0 0 16px;font-family:${SERIF};font-size:17px;line-height:1.65;color:${BRAND.cream};`;
  const detail = (key: string, value: string, last = false) => `<tr><td width="34%" valign="top" style="padding:13px 10px 13px 0;${last ? '' : `border-bottom:1px solid ${BRAND.line};`}${label}">${key}</td><td valign="top" style="padding:13px 0;${last ? '' : `border-bottom:1px solid ${BRAND.line};`}font-family:${SERIF};font-size:16px;line-height:1.45;color:${BRAND.cream};">${value}</td></tr>`;
  const rule = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="72" height="1" bgcolor="${BRAND.gold}" style="width:72px;height:1px;font-size:0;line-height:0;background:${BRAND.gold};">&nbsp;</td></tr></table>`;
  const link = escapeHtml(registerUrl);
  const unsubscribe = escapeHtml(invite.unsubscribeUrl);

  const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${escapeHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .email-title { font-size: 28px !important; }
        .email-logo { width: 230px !important; }
      }
    </style>
  </head>
  <body bgcolor="${BRAND.night}" style="margin:0;padding:0;background:${BRAND.night};color:${BRAND.cream};font-family:${SERIF};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.night}" style="background:${BRAND.night};">
      <tr>
        <td align="center" style="padding:24px 10px;">
          <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bordeaux}" style="width:100%;max-width:600px;background:${BRAND.bordeaux};border:1px solid ${BRAND.gold};">
            <tr>
              <td class="email-pad" align="center" style="padding:34px 48px 0;">
                <img src="${imageBase}/email/dcv-monogramma.png" width="60" height="115" alt="" style="display:block;width:60px;height:115px;margin:0 auto;border:0;">
                <img class="email-logo" src="${imageBase}/email/dcv-logo.png" width="280" height="103" alt="Damai Christmas Village" style="display:block;width:280px;max-width:100%;height:auto;margin:14px auto 0;border:0;font-family:${SERIF};font-size:24px;color:${BRAND.gold};">
                <div style="margin-top:14px;${label}">12 e 13 dicembre 2026 &middot; Ingresso gratuito</div>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:30px 48px 0;">
                ${rule}
                <div style="margin-top:26px;${label}">Un invito da Damai Event Garden</div>
                <h1 class="email-title" style="margin:14px 0 18px;font-family:${SERIF};font-size:34px;line-height:1.18;font-weight:normal;color:${BRAND.cream};">Dopo La Dolce Vita, ti aspettiamo al Christmas Village</h1>
                <p style="${paragraph}">${escapeHtml(greeting)}<br>${escapeHtml(intro)}</p>
                <p style="${paragraph}">${escapeHtml(body)}</p>
                <p style="${paragraph}margin-bottom:0;">${escapeHtml(seats)}</p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:26px 48px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};">
                  ${detail('Quando', `Sabato 12 e domenica 13 dicembre 2026<br>${escapeHtml(EVENT.hoursLabel)}, ${escapeHtml(EVENT.lastEntryLabel)}`)}
                  ${detail('Ingresso', 'Gratuito, su registrazione')}
                  ${detail('Posti', `${EVENT.slotCapacity} persone per fascia oraria`)}
                  ${detail('Dove', `${escapeHtml(EVENT.venue)}<br>${escapeHtml(EVENT.address)}`, true)}
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:32px 48px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td align="center" bgcolor="${BRAND.gold}" style="background:${BRAND.gold};">
                      <a href="${link}" style="display:inline-block;padding:17px 34px;font-family:${SERIF};font-size:14px;line-height:1.2;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${BRAND.night};text-decoration:none;">Registrati</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;font-family:${SERIF};font-size:12px;line-height:1.5;color:${BRAND.soft};">Se il pulsante non funziona, apri questo indirizzo:<br><a href="${link}" style="color:${BRAND.gold};text-decoration:underline;word-break:break-all;">${link}</a></p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:34px 48px 36px;">
                ${rule}
                <p style="margin:22px 0 0;font-family:${SERIF};font-size:13px;line-height:1.6;color:${BRAND.soft};">${escapeHtml(why)}</p>
                <p style="margin:12px 0 0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${BRAND.soft};">Titolare del trattamento: ${escapeHtml(LDV_CONTROLLER)}. <a href="${escapeHtml(privacyUrl)}" style="color:${BRAND.gold};text-decoration:underline;">Informativa privacy</a></p>
                <p style="margin:18px 0 0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${BRAND.cream};">Non vuoi ricevere altre comunicazioni promozionali?<br><a href="${unsubscribe}" style="color:${BRAND.gold};text-decoration:underline;font-weight:bold;">Disiscriviti con un clic</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * Invio dell'invito a un indirizzo. Con `List-Unsubscribe` e `List-Unsubscribe-Post`
 * i client di posta mostrano il pulsante di disiscrizione (POST one-click su /unsubscribe).
 */
export async function sendLdvInvite(to: string, invite: LdvInvite, options: { idempotencyKey: string; subjectPrefix?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !baseUrl()) return { sent: false as const, reason: 'email_not_configured' };
  const { subject, html, text } = renderLdvInvite(invite);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': options.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      subject: `${options.subjectPrefix || ''}${subject}`,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${invite.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(data)}`);
  return { sent: true as const, providerId: String(data.id || '') };
}

function normalizeWhatsApp(phone: string) {
  let digits = phone.replace(/\D/g,'');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;
  return digits;
}

function whatsappTemplate(type: CommunicationType) {
  const map: Record<CommunicationType, string | undefined> = {
    registration_confirmation: process.env.WA_TEMPLATE_CONFIRMATION,
    reminder_48h: process.env.WA_TEMPLATE_REMINDER_48H,
    reminder_24h: process.env.WA_TEMPLATE_REMINDER_24H,
    thank_you: process.env.WA_TEMPLATE_THANK_YOU,
    exit_thank_you: undefined,
  };
  return map[type];
}

export async function sendWhatsApp(type: CommunicationType, guest: Guest) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;
  const template = whatsappTemplate(type);
  if (!phoneNumberId || !token || !template || !baseUrl()) return { sent:false, reason:'whatsapp_not_configured' };

  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      messaging_product:'whatsapp',
      to:normalizeWhatsApp(guest.phone),
      type:'template',
      template:{
        name:template,
        language:{code:'it'},
        components:[{type:'body',parameters:[
          {type:'text',text:guest.firstName},
          {type:'text',text:prettyDate(guest.eventDate)},
          {type:'text',text:guest.startTime.slice(0,5)},
          {type:'text',text:ticketUrl(guest)},
        ]}],
      },
    }),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`WhatsApp ${response.status}: ${JSON.stringify(data)}`);
  return { sent:true, providerId:String(data.messages?.[0]?.id || '') };
}

export type { CommunicationType, Guest };
