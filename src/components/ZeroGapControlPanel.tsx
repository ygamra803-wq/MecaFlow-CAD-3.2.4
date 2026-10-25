import React, { useState, useEffect } from 'react';
import { ZeroGapState, WizardStep, WIZARD_LABELS, CADState } from '../types';
import { generateCadQueryScript } from '../lib/exportUtils';
import { generateGcode } from '../lib/gcodeGenerator';
import { generateProfessionalFileName } from '../lib/fileNameGenerator';
import { useProfiles } from '../hooks/useProfiles';
import { SavedProfile } from '../lib/profileStorage';
import { ProfileDetails } from './ProfileDetails';
import { StorageBridge } from '../lib/storageBridge';
import { ParameterValidator } from '../lib/validators/parameterValidator';
import { CloudBackupService } from '../lib/cloudBackup';
import { Eye, FolderOpen, ArrowRight, Search, Sliders, ChevronLeft } from 'lucide-react';
import { TubeIcon, PanIcon, HandleIcon } from './DashboardView';
import { Steps123Controls } from './steps/Steps123Controls';
import { Steps45Controls } from './steps/Steps45Controls';
import { Steps67Controls } from './steps/Steps67Controls';

interface ControlPanelProps {
  config: ZeroGapState;
  targetDimensions?: {l: number, w: number, h: number} | null;
  onUpdate: (config: ZeroGapState) => void;
  onExport: () => void;
  onExportSTEP?: (extension: 'step' | 'stp') => void;
  exportManufacturingFile: (content: string | Uint8Array, extension: 'gcode' | 'stl' | 'py' | 'nc' | 'step' | 'stp', suggestedName?: string) => void;
  wizardStep: WizardStep;
  onNext: () => void;
  onPrev: () => void;
  onJump?: (target: WizardStep, returnTo: WizardStep) => void;
  onOpenCustomViewer?: (category: 'tube' | 'pan' | 'handle') => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  onOpenDrafting: () => void;
  onOpenCNC: () => void;
  onUndo: () => void;
  onRedo: () => void;
  loadedProfileNames?: { tube: string | null; pan: string | null; handle: string | null; };
  onSetLoadedProfileName?: (type: 'tube' | 'pan' | 'handle', name: string | null) => void;
  libraryPreview?: {
    active: boolean;
    profileId: string | null;
    isUnique: boolean;
    isEditing: boolean;
    type: 'tube' | 'pan' | 'handle' | null;
  };
  setLibraryPreview?: (state: any) => void;
  onReturnToLibrary?: () => void;
  previewBackupConfig?: any;
  setPreviewBackupConfig?: (v: any) => void;
  previewBackupName?: string | null;
  setPreviewBackupName?: (v: string | null) => void;
  onSaveModel?: () => void;
  isPreviousWorkMode?: boolean;
  onExitPreviousWorkMode?: () => void;
}

