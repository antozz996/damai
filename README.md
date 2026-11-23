# Damai Christmas Village 2026

Backend di registrazione e check-in per il **Damai Christmas Village** di **sabato 12 e domenica 13 dicembre 2026**, dalle 16:00 alle 21:30 (ultimo ingresso alle 21:00). Ingresso gratuito con registrazione obbligatoria.

La pagina pubblica dell'evento vive sul sito statico (`https://www.damaigarden.it/christmas-village/`): il suo form chiama questo backend da un altro dominio (CORS). Il QR del volantino punta alla pagina del sito, non a questo backend.

Lo stesso sistema ha gestito gli Open Days 2026: quei dati restano nel database con l'edizione `open-days-2026` e non compaiono nelle schermate dell'edizione corrente.

## Funzioni

- Registrazione ospite + accompagnatori (bambini compresi) con numero di bambini informativo
- Disponibilità delle fasce in tempo reale
- Controllo capienza transazionale: niente overbooking anche con richieste simultanee
- Anti-duplicato per email/telefono, limitato all'edizione corrente
- Codice registrazione (`N26-…`) e QR personale univoco
- Biglietto pubblico con QR su `/ticket/[token]`
- Check-in e check-out dello staff tramite scansione del QR
- Dashboard amministrativa protetta: ingressi, uscite, presenti ora, bambini
- Modifica della capienza/attivazione di ogni fascia oraria
- Qualificazione lead per chi indica un evento da organizzare
- Esportazione CSV completa (con colonna `bambini`)
- Tracking UTM e provenienza
- Coda comunicazioni email + WhatsApp: conferma immediata con QR, promemoria, ringraziamento dopo l'uscita
- CORS per origini autorizzate, rate limit best-effort e campo honeypot sulla registrazione
- Informativa privacy dedicata

## Stack

- Next.js 16 / React 19
- PostgreSQL Neon (regione UE)
- `pg` con transazioni e row locking per le fasce
- QR code server-side
- Resend per email (configurabile)
- WhatsApp Cloud API / template Meta (configurabile)
- Vercel Cron per la coda comunicazioni

## Variabili ambiente

Copia `.env.example` e configura:

| Variabile | Descrizione |
| --- | --- |
| `DATABASE_URL` | Stringa di connessione PostgreSQL |
| `PUBLIC_BASE_URL` | Dominio pubblico di questo backend, es. `https://registrazioni.damaigarden.it` (base di `/ticket/<token>`) |
| `STAFF_BASE_URL` | Dominio codificato nel QR per lo staff; se assente usa `PUBLIC_BASE_URL` |
| `PUBLIC_PAGE_URL` | Pagina dell'evento sul sito (default `https://www.damaigarden.it/christmas-village/`) |
| `EVENT_EDITION` | Edizione corrente (default `natale-2026`) |
| `REGISTRATIONS_OPEN` | `true` per aprire le rotte pubbliche; con qualsiasi altro valore rispondono 410 |
| `CORS_ALLOWED_ORIGINS` | Origini autorizzate, separate da virgola |
| `WALK_IN_PUBLIC` | `true` per rendere pubblica la registrazione walk-in self-service (`/walk-in`) |
| `FEATURE_GIFT` | `true` per riattivare il passo "cadeau" all'uscita (default disattivato) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Credenziali Basic Auth dell'area staff |
| `CRON_SECRET` | Segreto del cron comunicazioni |
| Resend / WhatsApp | Facoltativi, vedi `.env.example` |

Nessun segreto deve essere committato nel repository.

## Rotte principali

Pubbliche solo con `REGISTRATIONS_OPEN=true`:

- `GET /api/slots` — fasce attive dell'edizione con posti residui (CORS)
- `POST /api/register` — registrazione (CORS, rate limit, honeypot)
- `/ticket/[token]` — biglietto personale con QR
- `/` — pagina di registrazione di riserva
- `/api/cron/communications` — coda comunicazioni (richiede `Authorization: Bearer CRON_SECRET`)

Sempre pubblica: `/privacy`.

Sempre protette da Basic Auth: `/admin`, `/admin/slots`, `/admin/registrations`, `/admin/checkin`, `/admin/walk-in`, `/api/admin/*` (export CSV compreso).

### Contratto API pubblico

`GET /api/slots` → `200 { "edition": "natale-2026", "slots": [{ "id", "eventDate": "2026-12-12", "startTime": "16:00:00", "capacity": 60, "used": 12, "remaining": 48 }] }`

`POST /api/register` (JSON):

| Campo | Obbligatorio | Note |
| --- | --- | --- |
| `firstName`, `lastName` | sì | 2-80 caratteri |
| `phone` | sì | 7-30 caratteri |
| `email` | sì | |
| `slotId` | sì | UUID di una fascia restituita da `/api/slots` |
| `privacyConsent` | sì | deve essere `true` |
| `companions` | no | 0-10, accompagnatori totali **bambini inclusi** (default 0) |
| `children` | no | 0-10, quanti accompagnatori sono bambini; deve essere ≤ `companions` |
| `eventType` | no | default `Solo Christmas Village` |
| `plannedEventDate` | no | `AAAA-MM-GG` |
| `guestCount` | no | 1-1000 |
| `source`, `notes` | no | |
| `marketingConsent` | no | default `false` |
| `utmSource`, `utmMedium`, `utmCampaign` | no | |
| `website` | no | honeypot: deve restare vuoto |

Risposta `201 { "registrationCode": "N26-1A2B3C4D", "qrToken": "<uuid>", "ticketUrl": "https://…/ticket/<uuid>" }`.

Errori, sempre nella forma `{ "error": "messaggio in italiano" }`: `400` dati non validi, `404` fascia non disponibile, `409` fascia completa o registrazione già presente, `410` registrazioni chiuse, `429` troppe richieste, `500`/`503` errore temporaneo.

## Database

- Installazione pulita: `db/schema.sql`.
- Database esistente (quello degli Open Days): applicare `db/migrations/20261123_edition_natale.sql`, idempotente. Aggiunge `edition` a fasce e registrazioni, `children` alle registrazioni e crea le 22 fasce dell'edizione `natale-2026` (12 e 13 dicembre, ogni 30 minuti dalle 16:00 alle 21:00, 60 persone ciascuna).

La capienza di ogni fascia è modificabile dall'area staff.

## Comunicazioni

Il sistema mette in coda:

1. conferma di registrazione con QR (inviata subito);
2. promemoria prima dell'evento;
3. ringraziamento il giorno successivo, dopo che lo staff ha registrato l'uscita.

Email e WhatsApp sono indipendenti: se un provider non è configurato, la comunicazione resta in coda e non blocca la registrazione. Promemoria e ringraziamento partono dal cron giornaliero definito in `vercel.json`, che funziona solo con `REGISTRATIONS_OPEN=true`.

Per configurare Resend, Vercel e il test dello scanner QR consulta [la guida email](docs/email-setup.md).

## Sicurezza

- Area staff protetta server-side (Basic Auth nel proxy)
- Credenziali solo tramite environment variables
- QR basato su UUID non prevedibile
- Query parametrizzate
- Validazione server-side con Zod
- Controllo capienza dentro transazione PostgreSQL con lock della fascia
- Database dati personali collocato in regione UE
