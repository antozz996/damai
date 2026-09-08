# DAMAI Open Days 2026

Sistema full-stack per gli Open Days DAMAI del **30-31 ottobre e 1 novembre 2026**.

## Funzioni

- Landing page brandizzata DAMAI / La Dolce Vita
- Registrazione ospite + accompagnatori
- Disponibilità slot in tempo reale
- Controllo capienza transazionale: niente overbooking anche con richieste simultanee
- Codice registrazione e QR personale univoco
- Check-in staff tramite scansione del QR
- Dashboard amministrativa protetta
- Modifica della capienza/attivazione di ogni fascia oraria
- Qualificazione lead: Nuovo, Hot Lead, Potenziale, In valutazione, Follow-up, Lungo termine, Convertito, Perso
- Esportazione CSV completa
- Tracking UTM e provenienza lead
- Log degli eventi della registrazione
- Coda comunicazioni email + WhatsApp
- Conferma immediata, reminder 48h, reminder 24h, thank-you post evento
- Retry automatico delle comunicazioni fallite
- Informativa privacy dedicata Open Days

## Stack

- Next.js 16 / React 19
- PostgreSQL Neon
- Database di produzione dedicato in `aws-eu-central-1`
- `pg` con transazioni e row locking per gli slot
- QR code server-side
- Resend per email (configurabile)
- WhatsApp Cloud API / template Meta (configurabile)
- Vercel Cron per la coda comunicazioni

## Variabili ambiente

Copia `.env.example` e configura:

- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `CRON_SECRET`
- opzionali: Resend e WhatsApp Cloud API

Nessun segreto deve essere committato nel repository.

## Rotte principali

- `/` — landing + registrazione
- `/ticket/[token]` — pass personale con QR
- `/privacy` — informativa privacy Open Days
- `/admin` — dashboard staff
- `/admin/slots` — configurazione capienza
- `/admin/checkin/[token]` — schermata check-in da QR
- `/api/admin/export` — export CSV

## Database

Schema riproducibile in `db/schema.sql`.

Gli slot iniziali sono dalle 16:00 alle 21:00 ogni 30 minuti, per tutte e tre le date, con capienza iniziale di 60 persone per fascia. La capienza è modificabile dall'area staff.

## Comunicazioni

Il sistema crea automaticamente in coda:

1. conferma registrazione;
2. reminder 48 ore prima;
3. reminder 24 ore prima;
4. thank-you il giorno successivo.

Email e WhatsApp sono indipendenti: se un provider non è ancora configurato, la comunicazione resta in coda e non blocca la registrazione.

## Sicurezza

- Area staff protetta server-side
- Credenziali solo tramite environment variables
- QR basato su UUID non prevedibile
- Query parametrizzate
- Validazione server-side con Zod
- Controllo capienza dentro transazione PostgreSQL con lock della fascia
- Database dati personali collocato in regione UE

## Stato

Branch di sviluppo: `open-days-system`  
Pull Request: `#1`
