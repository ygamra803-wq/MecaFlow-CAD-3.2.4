import React, { useState } from 'react';
import { AdvancedTubeGeometry } from '../../lib/geometry/AdvancedTubeGeometry';
import { Measurement } from '../../lib/measurement/SmartMeasurementSystem';
import { PhysicalAnalyzer } from '../../lib/analysis/PhysicalAnalyzer';
import { Download, Printer, Share2, TrendingUp } from 'lucide-react';

interface ComparisonAndReportsProps {
  tube: AdvancedTubeGeometry;
  measurements: Measurement[];
}

const ComparisonAndReports: React.FC<ComparisonAndReportsProps> = ({ tube, measurements }) => {
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'comparative'>('summary');
  const [analyzer] = useState(() => new PhysicalAnalyzer(tube));

  const measurementData = measurements.map((m, idx) => ({
    name: `قياس ${idx + 1}`,
    value: m.value,
    type: m.type
  }));

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportReport = () => {
    const reportText = analyzer.exportReport();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprehensive_report_${Date.now()}.txt`;
    a.click();
  };

  const handleShareReport = async () => {
    const reportText = analyzer.exportReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'تقرير القياس والتحليل البنيوي من ميكافلو CAD',
          text: reportText
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      // Fallback copy to clipboard
      navigator.clipboard.writeText(reportText);
      alert('تم نسخ محتوى التقرير بنجاح إلى الحافظة!');
    }
  };

  // Calculate scaling for self-rolled visual chart bars
  const maxValue = measurements.length > 0 ? Math.max(...measurements.map(m => m.value)) : 100;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white font-sans overflow-hidden" dir="rtl">
      {/* الرأس */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-bold">التقارير والمقارنات الرقمية</h2>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={handlePrintReport}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-all cursor-pointer border border-zinc-700"
              title="طباعة التقرير"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportReport}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all cursor-pointer"
              title="تصدير"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleShareReport}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-all cursor-pointer"
              title="مشاركة / نسخ"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* اختيار نوع التقرير */}
        <div className="flex gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-850">
          <button
            onClick={() => setReportType('summary')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              reportType === 'summary'
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            موجز
          </button>
          <button
            onClick={() => setReportType('detailed')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              reportType === 'detailed'
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            تفصيلي
          </button>
          <button
            onClick={() => setReportType('comparative')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              reportType === 'comparative'
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            مقارن
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reportType === 'summary' && (
          <div className="space-y-4 text-right">
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
              <h3 className="font-bold text-xs mb-3 text-zinc-400">📋 خلاصة المخرجات الهندسية</h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-zinc-800/40 pb-1.5">
                  <span className="text-zinc-400">إجمالي القياسات النشطة:</span>
                  <span className="text-emerald-400 font-bold">{measurements.length}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/40 pb-1.5">
                  <span className="text-zinc-400">تنوع الأنماط القياسية:</span>
                  <span className="text-emerald-400 font-bold">
                    {new Set(measurements.map(m => m.type)).size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">توقيت التحقق المالي الهيكلي:</span>
                  <span className="text-emerald-400 font-bold">
                    {new Date().toLocaleTimeString('ar-SA')}
                  </span>
                </div>
              </div>
            </div>

            {/* رسم بياني للقياسات سليم بدون مكتبة خارجية */}
            {measurementData.length > 0 ? (
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <h3 className="font-bold text-xs mb-3 text-zinc-400">📊 مقارنة قيم القياس المدخلة (ملم)</h3>
                <div className="space-y-3 pt-2">
                  {measurementData.map((data, idx) => {
                    const pct = Math.max(5, (data.value / maxValue) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-zinc-350">{data.name} ({data.type})</span>
                          <span className="text-emerald-400 font-bold">{data.value.toFixed(2)} مم</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-650 py-10 text-[11px]">
                أضف قياسات لعرض المنحنى البياني التحليلي لتوزيع قيم الأبعاد.
              </div>
            )}
          </div>
        )}

        {reportType === 'detailed' && (
          <div className="space-y-3 text-right">
            <h3 className="font-bold text-xs text-zinc-400 mb-2">📋 تفاصيل السجلات الهندسية والفيزيائية</h3>
            {measurements.length === 0 ? (
              <div className="text-center text-zinc-650 py-10 text-xs">
                لا توجد قياسات حالياً لعرضها بالتفصيل.
              </div>
            ) : (
              measurements.map((measurement, idx) => (
                <div key={idx} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center bg-zinc-800/20 p-1.5 rounded border border-zinc-800/40">
                    <span className="font-bold text-emerald-400">{measurement.label}</span>
                    <span className="text-[9px] text-zinc-500">
                      {measurement.timestamp.toLocaleTimeString('ar-SA')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                    <div>النوع: <span className="text-white">{measurement.type}</span></div>
                    <div>القيمة المحسوبة: <span className="text-white font-bold">{measurement.value.toFixed(3)}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {reportType === 'comparative' && (
          <div className="space-y-4 text-right leading-relaxed text-xs">
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 space-y-3">
              <h3 className="font-bold text-xs text-zinc-400">🔄 موازنة الفوارق البعدية</h3>

              {measurements.length >= 2 ? (
                <div className="space-y-2 text-right">
                  <p className="text-zinc-500 text-[10px]">
                    مقارنة القياس الأول بقيمة {measurements[0].value.toFixed(2)} ملم مع القياس الثاني بقيمة {measurements[1].value.toFixed(2)} ملم.
                  </p>
                  <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-800 font-mono">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-zinc-400">الفارق البعدي المطلق:</span>
                      <span className="text-yellow-400 font-bold">{Math.abs(measurements[0].value - measurements[1].value).toFixed(3)} مم</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">النسبة المئوية للفارق:</span>
                      <span className="text-yellow-400 font-bold">{((Math.abs(measurements[0].value - measurements[1].value) / (measurements[0].value + 1e-10)) * 100).toFixed(2)} %</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-650 py-10">
                  يتطلب وجود قياسين هندسيين نشطين على الأقل لتفعيل مقارنة الفروقات البعدية النسبية.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonAndReports;
