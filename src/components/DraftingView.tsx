import React, { useMemo, useRef } from 'react';
import { ZeroGapState } from '../types';
import { GCodeGenerator } from '../lib/gcodeGenerator';
import { generateProfessionalFileName } from '../lib/fileNameGenerator';
import { NotificationService } from '../lib/notificationService';

interface DraftingViewProps {
  config: ZeroGapState;
}

const DraftingView: React.FC<DraftingViewProps> = ({ config }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const gcodeData = useMemo(() => {
    return GCodeGenerator.generateGCode(config, 'final-inspect');
  }, [config]);

  const metrics = gcodeData.metrics;
  const tw = config.tube.width;
  const th = config.tube.shape === 'دائري' ? tw : (config.tube.height || tw);
  const tl = metrics.effectiveTubeLengthMm || GCodeGenerator.getEffectiveTubeLength(config, 'final-inspect');

  // بناء مسار SVG للمخطط المفرد للقص الدوراني (Unrolled Rotary Pattern A: 0..360 vs X: 0..tl)
  const unrolledPaths = useMemo(() => {
    const plotW = 460;
    const plotH = 170;
    const padX = 45;
    const padY = 24;

    const mapX = (xMm: number) => padX + (Math.max(0, Math.min(tl, xMm)) / Math.max(1, tl)) * plotW;
    const mapY = (aDeg: number) => padY + (Math.max(0, Math.min(360, aDeg)) / 360) * plotH;

    const panPts = metrics.panCutPoints;
    const handlePts = metrics.handleCutPoints;

    const panPath =
      panPts.length > 0
        ? panPts
            .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(pt.x).toFixed(2)} ${mapY(pt.a).toFixed(2)}`)
            .join(' ')
        : '';

    const handlePath =
      handlePts.length > 0
        ? handlePts
            .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(pt.x).toFixed(2)} ${mapY(pt.a).toFixed(2)}`)
            .join(' ')
        : '';

    // منطقة البدن الصافي المحصورة بين القص الأمامي والخلفي
    let bodyPolygon = '';
    if (panPts.length > 1 && handlePts.length > 1) {
      const forward = panPts.map(pt => `${mapX(pt.x).toFixed(2)},${mapY(pt.a).toFixed(2)}`);
      const backward = [...handlePts]
        .reverse()
        .map(pt => `${mapX(pt.x).toFixed(2)},${mapY(pt.a).toFixed(2)}`);
      bodyPolygon = [...forward, ...backward].join(' ');
    }

    return { panPath, handlePath, bodyPolygon, plotW, plotH, padX, padY };
  }, [metrics, tl]);

  // تصدير المخطط الهندسي كملف SVG قياسي قابل للفتح في AutoCAD / Illustrator / Inkscape / المتصفح
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgRef.current);
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
      const blob = new Blob([xmlHeader + source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = generateProfessionalFileName(config, 'step').replace(/\.(step|stp)$/i, '');
      a.download = `${baseName}_ISO_A3_Blueprint.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      NotificationService.success('تم تصدير المخطط الهندسي بصيغة SVG القياسية بنجاح');
    } catch (err) {
      NotificationService.error('فشل تصدير المخطط: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handlePrintBlueprint = () => {
    window.print();
  };

  return (
    <div className="w-full h-full p-4 sm:p-6 flex flex-col items-center overflow-y-auto custom-scrollbar" id="drafting-view">
      <div className="w-full max-w-6xl bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col p-6 shadow-2xl">
        {/* ترويسة المخطط الهندسي */}
        <div className="w-full p-4 border border-zinc-800 bg-zinc-950 text-emerald-500 rounded-lg mb-6 flex flex-wrap justify-between items-center gap-4">
          <div className="text-left">
            <h4 className="font-bold text-xs uppercase tracking-widest text-emerald-400">
              ISO 128 / ISO 7200 — ZERO-GAP MANUFACTURING BLUEPRINT (A3)
            </h4>
            <span className="text-[10.5px] text-zinc-400">
              المخطط الهندسي التنفيذي ومسقط إفراد مسار الليزر الدوراني (Unrolled 5-Axis Laser Development)
            </span>
          </div>
          <div className="flex items-center gap-4 text-right font-mono text-[10px]">
            <div>
              <p className="text-zinc-500">TOLERANCE STANDARD</p>
              <p className="text-zinc-200 font-bold">ISO 2768-mK (±0.05 mm)</p>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <p className="text-zinc-500">DATE / REV</p>
              <p className="text-zinc-200 font-bold">{new Date().toISOString().split('T')[0]} / REV 2.3</p>
            </div>
          </div>
        </div>

        {/* اللوحة الهندسية المتجهية الحقيقية (SVG Vector Sheet) */}
        <div className="w-full bg-[#090d16] border border-zinc-800 rounded-lg p-3 mb-6 overflow-x-auto">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 580"
            className="w-full h-auto min-w-[780px] font-mono select-none"
            style={{ backgroundColor: '#090d16' }}
          >
            <defs>
              <pattern id="isoGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
              </pattern>
              <pattern id="isoGridMajor" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#isoGrid)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="1" />
              </pattern>
            </defs>

            {/* خلفية الشبكة الهندسية وإطار ISO A3 */}
            <rect x="10" y="10" width="980" height="560" fill="url(#isoGridMajor)" stroke="#10b981" strokeWidth="2" />
            <rect x="18" y="18" width="964" height="544" fill="none" stroke="#334155" strokeWidth="1" />

            {/* =================================================================
                المسقط 1 (أعلى اليسار): المقطع العرضي للأنبوب وسماكة الجدار (Scale 2:1)
               ================================================================= */}
            <g transform="translate(30, 30)">
              <rect x="0" y="0" width="360" height="235" fill="#090d16" fillOpacity="0.88" stroke="#334155" strokeWidth="1" />
              <text x="12" y="20" fill="#10b981" fontSize="11" fontWeight="bold">
                SECTION A-A: TUBE CROSS-SECTION PROFILE
              </text>
              <text x="12" y="34" fill="#94a3b8" fontSize="9">
                المقطع العرضي للأنبوب ({config.tube.shape}) — السماكة: {config.tube.thickness} مم
              </text>

              {/* محاور التناظر */}
              <line x1="60" y1="130" x2="300" y2="130" stroke="#475569" strokeWidth="0.8" strokeDasharray="6,3,2,3" />
              <line x1="180" y1="50" x2="180" y2="210" stroke="#475569" strokeWidth="0.8" strokeDasharray="6,3,2,3" />

              {(() => {
                const scale = Math.min(160 / Math.max(tw, 1), 110 / Math.max(th, 1));
                const dispW = tw * scale;
                const dispH = th * scale;
                const dispT = Math.max(2, config.tube.thickness * scale);
                const dispR =
                  config.tube.shape === 'دائري'
                    ? dispW / 2
                    : Math.min((config.tube.cornerRadius || 0) * scale, dispW / 2, dispH / 2);

                if (config.tube.shape === 'دائري' || config.tube.shape === 'بيضاوي') {
                  return (
                    <g transform="translate(180, 130)">
                      <ellipse
                        cx="0"
                        cy="0"
                        rx={dispW / 2}
                        ry={dispH / 2}
                        fill="#10b981"
                        fillOpacity="0.12"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                      <ellipse
                        cx="0"
                        cy="0"
                        rx={Math.max(2, dispW / 2 - dispT)}
                        ry={Math.max(2, dispH / 2 - dispT)}
                        fill="#090d16"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="3,2"
                      />
                    </g>
                  );
                }

                return (
                  <g transform="translate(180, 130)">
                    <rect
                      x={-dispW / 2}
                      y={-dispH / 2}
                      width={dispW}
                      height={dispH}
                      rx={dispR}
                      ry={dispR}
                      fill="#10b981"
                      fillOpacity="0.12"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    <rect
                      x={-(dispW / 2 - dispT)}
                      y={-(dispH / 2 - dispT)}
                      width={Math.max(4, dispW - 2 * dispT)}
                      height={Math.max(4, dispH - 2 * dispT)}
                      rx={Math.max(0, dispR - dispT)}
                      ry={Math.max(0, dispR - dispT)}
                      fill="#090d16"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })()}

              {/* خطوط الأبعاد للمقطع العرضي */}
              <text x="180" y="205" fill="#e2e8f0" fontSize="10" textAnchor="middle">
                W = {tw.toFixed(1)} mm | H = {th.toFixed(1)} mm | t = {config.tube.thickness.toFixed(2)} mm
              </text>
              {config.tube.shape === 'مستطيل' && (
                <text x="180" y="220" fill="#38bdf8" fontSize="9.5" textAnchor="middle">
                  Corner Radius R = {config.tube.cornerRadius.toFixed(2)} mm
                </text>
              )}
            </g>

            {/* =================================================================
                المسقط 2 (أعلى اليمين): مسقط إفراد مسار الليزر الدوراني (Unrolled 2D Wrap)
               ================================================================= */}
            <g transform="translate(405, 30)">
              <rect x="0" y="0" width="560" height="235" fill="#090d16" fillOpacity="0.88" stroke="#334155" strokeWidth="1" />
              <text x="14" y="20" fill="#10b981" fontSize="11" fontWeight="bold">
                ROTARY LASER UNROLLED DEVELOPMENT (A: 0° → 360° vs X: 0 → {tl.toFixed(1)} mm)
              </text>
              <text x="546" y="20" fill="#f59e0b" fontSize="9.5" textAnchor="end">
                KERF COMPENSATED (±{metrics.kerfOffsetMm.toFixed(2)} mm)
              </text>

              <g transform="translate(15, 28)">
                {/* إطار منطقة الإفراد */}
                <rect
                  x={unrolledPaths.padX}
                  y={unrolledPaths.padY}
                  width={unrolledPaths.plotW}
                  height={unrolledPaths.plotH}
                  fill="#0f172a"
                  stroke="#475569"
                  strokeWidth="1"
                />

                {/* خطوط تقسيم زوايا الدوران A (0, 90, 180, 270, 360) */}
                {[0, 90, 180, 270, 360].map(deg => {
                  const yPos = unrolledPaths.padY + (deg / 360) * unrolledPaths.plotH;
                  return (
                    <g key={deg}>
                      <line
                        x1={unrolledPaths.padX}
                        y1={yPos}
                        x2={unrolledPaths.padX + unrolledPaths.plotW}
                        y2={yPos}
                        stroke="#1e293b"
                        strokeWidth="0.8"
                        strokeDasharray="3,3"
                      />
                      <text x={unrolledPaths.padX - 6} y={yPos + 3} fill="#94a3b8" fontSize="8.5" textAnchor="end">
                        {deg}°
                      </text>
                    </g>
                  );
                })}

                {/* تضليل منطقة البدن الصافي للقطعة */}
                {unrolledPaths.bodyPolygon && (
                  <polygon
                    points={unrolledPaths.bodyPolygon}
                    fill="#10b981"
                    fillOpacity="0.14"
                  />
                )}

                {/* منحنى قص المقلاة عند الطرف A */}
                {unrolledPaths.panPath && (
                  <path
                    d={unrolledPaths.panPath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.2"
                  />
                )}

                {/* منحنى قص المقبض عند الطرف B */}
                {unrolledPaths.handlePath && (
                  <path
                    d={unrolledPaths.handlePath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.2"
                  />
                )}

                {/* علامة الليزر المرجعية إذا كانت مفعلة */}
                {config.markOrientation && (
                  <g
                    transform={`translate(${unrolledPaths.padX + 0.5 * unrolledPaths.plotW}, ${
                      unrolledPaths.padY + (90 / 360) * unrolledPaths.plotH
                    })`}
                  >
                    <circle cx="0" cy="0" r="4" fill="none" stroke="#f43f5e" strokeWidth="1.5" />
                    <line x1="-6" y1="0" x2="6" y2="0" stroke="#f43f5e" strokeWidth="1" />
                    <line x1="0" y1="-6" x2="0" y2="6" stroke="#f43f5e" strokeWidth="1" />
                    <text x="8" y="-4" fill="#f43f5e" fontSize="8">
                      LASER MARK (A=90°)
                    </text>
                  </g>
                )}

                {/* تسميات المحور الطولي X */}
                <text x={unrolledPaths.padX} y={unrolledPaths.padY + unrolledPaths.plotH + 13} fill="#38bdf8" fontSize="8.5">
                  X=0 (END A: PAN CUT)
                </text>
                <text
                  x={unrolledPaths.padX + unrolledPaths.plotW / 2}
                  y={unrolledPaths.padY + unrolledPaths.plotH + 13}
                  fill="#10b981"
                  fontSize="8.5"
                  textAnchor="middle"
                >
                  NET BODY = {config.tube.partLength.toFixed(1)} mm
                </text>
                <text
                  x={unrolledPaths.padX + unrolledPaths.plotW}
                  y={unrolledPaths.padY + unrolledPaths.plotH + 13}
                  fill="#f59e0b"
                  fontSize="8.5"
                  textAnchor="end"
                >
                  X={tl.toFixed(1)} mm (END B: HANDLE)
                </text>
              </g>
            </g>

            {/* =================================================================
                المسقط 3 (أسفل اليسار): المسقط الجانبي للتجميع (Pan + Tilted Tube + Handle)
               ================================================================= */}
            <g transform="translate(30, 280)">
              <rect x="0" y="0" width="530" height="270" fill="#090d16" fillOpacity="0.88" stroke="#334155" strokeWidth="1" />
              <text x="14" y="22" fill="#10b981" fontSize="11" fontWeight="bold">
                SIDE ASSEMBLY ORTHOGRAPHIC PROJECTION (PAN + TUBE + HANDLE)
              </text>
              <text x="14" y="36" fill="#94a3b8" fontSize="9">
                زاوية ميلان الأنبوب: {config.assembly.tiltAngle}° | عمق التداخل الأمامي: {config.assembly.insertionDistance} مم | إزاحة الارتفاع: {config.assembly.heightOffset} مم
              </text>

              {/* رسم تخطيطي قياسي للمقلاة والأنبوب المائل والمقبض */}
              <g transform="translate(175, 165)">
                {/* محور دوران المقلاة */}
                <line x1="-90" y1="-95" x2="-90" y2="55" stroke="#475569" strokeWidth="0.9" strokeDasharray="6,3,2,3" />
                {/* مقطع المقلاة المخروطي/المنحني */}
                <path
                  d="M -140,35 L -40,35 Q -20,-10 -5,-55 L -175,-55 Q -160,-10 -140,35 Z"
                  fill="#38bdf8"
                  fillOpacity="0.12"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <text x="-90" y="52" fill="#38bdf8" fontSize="9" textAnchor="middle">
                  PAN Ø{config.pan.bottomDiameter} / Ø{config.pan.topDiameter} mm (H={config.pan.height}mm)
                </text>

                {/* الأنبوب المائل بزاوية tiltAngle */}
                <g transform={`translate(-22, -12) rotate(${-Math.min(35, Math.max(-35, config.assembly.tiltAngle || 0))})`}>
                  <rect
                    x="0"
                    y="-16"
                    width="220"
                    height="32"
                    fill="#10b981"
                    fillOpacity="0.18"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <line x1="-15" y1="0" x2="275" y2="0" stroke="#10b981" strokeWidth="0.8" strokeDasharray="8,3,2,3" />
                  <text x="110" y="-22" fill="#10b981" fontSize="9.5" textAnchor="middle" fontWeight="bold">
                    TUBE L={tl.toFixed(1)}mm (Tilt {config.assembly.tiltAngle}°)
                  </text>

                  {/* المقبض المتصل بالطرف الخلفي B */}
                  <rect
                    x="202"
                    y="-12"
                    width="75"
                    height="24"
                    fill="#f59e0b"
                    fillOpacity="0.15"
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                  />
                  <text x="240" y="26" fill="#f59e0b" fontSize="8.5" textAnchor="middle">
                    HANDLE ({config.handle.width}×{config.handle.height}mm)
                  </text>
                </g>
              </g>
            </g>

            {/* =================================================================
                المسقط 4 (أسفل اليمين): جدول المواصفات القياسي ISO 7200 Title Block
               ================================================================= */}
            <g transform="translate(575, 280)">
              <rect x="0" y="0" width="390" height="270" fill="#090d16" fillOpacity="0.95" stroke="#10b981" strokeWidth="1.5" />
              <line x1="0" y1="36" x2="390" y2="36" stroke="#10b981" strokeWidth="1.2" />
              <text x="14" y="23" fill="#10b981" fontSize="11.5" fontWeight="bold">
                ISO 7200 MANUFACTURING TITLE BLOCK
              </text>

              {[
                ['PART DESIGNATION', `ZERO-GAP TUBE ${tw}x${th}x${config.tube.thickness}mm`],
                ['RAW STOCK LENGTH', `${tl.toFixed(2)} mm (Net Body: ${config.tube.partLength.toFixed(1)} mm)`],
                ['PAN GEOMETRY (END A)', `Top Ø${config.pan.topDiameter} / Bot Ø${config.pan.bottomDiameter} / H ${config.pan.height}mm`],
                ['PAN WALL PROFILE', config.pan.wallProfile === 'curved' ? `Curved Bezier (R=${config.pan.curveRadius}mm)` : 'Conical Straight'],
                ['HANDLE GEOMETRY (END B)', `${config.handle.shape.toUpperCase()} ${config.handle.width}x${config.handle.height}x${config.handle.depth}mm`],
                ['ASSEMBLY ANGLES', `Tilt X: ${config.assembly.tiltAngle}° | Roll Z: ${config.assembly.handleAngleY || 0}°`],
                ['TOTAL LASER CUT PATH', `${metrics.totalCutLengthMm.toFixed(1)} mm (${metrics.pierceCount} Pierces)`],
                ['MAX 5-AXIS BEVEL ANGLE', `${metrics.maxBevelAngleDeg.toFixed(1)}° | Kerf: ±${metrics.kerfOffsetMm.toFixed(2)} mm`],
                ['THERMAL / FILLET / MARK', `Clearance: ${config.thermalClearance ? '+0.1mm' : 'OFF'} | Fillet: ${config.addFillet ? '0.2mm' : 'OFF'} | Mark: ${config.markOrientation ? 'ON' : 'OFF'}`],
              ].map(([label, val], idx) => {
                const y = 58 + idx * 23;
                return (
                  <g key={label}>
                    <line x1="0" y1={y + 6} x2="390" y2={y + 6} stroke="#1e293b" strokeWidth="1" />
                    <text x="12" y={y} fill="#64748b" fontSize="8.5" fontWeight="bold">
                      {label}:
                    </text>
                    <text x="378" y={y} fill="#e2e8f0" fontSize="9" textAnchor="end" fontWeight="bold">
                      {val}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* أزرار التصدير الفعلي للمخطط الهندسي */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={handleDownloadSVG}
            className="w-full py-3.5 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)]"
          >
            تنزيل المخطط الهندسي المتجهي (SVG Vector CAD)
          </button>
          <button
            type="button"
            onClick={handlePrintBlueprint}
            className="w-full py-3.5 bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            طباعة / حفظ المخطط القياسي (PDF ISO A3)
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftingView;