const PrecisionControl = ({
  label, val, onChange, min, max, step
}: {
  label: string, val: number, onChange: (v: number) => void, min: number, max: number, step: number
}) => {
  const handleUpdate = (newVal: number) => {
    let bounded = Math.max(min, Math.min(max, newVal));
    const decimals = step < 1 ? 1 : 0;
    onChange(parseFloat(bounded.toFixed(decimals)));
  };

  return (
    <div className="flex flex-col gap-2 mb-4 bg-white/5 p-2 rounded border border-[var(--border)]">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={() => handleUpdate(val - step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >-</button>
        <div className="flex-1 relative input-wrapper">
          <input
            type="number"
            min={min} max={max} step={step} value={val}
            onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
            className="w-full bg-black/40 border border-[var(--border)] rounded h-8 text-center text-[12px] font-mono text-white focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none"
          />
        </div>
        <button type="button"
          onClick={() => handleUpdate(val + step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >+</button>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
        className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
};

const ZeroGapControlPanel: React.FC<ControlPanelProps> = ({
  config, targetDimensions, onUpdate, onExport, onExportSTEP, exportManufacturingFile, wizardStep, onNext, onPrev, onJump, onOpenCustomViewer, canGoNext, canGoPrev,
  onOpenDrafting, onOpenCNC, onUndo, onRedo,
  loadedProfileNames, onSetLoadedProfileName,
  libraryPreview, setLibraryPreview, onReturnToLibrary,
  previewBackupConfig, setPreviewBackupConfig, previewBackupName, setPreviewBackupName,
  onSaveModel,
  isPreviousWorkMode,
  onExitPreviousWorkMode,
}) => {
  const { profiles, addProfile, updateProfile, deleteProfile, refreshProfiles } = useProfiles();
  const [viewingProfilesType, setViewingProfilesType] = useState<'tube' | 'pan' | 'handle' | null>(null);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');


  useEffect(() => {
    if (viewingProfilesType && !libraryPreview?.active) {
      setViewingProfilesType(null);
    }
  }, [libraryPreview?.active]);


  const handleExportProfiles = () => {
    try {
      const typeLabel = viewingProfilesType === 'tube' ? 'أنابيب' : viewingProfilesType === 'pan' ? 'مقالي' : 'مقابض';
      const fileContent = JSON.stringify(profiles.filter(p => p.type === viewingProfilesType), null, 2);
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mecaflow_profiles_${typeLabel}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('فشل تصدير النماذج: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
    }
  };

  const handleImportProfiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        const importedArray = Array.isArray(imported) ? imported : [imported];

        let addedCount = 0;
        importedArray.forEach((item: any) => {
          if (item && item.name && item.type && item.data) {
            // التحقق والترميم السليم للنماذج
            addProfile(
              item.name + ' (مستورد)',
              item.type,
              item.data
            );
            addedCount++;
          }
        });

        alert(`نجح استيراد ${addedCount} من النماذج الهندسية بسلام.`);
        if (refreshProfiles) refreshProfiles();
      } catch (err) {
        alert('فشل قراءة ملف النماذج، تأكد من صحة تنسيق JSON: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
      }
    };
    reader.readAsText(file);
  };

  const updatePan = <K extends keyof ZeroGapState['pan']>(key: K, val: ZeroGapState['pan'][K]) => {
    onUpdate({ ...config, pan: { ...config.pan, [key]: val } });
    const loadedName = loadedProfileNames ? loadedProfileNames.pan : null;
    if (loadedName && !loadedName.endsWith(' (معدل)') && onSetLoadedProfileName) {
      onSetLoadedProfileName('pan', `${loadedName} (معدل)`);
    }
  };
  const updateTube = <K extends keyof ZeroGapState['tube']>(key: K, val: ZeroGapState['tube'][K]) => {
    onUpdate({ ...config, tube: { ...config.tube, [key]: val } });
    const loadedName = loadedProfileNames ? loadedProfileNames.tube : null;
    if (loadedName && !loadedName.endsWith(' (معدل)') && onSetLoadedProfileName) {
      onSetLoadedProfileName('tube', `${loadedName} (معدل)`);
    }
  };
  const updateHandle = <K extends keyof ZeroGapState['handle']>(key: K, val: ZeroGapState['handle'][K]) => {
    onUpdate({ ...config, handle: { ...config.handle, [key]: val } });
    const loadedName = loadedProfileNames ? loadedProfileNames.handle : null;
    if (loadedName && !loadedName.endsWith(' (معدل)') && onSetLoadedProfileName) {
      onSetLoadedProfileName('handle', `${loadedName} (معدل)`);
    }
  };
  const updateAssembly = <K extends keyof ZeroGapState['assembly']>(key: K, val: ZeroGapState['assembly'][K]) => {
    onUpdate({ ...config, assembly: { ...config.assembly, [key]: val } });
  };

  const renderSlider = (
    label: string,
    val: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number = 1
  ) => <PrecisionControl label={label} val={val} onChange={onChange} min={min} max={max} step={step} />;

  // ── Toggle button helper ──────────────────────────────────────────────
  const renderToggle = (
    label: string,
    active: boolean,
    onClick: () => void,
    color: string = 'var(--accent)',
  ) => (
    <button type="button"
      onClick={onClick}
      className={`w-full py-2 mb-2 text-[10px] font-bold uppercase border rounded flex items-center justify-between px-3 transition-colors ${!active ? 'border-(--border) text-(--text-dim) hover:border-(--text-main)' : ''}`}
      style={active ? { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color: color, borderColor: color } : undefined}
    >
      <span>{label}</span>
      <div
        className={`w-3 h-3 rounded-full shrink-0 transition-colors ${!active ? 'bg-(--border)' : ''}`}
        style={active ? { backgroundColor: color } : undefined}
      />
    </button>
  );

  // ── Step label ────────────────────────────────────────────────────────
  const stepTitle = WIZARD_LABELS[wizardStep];

  const [savingProfileType, setSavingProfileType] = useState<'tube' | 'pan' | 'handle' | null>(null);
  const [newProfileName, setNewProfileName] = useState('');

  const handleSaveProfile = (type: 'tube' | 'pan' | 'handle') => {
    setSavingProfileType(type);
    let defaultName = '';
    const loadedName = loadedProfileNames ? loadedProfileNames[type] : null;
    if (loadedName) {
      if (loadedName.endsWith(' (معدل)')) {
        defaultName = loadedName;
      } else {
        defaultName = `${loadedName} (معدل)`;
      }
    }
    setNewProfileName(defaultName);
  };

  if (viewingProfilesType) {
    const typeLabel = viewingProfilesType === 'tube' ? 'أنابيب' : viewingProfilesType === 'pan' ? 'مقالي' : 'مقابض';
    const typeColor = viewingProfilesType === 'tube' ? 'text-zinc-400' : viewingProfilesType === 'pan' ? 'text-blue-400' : 'text-amber-400';
    const bgAccentLight = viewingProfilesType === 'tube' ? 'bg-zinc-500/10' : viewingProfilesType === 'pan' ? 'bg-blue-500/10' : 'bg-amber-500/10';
    const borderAccentColor = viewingProfilesType === 'tube' ? 'border-zinc-500/30' : viewingProfilesType === 'pan' ? 'border-blue-500/30' : 'border-amber-500/30';
    const activeTextClass = viewingProfilesType === 'tube' ? 'text-zinc-350 bg-zinc-950/40 border-zinc-800' : viewingProfilesType === 'pan' ? 'text-blue-400 bg-blue-950/20 border-blue-900/30' : 'text-amber-400 bg-amber-950/20 border-amber-900/30';
    
    const TypeIcon = viewingProfilesType === 'tube' ? TubeIcon : viewingProfilesType === 'pan' ? PanIcon : HandleIcon;
    const rawFiltered = profiles.filter(p => p.type === viewingProfilesType);
    const filteredProfiles = rawFiltered.filter(p => {
      if (!profileSearchQuery.trim()) return true;
      const term = profileSearchQuery.toLowerCase();
      return p.name.toLowerCase().includes(term);
    });

    return (
      <aside className="w-full h-full flex flex-col relative bg-[#09090b]" id="zero-gap-panel">
        {/* البار العلوي للمكتبة تماشياً مع الـ Sidebar الأصلي الأنيق */}
        <div className="p-4 border-b border-[#27272a]/50 flex flex-col bg-gradient-to-b from-[#0c0d10] to-transparent" dir="rtl">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`p-1.5 rounded-lg ${bgAccentLight} border ${borderAccentColor}`}>
              <TypeIcon className={`${typeColor} w-4 h-4`} />
            </div>
            <div className="mr-1 text-right">
              <span className={`text-[12px] font-extrabold ${typeColor} uppercase tracking-wider block`}>
                مستودع عينات: {typeLabel}
              </span>
              <p className="text-[9px] text-zinc-500 font-mono mt-0.5 mt-[-1px]">
                / library / {viewingProfilesType}_models
              </p>
            </div>
          </div>
        </div>

        {/* شريض البحث المطور ليتوافق مع أسلوب عناصر الإعدادات الراقية */}
        <div className="px-4 py-3 border-b border-[#27272a]/20 bg-[#0c0d10]/50" dir="rtl">
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم النموذج أو القياسات الهندسية..."
              value={profileSearchQuery}
              onChange={(e) => setProfileSearchQuery(e.target.value)}
              className="w-full bg-[#0d0d10] border border-[#27272a] focus:border-[var(--accent)] hover:border-zinc-700 outline-none rounded-xl pl-9 pr-8 py-2 text-zinc-200 text-[11px] font-sans transition-all duration-250 placeholder-zinc-650 shadow-inner text-right"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <Search size={13} className="opacity-70" />
            </div>
            {profileSearchQuery && (
              <button
                onClick={() => setProfileSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-350 hover:text-white rounded-full text-[9px] transition-colors"
                title="تصفية البحث"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* عرض قائمة الكروت الهندسية المصممة بأسلوب بانتو ورموز دقيقة */}
        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-[#050507]">
          {rawFiltered.length === 0 ? (
            <div className="text-center text-zinc-500 text-[11px] py-16 flex flex-col items-center justify-center gap-3" dir="rtl">
              <Sliders size={20} className="text-zinc-700 animate-pulse" />
              <p className="max-w-[190px] leading-relaxed">
                لا توجد نماذج مسبقة محفوظة في هذه الفئة حالياً. يمكنك تدوين وحفظ تهيئتك الحالية لحفظها الفوري.
              </p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center text-zinc-500 text-[11px] py-16 flex flex-col items-center justify-center gap-2" dir="rtl">
              <span className="text-lg">🔍</span>
              <p className="max-w-[200px] leading-relaxed">
                لم نجد أي نموذج هندسي مطابق لنطاق البحث "{profileSearchQuery}"
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filteredProfiles.map(p => {
                const isSelectedCard = libraryPreview?.active && libraryPreview?.profileId === p.id;
                
                // Dynamic border class based on selection and type
                let borderClass = 'border-zinc-800 hover:border-zinc-700';
                if (isSelectedCard) {
                  borderClass = viewingProfilesType === 'tube' ? 'border-zinc-500 shadow-[0_0_15px_rgba(244,244,245,0.06)]' : viewingProfilesType === 'pan' ? 'border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
                }

                return (
                  <div 
                    key={p.id} 
                    className={`p-3 bg-[#0d0d11] border rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col gap-2.5 ${borderClass} hover:-translate-y-[1px] hover:shadow-xl`}
                    style={{
                      background: isSelectedCard 
                        ? `linear-gradient(135deg, #0d0d11 0%, ${viewingProfilesType === 'pan' ? 'rgba(59,130,246,0.02)' : viewingProfilesType === 'handle' ? 'rgba(245,158,11,0.02)' : 'rgba(255,255,255,0.02)'} 100%)`
                        : undefined
                    }}
                    onClick={() => {
                      if (previewBackupConfig === undefined || previewBackupConfig === null) {
                        if (setPreviewBackupConfig) {
                          setPreviewBackupConfig(JSON.parse(JSON.stringify(config[p.type])));
                        }
                        if (setPreviewBackupName) {
                          setPreviewBackupName(loadedProfileNames ? loadedProfileNames[p.type] : null);
                        }
                      }
                      
                      if (setLibraryPreview) {
                        setLibraryPreview({
                          active: true,
                          profileId: p.id,
                          isUnique: !!p.data?.isUnique,
                          isEditing: false,
                          type: p.type
                        });
                      }

                      onUpdate({ ...config, [p.type]: p.data });
                      if (onSetLoadedProfileName) {
                        onSetLoadedProfileName(p.type, p.name);
                      }
                    }}
                  >
                    {/* Glowing highlight stripe at active */}
                    {isSelectedCard && (
                      <div className={`absolute top-0 right-0 w-[3px] h-full ${viewingProfilesType === 'tube' ? 'bg-zinc-400' : viewingProfilesType === 'pan' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    )}

                    <div className="flex justify-between items-center relative z-10" dir="rtl">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`text-[12px] font-bold tracking-wide transition-colors ${
                          isSelectedCard ? 'text-zinc-150 font-extrabold' : 'text-zinc-300'
                        }`}>
                          {p.name}
                        </span>
                      </div>
                      
                      {isSelectedCard && (
                        <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-md border ${activeTextClass} animate-pulse`}>
                          قيد المعاينة النشطة
                        </span>
                      )}
                    </div>

                    <ProfileDetails profile={p} />

                    <div className="text-[9.5px] text-zinc-500 flex justify-between mt-1 items-center relative z-10 border-t border-zinc-900/60 pt-2" dir="rtl">
                      <span className="font-mono text-[8px] text-zinc-500" dir="ltr">
                        {new Date(p.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        {isSelectedCard ? (
                          <span className="text-zinc-450 flex items-center gap-1 font-bold">
                            <Eye size={12} className={typeColor} /> معروض الآن تلقائياً
                          </span>
                        ) : (
                          <span className="text-zinc-550 hover:text-zinc-350 flex items-center gap-1 transition-colors">
                            <Eye size={12} /> اضغط للاستعراض النشط
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* تذييل بار العودة لشريط الإعدادات الأصلي */}
        <div className="p-3 border-t border-[#27272a]/20 bg-[#0c0d10]" dir="rtl">
          <button
            onClick={() => {
              setViewingProfilesType(null);
              setProfileSearchQuery('');
              if (onReturnToLibrary) {
                onReturnToLibrary();
              }
            }}
            className="w-full py-2 bg-gradient-to-r from-zinc-900 to-[#1c1c22] hover:from-zinc-800 hover:to-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all rounded-xl text-[11px] font-sans font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <ChevronLeft size={13} />
            <span>إلغاء والعودة لشريط الإعدادات الرئيسي</span>
          </button>
        </div>
      </aside>
    );
  }

  const isPanStep = wizardStep === 'pan-design' || wizardStep === 'pan-tube-cut';
  const isHandleStep = wizardStep === 'handle-design' || wizardStep === 'tube-handle-cut';

  const currentAccent = isPanStep ? '#3b82f6' : isHandleStep ? '#fbbf24' : '#94a3b8';
  const currentAccentBlue = '#3b82f6';
  const currentAccentDim = isPanStep ? '#1d4ed8' : isHandleStep ? '#b45309' : '#475569';
  const currentAccentHover = isPanStep ? '#60a5fa' : isHandleStep ? '#fcd34d' : '#cbd5e1';

  return (
    <aside 
      className="w-full h-full flex flex-col relative transition-all duration-300 bg-[#09090b] border-r border-[#1f1f23]" 
      id="zero-gap-panel"
      style={{
        '--accent': currentAccent,
        '--accent-blue': currentAccentBlue,
        '--accent-dim': currentAccentDim,
        '--accent-hover': currentAccentHover,
        '--border': '#27272a', // Constant, clean gray border
      } as React.CSSProperties}
    >
      {/* Decorative unified gradient bar representing Blue, Yellow, and Gray in perfect harmony */}
      <div className="h-[2.5px] w-full bg-gradient-to-r from-[#3b82f6] via-[#fbbf24] to-[#71717a] shrink-0 shadow-[0_1px_10px_rgba(251,191,36,0.15)]" />

      {savingProfileType && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-[#0c0d10] border border-[var(--accent)] rounded p-4 w-full shadow-xl" dir="rtl">
            <h3 className="text-[12px] font-bold text-white mb-2">حفظ النموذج</h3>
            <input 
              type="text" 
              className="w-full bg-black/50 border border-[var(--border)] outline-none focus:border-[var(--accent)] rounded px-3 py-2 text-white text-[12px] mb-4"
              placeholder="اسم النموذج..."
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newProfileName.trim()) {
                  addProfile(newProfileName.trim(), savingProfileType, config[savingProfileType]);
                  if (onSetLoadedProfileName) {
                    onSetLoadedProfileName(savingProfileType, newProfileName.trim());
                  }
                  setSavingProfileType(null);
                }
              }}
            />
            <div className="flex justify-between gap-2">
              <button 
                className="px-3 py-1.5 text-[10px] border border-[var(--border)] hover:bg-white/5 rounded text-white transition-colors"
                onClick={() => setSavingProfileType(null)}
              >
                إلغاء
              </button>
              <div className="flex gap-2">
                {libraryPreview?.active && libraryPreview?.isEditing && libraryPreview?.profileId && (
                  <button 
                    className="px-3 py-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-colors"
                    onClick={() => {
                      if (newProfileName.trim() && updateProfile) {
                        updateProfile(libraryPreview.profileId!, newProfileName.trim(), config[savingProfileType]);
                        if (onSetLoadedProfileName) {
                          onSetLoadedProfileName(savingProfileType, newProfileName.trim());
                        }
                        setSavingProfileType(null);
                      }
                    }}
                  >
                    حفظ التعديلات للنموذج
                  </button>
                )}
                <button 
                  className="px-3 py-1.5 text-[10px] bg-[var(--accent)] hover:opacity-90 text-white rounded font-bold transition-opacity"
                  onClick={() => {
                    if (newProfileName.trim()) {
                      addProfile(newProfileName.trim(), savingProfileType, config[savingProfileType]);
                      if (onSetLoadedProfileName) {
                        onSetLoadedProfileName(savingProfileType, newProfileName.trim());
                      }
                      setSavingProfileType(null);
                    }
                  }}
                >
                  حفظ كنموذج جديد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Panel Header */}
      <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-white/5">
        <div>
          <h3 className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-widest">{stepTitle}</h3>
          <p className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5">MecaFlow CAD / {wizardStep}</p>
          {(() => {
            const activeType = wizardStep === 'tube-design' || wizardStep === 'pan-tube-cut' ? 'tube'
                             : wizardStep === 'pan-design' ? 'pan'
                             : wizardStep === 'handle-design' || wizardStep === 'tube-handle-cut' ? 'handle'
                             : null;
            const loadedName = activeType && loadedProfileNames ? loadedProfileNames[activeType] : null;
            if (loadedName) {
              return (
                <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-300 font-bold bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50 w-fit max-w-[155px] truncate" title={`النموذج النشط المستورد كقالب: ${loadedName}`}>
                  <span className="text-zinc-400 text-[10px]">📋</span>
                  <span>{loadedName}</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
        <div className="flex gap-1">
          <button onClick={onUndo} title="تراجع" className="p-1 text-[var(--text-dim)] hover:text-white">↺</button>
          <button onClick={onRedo} title="إعادة" className="p-1 text-[var(--text-dim)] hover:text-white">↻</button>
          <label className="cursor-pointer ml-2 px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-[var(--text-main)] hover:border-[var(--accent-blue)] transition-colors">
            تحميل
            <input type="file" accept=".json" className="hidden" onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const r = new FileReader();
                r.onload = ev => {
                  try { onUpdate(JSON.parse(ev.target?.result as string)); } catch { alert('ملف غير صالح'); }
                };
                r.readAsText(e.target.files[0]);
              }
            }}/>
          </label>
            <button
            onClick={async () => {
              const data = JSON.stringify(config, null, 2);
              await StorageBridge.exportNativeFile(data, 'mecaflow_config.json');
            }}
            className="px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-[var(--accent)] hover:border-[var(--accent)] transition-colors mr-1"
          >حفظ</button>
          <button
            onClick={async () => {
              const dummyState: CADState = {
                parts: [],
                selectedPartId: 'current-drawing',
                viewMode: '3d',
                gridVisible: true,
                units: 'mm',
                zeroGap: config,
                wizardStep: wizardStep
              };
              const backupRes = await CloudBackupService.backupProject(dummyState);
              alert(backupRes.message);
            }}
            className="px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-blue-400 hover:border-blue-400 hover:text-white transition-colors"
            title="تأمين نسخة احتياطية محلية وسحابية فورية للرسومات"
          >سحابة ☁</button>
        </div>
      </div>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">

        {libraryPreview?.active && !libraryPreview?.isEditing ? (
          <div className="flex flex-col items-center justify-start p-6 text-center h-full border-t border-[var(--border)] mt-4 overflow-y-auto custom-scrollbar" dir="rtl">
            <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-4 border border-[var(--accent)]/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
              <Eye size={24} />
            </div>
            <h3 className="text-zinc-200 text-sm font-bold mb-2 shrink-0">وضع المعاينة من المكتبة</h3>
            <p className="text-[11px] text-[var(--text-dim)] mb-6 max-w-xs leading-relaxed shrink-0">
              {libraryPreview.isUnique 
                ? "هذا النموذج تم استيراده كـ 3D Mesh ولا يدعم التعديل البارامتري، لا يمكن تغيير أي قياسات للنماذج الفريدة." 
                : "أنت الآن في وضع المعاينة. يمكنك الضغط على 'تعديل' لفتح المحرر البارامتري وتعديل أبعاد هذا النموذج."}
            </p>

            {/* Diagnostic Card for Dimensions */}
            {!libraryPreview.isUnique && (
              <div className="w-full text-right mt-2 space-y-4 shrink-0 pb-10">
                {libraryPreview.type === 'tube' && (
                  <div className="bg-[#0c0d10]/80 rounded-xl p-4 border border-[#27272a] shadow-lg text-right">
                    <div className="text-[10px] text-zinc-300 mb-3 font-bold uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
                       <TubeIcon className="w-4 h-4 text-zinc-400" /> أبعاد الأنبوب الرئيسي
                    </div>
                    <div className="flex flex-col gap-2.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center text-zinc-400"><span>شكل المقطع:</span> <span className="text-white bg-white/5 px-2 py-0.5 rounded text-[10px]">{config.tube?.shape === 'دائري' ? 'دائري' : config.tube?.shape === 'بيضاوي' ? 'بيضاوي' : 'مستطيل/مربع'}</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>القطر/العرض الخارجي:</span> <span className="text-white">{(config.tube?.width || 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>القطر/العرض الداخلي:</span> <span className="text-white">{Math.max((config.tube?.width || 0) - (config.tube?.thickness || 0) * 2, 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>سماكة الجدار (Wall):</span> <span className="text-white">{(config.tube?.thickness || 0).toFixed(2)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400 pt-1 border-t border-[#27272a]"><span>الطول الإجمالي للأنبوب:</span> <span className="text-[var(--accent)] font-bold tracking-wider">{(config.tube?.totalLength || 0).toFixed(1)} مم</span></div>
                    </div>
                  </div>
                )}

                {libraryPreview.type === 'pan' && (
                  <div className="bg-[#0c0d10]/80 rounded-xl p-4 border border-[#27272a] shadow-lg text-right">
                    <div className="text-[10px] text-blue-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
                       <PanIcon className="w-4 h-4 text-blue-400" /> أبعاد الوصلة الأمامية / المقلاة
                    </div>
                    <div className="flex flex-col gap-2.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center text-zinc-400"><span>شكل جدار المقلاة:</span> <span className="text-white bg-white/5 px-2 py-0.5 rounded text-[10px]">{config.pan?.wallProfile === 'curved' ? 'منحني' : 'مستقيم'}</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>القطر السفلي (القاع):</span> <span className="text-white">{(config.pan?.bottomDiameter || 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>القطر العلوي:</span> <span className="text-white">{(config.pan?.topDiameter || 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>سماكة معدن المقلاة:</span> <span className="text-white">{(config.pan?.wallThickness || 0).toFixed(2)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400 pt-1 border-t border-[#27272a]"><span>ارتفاع المقلاة (Y):</span> <span className="text-[#60a5fa] font-bold tracking-wider">{(config.pan?.height || 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>مستوى القياس:</span> <span className="text-zinc-500 text-[9px]">{config.pan?.innerMoldMode ? 'داخلي (Inner)' : 'خارجي (Outer)'}</span></div>
                    </div>
                  </div>
                )}

                {libraryPreview.type === 'handle' && (
                  <div className="bg-[#0c0d10]/80 rounded-xl p-4 border border-[#27272a] shadow-lg text-right">
                    <div className="text-[10px] text-amber-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-2">
                       <HandleIcon className="w-4 h-4 text-amber-400" /> أبعاد المقبض / الدعامة التقنية
                    </div>
                    <div className="flex flex-col gap-2.5 text-[11px] font-mono">
                      <div className="flex justify-between items-center text-zinc-400"><span>شكل مقطع المقبض:</span> <span className="text-white bg-white/5 px-2 py-0.5 rounded text-[10px]">{config.handle?.shape === 'rectangular' ? 'مربع/مستطيل' : 'دائري'}</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>القطر / العرض:</span> <span className="text-white">{(config.handle?.width || 0).toFixed(1)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>سماكة الجدار:</span> <span className="text-white">{(config.handle?.thickness || 0).toFixed(2)} مم</span></div>
                      <div className="flex justify-between items-center text-zinc-400"><span>زاوية الانحناء (X):</span> <span className="text-white">{(config.handle?.angleX || 0).toFixed(1)}°</span></div>
                      <div className="flex justify-between items-center text-zinc-400 pt-1 border-t border-[#27272a]"><span>طول المقبض الإجمالي:</span> <span className="text-[#fbbf24] font-bold tracking-wider">{(config.handle?.depth || 0).toFixed(1)} مم</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 📋 لوحة الجودة الهندسية والمصنعية الموحدة */}
            {(() => {
              const dummyStateVal: CADState = {
                parts: [],
                selectedPartId: 'current-drawing',
                viewMode: '3d',
                gridVisible: true,
                units: 'mm',
                zeroGap: config,
                wizardStep: wizardStep
              };
              const valRes = ParameterValidator.validateStepParameters(dummyStateVal, wizardStep);
              return (
                <div className="mb-6 p-3 rounded bg-zinc-950/80 border border-zinc-800 text-[11px] font-sans" id="validation-panel" dir="rtl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                      🛡️ وحدة التحقق والتحليل الهندسي
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all duration-300 ${
                      valRes.isValid 
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-red-950/80 text-red-400 border border-red-500/20'
                    }`}>
                      {valRes.isValid ? 'سليم هندسياً' : 'يوجد تعارض'}
                    </span>
                  </div>

                  {!valRes.isValid && (
                    <div className="bg-red-950/10 border border-red-500/20 p-2.5 rounded text-[10px] space-y-1 mb-2 text-red-200">
                      <div className="font-bold text-red-400">تنبيهات هندسية حرجة (P0):</div>
                      {valRes.errors.map((err, idx) => (
                        <div key={idx} className="flex gap-1 items-start text-right">
                          <span>•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {valRes.warnings.length > 0 && (
                    <div className="bg-amber-950/10 border border-amber-500/20 p-2.5 rounded text-[10px] space-y-1 text-amber-200">
                      <div className="font-bold text-amber-400">نصائح سلامة قطع ليزر الوصلة (P1):</div>
                      {valRes.warnings.map((warn, idx) => (
                        <div key={idx} className="flex gap-1 items-start text-right">
                          <span>•</span>
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {valRes.isValid && valRes.warnings.length === 0 && (
                    <div className="bg-emerald-950/10 border border-emerald-500/20 p-2 px-3 rounded text-[10px] text-emerald-250 text-right">
                      ✓ جميع القياسات والزوايا متوافقة تماماً للتوصيل المثالي وتوليد مسارات القطع بدون فجوات.
                    </div>
                  )}
                </div>
              );
            })()}

        <Steps123Controls
          config={config}
          wizardStep={wizardStep}
          onUpdate={onUpdate}
          updateTube={updateTube}
          updatePan={updatePan}
          updateHandle={updateHandle}
          setViewingProfilesType={setViewingProfilesType}
          handleSaveProfile={handleSaveProfile}
          onOpenCustomViewer={onOpenCustomViewer}
          loadedProfileNames={loadedProfileNames}
        />

        <Steps45Controls
          config={config}
          wizardStep={wizardStep}
          onUpdate={onUpdate}
          updateAssembly={updateAssembly}
          updatePan={updatePan}
          updateHandle={updateHandle}
          loadedProfileNames={loadedProfileNames}
          onJump={onJump}
        />

        <Steps67Controls
          config={config}
          targetDimensions={targetDimensions}
          wizardStep={wizardStep}
          onUpdate={onUpdate}
          updateTube={updateTube}
          onOpenDrafting={onOpenDrafting}
          onOpenCNC={onOpenCNC}
          onExport={onExport}
          onExportSTEP={onExportSTEP}
          exportManufacturingFile={exportManufacturingFile}
          onSaveModel={onSaveModel}
          isPreviousWorkMode={isPreviousWorkMode}
          onExitPreviousWorkMode={onExitPreviousWorkMode}
        />
        </>
        )}
      </div>

      {/* ── Wizard Navigation (bottom) ─────────────────────────────────── */}
      <div className="wizard-nav border-t border-[var(--border)] p-3 flex gap-2">
        {libraryPreview?.active ? (
          <>
            {libraryPreview.isEditing ? (
              <>
                <button 
                  className="flex-1 wizard-nav-btn" 
                  onClick={() => setLibraryPreview?.({ ...libraryPreview, isEditing: false })}
                >
                  إلغاء
                </button>
                {/* Check if user wants to overwrite or save as new */}
                <button 
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-[10px] transition-colors whitespace-nowrap px-1"
                  onClick={() => {
                    handleSaveProfile(libraryPreview.type!); // this will trigger the save popup for a new/modified model
                    // Also we should leave it active for them to save
                  }}
                >
                  حفظ التفاصيل
                </button>
              </>
            ) : (
              <>
                <button 
                  className="flex-1 wizard-nav-btn" 
                  onClick={() => onReturnToLibrary?.()}
                >
                  رجوع للمكتبة
                </button>
                {!libraryPreview.isUnique && (
                  <button 
                    className="flex-1 wizard-nav-btn primary" 
                    onClick={() => setLibraryPreview?.({ ...libraryPreview, isEditing: true })}
                  >
                    تعديل
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button className="wizard-nav-btn" onClick={onPrev} disabled={!canGoPrev}>
              ← السابق
            </button>
            <button className="wizard-nav-btn primary" onClick={onNext} disabled={!canGoNext}>
              {wizardStep === 'tube-handle-cut' ? 'مراجعة البيانات →' : 
               wizardStep === 'technical-review' ? 'المعاينة النهائية →' : 
               wizardStep === 'final-inspect' ? 'إنهاء التجميع والعودة للرئيسية 🏠' :
               'التالي →'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default ZeroGapControlPanel;
