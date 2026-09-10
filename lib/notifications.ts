type CommunicationType = 'registration_confirmation' | 'reminder_48h' | 'reminder_24h' | 'thank_you';

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
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
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

export async function sendEmail(type: CommunicationType, guest: Guest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !baseUrl()) return { sent:false, reason:'email_not_configured' };
  const copy = emailCopy(type, guest);
  const qrDataUrl = await QRCode.toDataURL(checkinUrl(guest), { width: 520, margin: 1, errorCorrectionLevel: 'M' });
  const qrContent = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const html = `<!doctype html><html><body style="margin:0;background:#f4ede1;font-family:Georgia,serif;color:#2f261e"><div style="max-width:620px;margin:0 auto;padding:44px 24px"><div style="letter-spacing:.18em;font-size:28px">DAMAI</div><div style="font-size:10px;letter-spacing:.3em;text-transform:uppercase;margin-bottom:44px">Exclusive Garden</div><h1 style="font-weight:400;font-size:38px;line-height:1.05">${escapeHtml(copy.heading)}</h1><p style="font-size:18px;line-height:1.6">Ciao ${escapeHtml(guest.firstName)},<br>${escapeHtml(copy.text)}</p><div style="margin:30px 0 26px;text-align:center;background:#fff;padding:20px"><img src="cid:damai-qr-code" width="240" height="240" alt="QR code personale DAMAI" style="display:block;width:240px;height:240px;margin:0 auto"><p style="margin:14px 0 0;color:#6f6256;font-size:13px">Mostra questo QR all’ingresso. È allegato anche come immagine.</p></div><p style="margin:34px 0"><a href="${copy.link}" style="display:inline-block;background:#0e2d4f;color:white;text-decoration:none;padding:15px 22px;letter-spacing:.1em;text-transform:uppercase;font-size:12px">${escapeHtml(copy.cta)}</a></p><p style="font-size:13px;color:#6f6256">Codice registrazione: ${escapeHtml(guest.registrationCode)}</p></div></body></html>`;
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
        content_id:'damai-qr-code',
      }],
      headers:{'Idempotency-Key':`damai-${type}-${guest.registrationCode}`},
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
