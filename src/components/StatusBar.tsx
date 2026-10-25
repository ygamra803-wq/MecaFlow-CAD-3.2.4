import React, { useState, useEffect } from 'react';
import { performanceOptimizer } from '../lib/performanceOptimizer';
import { ZeroGapState, WizardStep } from '../types';

interface StatusBarProps {
  config: ZeroGapState;
  wizardStep: WizardStep;
  currentStepIdx: number;
  targetDimensions?: { l: number; w: number; h: number };
  isDashboard: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ config, wizardStep, currentStepIdx, targetDimensions, isDashboard }) => {
  const [metrics, setMetrics] = useState({ geometries: 0, textures: 0, calls: 0, triangles: 0, jsHeap: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        ...performanceOptimizer.getWebGLMetrics(),
        jsHeap: performanceOptimizer.getMemoryUsage()
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`absolute ${isDashboard ? 'bottom-0 left-0 right-0' : 'bottom-4 left-4 right-4'} h-[32px] border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between text-[10px] uppercase font-mono z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]`}>
      <div className="flex items-center gap-5 text-zinc-500">
        <span className="flex items-center gap-2 text-zinc-300">
          <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse" />
          {isDashboard ? 'جاهز' : `المرحلة ${currentStepIdx} / 7`}
        </span>
        {!isDashboard && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">السمك: <span className="text-white">{config.tube.thickness}mm</span></span>
            <span className="text-zinc-400">الزاوية: <span className="text-white">{config.assembly.tiltAngle.toFixed(0)}°</span></span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-zinc-500">
        <span className="text-zinc-400">HEAP: <span className={metrics.jsHeap > 800 ? 'text-red-500' : 'text-zinc-200'}>{metrics.jsHeap} MB</span></span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-400">TRIGS: <span className="text-zinc-200">{metrics.triangles}</span></span>
        <span className="text-zinc-600">|</span>
        <span className="text-[var(--accent)] font-bold tracking-widest">MecaFlow CAD</span>
      </div>
    </div>
  );
};
