# Email di conferma e QR DAMAI

Il form registra l'ospite e genera un codice univoco. Quando le variabili email sono configurate, la conferma parte immediatamente e contiene:

- il QR personale in linea nell'email;
- l'allegato `DAMAI-QR.png`;
- il link al biglietto personale (`/ticket/<token>`);
- la data e la fascia di arrivo selezionate.

Il QR apre la scheda di check-in dello staff. La pagina è protetta dalle credenziali dell'area amministrativa; le ragazze devono usare il link dello scanner `/admin/checkin`.

I tre template transazionali del Damai Christmas Village (conferma con QR, promemoria, ringraziamento il giorno dopo la visita) sono in stile bordeaux e oro, con layout a tabelle da 600px e font Georgia. Usano le immagini `public/email/dcv-monogramma.png` e `public/email/dcv-logo.png`, servite da `${PUBLIC_BASE_URL}/email/…` (i file statici sono sempre pubblici, anche a registrazioni chiuse). Anteprima senza invio: `/api/admin/test-email?type=registration_confirmation` (oppure `reminder_24h`, `thank_you`), raggiungibile dalla pagina `/admin/emails`.

## 1. Verifica il dominio in Resend

1. Apri [Resend Domains](https://resend.com/domains) e aggiungi il dominio che userai nel mittente, ad esempio `damaigarden.it`.
2. Inserisci nel DNS del dominio tutti i record SPF/DKIM indicati da Resend.
3. Attendi lo stato **Verified**. Finché il dominio non è verificato, per una prova puoi usare `onboarding@resend.dev` come mittente.
4. Crea una API key con permesso di invio e conservala senza inserirla in GitHub o in chat.

## 2. Inserisci le variabili in Vercel

Nel progetto Vercel `damai`, apri **Settings → Environment Variables**. Per i test seleziona **Preview**; per l'uso reale seleziona **Production**.

| Variabile | Tipo | Valore |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | La chiave `re_...` di Resend |
| `EMAIL_FROM` | Config | `Damai Christmas Village <eventi@damaigarden.it>` |
| `EMAIL_REPLY_TO` | Config, opzionale | L'indirizzo a cui rispondere, ad esempio `info@damaigarden.it` |
| `PUBLIC_BASE_URL` | Config | `https://registrazioni.damaigarden.it` (dominio di questo backend) |
| `REGISTRATIONS_OPEN` | Config | `true` per aprire le registrazioni |
| `DATABASE_URL` | Secret | La stringa Neon di produzione |
| `ADMIN_USER` | Secret | Utente dello staff |
| `ADMIN_PASSWORD` | Secret | Password dello staff |
| `CRON_SECRET` | Secret | Una chiave casuale lunga |

Il dominio contenuto in `EMAIL_FROM` deve essere quello verificato in Resend. Dopo aver salvato le variabili, esegui un nuovo deploy; le variabili vengono lette solo dalle nuove esecuzioni.

## 3. Prova completa

1. Apri la pagina del Christmas Village e invia una registrazione usando un indirizzo email controllabile.
2. Controlla in Resend **Emails** che la richiesta sia stata accettata e poi consegnata.
3. Verifica che l'email mostri il QR e contenga l'allegato `DAMAI-QR.png`.
4. Sul telefono dello staff apri `/admin/checkin`, attiva la fotocamera e inquadra il QR.
5. Nella scheda del cliente premi **Registra ingresso** e verifica lo stato nella dashboard.

Se Resend non è configurato o risponde con un errore temporaneo, la registrazione resta valida: la comunicazione rimane in coda e il cron `/api/cron/communications` la ritenta automaticamente, fino a tre tentativi. Controlla il dettaglio dell'errore nei log della funzione Vercel e in Resend.

Non condividere mai `RESEND_API_KEY`, `DATABASE_URL`, `ADMIN_PASSWORD` o `CRON_SECRET` in chat, screenshot o commit.
