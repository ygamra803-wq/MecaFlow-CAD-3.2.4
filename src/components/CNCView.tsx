import React, { useMemo, useState } from 'react';
import { ZeroGapState } from '../types';
import { GCodeGenerator } from '../lib/gcodeGenerator';
import { NotificationService } from '../lib/notificationService';
import { generateProfessionalFileName } from '../lib/fileNameGenerator';

interface CNCViewProps {
  config: ZeroGapState;
  exportManufacturingFile: (
    content: string | Uint8Array,
    extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp',
    suggestedName?: string
  ) => void;
}

const CNCView: React.FC<CNCViewProps> = ({ config, exportManufacturingFile }) => {
  const [copied, setCopied] = useState(false);

  const gcodeResult = useMemo(() => {
    return GCodeGenerator.generateGCode(config, 'final-inspect');
  }, [config]);

  const hasError = !!gcodeResult.error || gcodeResult.validation.errors.length > 0;
  const errorMsg = gcodeResult.error || gcodeResult.validation.errors.join('\n');
  const gcodeLines = hasError ? [] : gcodeResult.gcode.split('\n');
  const metrics = gcodeResult.metrics;

  const formattedTime = useMemo(() => {
    if (hasError) return '--:--:--';
    const totalMinutes = gcodeResult.estimatedTime;
    const mins = Math.floor(totalMinutes);
    const secs = Math.floor((totalMinutes - mins) * 60);
    const ms = Math.floor(((totalMinutes - mins) * 60 - secs) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, [hasError, gcodeResult.estimatedTime]);

  const handleExport = (ext: 'nc' | 'gcode') => {
    if (hasError) {
      NotificationService.error(errorMsg);
      return;
    }
    exportManufacturingFile(gcodeResult.gcode, ext, generateProfessionalFileName(config, ext));
  };

  const handleCopy = async () => {
    if (hasError || !gcodeResult.gcode) return;
    try {
      await navigator.clipboard.writeText(gcodeResult.gcode);
      setCopied(true);
      NotificationService.success('تم نسخ كود الماكينة (G-Code) إلى الحافظة');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      NotificationService.error('تعذر النسخ التلقائي إلى الحافظة');
    }
  };

  return (
    <div className="w-full h-full text-zinc-300 font-mono p-6 flex flex-col overflow-hidden" id="cnc-view">
      {/* الشريط العلوي لمعلومات الماكينة */}
      <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-t-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${hasError ? 'bg-red-500' : 'bg-emerald-500'}`} />
          <div>
            <span className="text-[11px] font-bold text-zinc-100 uppercase tracking-widest block">
              NCCSTUDIO V15 / ISO-6983 5-AXIS ROTARY TUBE LASER
            </span>
            <span className="text-[9.5px] text-zinc-500">
              مسار ليزر حقيقي مع تعويض Kerf ({metrics.kerfOffsetMm.toFixed(2)} مم) ونقاط اختراق خارجية (Lead-In)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 bg-zinc-900 text-[10px] rounded border border-zinc-800 text-emerald-400">
            PWR: 1500W CW
          </span>
          <span className="px-2.5 py-1 bg-zinc-900 text-[10px] rounded border border-zinc-800 text-blue-400">
            GAS: O2 (1.2 MPa)
          </span>
          <span className="px-2.5 py-1 bg-zinc-900 text-[10px] rounded border border-zinc-800 text-amber-400">
            KERF: ±{metrics.kerfOffsetMm.toFixed(2)}mm
          </span>
        </div>
      </div>

      {/* بطاقات المقاييس الهندسية الحقيقية للمسار */}
      {!hasError && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-zinc-900/70 p-3 border-x border-b border-zinc-800 text-right" dir="rtl">
          <div className="bg-zinc-950/90 p-2 rounded border border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 block font-sans">إجمالي طول القطع بالليزر</span>
            <span className="text-xs font-bold text-emerald-400">{metrics.totalCutLengthMm.toFixed(1)} مم</span>
          </div>
          <div className="bg-zinc-950/90 p-2 rounded border border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 block font-sans">نطاق المحور الطولي (X)</span>
            <span className="text-xs font-bold text-zinc-200">
              {metrics.xMin.toFixed(1)} → {metrics.xMax.toFixed(1)} مم
            </span>
          </div>
          <div className="bg-zinc-950/90 p-2 rounded border border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 block font-sans">عدد نقاط الثقب (Pierces)</span>
            <span className="text-xs font-bold text-amber-400">{metrics.pierceCount} نقطة</span>
          </div>
          <div className="bg-zinc-950/90 p-2 rounded border border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 block font-sans">أقصى زاوية ميلان (Bevel)</span>
            <span className="text-xs font-bold text-blue-400">{metrics.maxBevelAngleDeg.toFixed(1)}°</span>
          </div>
          <div className="bg-zinc-950/90 p-2 rounded border border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 block font-sans">عدد أسطر البرنامج</span>
            <span className="text-xs font-bold text-zinc-200">{gcodeLines.length} سطر</span>
          </div>
        </div>
      )}

      {config.tube.shape === 'مخصص' && (
        <div className="mx-4 mt-3 p-3 bg-amber-900/10 border border-amber-700/30 rounded flex items-start gap-2" dir="rtl">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div className="text-[10px] text-amber-200/80 leading-relaxed">
            <strong className="block text-amber-500 mb-1">تنبيه: دقة مسار القص للملفات المخصصة</strong>
            بالنسبة لملفات STL المخصصة المستوردة من الخارج، يتم تقريب محيط الأنبوب رياضياً لأغراض الدوران المستمر للمحور A.
          </div>
        </div>
      )}

      {!hasError && gcodeResult.validation.warnings.length > 0 && (
        <div className="mx-4 mt-2 p-2.5 bg-yellow-950/10 border border-yellow-700/30 rounded text-[10px] text-yellow-300 space-y-1">
          <div className="font-bold flex items-center gap-1 text-yellow-500">⚠️ تحذيرات سلامة الحركة:</div>
          {gcodeResult.validation.warnings.map((warn, i) => (
            <div key={i}>• {warn}</div>
          ))}
        </div>
      )}

      {hasError ? (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 border-x border-zinc-800">
          <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-lg text-right" dir="rtl">
            <h3 className="text-red-500 font-bold text-sm mb-2">خطأ في توليد G-Code</h3>
            <p className="text-zinc-400 text-xs whitespace-pre-line">{errorMsg}</p>
            <p className="text-zinc-500 text-xs mt-2">تحقق من أقطار الأنبوب وزاوية الميلان ومسافة التقارب.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 border-x border-zinc-800 space-y-0.5 text-[11.5px] custom-scrollbar">
          <div className="mb-3 p-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded text-[10.5px] text-emerald-400 flex items-center justify-between" dir="rtl">
            <span>
              ✓ تم فحص البرنامج بنجاح: أوامر الليزر (M03/M05/M30)، مسارات الدخول الآمنة (Lead-In)، وتخفيض سرعة الزوايا جاهزة للتشغيل الفوري.
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded text-[10px] font-sans font-bold shrink-0 cursor-pointer"
            >
              {copied ? '✓ تم النسخ' : 'نسخ الكود'}
            </button>
          </div>
          {gcodeLines.map((line, idx) => {
            const isComment = line.startsWith('(') || line.startsWith(';');
            const isMCode = line.startsWith('M') || line.startsWith('S');
            const isGCode = line.startsWith('G');
            return (
              <div key={idx} className="flex gap-3 hover:bg-zinc-900/40 px-1 rounded">
                <span className="text-zinc-700 select-none w-8 text-right shrink-0">{idx + 1}</span>
                <p
                  className={
                    isComment
                      ? 'text-zinc-500'
                      : isMCode
                        ? 'text-amber-300 font-semibold'
                        : isGCode
                          ? 'text-emerald-400 font-bold'
                          : 'text-zinc-300'
                  }
                >
                  {line}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-b-xl flex flex-wrap justify-between items-center gap-3">
        <div className="text-[10.5px] text-zinc-400 uppercase tracking-widest font-bold">
          ESTIMATED CYCLE TIME: <span className="text-emerald-400">{formattedTime}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleExport('gcode')}
            className="px-4 py-2 bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px] font-bold rounded hover:bg-zinc-700 transition-colors uppercase tracking-wider cursor-pointer"
          >
            تنزيل (.GCODE)
          </button>
          <button
            type="button"
            onClick={() => handleExport('nc')}
            className="px-6 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded hover:bg-emerald-500 transition-colors uppercase tracking-widest cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            تصدير لماكينة الليزر (.NC)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CNCView;
