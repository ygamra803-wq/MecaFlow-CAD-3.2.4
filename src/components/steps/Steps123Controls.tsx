import React from 'react';
import { ZeroGapState, WizardStep } from '../../types';
import { PrecisionControl, CustomToggle } from './SharedControls';
import { TubeIcon, PanIcon, HandleIcon } from '../DashboardView';

interface Steps123ControlsProps {
  config: ZeroGapState;
  wizardStep: WizardStep;
  onUpdate: (config: ZeroGapState) => void;
  updateTube: <K extends keyof ZeroGapState['tube']>(key: K, val: ZeroGapState['tube'][K]) => void;
  updatePan: <K extends keyof ZeroGapState['pan']>(key: K, val: ZeroGapState['pan'][K]) => void;
  updateHandle: <K extends keyof ZeroGapState['handle']>(key: K, val: ZeroGapState['handle'][K]) => void;
  setViewingProfilesType: (type: 'tube' | 'pan' | 'handle' | null) => void;
  handleSaveProfile: (type: 'tube' | 'pan' | 'handle') => void;
  onOpenCustomViewer?: (category: 'tube' | 'pan' | 'handle') => void;
  loadedProfileNames?: { tube: string | null; pan: string | null; handle: string | null; };
}

export const Steps123Controls: React.FC<Steps123ControlsProps> = ({
  config,
  wizardStep,
  onUpdate,
  updateTube,
  updatePan,
  updateHandle,
  setViewingProfilesType,
  handleSaveProfile,
  onOpenCustomViewer,
  loadedProfileNames,
}) => {
  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
         STEP 1: TUBE DESIGN
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'tube-design' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setViewingProfilesType('tube')}
              className="flex-1 py-1 px-2 border border-[var(--border)] rounded text-[10px] text-[var(--accent)] hover:border-[var(--accent)] transition-colors uppercase font-bold"
            >
              اختيار من نماذج محفوظة
            </button>
            <button
              type="button"
              onClick={() => handleSaveProfile('tube')}
              className="py-1 px-2 border border-[var(--border)] rounded text-[10px] text-white bg-[var(--accent)] hover:opacity-90 transition-opacity uppercase font-bold"
            >
              حفظ النموذج
            </button>
          </div>

          {/* بطاقة قياسات ومعلومات الأنبوب المربوط نشطاً */}
          <div className="mb-4 bg-zinc-950/40 p-3 rounded-xl border border-zinc-500/15 text-right font-sans" dir="rtl">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold mb-2 pb-1 border-b border-zinc-500/10">
              <TubeIcon className="w-4 h-4 text-zinc-400" />
              <span>الربط النشط للأنبوب الرئيسي (Connected Tube Stage)</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mb-1.5">
              <span className="text-zinc-400">النموذج المتصل:</span>
              <span className="text-white font-bold bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-500/20 max-w-[150px] truncate">
                {loadedProfileNames?.tube || 'نموذج بارامتري مخصص'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono mt-1 pt-1.5 border-t border-zinc-800/60">
              <div className="flex justify-between text-zinc-400"><span>العرض/القطر:</span> <span className="text-zinc-200">{(config.tube.width || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400"><span>الطول الإجمالي:</span> <span className="text-zinc-200">{(config.tube.totalLength || 0).toFixed(1)} مم</span></div>
              <div className="flex justify-between text-zinc-400 col-span-2"><span>شكل المقطع:</span> <span className="text-zinc-200">{config.tube.shape}</span></div>
            </div>
          </div>

          <section className="mb-6 border-b border-[var(--border)] pb-2">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">شكل مقطع الأنبوب</label>
            <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'مستطيل' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updateTube('shape', 'مستطيل')}
              >مستطيل / مربع</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'بيضاوي' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updateTube('shape', 'بيضاوي')}
              >بيضاوي</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'دائري' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updateTube('shape', 'دائري')}
              >دائري</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'مخصص' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => {
                  updateTube('shape', 'مخصص');
                  if (onOpenCustomViewer) onOpenCustomViewer('tube');
                }}
              >STL مخصص</button>
            </div>

            {config.tube.shape === 'مخصص' && (
              <div className="mb-4 bg-white/5 p-3 rounded border border-[var(--accent)]/50 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCustomViewer?.('tube')}
                    className="inline-block px-3 py-1 bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white rounded text-[10px] uppercase font-bold transition-colors cursor-pointer"
                  >
                    {config.tube.customStlName ? `تغيير الموديل: ${config.tube.customStlName}` : 'رفع وتأكيد ملف STL'}
                  </button>
                  {config.tube.customStlName && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...config, tube: { ...config.tube, customStlBuffer: null as any, customStlName: undefined } })}
                      className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 rounded text-[10px] uppercase font-bold transition-colors border border-red-800"
                    >مسح (Clear STL)</button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between text-[11px] mb-3 text-[var(--text-dim)]">
              <span>عرض: <b className="text-[var(--text-main)] font-mono">{config.tube.width}</b></span>
              <span>ارتفاع: <b className="text-[var(--text-main)] font-mono">{config.tube.shape === 'دائري' ? config.tube.width : config.tube.height}</b></span>
            </div>

            <PrecisionControl
              label={config.tube.shape === 'دائري' ? 'قطر الأنبوب' : 'عرض الأنبوب'}
              val={config.tube.width}
              onChange={v => updateTube('width', v)}
              min={10}
              max={80}
              step={1}
            />
            {config.tube.shape !== 'دائري' && config.tube.shape !== 'مخصص' && (
              <PrecisionControl
                label={config.tube.shape === 'بيضاوي' ? 'القطر الأصغر (Height)' : 'ارتفاع الأنبوب'}
                val={config.tube.height}
                onChange={v => updateTube('height', v)}
                min={5}
                max={50}
                step={1}
              />
            )}
            <PrecisionControl
              label="سماكة المعدن"
              val={config.tube.thickness}
              onChange={v => updateTube('thickness', v)}
              min={0.5}
              max={5.0}
              step={0.1}
            />
            {config.tube.shape === 'مستطيل' && (
              <PrecisionControl
                label="تنعيم الحواف (R)"
                val={config.tube.cornerRadius}
                onChange={v => updateTube('cornerRadius', v)}
                min={0}
                max={Math.min(config.tube.width / 2, config.tube.height / 2)}
                step={0.1}
              />
            )}
            <PrecisionControl
              label="الطول الكلي للأنبوب"
              val={config.tube.totalLength}
              onChange={v => updateTube('totalLength', v)}
              min={50}
              max={300}
              step={1}
            />

            {/* لوحة الملاحظات الهندسية للمصمم المحترف */}
            <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300" id="meca-validation-tube">
              <div className="font-bold text-[var(--accent)] mb-1 flex items-center gap-1.5 justify-end">
                <span>التوصية الميكانيكية للتصميم</span>
                <span className="text-xs">⚙️</span>
              </div>
              {config.tube.shape === 'دائري' && (
                <p>تتمتع المقاطع الدائرية بمقاومة التواء متوازنة (Polar Moment of Inertia) وسهولة ثني في جميع الاتجاهات، مما يسهل تصنيعها باستخدام ثني الأنابيب الهيدروليكي الموجه (Mandrel Bending).</p>
              )}
              {config.tube.shape === 'مستطيل' && (
                <p>يوفر المقطع المستطيل/المربع عزم مقاومة انحناء أعلى (Bending Stiffness) على المحور الرئيسي ومساحة تلامس مسطحة، مما يجعله مثاليًا للربط السطحي دون فراغات عند نقاط الاتصال.</p>
              )}
              {config.tube.shape === 'بيضاوي' && (
                <p>تدمج المقاطع البيضاوية بين المظهر الانسيابي وقوة التحميل الممتازة في محور قطرها الأكبر، وتعد من أفضل الخيارات لتقليل الاضطراب وتوفير راحة إرجونومية لليد.</p>
              )}
              {config.tube.shape === 'مخصص' && (
                <p>المقطع المخصص (STL) يسمح بحرية هندسية كاملة، ولكن يتطلب التأكد من سماكة الجدران وجودة تقسيم الـ Mesh لتفادي الفشل الميكانيكي أو أخطاء التوليد البرمجي.</p>
              )}
            </div>
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
         STEP 2: PAN DESIGN
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'pan-design' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setViewingProfilesType('pan')}
              className="flex-1 py-1 px-2 border border-[var(--border)] rounded text-[10px] text-[var(--accent)] hover:border-[var(--accent)] transition-colors uppercase font-bold"
            >
              اختيار مقلاة محفوظة
            </button>
            <button
              type="button"
              onClick={() => handleSaveProfile('pan')}
              className="py-1 px-2 border border-[var(--border)] rounded text-[10px] text-white bg-[var(--accent)] hover:opacity-90 transition-opacity uppercase font-bold"
            >
              حفظ المقلاة
            </button>
          </div>

          {/* بطاقة قياسات ومعلومات المقلاة المربوطة نشطاً */}
          <div className="mb-4 bg-blue-950/20 p-3 rounded-xl border border-blue-500/15 text-right font-sans" dir="rtl">
            <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold mb-2 pb-1 border-b border-blue-500/10">
              <PanIcon className="w-4 h-4 text-blue-400" />
              <span>الربط النشط للمقلاة (Connected Pan Stage)</span>
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
          </div>

          <section className="mb-6 border-b border-[var(--border)] pb-2">
            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">أبعاد المقلاة</label>

            <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-2 mt-4 text-right">شكل الجدار (Wall Profile)</label>
            <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.pan.wallProfile === 'curved' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updatePan('wallProfile', 'curved')}
              >منحني (Curved)</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.pan.wallProfile === 'straight' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updatePan('wallProfile', 'straight')}
              >مستقيم (Straight)</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.pan.wallProfile === 'مخصص' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => {
                  updatePan('wallProfile', 'مخصص');
                  onOpenCustomViewer?.('pan');
                }}
              >STL مخصص</button>
            </div>

            {config.pan.wallProfile === 'مخصص' && (
              <div className="mb-4 bg-white/5 p-3 rounded border border-[var(--accent)]/50 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCustomViewer?.('pan')}
                    className="inline-block px-3 py-1 bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white rounded text-[10px] uppercase font-bold transition-colors cursor-pointer"
                  >
                    {config.pan.customStlName ? `تغيير الموديل: ${config.pan.customStlName}` : 'رفع وتأكيد ملف STL'}
                  </button>
                  {config.pan.customStlName && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...config, pan: { ...config.pan, customStlBuffer: null as any, customStlName: undefined, wallProfile: 'straight' } })}
                      className="text-[9px] text-red-400 hover:text-red-300 underline cursor-pointer"
                    >
                      حذف وإعادة الضبط
                    </button>
                  )}
                </div>
              </div>
            )}

            <PrecisionControl
              label="القطر السفلي (القاع)"
              val={config.pan.bottomDiameter}
              onChange={v => updatePan('bottomDiameter', v)}
              min={50}
              max={400}
              step={1}
            />
            <PrecisionControl
              label="القطر العلوي"
              val={config.pan.topDiameter}
              onChange={v => updatePan('topDiameter', v)}
              min={100}
              max={500}
              step={1}
            />
            <PrecisionControl
              label="الارتفاع الكلي"
              val={config.pan.height}
              onChange={v => updatePan('height', v)}
              min={20}
              max={200}
              step={1}
            />
            {config.pan.wallProfile !== 'straight' && (
              <PrecisionControl
                label="نصف قطر تقوس الجدار"
                val={config.pan.curveRadius}
                onChange={v => updatePan('curveRadius', v)}
                min={0}
                max={250}
                step={5}
              />
            )}
            <PrecisionControl
              label="قوس القاع (Fillet)"
              val={config.pan.bottomFilletRadius}
              onChange={v => updatePan('bottomFilletRadius', v)}
              min={0}
              max={30}
              step={0.5}
            />

            <CustomToggle
              label="إزالة قاع المقلاة (Remove Bottom)"
              active={!!config.pan.removeBottom}
              onClick={() => onUpdate({ ...config, pan: { ...config.pan, removeBottom: !config.pan.removeBottom } })}
            />
            <CustomToggle
              label="إضافة حافة علوية (Rim)"
              active={config.pan.addRim}
              onClick={() => onUpdate({ ...config, pan: { ...config.pan, addRim: !config.pan.addRim } })}
            />

            {config.pan.addRim && (
              <>
                <PrecisionControl
                  label="ارتفاع الحافة"
                  val={config.pan.rimHeight}
                  onChange={v => updatePan('rimHeight', v)}
                  min={1}
                  max={20}
                  step={0.5}
                />
                <PrecisionControl
                  label="سماكة الحافة"
                  val={config.pan.rimThickness}
                  onChange={v => updatePan('rimThickness', v)}
                  min={0}
                  max={10}
                  step={0.5}
                />
              </>
            )}
          </section>

          <section className="mb-6 border-b border-[var(--border)] pb-2">
            <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">فيزياء المقلاة (Shell)</label>
            <PrecisionControl
              label="سمك المعدن (mm)"
              val={config.pan.wallThickness}
              onChange={v => updatePan('wallThickness', v)}
              min={0.5}
              max={10}
              step={0.1}
            />
            <CustomToggle
              label="عرض مجوّف (Shell)"
              active={config.pan.useShellPreview}
              onClick={() => onUpdate({ ...config, pan: { ...config.pan, useShellPreview: !config.pan.useShellPreview } })}
              color="#14b8a6"
            />
            <CustomToggle
              label="قياسات القالب الداخلي"
              active={config.pan.innerMoldMode}
              onClick={() => onUpdate({ ...config, pan: { ...config.pan, innerMoldMode: !config.pan.innerMoldMode } })}
              color="#22d3ee"
            />
            <CustomToggle
              label="تطبيق السمك على القطع"
              active={config.pan.applyThicknessToCut}
              onClick={() => onUpdate({ ...config, pan: { ...config.pan, applyThicknessToCut: !config.pan.applyThicknessToCut } })}
              color="#ef4444"
            />

            {/* لوحة الاستشارات التصنيعية للمقلاة */}
            <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300" id="meca-validation-pan">
              <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5 justify-end">
                <span>التحليل التصنيعي لوعاء الطهي</span>
                <span className="text-xs">🍳</span>
              </div>
              {config.pan.wallProfile === 'curved' ? (
                <p>الجدار المنحني يوزع الإجهادات الهيكلية الناتجة عن تمدد الحرارة بشكل متساو ويبسط عملية السحب العميق (Deep Drawing)، كما يساعد في تدوير السوائل بشكل ممتاز أثناء الاستعمال.</p>
              ) : config.pan.wallProfile === 'straight' ? (
                <p>الجدار المستقيم ممتاز لتسريع التصنيع بطريقة تدوير المعادن (Spinning)، ولكنه يعزز تركيز الإجهادات (Stress Concentration) عند نقاط القاع؛ لذا يُوصى بزيادة نصف قطر تدوير القاع (Fillet) لتلافى التشققات.</p>
              ) : (
                <p>الموديل ثلاثي الأبعاد المرفوع مخصص للهندسة الحرارية المعقدة، يُرجى التأكد من تطابق محيط الاتصال الدائري لضمان جودة القص واللحام اللاحق.</p>
              )}
              <div className="mt-2 pt-2 border-t border-zinc-500/5 text-[9.5px] text-zinc-400">
                سماكة المعدن الحالية <span className="font-mono text-white">({config.pan.wallThickness} مم)</span> {config.pan.wallThickness < 1.5 ? 'تعد رقيقة وقد تعرض جسم المقلاة للالتواء الحراري عند التشغيل العالي.' : 'توفر متانة هيكلية متميزة وقدرة ممتازة على الصمود الميكانيكي والتبادل الحراري.'}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
         STEP 3: HANDLE DESIGN
         ════════════════════════════════════════════════════════════════ */}
      {wizardStep === 'handle-design' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setViewingProfilesType('handle')}
              className="flex-1 py-1 px-2 border border-[var(--border)] rounded text-[10px] text-[var(--accent)] hover:border-[var(--accent)] transition-colors uppercase font-bold"
            >
              اختيار مقبض محفوظ
            </button>
            <button
              type="button"
              onClick={() => handleSaveProfile('handle')}
              className="py-1 px-2 border border-[var(--border)] rounded text-[10px] text-white bg-[var(--accent)] hover:opacity-90 transition-opacity uppercase font-bold"
            >
              حفظ المقبض
            </button>
          </div>

          {/* بطاقة قياسات ومعلومات المقبض المربوط نشطاً */}
          <div className="mb-4 bg-amber-950/20 p-3 rounded-xl border border-amber-500/15 text-right font-sans" dir="rtl">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold mb-2 pb-1 border-b border-amber-500/10">
              <HandleIcon className="w-4 h-4 text-amber-400" />
              <span>الربط النشط للمقبض (Connected Handle Stage)</span>
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
          </div>

          <section className="mb-4 border-b border-[var(--border)] pb-2">
            <label className="block text-[10px] font-bold text-[var(--accent)] uppercase mb-3 text-right">شكل المقبض</label>
            <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.handle.shape === 'rectangular' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updateHandle('shape', 'rectangular')}
              >مستطيل</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.handle.shape === 'cylindrical' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => updateHandle('shape', 'cylindrical')}
              >أسطواني</button>
              <button
                type="button"
                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.handle.shape === 'مخصص' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                onClick={() => {
                  updateHandle('shape', 'مخصص');
                  onOpenCustomViewer?.('handle');
                }}
              >STL مخصص</button>
            </div>

            {config.handle.shape === 'مخصص' && (
              <div className="mb-4 bg-white/5 p-3 rounded border border-[var(--accent)]/50 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCustomViewer?.('handle')}
                    className="inline-block px-3 py-1 bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white rounded text-[10px] uppercase font-bold transition-colors cursor-pointer"
                  >
                    {config.handle.customStlName ? `تغيير الموديل: ${config.handle.customStlName}` : 'رفع وتأكيد ملف STL'}
                  </button>
                  {config.handle.customStlName && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...config, handle: { ...config.handle, customStlBuffer: null as any, customStlName: undefined, shape: 'rectangular' } })}
                      className="text-[9px] text-red-400 hover:text-red-300 underline cursor-pointer"
                    >
                      حذف وإعادة الضبط
                    </button>
                  )}
                </div>
              </div>
            )}
            <CustomToggle
              label="جسم صلب (بدون تجويف)"
              active={!!config.handle.solid}
              onClick={() => onUpdate({ ...config, handle: { ...config.handle, solid: !config.handle.solid } })}
              color="var(--accent)"
            />
            <PrecisionControl
              label={config.handle.shape === 'cylindrical' ? 'قطر المقبض' : 'عرض المقبض'}
              val={config.handle.width}
              onChange={v => updateHandle('width', v)}
              min={10}
              max={60}
              step={1}
            />
            {config.handle.shape === 'rectangular' && (
              <PrecisionControl
                label="ارتفاع المقبض"
                val={config.handle.height}
                onChange={v => updateHandle('height', v)}
                min={5}
                max={40}
                step={1}
              />
            )}
            <PrecisionControl
              label="طول المقبض"
              val={config.handle.depth}
              onChange={v => updateHandle('depth', v)}
              min={30}
              max={200}
              step={1}
            />
            {!config.handle.solid && (
              <PrecisionControl
                label="سماكة المعدن"
                val={config.handle.thickness}
                onChange={v => updateHandle('thickness', v)}
                min={0.5}
                max={5}
                step={0.1}
              />
            )}
            {config.handle.shape === 'rectangular' && (
              <PrecisionControl
                label="تنعيم الحواف (R)"
                val={config.handle.cornerRadius}
                onChange={v => updateHandle('cornerRadius', v)}
                min={0}
                max={Math.min(config.handle.width / 2, config.handle.height / 2)}
                step={0.1}
              />
            )}

            {/* المعولية الميكانيكية وقبضة المقبض */}
            <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-500/10 text-right text-[10.5px] leading-relaxed text-zinc-300" id="meca-validation-handle">
              <div className="font-bold text-amber-500 mb-1 flex items-center gap-1.5 justify-end">
                <span>مراجعة الانسيابية الحرارية والميكانيكية للقبضة</span>
                <span className="text-xs">🦾</span>
              </div>
              {config.handle.solid ? (
                <p>المقبض المصمت (Solid) يضمن تحمل أحمال ميكانيكية استثنائية وبناء صلداً للغاية، إلا أنه يعاني من حمل حراري زائد (Thermal Conductivity)؛ ستحتاج عازلاً حراريًا عند نقاط التثبيت وعيون الربط.</p>
              ) : (
                <p>تصميم المقبض المجوف (Hollow Shell) يساهم في تكوين عازل هوائي داخلي يقلل التوصيل الحراري ليد المستخدم، ويوفر حوالي <span className="text-amber-400 font-bold">{Math.max(30, Math.min(85, Math.round(100 - (config.handle.thickness / (config.handle.width || 20)) * 200)))}%</span> من الوزن الإجمالي للخامة لتصميم متوازن إرجونوميًا مريح للمستخدم المناوب.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
};
