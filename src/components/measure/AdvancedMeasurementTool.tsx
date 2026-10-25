import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { AdvancedTubeGeometry, TubeFace } from '../../lib/geometry/AdvancedTubeGeometry';
import { SmartMeasurementSystem, Measurement, CameraPreset } from '../../lib/measurement/SmartMeasurementSystem';
import { Ruler, Camera, BarChart3, Download, Trash2, Eye, EyeOff } from 'lucide-react';

interface AdvancedMeasurementToolProps {
  tube: AdvancedTubeGeometry;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  onMeasurementsChange?: (measurements: Measurement[]) => void;
}

const AdvancedMeasurementTool: React.FC<AdvancedMeasurementToolProps> = ({
  tube,
  scene,
  camera,
  onMeasurementsChange
}) => {
  const [measurementSystem, setMeasurementSystem] = useState<SmartMeasurementSystem | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>([]);
  const [showWireframe, setShowWireframe] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<string | null>(null);

  useEffect(() => {
    const system = new SmartMeasurementSystem(tube, scene, camera);
    setMeasurementSystem(system);
    setCameraPresets(system.getCameraPresets());

    return () => {
      system.dispose();
    };
  }, [tube, scene, camera]);

  useEffect(() => {
    if (!measurementSystem) return;

    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Actively bind mouse clicks to raycast point selection
    const cleanup = measurementSystem.enablePointSelection(canvas, () => {
      syncMeasurements(measurementSystem);
    });

    return () => {
      cleanup();
    };
  }, [measurementSystem, measurementMode]);

  const handleSelectFace = (faceName: string) => {
    if (measurementSystem) {
      measurementSystem.selectFace(faceName);
      setSelectedFace(faceName);
    }
  };

  const handleDeselectFace = () => {
    if (measurementSystem) {
      measurementSystem.deselectFace();
      setSelectedFace(null);
    }
  };

  const syncMeasurements = (system: SmartMeasurementSystem) => {
    const list = system.getMeasurements();
    setMeasurements([...list]);
    if (onMeasurementsChange) {
      onMeasurementsChange([...list]);
    }
  };

  const handleMeasureDistance = () => {
    if (measurementSystem) {
      setMeasurementMode('distance');
      measurementSystem.setMeasurementMode('distance');
    }
  };

  const handleMeasureAngle = () => {
    if (measurementSystem) {
      setMeasurementMode('angle');
      measurementSystem.setMeasurementMode('angle');
    }
  };

  const handleMeasureArea = () => {
    setMeasurementMode('area');
    if (measurementSystem) {
      measurementSystem.selectFace(selectedFace || 'front');
      measurementSystem.measureFaceArea();
      syncMeasurements(measurementSystem);
    }
  };

  const handleMeasureVolume = () => {
    setMeasurementMode('volume');
    if (measurementSystem) {
      measurementSystem.measureVolume();
      syncMeasurements(measurementSystem);
    }
  };

  const handleMeasureWeight = () => {
    setMeasurementMode('weight');
    if (measurementSystem) {
      measurementSystem.measureWeight();
      syncMeasurements(measurementSystem);
    }
  };

  const handleMeasurePerimeter = () => {
    setMeasurementMode('perimeter');
    if (measurementSystem) {
      measurementSystem.selectFace(selectedFace || 'front');
      measurementSystem.measurePerimeter();
      syncMeasurements(measurementSystem);
    }
  };

  const handleSetCameraPreset = (presetName: string) => {
    if (measurementSystem) {
      measurementSystem.setCameraPreset(presetName);
    }
  };

  const handleToggleWireframe = () => {
    setShowWireframe(!showWireframe);
    tube.getWireframe().visible = !showWireframe;
  };

  const handleExportMeasurements = () => {
    if (measurementSystem) {
      const data = measurementSystem.saveMeasurements();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurements_${Date.now()}.json`;
      a.click();
    }
  };

  const handleClearMeasurements = () => {
    if (measurementSystem) {
      measurementSystem.clearMeasurementVisuals();
      setMeasurements([]);
      if (onMeasurementsChange) onMeasurementsChange([]);
    }
  };

  const faces = tube.getFaces();

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white font-sans" dir="rtl">
      {/* رأس الأداة */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-4 justify-start">
          <Ruler className="w-5 h-5 text-emerald-500" />
          <h2 className="text-sm font-bold">أداة القياس الذكية المتقدمة</h2>
        </div>

        {/* أزرار الكاميرا المسبقة */}
        <div className="flex gap-1.5 mb-4 flex-wrap justify-start">
          {cameraPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSetCameraPreset(preset.name)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center gap-1 transition-colors border border-zinc-700 cursor-pointer text-zinc-300"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {/* أزرار القياس */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleMeasureDistance}
            className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              measurementMode === 'distance'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300'
            }`}
          >
            📏 مسافة
          </button>
          <button
            onClick={handleMeasureAngle}
            className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              measurementMode === 'angle'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300'
            }`}
          >
            📐 زاوية
          </button>
          <button
            onClick={handleMeasureArea}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all cursor-pointer text-zinc-300"
          >
            📊 مساحة
          </button>
          <button
            onClick={handleMeasureVolume}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all cursor-pointer text-zinc-300"
          >
            📦 حجم
          </button>
          <button
            onClick={handleMeasureWeight}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all cursor-pointer text-zinc-300"
          >
            ⚖️ وزن
          </button>
          <button
            onClick={handleMeasurePerimeter}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded text-xs font-bold transition-all cursor-pointer text-zinc-300"
          >
            🔄 محيط
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden p-4">
        {/* قائمة الأوجه */}
        <div className="flex-1 bg-zinc-900 rounded-lg border border-zinc-800 overflow-y-auto max-h-[160px]">
          <div className="p-3 border-b border-zinc-800 sticky top-0 bg-zinc-900 flex justify-between items-center">
            <h3 className="font-bold text-xs text-zinc-400">الأوجه المتاحة للهيكل</h3>
          </div>

          <div className="p-2 space-y-1">
            {faces.map((face) => (
              <button
                key={face.name}
                onClick={() => handleSelectFace(face.name)}
                className={`w-full text-right px-3 py-2 rounded text-xs transition-all cursor-pointer flex flex-col gap-0.5 ${
                  selectedFace === face.name
                    ? 'bg-emerald-650 text-white'
                    : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-transparent hover:border-zinc-700'
                }`}
              >
                <div className="font-bold">{face.name}</div>
                <div className="text-[10px] text-zinc-400">
                  المساحة: {face.area.toFixed(1)} مم² | النوع: {face.type === 'planar' ? 'مستوي' : 'منحني'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* قائمة القياسات */}
        <div className="flex-2 bg-zinc-900 rounded-lg border border-zinc-800 overflow-y-auto flex flex-col">
          <div className="p-3 border-b border-zinc-800 sticky top-0 bg-zinc-900 flex items-center justify-between">
            <h3 className="font-bold text-xs flex items-center gap-1.5 text-zinc-400">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              القياسات المسجلة
            </h3>
            <div className="flex gap-1.5">
              <button
                onClick={handleToggleWireframe}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-all cursor-pointer border border-zinc-700"
                title="عرض/إخفاء الهيكل السلكي"
              >
                {showWireframe ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                onClick={handleExportMeasurements}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded transition-all cursor-pointer border border-zinc-700"
                title="تصدير القياسات"
              >
                <Download size={13} />
              </button>
              <button
                onClick={handleClearMeasurements}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded transition-all cursor-pointer border border-zinc-700"
                title="مسح القياسات"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2 flex-1">
            {measurements.length === 0 ? (
              <div className="text-center text-zinc-500 py-6 text-xs leading-relaxed">
                <p>لا توجد قياسات مسجلة حالياً.</p>
                <p className="text-[10px] mt-1 text-zinc-600">اختر وجهاً هندسياً واضغط على ميزة قياس لتوليد النتائج.</p>
              </div>
            ) : (
              measurements.map((measurement, index) => (
                <div
                  key={index}
                  className="bg-zinc-800/40 p-2.5 rounded border border-zinc-800 hover:border-emerald-500/40 transition-all font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-400">{measurement.label}</span>
                    <span className="text-[9px] text-zinc-500">
                      {measurement.timestamp.toLocaleTimeString('ar-SA')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-400">
                    <div>النوع: <span className="text-zinc-200">{measurement.type}</span></div>
                    <div>القيمة: <span className="text-zinc-200">{measurement.value.toFixed(2)}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* شريط الحالة */}
      <div className="bg-zinc-900 border-t border-zinc-850 p-2 text-[10px] text-zinc-500 flex justify-between font-mono">
        <span>الوجه المحدد: {selectedFace || 'لا يوجد'}</span>
        <span>القياسات: {measurements.length}</span>
      </div>
    </div>
  );
};

export default AdvancedMeasurementTool;
