import { lazy, Suspense, memo } from 'react';
import { Cpu } from 'lucide-react';
import './styles/glassmorphism.css';

const PortMappingPanel = lazy(() => import('./components/PortMappingPanel'));

const PanelSkeleton = memo(function PanelSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
});

const AnimatedBackground = memo(function AnimatedBackground() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
    </div>
  );
});

function App() {
  return (
    <div className="app-container min-h-screen overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex h-screen flex-col">
        {/* Header — drag-region makes the whole bar draggable */}
        <header className="drag-region h-16 px-8 flex items-center justify-between glass-panel border-b border-cyan-500/20">
          <div className="no-drag flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Localhost Mapper
            </h1>
          </div>

          <div className="no-drag flex items-center space-x-2 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>SYSTEM ONLINE</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-hidden">
          <div className="h-full">
            <Suspense fallback={<PanelSkeleton />}>
              <PortMappingPanel />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default memo(App);
