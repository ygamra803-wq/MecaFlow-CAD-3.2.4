import React from 'react';
import { SavedProfile } from '../lib/profileStorage';
import { Box, Layers, Sliders, Settings, ShieldAlert, Cpu } from 'lucide-react';

export const ProfileDetails: React.FC<{ profile: SavedProfile }> = ({ profile }) => {
  const { type, data } = profile;

  const renderUniqueDiagram = () => {
    const dimensions = data.dimensions || { x: 0, y: 0, z: 0 };
    const triangles = data.triangles || 0;
    const selectedFaceA = data.selectedFaceA || 'front';
    const customFileName = data.customFileName || 'model_import.stl';

    return (
      <div className="space-y-4 font-sans text-right" dir="rtl">
        {/* SVG Diagram with Premium High-Tech Styling */}
        <div className="relative shrink-0 w-full h-[110px] bg-[#0c0d12]/90 rounded-xl border border-cyan-900/40 flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle decorative grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:14px_14px]" />
          
          <svg className="w-12 h-12 text-cyan-500/80 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="12" y1="12" x2="22" y2="8.5" />
            <line x1="12" y1="12" x2="2" y2="8.5" />
          </svg>
          <span className="text-[8px] font-mono font-bold text-cyan-400/80 tracking-wider">3D WIREFRAME MESH ENGINE</span>
          <div className="absolute top-2 right-2 bg-cyan-950/80 px-2 py-0.5 rounded text-[8px] border border-cyan-500/30 text-cyan-400 font-mono font-bold">
            مستورد ثلاثي الأبعاد
          </div>
        </div>

        {/* Structured Datasheet Grid matching PreviousWorkLibrary */}
        <div className="bg-[#121318]/95 border border-[#27272a]/80 rounded-xl p-4 text-[11px] text-zinc-300 space-y-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-cyan-400 border-b border-zinc-800/60 pb-1">
            <Cpu size={13} className="shrink-0" />
            <span>بيانات النموذج الهندسي والشبكة</span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10.5px] font-mono text-zinc-400">
            <div className="flex justify-between col-span-2 border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الملف المصدر:</span>
              <span className="font-mono text-cyan-400 font-bold max-w-[200px] truncate-reverse block text-left" title={customFileName}>
                {customFileName}
              </span>
            </div>
            
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الوجه المرجعي A:</span>
              <span className="text-zinc-200 font-bold capitalize">{selectedFaceA}</span>
            </div>
            
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">عدد المضلعات:</span>
              <span className="text-zinc-200 font-bold">{triangles.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between col-span-2 border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الأبعاد القصوى (X×Y×Z):</span>
              <span className="text-emerald-400 font-bold">
                {dimensions.x.toFixed(1)} × {dimensions.y.toFixed(1)} × {dimensions.z.toFixed(1)} مم
              </span>
            </div>
            
            <div className="flex justify-between col-span-2 pt-1 text-[9px] text-zinc-500 leading-relaxed font-sans">
              <span>الحالة والتحصيل الميكانيكي:</span>
              <span className="text-emerald-500 font-semibold">✓ متطابق مع فلسفة التعشيق الذاتي للحساب الجيومتري.</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTubeDiagram = () => {
    const width = data.width || 40;
    const height = data.height || 30;
    const thickness = data.thickness || 1.5;
    const shape = data.shape || 'مستطيل';
    const cornerRadius = data.cornerRadius || 2;
    const totalLength = data.totalLength || 200;

    // Scaling for the 2D visualizer canvas
    const maxVal = Math.max(width, height);
    const scale = maxVal > 0 ? 55 / maxVal : 1;
    const w = width * scale;
    const h = height * scale;
    const t = Math.max(0.7, thickness * scale);

    const cx = 70;
    const cy = 40;

    return (
      <div className="space-y-4 font-sans text-right" dir="rtl">
        {/* SVG Diagram with Premium Design */}
        <div className="relative shrink-0 w-full h-[110px] bg-zinc-955/40 rounded-xl border border-zinc-800/80 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-full h-full" viewBox="0 0 140 80">
            {shape === 'مستطيل' || shape === 'rectangular' ? (
              <>
                {/* Outer frame */}
                <rect
                  x={cx - w / 2}
                  y={cy - h / 2}
                  width={w}
                  height={h}
                  rx={Math.min(w / 4, cornerRadius * scale)}
                  fill="none"
                  stroke="rgba(129, 140, 248, 0.85)"
                  strokeWidth="1.5"
                />
                {/* Inner empty hollow thickness */}
                {w - 2 * t > 0 && h - 2 * t > 0 && (
                  <rect
                    x={cx - w / 2 + t}
                    y={cy - h / 2 + t}
                    width={w - 2 * t}
                    height={h - 2 * t}
                    rx={Math.max(0, Math.min(w / 4, cornerRadius * scale) - t)}
                    fill="none"
                    stroke="rgba(129, 140, 248, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                )}
              </>
            ) : (
              <>
                {/* Oval / Circular outer */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={w / 2}
                  ry={h / 2}
                  fill="none"
                  stroke="rgba(129, 140, 248, 0.85)"
                  strokeWidth="1.5"
                />
                {/* Inner */}
                {w - 2 * t > 0 && h - 2 * t > 0 && (
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={w / 2 - t}
                    ry={h / 2 - t}
                    fill="none"
                    stroke="rgba(129, 140, 248, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                )}
              </>
            )}

            {/* Dimensional Helpers */}
            <line x1={cx - w / 2} y1={cy + h / 2 + 6} x2={cx + w / 2} y2={cy + h / 2 + 6} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            <line x1={cx - w / 2} y1={cy + h / 2 + 4} x2={cx - w / 2} y2={cy + h / 2 + 8} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            <line x1={cx + w / 2} y1={cy + h / 2 + 4} x2={cx + w / 2} y2={cy + h / 2 + 8} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            
            <line x1={cx - w / 2 - 6} y1={cy - h / 2} x2={cx - w / 2 - 6} y2={cy + h / 2} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            <line x1={cx - w / 2 - 8} y1={cy - h / 2} x2={cx - w / 2 - 4} y2={cy - h / 2} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            <line x1={cx - w / 2 - 8} y1={cy + h / 2} x2={cx - w / 2 - 4} y2={cy + h / 2} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
          </svg>
          <div className="absolute top-2 left-2 bg-indigo-950/80 px-2 py-0.5 rounded text-[8px] border border-indigo-500/20 text-indigo-400 font-mono font-bold uppercase">
            {shape}
          </div>
        </div>

        {/* Structured Datasheet Grid matching PreviousWorkLibrary */}
        <div className="bg-[#121318]/95 border border-[#27272a]/80 rounded-xl p-4 text-[11px] text-zinc-300 space-y-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-indigo-400 border-b border-zinc-800/60 pb-1">
            <Box size={13} className="shrink-0" />
            <span>مواصفات هيكل الأنبوب للنموذج</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10.5px] font-mono text-zinc-400">
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">العرض الخارجي:</span>
              <span className="text-zinc-200 font-bold">{width} مم</span>
            </div>
            
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الارتفاع الخارجي:</span>
              <span className="text-zinc-200 font-bold">{height} مم</span>
            </div>
            
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">سمك الجدار الكلي:</span>
              <span className="text-emerald-400 font-bold">{thickness} مم</span>
            </div>
            
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الطول المعتمد:</span>
              <span className="text-zinc-200 font-bold">{totalLength} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">نصف قطر الانحناء:</span>
              <span className="text-zinc-200 font-bold">{cornerRadius} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">هندسة الغطاء:</span>
              <span className="text-indigo-400 font-bold">
                {shape === 'circular' ? 'دائري مغلق' : shape === 'oval' ? 'بيضاوي منبسط' : 'مستطيل قياسي'}
              </span>
            </div>

            <div className="col-span-2 text-[9px] text-zinc-500 leading-relaxed font-sans pt-1">
              ✓ تم استيفاء معايير الحساب الجايرو-فيزيائي وتوزيع الأحمال الهيكلية بنجاح.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPanDiagram = () => {
    const dBottom = data.bottomDiameter || 120;
    const dTop = data.topDiameter || 160;
    const height = data.height || 80;
    const thickness = data.wallThickness || 1.5;
    const wallProfile = data.wallProfile || 'مستقيم';
    const innerMoldMode = data.innerMoldMode;

    const maxVal = Math.max(dTop, height);
    const scale = maxVal > 0 ? 55 / maxVal : 1;
    const wTop = dTop * scale;
    const wBottom = dBottom * scale;
    const h = height * scale;
    const t = Math.max(0.7, thickness * scale);

    const cx = 70;
    const cy = 40;

    return (
      <div className="space-y-4 font-sans text-right" dir="rtl">
        {/* SVG Diagram with Premium Design */}
        <div className="relative shrink-0 w-full h-[110px] bg-zinc-900/30 rounded-xl border border-zinc-800/80 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-full h-full" viewBox="0 0 140 80">
            {/* outer trapezoidal profile of pan */}
            <polygon
              points={`
                ${cx - wTop / 2},${cy - h / 2}
                ${cx + wTop / 2},${cy - h / 2}
                ${cx + wBottom / 2},${cy + h / 2}
                ${cx - wBottom / 2},${cy + h / 2}
              `}
              fill="none"
              stroke="rgba(245, 158, 11, 0.85)"
              strokeWidth="1.5"
            />

            {/* Inner wall hollow profile representation */}
            {wBottom - 2 * t > 0 && wTop - 2 * t > 0 && h - t > 0 && (
              <polygon
                points={`
                  ${cx - wTop / 2 + t},${cy - h / 2}
                  ${cx + wTop / 2 - t},${cy - h / 2}
                  ${cx + wBottom / 2 - t},${cy + h / 2 - t}
                  ${cx - wBottom / 2 + t},${cy + h / 2 - t}
                `}
                fill="none"
                stroke="rgba(245, 158, 11, 0.35)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            )}

            {/* Dimensional line indicators */}
            <line x1={cx - wTop / 2} y1={cy - h / 2 - 5} x2={cx + wTop / 2} y2={cy - h / 2 - 5} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
            <line x1={cx - wBottom / 2} y1={cy + h / 2 + 5} x2={cx + wBottom / 2} y2={cy + h / 2 + 5} stroke="rgba(113,113,122,0.4)" strokeWidth="0.75" />
          </svg>

          <div className="absolute top-2 left-2 bg-amber-950/80 px-2 py-0.5 rounded text-[8px] border border-amber-500/20 text-amber-400 font-mono font-bold uppercase">
            {wallProfile === 'curved' ? 'جدار مقوس' : 'جدار مخروطي'}
          </div>
        </div>

        {/* Structured Datasheet Grid matching PreviousWorkLibrary */}
        <div className="bg-[#121318]/95 border border-[#27272a]/80 rounded-xl p-4 text-[11px] text-zinc-300 space-y-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-amber-500 border-b border-zinc-800/60 pb-1">
            <Sliders size={13} className="shrink-0" />
            <span>مواصفات هيكل وجسم الوعاء (Pan)</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10.5px] font-mono text-zinc-400">
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">قطر الفوهة (قمة):</span>
              <span className="text-zinc-200 font-bold">D{dTop} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">قطر القاعة (قاع):</span>
              <span className="text-zinc-200 font-bold">D{dBottom} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">الارتفاع الكلي:</span>
              <span className="text-zinc-200 font-bold">{height} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">سمك الصفيحة الجانبية:</span>
              <span className="text-amber-400 font-bold">{thickness} مم</span>
            </div>

            <div className="flex justify-between col-span-2 border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">نمط المعاينة والتجويف:</span>
              <span className="text-zinc-200 font-bold">
                {innerMoldMode ? 'قالب تجويف داخلي (قاطع)' : 'قالب صفائح خارجي قياسي'}
              </span>
            </div>

            {data.addRim && (
              <div className="flex justify-between col-span-2 border-b border-zinc-900/40 pb-1">
                <span className="text-zinc-500 font-sans">حافة تسطيح الشفة (Rim):</span>
                <span className="text-emerald-400 font-bold">مفعلة بارتفاع {data.rimHeight || 4} مم</span>
              </div>
            )}

            <div className="col-span-2 text-[9px] text-zinc-500 leading-relaxed font-sans pt-1">
              ✓ تم تقييم تفاوت السماكة وقوة الضغط الميكانيكي تحت ظروف الثني الهيدروليكي.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHandleDiagram = () => {
    const width = data.width || 32;
    const height = data.height || 20;
    const depth = data.depth || 100;
    const shape = data.shape || 'rectangular';
    const angleX = data.angleX || 0;
    const angleY = data.angleY || 0;
    const insertionDepth = data.insertionDepth || 15;
    const cornerRadius = data.cornerRadius || 2;

    const maxVal = Math.max(width, depth);
    const scale = maxVal > 0 ? 40 / maxVal : 1;
    const w = width * scale;
    const h = depth * scale;

    const cx = 70;
    const cy = 40;

    return (
      <div className="space-y-4 font-sans text-right" dir="rtl">
        {/* SVG Diagram with Premium Design */}
        <div className="relative shrink-0 w-full h-[110px] bg-zinc-900/30 rounded-xl border border-zinc-800/80 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-full h-full" viewBox="0 0 140 80">
            {shape === 'rectangular' || shape === 'مستطيل' ? (
              <rect
                x={cx - w / 2}
                y={cy - h / 2}
                width={w}
                height={h}
                rx={Math.min(w / 4, cornerRadius * scale)}
                fill="none"
                stroke="rgba(16, 185, 129, 0.85)"
                strokeWidth="1.5"
              />
            ) : (
              <ellipse
                cx={cx}
                cy={cy}
                rx={w / 2}
                ry={h / 2}
                fill="none"
                stroke="rgba(16, 185, 129, 0.85)"
                strokeWidth="1.5"
              />
            )}

            {/* Simulated connection mitre line */}
            <path d={`M ${cx - w/2} ${cy - h/2} L ${cx + w/2} ${cy - h/2 + angleX * 0.25}`} stroke="rgba(16, 185, 129, 0.35)" strokeWidth="1" strokeDasharray="1,1" />
          </svg>

          <div className="absolute top-2 left-2 bg-emerald-950/80 px-2 py-0.5 rounded text-[8px] border border-emerald-500/20 text-emerald-400 font-mono font-bold uppercase">
            {shape === 'cylindrical' || shape === 'دائري' ? 'أسطواني مفرغ' : 'مضلع حاد'}
          </div>
        </div>

        {/* Structured Datasheet Grid matching PreviousWorkLibrary */}
        <div className="bg-[#121318]/95 border border-[#27272a]/80 rounded-xl p-4 text-[11px] text-zinc-300 space-y-3.5">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-400 border-b border-zinc-800/60 pb-1">
            <Settings size={13} className="shrink-0" />
            <span>مواصفات مقبض التثبيت والتعشيق (Handle)</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10.5px] font-mono text-zinc-400">
            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">عرض المقبض:</span>
              <span className="text-zinc-200 font-bold">{width} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">سمك المقبض الرئيسي:</span>
              <span className="text-zinc-200 font-bold">{height} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">عمق البروز (طول):</span>
              <span className="text-zinc-200 font-bold">{depth} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1">
              <span className="text-zinc-500 font-sans">عمق تداخل المعدن:</span>
              <span className="text-emerald-400 font-bold">{insertionDepth} مم</span>
            </div>

            <div className="flex justify-between border-b border-zinc-900/40 pb-1 col-span-2">
              <span className="text-zinc-500 font-sans">زوايا ميل التوجيه الفعلي:</span>
              <span className="text-amber-500 font-bold">
                X: {angleX}° / Y: {angleY}°
              </span>
            </div>

            <div className="col-span-2 text-[9px] text-zinc-500 leading-relaxed font-sans pt-1">
              ✓ تم تمرير كفاءة العزم والحساب ثنائي التثبيت للمشغل اليدوي باقتدار.
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (pDataIsUnique(data)) return renderUniqueDiagram();
  if (type === 'tube') return renderTubeDiagram();
  if (type === 'pan') return renderPanDiagram();
  if (type === 'handle') return renderHandleDiagram();

  return null;
};

// Simple visual checker helper
function pDataIsUnique(data: any): boolean {
  return !!(data && (data.isUnique || data.customStlName || data.customStlBuffer));
}
