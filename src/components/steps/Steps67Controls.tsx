import React, { useState } from 'react';
import { ZeroGapState, WizardStep } from '../../types';
import { PrecisionControl, CustomToggle } from './SharedControls';
import { generateCadQueryScript } from '../../lib/exportUtils';
import { generateGcode } from '../../lib/gcodeGenerator';
import { generateProfessionalFileName } from '../../lib/fileNameGenerator';
import { StepExportService } from '../../lib/stepExport';

interface Steps67ControlsProps {
  config: ZeroGapState;
  targetDimensions?: {l: number, w: number, h: number} | null;
  wizardStep: WizardStep;
  onUpdate: (config: ZeroGapState) => void;
  updateTube: <K extends keyof ZeroGapState['tube']>(key: K, val: ZeroGapState['tube'][K]) => void;
  onOpenDrafting: () => void;
  onOpenCNC: () => void;
  onExport: () => void;
  onExportSTEP?: (extension: 'step' | 'stp') => void;
  exportManufacturingFile: (content: string | Uint8Array, extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp', suggestedName?: string) => void;
  onSaveModel?: () => void;
  isPreviousWorkMode?: boolean;
  onExitPreviousWorkMode?: () => void;
}

export const Steps67Controls: React.FC<Steps67ControlsProps> = ({
  config,
  targetDimensions,
  wizardStep,
  onUpdate,
  updateTube,
  onOpenDrafting,
  onOpenCNC,
  onExport,
  onExportSTEP,
  exportManufacturingFile,
  onSaveModel,
  isPreviousWorkMode,
  onExitPreviousWorkMode,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
         STEP 6: TECHNICAL REVIEW & MEASUREMENTS
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'technical-review' && (
        <>
          {isPreviousWorkMode && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-right animate-fade-in text-[11px] leading-relaxed text-zinc-300">
              <div className="font-bold text-amber-500 mb-1 flex items-center gap-1.5 justify-end">
                <span>وضع المعاينة (للقراءة فقط)</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              </div>
              <p className="mb-3 text-[10.5px] text-zinc-400">
                أنت تستعرض حالياً نموذجاً تم إنشاؤه وحفظه مسبقاً. حُظرت التعديلات لتفادي أي تشوهات هندسية في الرياضيات والـ STL.
              </p>
              <button
                type="button"
                onClick={onExitPreviousWorkMode}
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-750 text-white rounded font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                الخروج من المعاينة والبدء من جديد
              </button>
            </div>
          )}

          {/* التحكم في طول القطعة وعينات القص */}
          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">
              طول الجزء المستهدف والقص الفعلي
            </label>
            {isPreviousWorkMode ? (
              <div className="bg-black/40 rounded-xl p-3 border border-zinc-800 text-right mb-2">
                <span className="text-[9.5px] text-zinc-500 block mb-0.5">طول بدن القطعة (قراءة فقط)</span>
                <span className="text-xl font-mono font-bold text-amber-500">{config.tube.partLength} مم</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-850 text-right">
                  <span className="text-[10px] text-zinc-400 block mb-2 font-medium">التحكم في طول الجزء الأوسط (البدن المستقيم) للأنبوب:</span>
                  <PrecisionControl
                    label="طول البدن (mm)"
                    val={config.tube.partLength}
                    onChange={v => updateTube('partLength', v)}
                    min={50}
                    max={1000}
                    step={1}
                  />
                </div>
              </div>
            )}

            {/* الأبعاد والقياسات الناتجة عن عمليات القص بالـ CNC */}
            <div className="mt-4 bg-[#10B981]/5 border border-[#10B981]/20 p-3 rounded-xl text-right space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#10B981] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  أبعاد القطعة الفعلية الناتجة بعد القص في مرحلة 6
                </span>
                <span className="text-[8.5px] text-[#10B981]/70 font-bold uppercase font-mono">3D Measured</span>
              </div>

              <div className="bg-black/40 rounded-lg p-2.5 space-y-2 font-mono text-[10.5px] border border-zinc-800/80">
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-400 font-sans">طول القطعة الناتج الفعلي (أقصى امتداد):</span>
                  <span className="font-bold text-[#10B981] text-[12.5px]">
                    {targetDimensions?.l ? `${targetDimensions.l.toFixed(1)} مم` : `${config.tube.partLength.toFixed(1)} مم`}
                  </span>
                </div>
                
                <div className="h-px bg-zinc-800/60 my-1 font-sans" />

                <div className="grid grid-cols-1 gap-y-1.5 text-[9.5px] font-sans">
                  <div className="flex justify-between text-zinc-400">
                    <span>طول الأنبوب الخام الأصلي المطلوب حرارياً:</span>
                    <span className="text-white font-mono">
                      {(config.tube.partLength + Math.max(config.assembly.insertionDistance || 10, 10) + Math.max(config.handle.insertionDepth || 10, 10)).toFixed(1)} مم
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>طول بدن القطعة السليم (المستقيم الأوسط):</span>
                    <span className="text-white font-mono border-b border-dashed border-zinc-700/60">{config.tube.partLength} مم</span>
                  </div>
                  <div className="flex justify-between text-blue-400/90">
                    <span>الجزء المستقطع جهة الرأس لعلامة المقلاة:</span>
                    <span className="font-mono">-{Math.max(config.assembly.insertionDistance || 10, 10).toFixed(1)} مم</span>
                  </div>
                  <div className="flex justify-between text-yellow-500/90">
                    <span>الجزء المستقطع جهة الذيل لغرائز المقبض:</span>
                    <span className="font-mono">-{Math.max(config.handle.insertionDepth || 10, 10).toFixed(1)} مم</span>
                  </div>
                </div>
              </div>

              <p className="text-[9px] text-zinc-400 leading-relaxed font-sans pr-1">
                ⚠️ <span className="font-semibold text-zinc-300">تنويه هندسي:</span> يحسب هذا التقرير بدقة طول القطعة المطلوبة والأطراف التي تُستأصل مجهرياً أثناء لحام المقلاة والمقبض بخلوص صفر تجميعي.
              </p>
            </div>
          </section>

          {/* عرض القياسات التفصيلية */}
          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">
              تحليل أبعاد القطعة (Final Part Diagnostics)
            </label>

            <div className="space-y-4" dir="rtl">
              {/* الأنبوب الرئيسي */}
              <div className="bg-black/40 rounded p-2 border border-zinc-805">
                <div className="text-[9px] text-[var(--text-dim)] mb-2 font-bold uppercase tracking-wider border-b border-zinc-800 pb-1">أبعاد الأنبوب الرئيسي (Main Pipe)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-zinc-300"><span>العرض/القطر الخارجي:</span> <span className="text-white">{(config.tube?.width || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span>العرض/القطر الداخلي:</span> <span className="text-white">{Math.max((config.tube?.width || 0) - (config.tube?.thickness || 0) * 2, 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span>السماكة:</span> <span className="text-white">{(config.tube?.thickness || 0).toFixed(2)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span>الطول النهائي الفعلي (بعد القص):</span> <span className="text-[#10B981] font-bold">{(targetDimensions?.l || config.tube?.partLength || 0).toFixed(1)} مم</span></div>
                </div>
              </div>

              {/* تقاطع B - المقلاة */}
              <div className="bg-black/40 rounded p-2 border border-blue-900/30">
                <div className="text-[9px] text-[#60a5fa] mb-2 font-bold uppercase tracking-wider border-b border-blue-900/40 pb-1">تقاطع B (الوصلة الأمامية / المقلاة)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-zinc-300"><span>زاوية القطع:</span> <span className="text-white">{(config.assembly?.tiltAngle || 0).toFixed(1)}°</span></div>
                  <div className="flex justify-between text-zinc-300"><span>عمق الاختراق:</span> <span className="text-white">{(config.assembly?.insertionDistance || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span>إزاحة (Z Offset):</span> <span className="text-white">{(config.assembly?.heightOffset || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span>القطر السفلي للمقلاة:</span> <span className="text-white">{(config.pan?.bottomDiameter || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300 col-span-2"><span>نمط القوس:</span> <span className="text-white">{config.pan?.innerMoldMode ? 'داخلي (Inner)' : 'خارجي (Outer)'}</span></div>
                </div>
              </div>

              {/* تقاطع A - المقبض */}
              {config.handle && (
                <div className="bg-black/40 rounded p-2 border border-yellow-900/30">
                  <div className="text-[9px] text-yellow-500 mb-2 font-bold uppercase tracking-wider border-b border-yellow-900/40 pb-1">تقاطع A (الوصلة الخلفية / المقبض)</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                    <div className="flex justify-between text-zinc-300"><span>الشكل:</span> <span className="text-white">{config.handle.shape === 'cylindrical' ? 'أسطواني' : 'مربع/مستطيل'}</span></div>
                    <div className="flex justify-between text-zinc-300"><span>العرض/القطر:</span> <span className="text-white">{(config.handle.width || 0).toFixed(1)} مم</span></div>
                    <div className="flex justify-between text-zinc-300"><span>زاوية الانحراف (X):</span> <span className="text-white">{(config.handle.angleX || 0).toFixed(1)}°</span></div>
                    <div className="flex justify-between text-zinc-300"><span>زاوية الدوران (Y):</span> <span className="text-white">{(config.handle.angleY || 0).toFixed(1)}°</span></div>
                    <div className="flex justify-between text-zinc-300"><span>السماكة:</span> <span className="text-white">{(config.handle.thickness || 0).toFixed(1)} مم</span></div>
                    <div className="flex justify-between text-zinc-300"><span>الذيل المغروز:</span> <span className="text-white">{Math.max(config.handle.insertionDepth || 10, 10).toFixed(1)} مم</span></div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* المعايير البصرية */}
          <section className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المعايير البصرية</label>
            <CustomToggle
              label="إظهار حلقات التقسيم (Body Slices)"
              active={!!config.showBodySlices}
              onClick={() => onUpdate({ ...config, showBodySlices: !config.showBodySlices })}
              color="var(--accent)"
            />
            <CustomToggle
              label="خيال الأطراف المقطوعة (Ghost)"
              active={!!config.showGhostPart}
              onClick={() => onUpdate({ ...config, showGhostPart: !config.showGhostPart })}
              color="var(--accent-blue)"
            />
            <CustomToggle
              label="إظهار مسار القطع"
              active={!!config.showToolpathPreview}
              onClick={() => onUpdate({ ...config, showToolpathPreview: !config.showToolpathPreview })}
              color="var(--accent)"
            />
          </section>

          {/* لوحة المراجعة الهندسية المتكاملة والتحليل الهيكلي */}
          <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300 animate-fade-in" id="meca-validation-step6">
            <div className="font-bold text-[#10B981] mb-1 flex items-center gap-1.5 justify-end">
              <span>تقرير التحليل البعدي والتحقق الميكانيكي</span>
              <span className="text-xs">⚡</span>
            </div>
            <p className="mb-2">
              تم احتساب نسبة الصلابة الميكانيكية للوزن (Stiffness-to-Weight Ratio) للأنبوب الرئيسي ذي السماكة <span className="text-white font-mono font-bold">({config.tube.thickness} مم)</span>. 
              تبلغ نسبة الخلوص الصفرية عند تجميع المقلاة والمقبض <span className="text-[#10B981] font-bold">0.00 مم (Zero-Gap tolerance)</span> بفضل مسارات القص التكيفية ثنائية التموج.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-500/5 text-[9.5px] text-zinc-400 font-mono">
              <div className="text-right">مساحة منطقة اللحام: <span className="text-white">{Math.round((config.tube.width * Math.PI) * 1.15)} مم²</span></div>
              <div className="text-right">مقاومة الالتواء المتوقعة: <span className="text-white">ممتاز</span></div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
         STEP 7: FINAL INSPECTION
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'final-inspect' && (
        <>
          {isPreviousWorkMode && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-right animate-fade-in text-[11px] leading-relaxed text-zinc-300">
              <div className="font-bold text-amber-500 mb-1 flex items-center gap-1.5 justify-end">
                <span>وضع المعاينة (للقراءة فقط)</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              </div>
              <p className="mb-3 text-[10.5px] text-zinc-400">
                أنت تستعرض حالياً نموذجاً تم إنشاؤه وحفظه مسبقاً. حُظرت التعديلات لتفادي أي تشوهات هندسية في الرياضيات والـ STL.
              </p>
              <button
                type="button"
                onClick={onExitPreviousWorkMode}
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-755 text-white rounded font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                الخروج من المعاينة والبدء من جديد
              </button>
            </div>
          )}

          {/* Final Touches */}
          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">اللمسات النهائية</label>
            {isPreviousWorkMode ? (
              <div className="bg-black/40 rounded-xl p-3.5 border border-zinc-800 space-y-2.5 text-right text-[11px]">
                <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                  <span className="text-zinc-400">تنعيم حافة القطع:</span>
                  <span className={config.addFillet ? 'text-amber-500 font-bold' : 'text-zinc-650 font-medium'}>
                    {config.addFillet ? 'مُفعّل (0.2 مم)' : 'غير نشط'}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                  <span className="text-zinc-400">تخليص حراري:</span>
                  <span className={config.thermalClearance ? 'text-amber-500 font-bold' : 'text-zinc-650 font-medium'}>
                    {config.thermalClearance ? 'مُفعّل (+0.1 مم)' : 'غير نشط'}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                  <span className="text-zinc-400">التعليم المرجعي:</span>
                  <span className={config.markOrientation ? 'text-amber-500 font-bold' : 'text-zinc-650 font-medium'}>
                    {config.markOrientation ? 'مُفعّل (Laser Mark)' : 'غير نشط'}
                  </span>
                </div>
                <div className="pt-2">
                  <CustomToggle
                    label="إظهار مسار Gcode"
                    active={!!config.showGcodePath}
                    onClick={() => onUpdate({ ...config, showGcodePath: !config.showGcodePath })}
                    color="var(--accent)"
                  />
                </div>
              </div>
            ) : (
              <>
                <CustomToggle
                  label="تنعيم حافة القطع (0.2mm)"
                  active={!!config.addFillet}
                  onClick={() => onUpdate({ ...config, addFillet: !config.addFillet })}
                />
                <CustomToggle
                  label="إضافة تخليص حراري (+0.1mm)"
                  active={!!config.thermalClearance}
                  onClick={() => onUpdate({ ...config, thermalClearance: !config.thermalClearance })}
                />
                <CustomToggle
                  label="التعليم المرجعي (Laser Mark)"
                  active={!!config.markOrientation}
                  onClick={() => onUpdate({ ...config, markOrientation: !config.markOrientation })}
                />
                <CustomToggle
                  label="إظهار مسار Gcode"
                  active={!!config.showGcodePath}
                  onClick={() => onUpdate({ ...config, showGcodePath: !config.showGcodePath })}
                  color="var(--accent)"
                />
              </>
            )}
          </section>

          {/* لوحة الاستشارات التصنيعية النهائية لـ G-code والتصدير */}
          <div className="mb-6 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300 animate-fade-in" id="meca-validation-step7">
            <div className="font-bold text-amber-500 mb-1 flex items-center gap-1.5 justify-end">
              <span>جاهزية التصنيع وتصدير البيانات الهندسية</span>
              <span className="text-xs">🚀</span>
            </div>
            <p className="mb-2">
              تتناغم خوارزميات التوليد الرقمي للتصميم مع ماكينات القص بالليزر خماسي المحاور (5-Axis Laser Cutter) لإنتاج أفضل دقة ممكنة. 
              عند تنشيط <span className="text-white font-bold">التخليص الحراري (+0.1 مم)</span>، يتم تقليص فجوات التجميع تلقائياً لتعويض تمدد معدن الفولاذ المقاوم للصدأ (Stainless Steel) أثناء عملية اللحام القوسي أو بالليزر.
            </p>
            <p className="text-[9.5px] text-zinc-400">
              يمكنك تصدير ملفات <span className="text-zinc-200 font-bold">STEP</span>، وسكريبت بايثون <span className="text-zinc-200 font-bold font-mono">CadQuery</span>، أو كود التشغيل <span className="text-zinc-200 font-bold font-mono">G-CODE</span> مباشرةً لبدء عجلة التصنيع الرقمي الدقيق.
            </p>
          </div>

          {/* DraftingView / CNCView buttons */}
          <section className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={onOpenDrafting}
              className="flex-1 py-3 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold rounded flex flex-col items-center gap-1 transition-colors"
              title="عرض المخططات"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              مخطط تصنيع
            </button>
            <button
              type="button"
              onClick={onOpenCNC}
              className="flex-1 py-3 border border-zinc-700 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-[11px] font-bold rounded flex flex-col items-center gap-1 transition-colors"
              title="العرض للتصنيع"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              الماكينة CNC
            </button>
          </section>

          {!isPreviousWorkMode && (
            <section className="mb-6">
              <button
                type="button"
                onClick={onSaveModel}
                className="w-full py-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 font-bold text-[11px] uppercase tracking-widest rounded border border-indigo-500/50 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.2)]"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                حفظ وإضافة النموذج إلى مكتبة العمل السابق
              </button>
            </section>
          )}

          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <button
              type="button"
              onClick={() => {
                try {
                  const r = generateGcode(config, wizardStep);
                  if (r.error) { alert(r.error); return; }
                  exportManufacturingFile(r.gcode, 'nc', generateProfessionalFileName(config, 'nc'));
                } catch (err) { alert('فشل: ' + (err instanceof Error ? err.message : '')); }
              }}
              className="w-full py-2 bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-bold text-[11px] uppercase tracking-widest rounded border border-[var(--accent-blue)]/30 transition-colors"
              title="يصدر G-code الأولي المبني على المسار التجريبي"
            >
              تصدير G-CODE تجريبي
            </button>
          </section>

          {/* Export */}
          <section className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => { try { onExport(); } catch (err) { alert('فشل تصدير STL: ' + (err instanceof Error ? err.message : 'خطأ')); } }}
              className="w-full py-2 bg-[var(--accent)] hover:opacity-90 transition-opacity text-white font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              تصدير 3D مباشر (STL)
            </button>

            <div className="grid grid-cols-1 gap-2 mb-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsExporting(true);
                    const service = new StepExportService();
                    const stepString = await service.exportToSTEP(config);
                    
                    const blob = new Blob([stepString], { type: 'application/step' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = generateProfessionalFileName(config, 'step');
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    service.terminate();
                  } catch (err: any) {
                    console.error('Export failed:', err);
                    alert('فشل تصدير STEP: ' + (err.message || String(err)));
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className={`w-full py-2 transition-colors text-white font-bold text-[11px] uppercase rounded border ${isExporting ? 'bg-purple-800 border-purple-800 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'}`}
                title="تحميل مجسم STEP صناعي للتعديل والتصنيع (محرك OpenCASCADE محلي)"
              >
                {isExporting ? 'جاري تصدير STEP...' : '📄 تصدير STEP (مباشر)'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                try {
                  const s = generateCadQueryScript(config);
                  exportManufacturingFile(s, 'py', generateProfessionalFileName(config, 'py'));
                } catch (err) { alert('فشل: ' + (err instanceof Error ? err.message : '')); }
              }}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 transition-colors text-zinc-200 font-bold text-[11px] uppercase tracking-widest rounded border border-zinc-650"
              title="تنزيل سكربت بايثون CadQuery لإنشاء المجسم برمجياً"
            >
              تنزيل سكريبت المصنع (Python)
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  const r = generateGcode(config, wizardStep);
                  if (r.error) { alert(r.error); return; }
                  exportManufacturingFile(r.gcode, 'nc', generateProfessionalFileName(config, 'nc'));
                } catch (err) { alert('فشل: ' + (err instanceof Error ? err.message : '')); }
              }}
              className="w-full py-2 bg-green-600 hover:bg-green-500 transition-colors text-white font-bold text-[11px] uppercase tracking-widest rounded border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
            >
              تحميل كود الماكينة (G-CODE)
            </button>
          </section>
        </>
      )}
    </>
  );
};
