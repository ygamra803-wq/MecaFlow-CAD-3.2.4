import React, { useState, useEffect } from 'react';
import { AdvancedTubeGeometry } from '../../lib/geometry/AdvancedTubeGeometry';
import { PhysicalAnalyzer, MATERIALS_DATABASE } from '../../lib/analysis/PhysicalAnalyzer';
import { 
  BarChart3, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  Download,
  Zap,
  Weight,
  Gauge,
  Activity
} from 'lucide-react';

interface PhysicalAnalysisPanelProps {
  tube: AdvancedTubeGeometry;
}

const PhysicalAnalysisPanel: React.FC<PhysicalAnalysisPanelProps> = ({ tube }) => {
  const [analyzer, setAnalyzer] = useState<PhysicalAnalyzer | null>(null);
  const [report, setReport] = useState<any>(null);
  const [force, setForce] = useState(100);
  const [frequency, setFrequency] = useState(10);
  const [amplitude, setAmplitude] = useState(1);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('steel');

  useEffect(() => {
    const newAnalyzer = new PhysicalAnalyzer(tube);
    newAnalyzer.setMaterial(selectedMaterial);
    setAnalyzer(newAnalyzer);
    setReport(newAnalyzer.generateComprehensiveReport());
  }, [tube, selectedMaterial]);

  const handleMaterialChange = (matKey: string) => {
    setSelectedMaterial(matKey);
    if (analyzer) {
      analyzer.setMaterial(matKey);
      setReport(analyzer.generateComprehensiveReport());
      setAnalysisResult(null); // مسح النتيجة السابقة لتحديثها استجابة للمادة الجديدة
    }
  };

  const handleAnalyzePressure = () => {
    if (!analyzer) return;
    const res = analyzer.calculateSurfacePressure(force);
    setAnalysisResult(`مستوى الضغط المحسوب: ${res.pressure.toFixed(4)} Pascal. التحليل: ${res.analysis}`);
  };

  const handleAnalyzeStress = () => {
    if (!analyzer) return;
    const res = analyzer.calculateStress(force);
    setAnalysisResult(`قيمة الإجهاد: ${res.stress.toFixed(4)} MPa. عامل الأمان: ${res.safetyFactor.toFixed(2)}. الحالة: ${res.isSafe ? '✅ آمن ومستقر' : '❌ غير آمن تحت الإجهاد المرن'}`);
  };

  const handleAnalyzeVibration = () => {
    if (!analyzer) return;
    const res = analyzer.analyzeVibrations(frequency, amplitude);
    setAnalysisResult(`تردد الآلة المقدر: ${res.frequency} Hz, التردد الطبيعي: ${res.naturalFrequency.toFixed(1)} Hz. الاستجابة: ${res.analysis}`);
  };

  const handleExportReport = () => {
    if (!analyzer) return;
    const reportText = analyzer.exportReport();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `physical_analysis_${Date.now()}.txt`;
    a.click();
  };

  if (!report) {
    return <div className="text-center py-6 text-zinc-500 font-mono text-xs">جاري تحميل تقرير التحليل...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white font-sans overflow-y-auto" dir="rtl">
      {/* الرأس */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-4 justify-start">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          <h2 className="text-sm font-bold">تحليل الخصائص الفيزيائية والهيكلية</h2>
        </div>

        {/* أزرار التحليل */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAnalyzePressure}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-zinc-350"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>تحليل الضغط</span>
          </button>
          <button
            onClick={handleAnalyzeStress}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-zinc-350"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>تحليل الإجهاد</span>
          </button>
          <button
            onClick={handleAnalyzeVibration}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-zinc-350"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>تخميد الاهتزازات</span>
          </button>
          <button
            onClick={handleExportReport}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير تقرير</span>
          </button>
        </div>

        {/* مادة الصنع المستهدفة */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-2">
          <label className="text-[11px] font-bold text-zinc-400 block text-right">مادة الصنع المستهدفة للأنبوب</label>
          <select
            value={selectedMaterial}
            onChange={(e) => handleMaterialChange(e.target.value)}
            className="w-full text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white rounded p-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {Object.entries(MATERIALS_DATABASE).map(([key, info]) => (
              <option key={key} value={key} className="bg-zinc-900 text-zinc-200">
                {info.nameAr}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-zinc-500 text-right leading-relaxed font-medium">
            {MATERIALS_DATABASE[selectedMaterial]?.status}
          </div>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 p-4 space-y-4">
        {analysisResult && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-200 leading-relaxed font-mono">
            {analysisResult}
          </div>
        )}

        {/* الخصائص الأساسية */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="font-bold text-xs mb-3 flex items-center gap-2 text-zinc-400">
            <Weight className="w-4 h-4 text-emerald-500" />
            الخصائص البنيوية والفيزيائية
          </h3>

          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-400 mb-1">الوزن التقديري</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {report.basicProperties.weight.toFixed(3)} كجم
              </div>
            </div>

            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-400 mb-1">الحجم الفعلي للهيكل</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {(report.basicProperties.volume / 1000).toFixed(2)} سم³
              </div>
            </div>

            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800 col-span-2">
              <div className="text-[10px] text-zinc-400 mb-1">المساحة السطحية المعرضة</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {report.basicProperties.surfaceArea.toFixed(1)} مم²
              </div>
            </div>
          </div>
        </div>

        {/* الخصائص الديناميكية */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="font-bold text-xs mb-3 flex items-center gap-2 text-zinc-400">
            <Zap className="w-4 h-4 text-blue-500" />
            مكافئ العزوم والترددات الطبيعية
          </h3>

          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-400 mb-1">التردد الطبيعي العابر</div>
              <div className="text-sm font-mono font-bold text-blue-400">
                {report.dynamicProperties.naturalFrequency.toFixed(1)} Hz
              </div>
            </div>

            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
              <div className="text-[10px] text-zinc-400 mb-1">الدورية النبضية (T)</div>
              <div className="text-sm font-mono font-bold text-blue-400">
                {report.dynamicProperties.period.toFixed(4)} ثانية
              </div>
            </div>
          </div>
        </div>

        {/* تحليل التوازن */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="font-bold text-xs mb-3 flex items-center gap-2 text-zinc-400">
            {report.balanceAnalysis.isBalanced ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
            تقييم مركز الثقل والتوازن الجانبي
          </h3>

          <div className="space-y-2 text-right text-xs">
            <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800 flex justify-between items-center font-mono">
              <span className="text-zinc-400">الانحراف عن المركز الهندسي:</span>
              <span className="text-xs font-bold text-yellow-400">
                {report.balanceAnalysis.imbalance.toFixed(2)} مم
              </span>
            </div>

            <div className={`p-2 rounded text-xs ${
              report.balanceAnalysis.isBalanced
                ? 'bg-green-950/20 border border-green-500/20 text-green-300'
                : 'bg-red-950/20 border border-red-500/20 text-red-350'
            }`}>
              {report.balanceAnalysis.isBalanced
                ? '✅ جسم متماثل ومستقر ميكانيكياً'
                : '⚠️ هناك انحراف طفيف في مركز الكتلة'}
            </div>
          </div>
        </div>

        {/* أدوات المحاكاة الافتراضية */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 space-y-3">
          <h3 className="font-bold text-xs pb-1 border-b border-zinc-800 text-zinc-400">منظومة القوى والاهتزاز الافتراضية</h3>

          {/* القوة */}
          <div className="space-y-1 text-right">
            <label className="text-[10px] text-zinc-400">القوة المحورية المركزة (Newton)</label>
            <input
              type="range"
              min="0"
              max="2000"
              value={force}
              onChange={(e) => setForce(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="text-xs font-mono text-emerald-400 font-bold">{force} نـيـوتـن</div>
          </div>

          {/* التردد */}
          <div className="space-y-1 text-right">
            <label className="text-[10px] text-zinc-400">تردد الآلة الخارجي (Hz)</label>
            <input
              type="range"
              min="0"
              max="200"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-xs font-mono text-blue-400 font-bold">{frequency} هرتز</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalAnalysisPanel;
