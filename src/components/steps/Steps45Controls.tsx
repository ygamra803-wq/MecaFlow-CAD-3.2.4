import React from 'react';
import { ZeroGapState, WizardStep } from '../../types';
import { PrecisionControl, CustomToggle } from './SharedControls';
import { PanIcon, HandleIcon } from '../DashboardView';

interface Steps45ControlsProps {
  config: ZeroGapState;
  wizardStep: WizardStep;
  onUpdate: (config: ZeroGapState) => void;
  updateAssembly: <K extends keyof ZeroGapState['assembly']>(key: K, val: ZeroGapState['assembly'][K]) => void;
  updatePan: <K extends keyof ZeroGapState['pan']>(key: K, val: ZeroGapState['pan'][K]) => void;
  updateHandle: <K extends keyof ZeroGapState['handle']>(key: K, val: ZeroGapState['handle'][K]) => void;
  loadedProfileNames?: { tube: string | null; pan: string | null; handle: string | null; };
  onJump?: (target: WizardStep, returnTo: WizardStep) => void;
}

export const Steps45Controls: React.FC<Steps45ControlsProps> = ({
  config,
  wizardStep,
  onUpdate,
  updateAssembly,
  updatePan,
  updateHandle,
  loadedProfileNames,
  onJump,
}) => {
  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
         STEP 4: PAN-TUBE INTERSECTION
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'pan-tube-cut' && (
        <>
          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">وضع العرض</label>
            <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded">
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => onUpdate({ ...config, renderMode: 'preview' })}
              >معاينة التلامس</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'boolean' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => onUpdate({ ...config, renderMode: 'boolean' })}
              >قطع صفري (B)</button>
            </div>
          </section>

          {/* ربط المقلاة بالمرحلة الحالية */}
          <div className="mb-4 bg-blue-950/20 p-3 rounded-xl border border-blue-500/15 text-right font-sans" dir="rtl">
            <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold mb-2 pb-1 border-b border-blue-500/10">
              <PanIcon className="w-4 h-4 text-blue-400" />
              <span>المقلاة المربوطة هندسياً بالتقاطعات</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mb-1.5">
              <span className="text-zinc-400">النموذج المتصل:</span>
              <span className="text-white font-bold bg-blue-950/40 px-2 py-0.5 rounded border border-blue-500/20 max-w-[150px] truncate">
                {loadedProfileNames?.pan || 'نموذج بارامتري مخصص'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono mt-1 pt-1.5 border-t border-zinc-800/60">
              <div className="flex justify-between text-zinc-400"><span>القطر السفلي:</span> <span className="text-zinc-200">{(config.pan.bottomDiameter || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400"><span>الارتفاع الكلي:</span> <span className="text-zinc-200">{(config.pan.height || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400 col-span-2"><span>شكل الجدار:</span> <span className="text-zinc-200">{config.pan.wallProfile === 'curved' ? 'منحني (Curved)' : 'مستقيم (Straight)'}</span></div>
            </div>

            <button
              type="button"
              onClick={() => onJump?.('pan-design', 'pan-tube-cut')}
              className="w-full mt-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-[11px] font-bold transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow-blue-900/10"
            >
              تعديل شكل المقلاة ←
            </button>
          </div>

          {config.renderMode === 'boolean' ? (
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">
                تحليل التقاطع (Zero-Gap Diagnostics)
              </label>
              <div className="bg-black/40 rounded p-3 border border-blue-900/30 text-right">
                <div className="text-[9px] text-[#60a5fa] mb-3 font-bold uppercase tracking-wider border-b border-blue-900/40 pb-2">تقاطع B (المقلاة / الوصلة الأمامية)</div>
                <div className="flex flex-col gap-y-2 text-[10px] font-mono" dir="rtl">
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">زاوية ميل التقاطع الفعلي:</span> <span className="text-white">{(config.assembly?.tiltAngle || 0).toFixed(1)}°</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">عمق الاختراق:</span> <span className="text-white">{(config.assembly?.insertionDistance || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">إزاحة المركز (Z Offset):</span> <span className="text-white">{(config.assembly?.heightOffset || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">قطر القطع (السطح المتقاطع):</span> <span className="text-white">{(config.pan?.bottomDiameter || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span className="text-[var(--text-dim)]">نوع القالب المستخدم:</span> <span className="text-white">{config.pan?.innerMoldMode ? 'داخلي (Inner)' : 'خارجي (Outer)'}</span></div>
                </div>
                <div className="text-[#60a5fa] text-[9px] mt-4 font-normal bg-blue-900/10 border border-blue-900/20 p-2 rounded text-center leading-relaxed">
                  تم إخفاء أدوات التعديل للحفاظ على دقة القطع ومحاذاة الأبعاد.
                  <br/>
                  <span className="text-white font-bold opacity-70">للعودة للتعديل، يرجى تفعيل وضع "معاينة التلامس".</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">ضبط تركيب طرف B (المقلاة)</label>
              <PrecisionControl
                label="زاوية الميل (محور X)"
                val={config.assembly.tiltAngle}
                onChange={v => updateAssembly('tiltAngle', v)}
                min={-90}
                max={90}
                step={1}
              />
              <PrecisionControl
                label="دوران Twist (محور Z)"
                val={config.assembly.handleAngleY}
                onChange={v => updateAssembly('handleAngleY', v)}
                min={-45}
                max={45}
                step={1}
              />
              <PrecisionControl
                label="الارتفاع من القاع (محور Y)"
                val={config.assembly.heightOffset}
                onChange={v => updateAssembly('heightOffset', v)}
                min={-150}
                max={150}
                step={1}
              />
              <PrecisionControl
                label="عمق الاختراق (محور Z)"
                val={config.assembly.insertionDistance}
                onChange={v => updateAssembly('insertionDistance', v)}
                min={0}
                max={Math.floor((config.tube?.totalLength || 300) * 0.455)}
                step={1}
              />
            </section>
          )}

          <section className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المعايير البصرية</label>
            <CustomToggle
              label="إظهار مسار القطع"
              active={!!config.showToolpathPreview}
              onClick={() => onUpdate({ ...config, showToolpathPreview: !config.showToolpathPreview })}
              color="var(--accent)"
            />
          </section>

          {/* لوحة الاستشارة الهندسية المتقدمة لتقاطع المقلاة */}
          <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300" id="meca-validation-step4">
            <div className="font-bold text-[#00E5FF] mb-1 flex items-center gap-1.5 justify-end">
              <span>تحليل الاتصال وملاءمة الصفر-فجوة (Zero-Gap Fitment)</span>
              <span className="text-xs">📐</span>
            </div>
            <p>
              يتقاطع أنبوب الوصلة مع الجدار الخارجي المنحني للمقلاة لتشكيل منحنى سرجي معقد (Saddle Curve). 
              الملاءمة الحالية بزاوية ميلان <span className="text-[#00E5FF] font-bold font-mono">{config.assembly.tiltAngle}°</span> وعمق اختراق <span className="text-[#00E5FF] font-bold font-mono">{config.assembly.insertionDistance} مم</span> تحدد مظهر اللحام وجودته الميكانيكية.
            </p>
            <div className="mt-2 pt-2 border-t border-zinc-500/5 text-[9.5px] text-zinc-400">
              {config.assembly.tiltAngle === 0 ? (
                <span>الربط العمودي المباشر (Tilt = 0°) يضمن توجيه قوى الحمل الهيكلي بشكل متناظر تماماً، مما يسهل برمجة ماكينات القص خماسي المحاور (5-Axis Laser Cutter).</span>
              ) : (
                <span>الزاوية المائلة الحالية ممتازة لتوزيع عزم الدوران إرجونوميًا، ولكنها تتطلب تفادي الحواف الشديدة الحادة (Sharp Feathers) عبر شطف الحواف ميكانيكياً (Chamfering) قبل عملية اللحام بالكامل.</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
         STEP 5: TUBE-HANDLE INTERSECTION
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'tube-handle-cut' && (
        <>
          <section className="mb-6 border-b border-[var(--border)] pb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">وضع العرض</label>
            <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded">
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => onUpdate({ ...config, renderMode: 'preview' })}
              >معاينة التلامس</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'boolean' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => onUpdate({ ...config, renderMode: 'boolean' })}
              >قطع صفري (A)</button>
            </div>
          </section>

          {/* ربط المقبض بالمرحلة الحالية */}
          <div className="mb-4 bg-amber-950/20 p-3 rounded-xl border border-amber-500/15 text-right font-sans" dir="rtl">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold mb-2 pb-1 border-b border-amber-500/10">
              <HandleIcon className="w-4 h-4 text-amber-400" />
              <span>المقبض المربوط هندسياً بالتقاطعات</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mb-1.5">
              <span className="text-zinc-400">النموذج المتصل:</span>
              <span className="text-white font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20 max-w-[150px] truncate">
                {loadedProfileNames?.handle || 'نموذج بارامتري مخصص'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono mt-1 pt-1.5 border-t border-zinc-800/60">
              <div className="flex justify-between text-zinc-400"><span>العرض/القطر:</span> <span className="text-zinc-200">{(config.handle.width || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400"><span>الطول الإجمالي:</span> <span className="text-zinc-200">{(config.handle.depth || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400 col-span-2"><span>شكل المقطع:</span> <span className="text-zinc-200">{config.handle.shape === 'rectangular' ? 'مربع/مستطيل' : 'دائري/أسطواني'}</span></div>
            </div>

            <button
              type="button"
              onClick={() => onJump?.('handle-design', 'tube-handle-cut')}
              className="w-full mt-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-[11px] font-bold transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow-blue-900/10"
            >
              تعديل شكل المقبض ←
            </button>
          </div>

          {config.renderMode === 'boolean' ? (
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">
                تحليل التقاطع (Zero-Gap Diagnostics)
              </label>
              <div className="bg-black/40 rounded p-3 border border-yellow-900/30 text-right">
                <div className="text-[9px] text-yellow-500 mb-3 font-bold uppercase tracking-wider border-b border-yellow-900/40 pb-2">تقاطع A (الوصلة الخلفية / المقبض)</div>
                <div className="flex flex-col gap-y-2 text-[10px] font-mono" dir="rtl">
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">الشكل:</span> <span className="text-white">{config.handle?.shape === 'cylindrical' ? 'أسطواني' : 'مربع/مستطيل'}</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">العرض/القطر:</span> <span className="text-white">{(config.handle?.width || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">زاوية الانحراف (X):</span> <span className="text-white">{(config.handle?.angleX || 0).toFixed(1)}°</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">زاوية الدوران (Y):</span> <span className="text-white">{(config.handle?.angleY || 0).toFixed(1)}°</span></div>
                  <div className="flex justify-between text-zinc-300 border-b border-white/5 pb-1"><span className="text-[var(--text-dim)]">السماكة:</span> <span className="text-white">{(config.handle?.thickness || 0).toFixed(1)} مم</span></div>
                  <div className="flex justify-between text-zinc-300"><span className="text-[var(--text-dim)]">الذيل المغروز:</span> <span className="text-white">{Math.max(config.handle?.insertionDepth || 10, 10).toFixed(1)} مم</span></div>
                </div>
                <div className="text-yellow-500 text-[9px] mt-4 font-normal bg-yellow-900/10 border border-yellow-900/20 p-2 rounded text-center leading-relaxed">
                  تم إخفاء أدوات التعديل للحفاظ على دقة القطع ومحاذاة الأبعاد.
                  <br/>
                  <span className="text-white font-bold opacity-70">للعودة للتعديل، يرجى تفعيل وضع "معاينة التلامس".</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">ضبط تركيب طرف A (المقبض)</label>
              <PrecisionControl
                label="زاوية ميلان المقبض (X)"
                val={config.handle.angleX}
                onChange={v => updateHandle('angleX', v)}
                min={-90}
                max={90}
                step={1}
              />
              <PrecisionControl
                label="دوران المقبض (Y)"
                val={config.handle.angleY}
                onChange={v => updateHandle('angleY', v)}
                min={-180}
                max={180}
                step={1}
              />
              <PrecisionControl
                label="إزاحة المقبض (Z)"
                val={config.handle.offsetZ}
                onChange={v => updateHandle('offsetZ', v)}
                min={-100}
                max={100}
                step={1}
              />
              <PrecisionControl
                label="عمق الاختراق"
                val={config.handle.insertionDepth}
                onChange={v => updateHandle('insertionDepth', v)}
                min={0}
                max={Math.floor((config.tube?.totalLength || 300) * 0.455)}
                step={1}
              />
            </section>
          )}

          <section className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المعايير البصرية</label>
            <CustomToggle
              label="إظهار مسار القطع"
              active={!!config.showToolpathPreview}
              onClick={() => onUpdate({ ...config, showToolpathPreview: !config.showToolpathPreview })}
              color="var(--accent)"
            />
            <CustomToggle
              label="إخفاء المقلاة (لتسهيل الرؤية)"
              active={!!config.pan.hideInStep5}
              onClick={() => updatePan('hideInStep5', !config.pan.hideInStep5)}
            />
             <CustomToggle
              label="تفعيل القص التلقائي المسطح (Continuous Fallback)"
              active={config.fallbackCutToDepth !== false}
              onClick={() => onUpdate({ ...config, fallbackCutToDepth: config.fallbackCutToDepth === false ? true : false })}
              color="var(--accent-blue)"
            />
          </section>

          {/* دليل خيار القص التلقائي المسطح */}
          <div className="mt-3 p-3 rounded bg-zinc-950/40 border border-blue-500/10 text-right text-[10px] leading-relaxed text-zinc-400">
            <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5 justify-end">
              <span>ماذا يفعل خيار "القص التلقائي المسطح"؟</span>
              <span>ℹ️</span>
            </div>
            <p>
              عندما تكون نهاية الأنبوب خارج حدود ملامسة المقبض أو المقلاة جزئياً (بسبب زوايا ميلان حادة أو قطر أنبوب كبير)، يقوم هذا الخيار تلقائياً بقص الأجزاء التي لا تتقاطع بشكل مستقيم (مسطح) عند أقصى عمق للاختراق. هذا يحمي ماكينة القطع من التوقف ويمنع فشل توليد كود الـ G-code. إذا كان تصميمك متلامساً بالكامل وجاهزاً للقطع المنحني الطبيعي، يمكنك إلغاء تفعيله.
            </p>
          </div>

          {/* لوحة الاستشارة الهندسية لتقاطع المقبض */}
          <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300" id="meca-validation-step5">
            <div className="font-bold text-amber-500 mb-1 flex items-center gap-1.5 justify-end">
              <span>ديناميكا عزم الانحناء والتعشيق الهيكلي للقبضة</span>
              <span className="text-xs">⚡</span>
            </div>
            <p>
              تحدد قيمة عمق الاختراق <span className="text-amber-400 font-bold font-mono">{config.handle.insertionDepth} مم</span> متانة الوصلانية الخلفية. 
              {config.handle.insertionDepth < 15 ? (
                <span className="text-amber-500 font-bold"> تنبيه: الاختراق الحالي سطحي نسبياً وقد يعزز من تركيز الإجهادات (Stress Shear) عند اللحام؛ يفضل زيادة عمق الاختراق لأكثر من 15 مم لتوزيع الحمل الديناميكي بشكل داخلي متين.</span>
              ) : (
                <span> التعشيق الحالي ممتاز يضمن استقراراً استثنائياً ضد الالتواء الجانبي (Torsional Stiffness)، مما يمنع تفكك الوصلة بفعل الأحمال المتكررة في بيئات الخدمة الشاقة.</span>
              )}
            </p>
            <div className="mt-2 pt-2 border-t border-zinc-500/5 text-[9.5px] text-zinc-400">
              تقوم برمجية <span className="text-zinc-200">Zero-Gap AI Engine</span> باحتساب مسار القطع الذاتي باستمرارية هندسية كاملة استناداً إلى المحاذاة الحالية لتوفير فجوة خلوص صفرية حقيقية جاهزة للتجميع المباشر.
            </div>
          </div>
        </>
      )}
    </>
  );
};
