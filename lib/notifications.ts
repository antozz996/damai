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

function baseUrl() {
  return 'https://damai-rouge.vercel.app';
}

function ticketUrl(guest: Guest) {
  return `${baseUrl()}/ticket/${guest.qrToken}`;
}

function checkinUrl(guest: Guest) {
  return `${baseUrl()}/admin/checkin/${guest.qrToken}`;
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

function emailCopy(type: CommunicationType, guest: Guest) {
  const date = prettyDate(guest.eventDate);
  const time = guest.startTime.slice(0,5);
  const link = ticketUrl(guest);
  if (type === 'exit_thank_you') return {
    subject: 'DAMAI · Grazie per averci visitato',
    heading: 'Grazie per aver vissuto DAMAI con noi.',
    text: 'È stato un piacere accoglierti. Se vuoi approfondire il tuo evento o fissare un appuntamento, il nostro team è a tua disposizione.',
    cta: 'Ricontatta il team DAMAI', link: 'https://www.damaigarden.it/#contatti',
  };
  if (type === 'registration_confirmation') return {
    subject: 'DAMAI Open Days · Registrazione confermata',
    heading: 'La tua visita è confermata.',
    text: `Ti aspettiamo ${date} nella fascia delle ${time}.`,
    cta: 'Apri il tuo QR personale', link,
  };
  if (type === 'reminder_48h') return {
    subject: 'DAMAI Open Days · Mancano 48 ore',
    heading: 'La Dolce Vita è quasi qui.',
    text: `Ti ricordiamo la tua visita DAMAI di ${date} alle ${time}.`,
    cta: 'Rivedi il tuo pass', link,
  };
  if (type === 'reminder_24h') return {
    subject: 'DAMAI Open Days · Ti aspettiamo domani',
    heading: 'Ci vediamo presto da DAMAI.',
    text: `La tua fascia di arrivo è ${date} alle ${time}. Tieni a portata di mano il QR personale.`,
    cta: 'Apri il QR', link,
  };
  return {
    subject: 'DAMAI · Grazie per essere stati con noi',
    heading: 'Grazie per aver vissuto La Dolce Vita con noi.',
    text: 'Il nostro team resta a disposizione per trasformare le tue idee in un evento su misura.',
    cta: 'Rivedi la tua registrazione', link,
  };
}

function renderEmailHtml(type: CommunicationType, guest: Guest, copy: ReturnType<typeof emailCopy>, qrCid: string) {
  const firstName = escapeHtml(guest.firstName);
  const registrationCode = escapeHtml(guest.registrationCode);
  const preheader = type === 'exit_thank_you'
    ? 'Grazie per aver vissuto La Dolce Vita con DAMAI.'
    : 'Il tuo pass personale per gli Open Days DAMAI.';
  const imageBase = baseUrl();
  const link = escapeHtml(copy.link);
  const heading = escapeHtml(copy.heading);
  const text = escapeHtml(copy.text);
  const cta = escapeHtml(copy.cta);

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${heading}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .email-title { font-size: 34px !important; }
        .email-hero { height: 170px !important; object-fit: cover !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#e7dcce;color:#132f50;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e7dcce;">
      <tr>
        <td align="center" style="padding:22px 10px;">
          <table role="presentation" class="email-shell" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background:#f8f0e4;border:1px solid #cdbda8;">
            <tr>
              <td style="padding:0;line-height:0;">
                <img src="${imageBase}/damai/ldv/up-frame.png" width="620" alt="" style="display:block;width:100%;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:34px 52px 8px;">
                <div style="font-family:Didot,'Bodoni 72','Bodoni Moda',Georgia,serif;font-size:42px;line-height:1;letter-spacing:.16em;color:#111111;">DAMAI</div>
                <div style="margin-top:13px;font-size:11px;line-height:1.4;letter-spacing:.34em;text-transform:uppercase;color:#b4862f;">La Dolce Vita&nbsp; · &nbsp;Open Days 2026</div>
                <div style="width:82px;height:1px;margin:23px auto 0;background:#132f50;"></div>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:24px 52px 0;">
                <div style="font-family:'Brush Script MT','Segoe Script',cursive;font-size:28px;line-height:1.1;color:#174b82;">La Dolce Vita</div>
                <h1 class="email-title" style="margin:18px 0 18px;font-family:Didot,'Bodoni 72','Bodoni Moda',Georgia,serif;font-size:42px;line-height:1.08;font-weight:400;color:#132f50;">${heading}</h1>
                <p style="margin:0;font-size:18px;line-height:1.65;color:#3c332c;">Ciao ${firstName},<br>${text}</p>
              </td>
            </tr>
            ${type === 'exit_thank_you' ? `<tr><td style="padding:28px 32px 0;"><img class="email-hero" src="${imageBase}/damai/hero-exterior.webp" width="556" height="210" alt="Il giardino DAMAI" style="display:block;width:100%;height:210px;object-fit:cover;border:0;"></td></tr>` : ''}
            ${type === 'exit_thank_you' ? '' : `<tr><td align="center" style="padding:28px 32px 0;"><div style="padding:20px;background:#ffffff;border:1px solid #d6c7b5;"><img src="cid:${qrCid}" width="240" height="240" alt="QR code personale DAMAI" style="display:block;width:240px;height:240px;margin:0 auto;border:0;"><p style="margin:14px 0 0;font-size:13px;line-height:1.4;color:#6f6256;">Mostra questo QR all’ingresso.<br>È allegato anche come immagine.</p></div></td></tr>`}
            <tr>
              <td align="center" style="padding:30px 52px 0;">
                <a href="${link}" style="display:inline-block;padding:16px 25px;background:#123c67;color:#ffffff;text-decoration:none;font-size:12px;line-height:1;letter-spacing:.16em;text-transform:uppercase;">${cta}</a>
              </td>
            </tr>
            <tr>
              <td class="email-pad" align="center" style="padding:27px 52px 36px;">
                <div style="width:82px;height:1px;margin:0 auto 20px;background:#b4862f;"></div>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#6f6256;">Codice registrazione: <strong style="color:#132f50;">${registrationCode}</strong></p>
                <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#817468;">DAMAI Event Garden · Via Marina di Varcaturo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0;line-height:0;">
                <img src="${imageBase}/damai/ldv/shield.png" width="620" alt="" style="display:block;width:100%;height:auto;border:0;">
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(type: CommunicationType, guest: Guest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !baseUrl()) return { sent:false, reason:'email_not_configured' };
  const copy = emailCopy(type, guest);
  const qrCid = 'damai-qr-code';
  const qrDataUrl = await QRCode.toDataURL(checkinUrl(guest), { width: 520, margin: 1, errorCorrectionLevel: 'M' });
  const qrContent = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const html = renderEmailHtml(type, guest, copy, qrCid);
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from,
      to:[guest.email],
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      subject:copy.subject,
      html,
      attachments:[{
        filename:'DAMAI-QR.png',
        content:qrContent,
        content_type:'image/png',
        content_id:qrCid,
      }],
    }),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(data)}`);
  return { sent:true, providerId:String(data.id || '') };
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
