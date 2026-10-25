import React from 'react';
import { ZeroGapState } from '../types';

interface DraftingViewProps {
  config: ZeroGapState;
}

const DraftingView: React.FC<DraftingViewProps> = ({ config }) => {
  return (
    <div className="w-full h-full p-6 flex flex-col items-center justify-center" id="drafting-view">
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col p-8 shadow-2xl">
         <div className="w-full p-4 border border-zinc-800 bg-zinc-950 text-emerald-500 rounded mb-8 text-center flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase tracking-widest text-left">
              ZERO-GAP ENGINEERING SHEET<br/>
              <span className="text-[9px] text-zinc-400">المخطط الهندسي للمقبض</span>
            </h4>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">SYSTEM_AUTO</p>
              <p className="text-[10px] text-zinc-200 font-mono">{new Date().toLocaleDateString()}</p>
            </div>
         </div>

         <div className="w-full grid grid-cols-2 gap-8 mb-8">
            <div className="border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-400 font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px] rounded-lg">
               <div className="relative w-40 h-40 border-2 border-dashed border-emerald-500 rounded-full flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-emerald-500/50"></div>
                  <div className="absolute left-0 right-0 h-px bg-emerald-500/50"></div>
                  <span className="bg-zinc-950 px-2 text-emerald-500">Ø TOP {config.pan.topDiameter}mm</span>
               </div>
               [ مسقط رأسي للمقلاة - قطر: {config.pan.topDiameter}mm ]
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-400 font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px] rounded-lg">
               <div className="relative w-20 h-40 border-2 border-emerald-500 rounded-sm flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-emerald-500/50"></div>
                  <span className="bg-zinc-950 px-2 text-emerald-500 absolute -right-6 origin-left -rotate-90 whitespace-nowrap">TUBE L: {config.tube.totalLength}mm</span>
               </div>
               [ مسقط جانبي للأنبوب - أبعاد: {config.tube.width}x{config.tube.shape === 'دائري' ? config.tube.width : config.tube.height}mm ]
            </div>
         </div>

         <div className="space-y-4 w-full text-left font-mono text-[10px] mb-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-zinc-950 p-3 border border-zinc-800 flex justify-between rounded">
                 <span className="text-zinc-500">BOOLEAN ALGORITHM:</span>
                 <span className="text-zinc-200 font-bold">EXACT CSG</span>
               </div>
               <div className="bg-zinc-950 p-3 border border-zinc-800 flex justify-between rounded">
                 <span className="text-zinc-500">SURFACE QUALITY:</span>
                 <span className="text-zinc-200 font-bold text-emerald-500">ZERO SCAR / ZERO GAP</span>
               </div>
               <div className="bg-zinc-950 p-3 border border-zinc-800 flex justify-between rounded">
                 <span className="text-zinc-500">SCALE:</span>
                 <span className="text-zinc-200 font-bold">1:1 (True Scale)</span>
               </div>
               <div className="bg-zinc-950 p-3 border border-zinc-800 flex justify-between rounded">
                 <span className="text-zinc-500">EXPORT:</span>
                 <span className="text-zinc-200 font-bold">STEP / STL Solid</span>
               </div>
            </div>
         </div>

         <button className="w-full py-4 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-emerald-500 transition-colors">
             تصدير المخطط (PDF ISO A3)
         </button>
      </div>
    </div>
  );
};

export default DraftingView;
