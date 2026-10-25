import React, { useMemo } from 'react';
import { ZeroGapState } from '../types';
import { GCodeGenerator } from '../lib/gcodeGenerator';

interface CNCViewProps {
  config: ZeroGapState;
  exportManufacturingFile: (content: string | Uint8Array, extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp') => void;
}

const CNCView: React.FC<CNCViewProps> = ({ config, exportManufacturingFile }) => {
  // استخدام مولد الكود الصناعي مع التحقق
  const gcodeResult2 = useMemo(() => {
    return GCodeGenerator.generateGCode(config, 'final-inspect');
  }, [config]);

  const hasError = !!gcodeResult2.error || gcodeResult2.validation.errors.length > 0;
  const errorMsg = gcodeResult2.error || gcodeResult2.validation.errors.join('\n');
  const gcodeLines = hasError ? [] : gcodeResult2.gcode.split('\n');

  // حساب زمن الإنجاز الفعلي بناءً على طول المسار الخطي
  const formattedTime = useMemo(() => {
    if (hasError) return '--:--:--';
    const totalMinutes = gcodeResult2.estimatedTime;
    const mins = Math.floor(totalMinutes);
    const secs = Math.floor((totalMinutes - mins) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:00`;
  }, [hasError, gcodeResult2.estimatedTime]);

  const handleExport = () => {
    if (hasError) {
      alert(errorMsg);
      return;
    }
    exportManufacturingFile(gcodeResult2.gcode, 'nc');
  };

  return (
    <div className="w-full h-full text-zinc-300 font-mono p-6 flex flex-col overflow-hidden" id="cnc-view">
      {/* البار العلوي لمعلومات المحاكاة */}
      <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full animate-pulse ${hasError ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <span className="text-[11px] font-bold text-zinc-100 uppercase tracking-widest">NCCSTUDIO V15 G-CODE GEN & VERIFIER</span>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 bg-zinc-900 text-[10px] rounded border border-zinc-800 text-zinc-500">Laser PWR: 1500W</span>
          <span className="px-2 py-0.5 bg-zinc-900 text-[10px] rounded border border-zinc-800 text-zinc-500">Gas: O2</span>
        </div>
      </div>

      {config.tube.shape === 'مخصص' && (
        <div className="mx-4 mt-4 p-3 bg-amber-900/10 border border-amber-700/30 rounded flex items-start gap-2">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div className="text-[10px] text-amber-200/80 leading-relaxed">
            <strong className="block text-amber-500 mb-1">تنبيه: دقة مسار القص للملفات المخصصة</strong>
            محرك الـ CNC الرياضي الحالي يعتمد نموذج القص المخروطي البيضاوي. بالنسبة لملفات STL المخصصة والأشكال المعقدة، قد يكون مسار القطع المُوَلّد تقريبياً.
          </div>
        </div>
      )}

      {/* تنبيهات التحقق من G-Code */}
      {!hasError && gcodeResult2.validation.warnings.length > 0 && (
        <div className="mx-4 mt-2 p-2.5 bg-yellow-950/10 border border-yellow-700/30 rounded text-[10px] text-yellow-300 space-y-1">
          <div className="font-bold flex items-center gap-1 text-yellow-500">⚠️ تحذيرات سلامة الحركة قطع:</div>
          {gcodeResult2.validation.warnings.map((warn, i) => (
            <div key={i}>• {warn}</div>
          ))}
        </div>
      )}

      {hasError ? (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 border-x border-zinc-800">
          <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-lg">
            <h3 className="text-red-500 font-bold text-sm mb-2">خطأ في توليد G-Code</h3>
            <p className="text-zinc-400 text-xs whitespace-pre-line">{errorMsg}</p>
            <p className="text-zinc-500 text-xs mt-2">تحقق من أقطار الأنبوب وزاوية الميلان ومسافة التقارب</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 border-x border-zinc-800 space-y-1 text-[12px] custom-scrollbar">
          <div className="mb-2 p-2 bg-emerald-950/20 border border-emerald-500/20 rounded text-[10px] text-emerald-400">
            ✓ تم فحص الكود بنجاح. الأوامر الأساسية لليزر (M03 / M05 / M30) وتهيئات القياسات المترية موجودة وجاهزة للتشغيل الآمن.
          </div>
          {gcodeLines.map((line, idx) => {
            const isComment = line.startsWith('(') || line.startsWith(';');
            const isMCode = line.startsWith('M');
            const isGCode = line.startsWith('G');
            return (
              <p
                key={idx}
                className={
                  isComment ? 'text-zinc-650' :
                  isMCode ? 'text-zinc-200 font-semibold' :
                  isGCode ? 'text-emerald-500 font-bold' :
                  'text-zinc-400'
                }
              >
                {line}
              </p>
            );
          })}
          <p className="animate-pulse">_</p>
        </div>
      )}

      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-b-xl flex justify-between items-center">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
          EST TUBE CUT TIME: {formattedTime}
        </div>
        <button
          onClick={handleExport}
          className="px-6 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded hover:bg-emerald-500 transition-colors uppercase tracking-widest"
        >
           تصدير مسار الليزر
        </button>
      </div>
    </div>
  );
};

export default CNCView;
