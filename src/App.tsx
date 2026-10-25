import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { ErrorBoundary } from './components/ErrorBoundary';
import DraftingView from './components/DraftingView';
import { FileViewer } from './components/FileViewer';
import { StatusBar } from './components/StatusBar';
import ZeroGapControlPanel from './components/ZeroGapControlPanel';
import WizardStepper from './components/WizardStepper';
import DashboardView from './components/DashboardView';
import { CADState, WizardStep, WIZARD_STEPS } from './types';
import { StorageBridge } from './lib/storageBridge';
import { useProjectHistory } from './hooks/useProjectHistory';
import { useProfiles } from './hooks/useProfiles';
import { Eye } from 'lucide-react';

import { PreviousWorkLibrary } from './components/PreviousWorkLibrary';

const ThreeCanvas = React.lazy(() => import('./components/ThreeCanvas'));
const CNCView = React.lazy(() => import('./components/CNCView'));

const LoadingSpinner = () => <div className="absolute inset-0 flex items-center justify-center text-zinc-500 font-mono">جاري التحميل...</div>;

const defaultZeroGap: CADState['zeroGap'] = {
  pan: {
    bottomDiameter: 120, topDiameter: 280, height: 50, wallProfile: 'curved', curveRadius: 100,
    rimThickness: 2, bottomFilletRadius: 8, removeBottom: false, addRim: true,
    rimHeight: 3, wallThickness: 2.0, useShellPreview: true,
    innerMoldMode: false, applyThicknessToCut: false,
  },
  tube: {
    width: 38, height: 25, thickness: 1.2, totalLength: 120, partLength: 70,
    fixedHeadLength: 40, fixedTailLength: 30,
    cornerRadius: 5.75, shape: 'مستطيل',
  },
  handle: {
    shape: 'rectangular', width: 30, height: 20, depth: 80, thickness: 1.5,
    cornerRadius: 3, angleX: 0, angleY: 0, offsetZ: 0, insertionDepth: 15,
  },
  assembly: {
    tiltAngle: 15, handleAngleX: 0, handleAngleY: 10, handleOffset: 0,
    insertionDistance: 50, heightOffset: 25, tiltAxis: 'X',
  },
  renderMode: 'boolean',
  addFillet: true,
  thermalClearance: false,
  markOrientation: false,
  showGlow: true,
  showBorders: true,
  showToolpathPreview: true,
  showGcodePath: true,
  showBodySlices: true,
  showGhostPart: true,
  fallbackCutToDepth: true,
};

const defaultInitialState: CADState = {
  parts: [],
  selectedPartId: null,
  viewMode: '3d',
  gridVisible: true,
  units: 'mm',
  zeroGap: defaultZeroGap,
  wizardStep: 'dashboard',
};

