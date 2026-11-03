import React, { useMemo } from 'react';
import { ZeroGapState, WizardStep } from '../../types';
import { CollisionAnalyzer } from '../../lib/analysis/CollisionAnalyzer';
import { NotificationService } from '../../lib/notificationService';
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Eye } from 'lucide-react';

interface CollisionAnalysisCardProps {
  config: ZeroGapState;
  wizardStep: WizardStep;
  onUpdate: (newConfig: ZeroGapState) => void;
  readOnly?: boolean;
}

export const CollisionAnalysisCard: React.FC<CollisionAnalysisCardProps> = ({
  config,
  wizardStep,
  onUpdate,
  readOnly = false,
}) => {
  const report = useMemo(
    () => CollisionAnalyzer.analyze(config, wizardStep),
    [config, wizardStep]
  );

  const isActive = !!config.showCollisionAnalysis;

  const handleToggleHighlight = () => {
    const nextState = !isActive;
    onUpdate({ ...config, showCollisionAnalysis: nextState });
    if (nextState) {
      NotificationService.info(
        report.hasGaps
          ? `تم تفعيل كاشف التداخل: تم تظليل مناطق الفجوات والتداخل باللون الأحمر (${report.issues.length} ملاحظات)`
          : 'تم تفعيل كاشف التداخل: التطابق الهندسي سليم ويُعرض حجم التعشيق الفعلي'
      );
    }
  };

  const handleAutoFix = () => {
    if (readOnly) return;
    const fixedConfig = CollisionAnalyzer.computeAutoFix({
      ...config,
      showCollisionAnalysis: true,
    });
    onUpdate(fixedConfig);
    NotificationService.success(
      'تم ضبط أبعاد ومواضع التعشيق تلقائياً لتحقيق تلامس صفري (Zero-Gap 100%)'
    );
  };

  // تحديد الوصلات المعروضة حسب المرحلة الحالية
  const showPanJoint =
    wizardStep === 'pan-tube-cut' ||
    wizardStep === 'technical-review' ||
    wizardStep === 'final-inspect';
  const showHandleJoint =
    wizardStep === 'tube-handle-cut' ||
    wizardStep === 'technical-review' ||
    wizardStep === 'final-inspect';

  return (
    <section
      className={`mb-5 rounded-xl border p-3.5 text-right transition-all font-sans ${
        report.hasGaps
          ? 'bg-red-950/20 border-red-500/35 shadow-[0_0_20px_rgba(239,68,68,0.12)]'
          : 'bg-emerald-950/15 border-emerald-500/25'
      }`}
      dir="rtl"
    >
      {/* الرأس وزر التفعيل الثلاثي الأبعاد */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {report.hasGaps ? (
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <span>محلل مناطق التداخل والفجوات</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-zinc-300">
                Collision & Gap
              </span>
            </div>
            <div className="text-[9.5px] text-zinc-400 mt-0.5">
              تظليل مناطق التداخل والفجوات باللون الأحمر في المشهد ثلاثي الأبعاد
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleHighlight}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
            isActive
              ? 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.45)]'
              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
          }`}
          title="تفعيل أو إيقاف التظليل الأحمر لمناطق التداخل والفجوات في العرض ثلاثي الأبعاد"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isActive ? 'التظليل الأحمر نشط' : 'إظهار التداخل 3D'}</span>
        </button>
      </div>

      {/* شريط المؤشر العام */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center font-mono">
        <div className="bg-black/40 border border-white/5 rounded-lg p-2">
          <div className="text-[8.5px] text-zinc-400 font-sans mb-0.5">كفاءة التطابق الصفري</div>
          <div
            className={`text-xs font-bold ${
              report.manufacturingReadinessScore >= 95
                ? 'text-emerald-400'
                : report.manufacturingReadinessScore >= 75
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {report.manufacturingReadinessScore}%
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-2">
          <div className="text-[8.5px] text-zinc-400 font-sans mb-0.5">أقصى فجوة مرصودة</div>
          <div
            className={`text-xs font-bold ${
              Math.max(report.panJoint.maxGapMm, report.handleJoint.maxGapMm) > 0.08
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {Math.max(report.panJoint.maxGapMm, report.handleJoint.maxGapMm).toFixed(2)} مم
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-2">
          <div className="text-[8.5px] text-zinc-400 font-sans mb-0.5">البدن الصافي الفاصل</div>
          <div
            className={`text-xs font-bold ${
              report.axialBridgeLengthMm > 10 ? 'text-zinc-200' : 'text-red-400'
            }`}
          >
            {report.axialBridgeLengthMm.toFixed(1)} مم
          </div>
        </div>
      </div>

      {/* تفاصيل الوصلات */}
      <div className="space-y-2 mb-3">
        {showPanJoint && (
          <div
            className={`p-2.5 rounded-lg border text-[10px] ${
              report.panJoint.maxGapMm > 0.08
                ? 'bg-red-950/30 border-red-500/30'
                : 'bg-black/35 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-zinc-200">{report.panJoint.labelAr}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                  report.panJoint.maxGapMm > 0.08
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {report.panJoint.maxGapMm > 0.08
                  ? `فجوة: ${report.panJoint.maxGapMm.toFixed(2)} مم`
                  : 'Zero-Gap 100%'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono text-zinc-400">
              <div>
                التلامس المحيطي:{' '}
                <span className="text-white font-bold">
                  {report.panJoint.contactCoveragePercent.toFixed(0)}%
                </span>
              </div>
              <div>
                حجم التداخل:{' '}
                <span className="text-white font-bold">
                  {report.panJoint.estimatedInterferenceVolumeMm3.toFixed(0)} مم³
                </span>
              </div>
            </div>
            {report.panJoint.gapSectors.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-red-500/20 text-[9px] text-red-300 space-y-0.5">
                {report.panJoint.gapSectors.slice(0, 2).map((sec, idx) => (
                  <div key={idx}>• {sec.description}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {showHandleJoint && (
          <div
            className={`p-2.5 rounded-lg border text-[10px] ${
              report.handleJoint.maxGapMm > 0.08
                ? 'bg-red-950/30 border-red-500/30'
                : 'bg-black/35 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-zinc-200">{report.handleJoint.labelAr}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                  report.handleJoint.maxGapMm > 0.08
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {report.handleJoint.maxGapMm > 0.08
                  ? `فجوة: ${report.handleJoint.maxGapMm.toFixed(2)} مم`
                  : 'Zero-Gap 100%'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono text-zinc-400">
              <div>
                التلامس المحيطي:{' '}
                <span className="text-white font-bold">
                  {report.handleJoint.contactCoveragePercent.toFixed(0)}%
                </span>
              </div>
              <div>
                حجم التداخل:{' '}
                <span className="text-white font-bold">
                  {report.handleJoint.estimatedInterferenceVolumeMm3.toFixed(0)} مم³
                </span>
              </div>
            </div>
            {report.handleJoint.gapSectors.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-red-500/20 text-[9px] text-red-300 space-y-0.5">
                {report.handleJoint.gapSectors.slice(0, 2).map((sec, idx) => (
                  <div key={idx}>• {sec.description}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* قائمة التنبيهات والفجوات المرصودة */}
      {report.issues.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {report.issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-2 rounded-lg border text-[9.5px] leading-relaxed flex items-start gap-1.5 ${
                issue.severity === 'critical'
                  ? 'bg-red-950/40 border-red-500/40 text-red-200'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{issue.title}</div>
                <div className="opacity-90">{issue.message}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/25 text-[9.5px] text-emerald-300 mb-2">
          ✓ لا توجد أي فجوات هوائية أو تداخلات خاطئة بين الأجزاء؛ الوصلات جاهزة للقطع واللحام الصفري.
        </div>
      )}

      {/* زر الإصلاح الذكي التلقائي في حال وجود فجوات */}
      {report.hasGaps && !readOnly && (
        <button
          type="button"
          onClick={handleAutoFix}
          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-[10.5px] flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>إصلاح الفجوات ومطابقة التعشيق الصفري تلقائياً (Auto-Fix)</span>
        </button>
      )}
    </section>
  );
};
