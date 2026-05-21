import { Header } from './components/Header';
import { Scene } from './components/Scene';
import { InfoPanel } from './components/InfoPanel';
import { PdfViewer } from './components/PdfViewer';
import { GradeLegend } from './components/GradeLegend';
import { useMetadata } from './hooks/useDrillholes';
import { useStore } from './store/useStore';

export function App() {
  const { data: metadata } = useMetadata();
  const pdfPage = useStore((s) => s.pdfPage);
  const isPdfOpen = pdfPage !== null;

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      <Header />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Scene />
          {metadata && (
            <GradeLegend min={metadata.grade_range.min} max={metadata.grade_range.max} />
          )}
        </div>
        <div
          className="flex shrink-0 flex-col border-l border-border-default"
          style={{ width: isPdfOpen ? '50%' : '320px' }}
        >
          <InfoPanel />
          {isPdfOpen && <PdfViewer />}
        </div>
      </div>
    </div>
  );
}