function MainApp() {
  const { addProfile } = useProfiles();
  const [showSplash, setShowSplash] = useState(true);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [targetDimensions, setTargetDimensions] = useState<{l: number, w: number, h: number} | null>(null);
  const [finalPartFromHandle, setFinalPartFromHandle] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  const [defaultProjectId, setDefaultProjectId] = useState<string | undefined>();
  const { currentGeometry, updateGeometry, undo, redo, exportManufacturingFile, isLoading, canUndo, canRedo, saveAsNewProject, startNewProject } = useProjectHistory(defaultProjectId);
  
  useEffect(() => {
    StorageBridge.getLatestProject().then(project => {
       if (project && project.id) {
         setHasSavedConfig(true);
         setDefaultProjectId(project.id);
       }
       setDbLoaded(true);
    }).catch(err => {
      console.error('Failed to load project from Dexie:', err);
      setDbLoaded(true);
    });
  }, []);

  const state: CADState = useMemo(() => {
    if (!currentGeometry) return defaultInitialState;
    if (currentGeometry.zeroGap) return currentGeometry;
    return {
      ...defaultInitialState,
      zeroGap: { ...defaultZeroGap, ...currentGeometry }
    };
  }, [currentGeometry]);
  
  // Wrapper to update state
  const setState = (updater: (prev: CADState) => CADState) => {
    updateGeometry(updater(state));
  };

  const canvasRef = useRef<any>(null); // Use any for ref to avoid circular dependency issues during build if needed

  // ── Wizard navigation ─────────────────────────────────────────────────────
  const setWizardStep = (step: WizardStep, jumpBack: WizardStep | null = null, clearJump: boolean = false) => {
    setState(prev => {
      let newRenderMode = prev.zeroGap.renderMode;
      if (step === 'pan-tube-cut' || step === 'tube-handle-cut') {
        newRenderMode = 'preview';
      } else if (step === 'technical-review' || step === 'final-inspect') {
        newRenderMode = 'boolean';
      }

      let nextJumpBack = prev.jumpBackToStep;
      if (clearJump) {
        nextJumpBack = null;
      } else if (jumpBack !== null) {
        nextJumpBack = jumpBack;
      }

      return { 
        ...prev, 
        wizardStep: step,
        jumpBackToStep: nextJumpBack,
        zeroGap: {
          ...prev.zeroGap,
          renderMode: newRenderMode
        }
      };
    });
  };

  // Helper variables moved below state initialization to avoid temporal dead zone (TDZ)


  const isDashboard = state.wizardStep === 'dashboard';
  const showCanvas = !isDashboard;
  const showSidebar = !isDashboard;

  const handleJump = (target: WizardStep, returnTo: WizardStep) => {
    setWizardStep(target, returnTo);
  };

  const handleConfirmCustomModel = (name: string, category: 'tube' | 'pan' | 'handle', buffer: ArrayBuffer) => {
    // 1. Add to library as a "Unique" model
    addProfile(name, category, {
      isUnique: true,
      customStlBuffer: buffer,
      customStlName: name + '.stl',
      importedAt: Date.now(),
    });
    
    // 2. Update active configuration
    setState(prev => {
      const newConfig = { ...prev.zeroGap };
      if (category === 'tube') {
        newConfig.tube = {
          ...newConfig.tube,
          shape: 'مخصص',
          customStlBuffer: buffer,
          customStlName: name + '.stl',
        };
      } else if (category === 'pan') {
        newConfig.pan = {
          ...newConfig.pan,
          wallProfile: 'مخصص',
          customStlBuffer: buffer,
          customStlName: name + '.stl',
        };
      } else if (category === 'handle') {
        newConfig.handle = {
          ...newConfig.handle,
          shape: 'مخصص',
          customStlBuffer: buffer,
          customStlName: name + '.stl',
        };
      }
      return { 
        ...prev, 
        zeroGap: newConfig,
        pendingCustomSelection: null
      };
    });

    // 3. Close viewer & auto navigate back to corresponding design stage
    setOverlayView(null);
    if (category === 'tube') {
      setWizardStep('tube-design');
    } else if (category === 'pan') {
      setWizardStep('pan-design');
    } else if (category === 'handle') {
      setWizardStep('handle-design');
    }
    
    // 4. Update UI labels
    setLoadedProfileNames(prev => ({
      ...prev,
      [category]: name
    }));
    setCustomSelectionBackup(null);
  };

  // ── Overlay views (Drafting / CNC / Viewer) triggered from final-inspect or Dashboard ────────
  const [overlayView, setOverlayView] = useState<'drafting' | 'cnc' | 'viewer' | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showPreviousWork, setShowPreviousWork] = useState(false);
  const [isPreviousWorkMode, setIsPreviousWorkMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [loadedProfileNames, setLoadedProfileNames] = useState<{
    tube: string | null;
    pan: string | null;
    handle: string | null;
  }>({ tube: null, pan: null, handle: null });

  const [libraryPreview, setLibraryPreview] = useState<{
    active: boolean;
    profileId: string | null;
    isUnique: boolean;
    isEditing: boolean;
    type: 'tube' | 'pan' | 'handle' | null;
  }>({ active: false, profileId: null, isUnique: false, isEditing: false, type: null });

  const [previewBackupConfig, setPreviewBackupConfig] = useState<any>(null);
  const [previewBackupName, setPreviewBackupName] = useState<string | null>(null);
  const [customSelectionBackup, setCustomSelectionBackup] = useState<{ category: 'tube' | 'pan' | 'handle'; config: any; name: string | null } | null>(null);

  const currentStepIdx = WIZARD_STEPS.indexOf(state.wizardStep);
  const canGoNext = isPreviousWorkMode 
    ? (state.wizardStep === 'technical-review' || state.wizardStep === 'final-inspect')
    : (currentStepIdx < WIZARD_STEPS.length - 1 || state.wizardStep === 'final-inspect');
  const canGoPrev = isPreviousWorkMode
    ? (state.wizardStep === 'final-inspect')
    : (currentStepIdx > 0);
  
  const goNext = () => { 
    if (state.wizardStep === 'final-inspect') {
      setWizardStep('dashboard');
      setIsPreviousWorkMode(false);
      return;
    }

    if (state.jumpBackToStep) {
      const target = state.jumpBackToStep;
      const targetIdx = WIZARD_STEPS.indexOf(target);
      
      // If we are already at or past the jump target, proceed to actual next step
      if (targetIdx <= currentStepIdx) {
        if (canGoNext) setWizardStep(WIZARD_STEPS[currentStepIdx + 1], null, true);
      } else {
        // Otherwise jump forward to the destination
        setWizardStep(target, null, true);
      }
      return;
    }
    if (canGoNext) setWizardStep(WIZARD_STEPS[currentStepIdx + 1]); 
  };
  
  const goPrev = () => { 
    if (canGoPrev) {
      // If we are in a jump-back state and go back, we might want to clear it?
      // For now, normal back behavior.
      setWizardStep(WIZARD_STEPS[currentStepIdx - 1]); 
    }
  };

  return (
    <>
      {showSplash && (
        <div className="splash-screen">
          <div className="dashboard-logo-wrapper splash-logo-container" id="splash-3d-logo">
            {/* Outer Blue Glass Cube */}
            <div className="glass-cube-3d cube-outer">
              <div className="face front"></div>
              <div className="face back"></div>
              <div className="face left"></div>
              <div className="face right"></div>
              <div className="face top"></div>
              <div className="face bottom"></div>
            </div>
            {/* Middle Yellow Glass Cube */}
            <div className="glass-cube-3d cube-middle">
              <div className="face front"></div>
              <div className="face back"></div>
              <div className="face left"></div>
              <div className="face right"></div>
              <div className="face top"></div>
              <div className="face bottom"></div>
            </div>
            {/* Inner Green Glass Cube */}
            <div className="glass-cube-3d cube-inner">
              <div className="face front"></div>
              <div className="face back"></div>
              <div className="face left"></div>
              <div className="face right"></div>
              <div className="face top"></div>
              <div className="face bottom"></div>
            </div>
          </div>
          <div className="neon-text-lux">MecaFlow-CAD</div>
          <div className="neon-sub-lux">ZERO-GAP LASER SYSTEM</div>
        </div>
      )}

      <div className={`h-screen overflow-hidden flex flex-col font-sans ${showSplash ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
        {/* ── Header with Wizard Stepper ────────────────────────────────── */}
        {!state.pendingCustomSelection && (
          <header className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 shrink-0 z-20 mx-4 mt-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <img 
                  src="/logo.svg" 
                  className="w-8 h-8 rounded-lg shadow-lg border border-zinc-800 object-cover bg-zinc-950/80" 
                  alt="MecaFlow CAD Logo" 
                  referrerPolicy="no-referrer" 
                />
                <h1 className="font-bold tracking-tight text-lg">MecaFlow <span className="bg-gradient-to-r from-[#3b82f6] via-[#14b8a6] to-[#fbbf24] bg-clip-text text-transparent font-black">CAD V2.3</span></h1>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              {(!isDashboard && overlayView === null && !libraryPreview.active) && (
                <WizardStepper 
                  currentStep={state.wizardStep} 
                  jumpBackToStep={state.jumpBackToStep}
                  onStepClick={(step) => {
                    if (step === 'dashboard') {
                      setWizardStep(step);
                      setIsPreviousWorkMode(false);
                      setOverlayView(null);
                      setShowLibrary(false);
                    } else if (isPreviousWorkMode) {
                      if (step === 'technical-review' || step === 'final-inspect') {
                        setWizardStep(step);
                      }
                    } else {
                      setWizardStep(step);
                    }
                  }} 
                  isPreviousWorkMode={isPreviousWorkMode}
                />
              )}
            </div>

            <div className="flex gap-3 items-center">
              <div className="px-3 py-1 bg-zinc-800 rounded text-[10px] border border-zinc-700 font-mono text-zinc-400">v2.3</div>
            </div>
          </header>
        )}

        {/* ── Main Layout ──────────────────────────────────────────────── */}
        {state.pendingCustomSelection || (overlayView === 'viewer' && isDashboard) ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
             <FileViewer 
                onClose={() => {
                  setOverlayView(null);
                  const cat = state.pendingCustomSelection;
                  if (cat) {
                    let targetStep: WizardStep = 'tube-design';
                    if (cat === 'tube') targetStep = 'tube-design';
                    else if (cat === 'pan') targetStep = 'pan-design';
                    else if (cat === 'handle') targetStep = 'handle-design';

                    setState(prev => {
                      const restoredZeroGap = { ...prev.zeroGap };
                      if (customSelectionBackup && customSelectionBackup.category === cat) {
                        restoredZeroGap[cat] = customSelectionBackup.config;
                      }

                      return {
                        ...prev,
                        wizardStep: targetStep,
                        zeroGap: restoredZeroGap,
                        pendingCustomSelection: null
                      };
                    });

                    if (customSelectionBackup && customSelectionBackup.category === cat) {
                      setLoadedProfileNames(prev => ({
                        ...prev,
                        [cat]: customSelectionBackup.name
                      }));
                      setCustomSelectionBackup(null);
                    }
                  } else {
                    setState(prev => ({ ...prev, pendingCustomSelection: null }));
                  }
                }} 
                currentStlProvider={async () => {
                  const r = await canvasRef.current?.exportSTL();
                  return r || null;
                }}
                onAddProfile={addProfile}
                onConfirmSelection={state.pendingCustomSelection ? handleConfirmCustomModel : undefined}
                initialCategory={state.pendingCustomSelection || undefined}
              />
          </div>
        ) : (
          <main className={isDashboard ? "flex-1 flex overflow-hidden relative" : "flex-1 grid grid-cols-12 grid-rows-6 gap-4 p-4 overflow-hidden relative"}>
            <div className={isDashboard ? "flex-1 flex flex-col overflow-hidden" : "col-span-8 row-span-6 flex flex-col overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl relative group"}>
              {/* View Container */}
              <div className={`flex-1 relative group overflow-hidden`} style={{ backgroundImage: isDashboard ? 'none' : 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                {isDashboard && (
                  <DashboardView
                  onNewPart={() => {
                    startNewProject();
                    setIsPreviousWorkMode(false);
                    setLoadedProfileNames({ tube: null, pan: null, handle: null });
                    setWizardStep('tube-design');
                  }}
                  onLoadSTL={(buffer, name) => {
                    startNewProject();
                    setIsPreviousWorkMode(false);
                    setLoadedProfileNames({ tube: null, pan: null, handle: null });
                    setState(prev => ({
                      ...prev,
                      wizardStep: 'tube-design',
                      zeroGap: {
                        ...prev.zeroGap,
                        tube: { ...prev.zeroGap.tube, shape: 'مخصص', customStlBuffer: buffer, customStlName: name },
                      },
                    }));
                  }}
                  onLoadConfig={() => {
                    canvasRef.current?.disposeCSG();
                    setShowPreviousWork(true);
                  }}
                  hasSavedConfig={hasSavedConfig}
                  onOpenViewer={() => setOverlayView('viewer')}
                  showLibrary={showLibrary}
                  setShowLibrary={setShowLibrary}
                  showHelp={showHelp}
                  setShowHelp={setShowHelp}
                  onLoadProfile={(type, data, name) => {
                    const clonedData = JSON.parse(JSON.stringify(data));
                    setState(prev => ({
                      ...prev,
                      zeroGap: {
                        ...prev.zeroGap,
                        [type]: {
                          ...prev.zeroGap[type],
                          ...clonedData
                        }
                      }
                    }));
                    
                    setLoadedProfileNames(prev => ({ ...prev, [type]: name }));
                    setShowLibrary(false);
                    
                    if (type === 'tube') {
                      setWizardStep('tube-design');
                    } else if (type === 'pan') {
                      setWizardStep('pan-design');
                    } else if (type === 'handle') {
                      setWizardStep('handle-design');
                    }
                  }}
                  onPreviewProfile={(p) => {
                    const clonedData = JSON.parse(JSON.stringify(p.data));
                    const typeKey = p.type as 'tube' | 'pan' | 'handle';
                    setState(prev => ({
                      ...prev,
                      zeroGap: {
                        ...prev.zeroGap,
                        [typeKey]: {
                          ...prev.zeroGap[typeKey],
                          ...clonedData
                        },
                        renderMode: 'boolean' // Cuts representation mode for Preview
                      }
                    }));
                    
                    setLoadedProfileNames(prev => ({ ...prev, [typeKey]: p.name }));
                    
                    setLibraryPreview({
                      active: true,
                      profileId: p.id,
                      isUnique: !!p.data?.isUnique,
                      isEditing: false,
                      type: p.type
                    });
                    
                    if (p.type === 'tube') {
                      setWizardStep('tube-design');
                    } else if (p.type === 'pan') {
                      setWizardStep('pan-design');
                    } else if (p.type === 'handle') {
                      setWizardStep('handle-design');
                    }
                    
                    setShowLibrary(false);
                  }}
                />
              )}

              {showPreviousWork && (
                <PreviousWorkLibrary
                  onClose={() => setShowPreviousWork(false)}
                  onLoadProject={(id, geometry) => {
                     // restore the assembled model
                     setIsPreviousWorkMode(true);
                     setState(prev => ({
                       ...prev,
                       wizardStep: 'final-inspect',
                       zeroGap: geometry
                     }));
                     setShowPreviousWork(false);
                  }}
                />
              )}

              {showCanvas && (
                <Suspense fallback={<LoadingSpinner />}>
                  <ThreeCanvas
                    ref={canvasRef}
                    config={state.zeroGap}
                    gridVisible={state.gridVisible}
                    wizardStep={state.wizardStep}
                    onDimensionsChange={setTargetDimensions}
                    finalPartFromHandle={finalPartFromHandle}
                    onResultComputed={setFinalPartFromHandle}
                  />
                </Suspense>
              )}

              {/* Custom Save Dialog */}
              {showSaveDialog && (
                <div className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 font-sans text-right" dir="rtl">
                  <div className="bg-[#0c0d10] border border-[#27272a] rounded-xl p-6 w-full max-w-md shadow-2xl relative">
                    <h2 className="text-xl font-bold text-white mb-2">حفظ النموذج</h2>
                    <p className="text-sm text-zinc-400 mb-6">الرجاء إدخال اسم للنموذج لحفظه في مكتبة العمل السابق.</p>
                    
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      className="w-full bg-black/40 border border-[#27272a] rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (saveName) {
                            saveAsNewProject(saveName, state.zeroGap).then(() => {
                              setShowSaveDialog(false);
                              setSaveSuccessMessage(true);
                              setTimeout(() => setSaveSuccessMessage(false), 3000);
                            });
                          }
                        }}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors cursor-pointer"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setShowSaveDialog(false)}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Success Toast */}
              {saveSuccessMessage && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#10B981] text-white px-6 py-3 rounded-lg shadow-xl font-bold text-sm z-[100] flex items-center gap-2 animate-fade-in" dir="rtl">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  تم حفظ النموذج بنجاح في مكتبة العمل السابق!
                </div>
              )}

              {/* بنر المعاينة الذكي فوق الكانفاس */}
              {showCanvas && libraryPreview.active && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-zinc-950/90 backdrop-blur-md rounded-2xl border border-zinc-500/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-4 max-w-sm w-[calc(100%-2rem)] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-350 font-sans" dir="rtl">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center shrink-0">
                      <Eye size={16} className="text-blue-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-zinc-100 text-[12px] font-bold">وضع المعاينة المؤقت للنموذج</h4>
                      <p className="text-zinc-400 text-[10.5px] leading-relaxed mt-0.5">
                        أنت تستعرض الآن الأبعاد على لوحة العمل ثلاثية الأبعاد. يرجى تأكيد النموذج أو إلغاء العودة.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 pt-2 border-t border-zinc-900 font-sans">
                    <button
                      onClick={() => {
                        // Confirm Selection
                        setLibraryPreview({ active: false, profileId: null, isUnique: false, isEditing: false, type: null });
                        setPreviewBackupConfig(null);
                        setPreviewBackupName(null);
                      }}
                      className="flex-1 py-1.5 px-3 bg-zinc-200 hover:bg-white text-black rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer shadow-md"
                    >
                      تأكيد واختيار
                    </button>
                    <button
                      onClick={() => {
                        // Revert Selection
                        if (previewBackupConfig && libraryPreview.type) {
                          setState(prev => ({
                            ...prev,
                            zeroGap: {
                              ...prev.zeroGap,
                              [libraryPreview.type!]: previewBackupConfig
                            }
                          }));
                          setLoadedProfileNames(prev => ({
                            ...prev,
                            [libraryPreview.type!]: previewBackupName
                          }));
                        }
                        setLibraryPreview({ active: false, profileId: null, isUnique: false, isEditing: false, type: null });
                        setPreviewBackupConfig(null);
                        setPreviewBackupName(null);
                      }}
                      className="flex-1 py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-750 text-zinc-350 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer"
                    >
                      إلغاء وتراجع
                    </button>
                  </div>
                </div>
              )}

              {/* Overlay: DraftingView / CNCView */}
              {overlayView === 'drafting' && (
                <div className="absolute inset-4 z-50 bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
                    <h2 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">مخطط التنفيذ (Drafting)</h2>
                    <button
                      className="px-4 py-1.5 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded text-xs font-bold transition-all border border-red-900"
                      onClick={() => setOverlayView(null)}
                    >إغلاق ✕</button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <DraftingView config={state.zeroGap} />
                  </div>
                </div>
              )}
              {overlayView === 'cnc' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <div className="absolute inset-4 z-50 bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
                      <h2 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">توليد مسارات التصنيع (CNC)</h2>
                      <button
                        className="px-4 py-1.5 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded text-xs font-bold transition-all border border-red-900"
                        onClick={() => setOverlayView(null)}
                      >إغلاق ✕</button>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <CNCView config={state.zeroGap} exportManufacturingFile={exportManufacturingFile} />
                    </div>
                  </div>
                </Suspense>
              )}

              {overlayView === 'viewer' && !isDashboard && !state.pendingCustomSelection && (
                <FileViewer 
                  onClose={() => {
                    setOverlayView(null);
                    setState(prev => ({ ...prev, pendingCustomSelection: null }));
                  }} 
                  currentStlProvider={async () => {
                    const r = await canvasRef.current?.exportSTL();
                    return r || null;
                  }}
                  onAddProfile={addProfile}
                  onConfirmSelection={undefined}
                  initialCategory={undefined}
                />
              )}

              {/* View HUD (only in non-dashboard) */}
              {showCanvas && (
                <div className="absolute top-4 left-4 flex gap-2 z-10">
                  <div className="bg-zinc-950/80 backdrop-blur px-2 py-1 rounded border border-zinc-700 text-[10px] font-mono text-zinc-400">Perspective</div>
                  <div className="bg-zinc-950/80 backdrop-blur px-2 py-1 rounded border border-zinc-700 text-[10px] font-mono text-zinc-400">Shaded with Edges</div>
                  <button onClick={() => setState(prev => ({...prev, gridVisible: !prev.gridVisible}))} className={`backdrop-blur px-2 py-1 rounded border border-zinc-700 text-[10px] font-mono transition-colors ${state.gridVisible ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-950/80 text-zinc-500'}`}>{state.gridVisible ? 'إخفاء الشبكة' : 'إظهار الشبكة'}</button>
                </div>
              )}
            </div>
            
            <StatusBar
              config={state.zeroGap}
              wizardStep={state.wizardStep}
              currentStepIdx={WIZARD_STEPS.indexOf(state.wizardStep)}
              isDashboard={isDashboard}
            />

          </div>

          {/* ── Sidebar (hidden on dashboard) ──────────────────────────── */}
          {showSidebar && (
            <div className="col-span-4 row-span-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col relative w-full">
              <ZeroGapControlPanel
                config={state.zeroGap}
                targetDimensions={targetDimensions}
                onUpdate={(newConfig) => setState(prev => ({ ...prev, zeroGap: newConfig }))}
                onExport={async () => {
                  const r = await canvasRef.current?.exportSTL();
                  const { generateProfessionalFileName } = await import('./lib/fileNameGenerator');
                  if (r) await exportManufacturingFile(r, 'stl', generateProfessionalFileName(state.zeroGap, 'stl'));
                }}
                onExportSTEP={async (ext) => {
                  const r = await canvasRef.current?.exportSTEP();
                  const { generateProfessionalFileName } = await import('./lib/fileNameGenerator');
                  if (r) await exportManufacturingFile(r, ext, generateProfessionalFileName(state.zeroGap, ext));
                }}
                exportManufacturingFile={exportManufacturingFile}
                wizardStep={state.wizardStep}
                onNext={goNext}
                onPrev={goPrev}
                onJump={handleJump}
                onOpenCustomViewer={(cat) => {
                  const backupConfig = state.zeroGap[cat];
                  const backupName = loadedProfileNames[cat];
                  setCustomSelectionBackup({
                    category: cat,
                    config: backupConfig,
                    name: backupName
                  });
                  setState(prev => ({ ...prev, pendingCustomSelection: cat }));
                  setOverlayView('viewer');
                }}
                canGoNext={canGoNext}
                canGoPrev={canGoPrev}
                onOpenDrafting={() => setOverlayView('drafting')}
                onOpenCNC={() => setOverlayView('cnc')}
                onUndo={undo}
                onRedo={redo}
                loadedProfileNames={loadedProfileNames}
                onSetLoadedProfileName={(type, name) => setLoadedProfileNames(prev => ({ ...prev, [type]: name }))}
                libraryPreview={libraryPreview}
                setLibraryPreview={setLibraryPreview}
                previewBackupConfig={previewBackupConfig}
                setPreviewBackupConfig={setPreviewBackupConfig}
                previewBackupName={previewBackupName}
                setPreviewBackupName={setPreviewBackupName}
                isPreviousWorkMode={isPreviousWorkMode}
                onExitPreviousWorkMode={() => {
                  setIsPreviousWorkMode(false);
                  startNewProject();
                  setWizardStep('dashboard');
                }}
                onSaveModel={() => {
                  setSaveName("نموذج_" + new Date().toISOString().slice(0, 10));
                  setShowSaveDialog(true);
                }}
                onReturnToLibrary={() => {
                  if (previewBackupConfig && libraryPreview.type) {
                    setState(prev => ({
                      ...prev,
                      zeroGap: {
                        ...prev.zeroGap,
                        [libraryPreview.type!]: previewBackupConfig
                      }
                    }));
                    setLoadedProfileNames(prev => ({
                      ...prev,
                      [libraryPreview.type!]: previewBackupName
                    }));
                  }
                  setLibraryPreview({ active: false, profileId: null, isUnique: false, isEditing: false, type: null });
                  setPreviewBackupConfig(null);
                  setPreviewBackupName(null);
                }}
              />
            </div>
          )}
        </main>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
