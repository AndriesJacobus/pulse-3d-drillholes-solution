import { useStore } from '../store/useStore';

export function InfoPanel() {
  const selectedHole = useStore((s) => s.selectedHole);
  const selectedIntercept = useStore((s) => s.selectedIntercept);
  const setPdfPage = useStore((s) => s.setPdfPage);

  if (!selectedHole) {
    return (
      <div className="shrink-0 overflow-y-auto bg-bg-surface p-4">
        <p className="text-sm text-text-muted" data-testid="info-panel">
          Click a drillhole to inspect
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 overflow-y-auto bg-bg-surface p-4">
      <div data-testid="info-panel">
        <h2 className="font-mono text-base font-semibold text-accent">{selectedHole.hole_code}</h2>

        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <dt className="text-text-muted">Prospect</dt>
          <dd className="font-mono text-text-primary">{selectedHole.prospect}</dd>
          <dt className="text-text-muted">Dip</dt>
          <dd className="font-mono text-text-primary">{selectedHole.dip}&deg;</dd>
          <dt className="text-text-muted">Azimuth</dt>
          <dd className="font-mono text-text-primary">{selectedHole.azimuth}&deg;</dd>
          <dt className="text-text-muted">Total depth</dt>
          <dd className="font-mono text-text-primary">{selectedHole.total_depth}m</dd>
        </dl>

        {selectedHole.intercepts.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-medium text-text-secondary">
              Intercepts ({selectedHole.intercepts.length})
            </h3>
            <ul className="space-y-1">
              {selectedHole.intercepts.map((ic, i) => {
                const isActive =
                  selectedIntercept?.depth_from === ic.depth_from &&
                  selectedIntercept?.depth_to === ic.depth_to;
                return (
                  <li
                    key={i}
                    className={`rounded px-2 py-1.5 text-xs ${
                      isActive ? 'bg-accent-muted' : 'bg-bg-raised'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text-primary">
                        {ic.depth_from}&ndash;{ic.depth_to}m
                      </span>
                      <span className="font-mono font-semibold text-accent">
                        {ic.grade} {ic.grade_unit}
                      </span>
                      <span className="text-text-muted">{ic.commodity}</span>
                    </div>
                    {ic.page && (
                      <button
                        onClick={() => setPdfPage(ic.page)}
                        className="mt-0.5 text-[10px] text-blue-400 underline hover:text-blue-300"
                      >
                        Source (p.{ic.page})
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-xs text-text-muted">No significant intercepts</p>
        )}

        <div className="mt-3 flex flex-col gap-1">
          {selectedHole.collar_page && (
            <button
              onClick={() => setPdfPage(selectedHole.collar_page)}
              className="text-left text-xs text-blue-400 underline hover:text-blue-300"
            >
              View source PDF (p.{selectedHole.collar_page})
            </button>
          )}
          <a
            href={`https://www.google.com/maps/search/${selectedHole.latitude},${selectedHole.longitude}/@${selectedHole.latitude},${selectedHole.longitude},17z`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-blue-400 underline"
          >
            View on Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
