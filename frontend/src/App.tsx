import { Header } from './components/Header';
import { Scene } from './components/Scene';
import { InfoPanel } from './components/InfoPanel';
import { GradeLegend } from './components/GradeLegend';
import { useMetadata } from './hooks/useDrillholes';

export function App() {
  const { data: metadata } = useMetadata();

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      <Header />
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <Scene />
          {metadata && (
            <GradeLegend min={metadata.grade_range.min} max={metadata.grade_range.max} />
          )}
        </div>
        <InfoPanel />
      </div>
    </div>
  );
}
