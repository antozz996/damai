import { EDITIONS, edHref, type Edition } from '@/lib/event';

/**
 * Selettore di edizione dell'area staff + banner "Archivio · sola lettura".
 * `path` è la pagina su cui restare cambiando edizione (senza parametri).
 */
export default function EditionBar({ edition, path }: { edition: Edition; path: string }) {
  return (
    <div className="edition-bar">
      {EDITIONS.length > 1 && (
        <nav className="edition-switch" aria-label="Edizione">
          {EDITIONS.map((item) => (
            <a
              key={item.id}
              className={`edition-pill${item.id === edition.id ? ' active' : ''}`}
              href={edHref(path, item)}
              aria-current={item.id === edition.id ? 'page' : undefined}
            >
              {item.tabLabel}{!item.current && <small> · archivio</small>}
            </a>
          ))}
        </nav>
      )}
      {!edition.current && (
        <div className="edition-archive-banner" role="status">
          <strong>Archivio · sola lettura</strong>
          <span>{edition.name} · {edition.datesLabel}. Dati consultabili ed esportabili; l’unica modifica consentita è lo stato del lead.</span>
        </div>
      )}
    </div>
  );
}
