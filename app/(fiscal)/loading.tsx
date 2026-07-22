export default function FiscalLoading() {
  return (
    <div className="af-page af-page-loading" role="status" aria-live="polite" aria-label="Carregando pagina">
      <div className="af-loading-heading">
        <div className="af-skeleton af-skeleton-title" />
        <div className="af-skeleton af-skeleton-subtitle" />
      </div>

      <div className="af-loading-metrics" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="af-loading-card" key={index}>
            <div className="af-skeleton af-skeleton-label" />
            <div className="af-skeleton af-skeleton-value" />
          </div>
        ))}
      </div>

      <div className="af-loading-panel" aria-hidden="true">
        <div className="af-skeleton af-skeleton-panel-title" />
        {Array.from({ length: 5 }, (_, index) => (
          <div className="af-loading-row" key={index}>
            <div className="af-skeleton" />
            <div className="af-skeleton" />
            <div className="af-skeleton" />
          </div>
        ))}
      </div>

      <span className="af-loading-screen-reader">Carregando conteúdo da página…</span>
    </div>
  );
}
