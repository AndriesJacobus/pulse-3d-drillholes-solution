import { useMetadata } from '../hooks/useDrillholes';

export function Header() {
  const { data: metadata } = useMetadata();

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border-default bg-bg-surface px-4">
      <h1 className="text-sm font-semibold text-text-primary">
        {metadata?.project_name ?? 'Drillhole Viewer'}
      </h1>
      {metadata && (
        <span className="ml-3 text-xs text-text-muted">
          {metadata.total_holes} holes &middot; {metadata.total_intercepts} intercepts
        </span>
      )}
    </header>
  );
}
