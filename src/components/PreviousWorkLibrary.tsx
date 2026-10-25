import React, { useState, useEffect } from 'react';
import { StorageBridge, ProjectRecord } from '../lib/storageBridge';
import { ArrowRight, Search, Box, Trash2, Eye, ShieldAlert, Archive } from 'lucide-react';

interface PreviousWorkLibraryProps {
  onClose: () => void;
  onLoadProject: (id: string, geometry: any) => void;
}

export const PreviousWorkLibrary: React.FC<PreviousWorkLibraryProps> = ({ onClose, onLoadProject }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchProjects = async () => {
    try {
      const list = await StorageBridge.getAllProjects();
      
      // Auto-cleanup bad/malformed records from previous versions
      const validList: ProjectRecord[] = [];
      const invalidIds: string[] = [];
      
      for (const p of list) {
        const isNameInvalid = !p.name || 
                              p.name.trim() === '' || 
                              p.name === 'undefined' || 
                              p.name === 'null' || 
                              p.name.includes('[object');
                              
        const isGeometryInvalid = !p.geometryData || 
                                  typeof p.geometryData !== 'object' || 
                                  !p.geometryData.tube || 
                                  !p.geometryData.pan;

        if (isNameInvalid || isGeometryInvalid) {
          if (p.id) invalidIds.push(p.id);
        } else {
          validList.push(p);
        }
      }

      if (invalidIds.length > 0) {
        for (const id of invalidIds) {
          StorageBridge.deleteProject(id).catch(err => console.error("Auto-cleanup draft crash:", err));
        }
      }
      
      setProjects(validList);
    } catch (err) {
      console.error("Error fetching projects from storage db:", err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteConfirm = async () => {
    if (projectToDelete) {
      try {
        await StorageBridge.deleteProject(projectToDelete);
        setProjectToDelete(null);
        await fetchProjects();
      } catch (err) {
        console.error("Failed to delete project:", err);
        setProjectToDelete(null);
      }
    }
  };

  const handleClearAll = async () => {
    setIsCleaning(true);
    try {
      await StorageBridge.clearAllProjects();
      setProjects([]);
    } catch (err) {
      console.error("Failed to clear database table:", err);
    } finally {
      setIsCleaning(false);
    }
  };

  const filtered = projects.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="absolute inset-0 bg-[#09090b] z-50 overflow-y-auto font-sans flex flex-col" dir="rtl">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-[#0c0d10] border-b border-[#27272a] py-5 px-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/40 border border-[#27272a] hover:bg-[#1f2937] text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
            title="العودة"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <Archive className="text-indigo-400 w-5 h-5" />
              مكتبة الأعمال والمخططات السابقة
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 tracking-wider uppercase">
              Secure Local Cad Workspaces Library
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text"
              placeholder="بحث في الأعمال المحفوظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-[#27272a] rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-650 pointer-events-none" />
          </div>
          
          <button
            onClick={() => {
              if (window.confirm("هل أنت متأكد تماماً من إفراغ جميع محتويات مكتبة الأعمال السابقة وحذفها بشكل دائم؟")) {
                handleClearAll();
              }
            }}
            disabled={isCleaning || projects.length === 0}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all h-full flex items-center gap-2 ${
              isCleaning || projects.length === 0
                ? 'bg-black/20 border-[#27272a] text-zinc-650 cursor-not-allowed'
                : 'bg-red-950/20 border-red-900/40 text-red-500 hover:bg-red-950/40 hover:border-red-500/50 cursor-pointer'
            }`}
          >
            <Trash2 size={14} />
            <span>{isCleaning ? 'جاري التنظيف...' : 'إفراغ المكتبة'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full flex flex-col p-6 lg:p-10 gap-8">
        
        {/* Helper Shield Info Banner */}
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 items-start shrink-0">
          <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold text-indigo-300">وضع استعراض آمن ومضمون</h4>
            <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
              عند تشغيل واستعراض أي قطعة من هذه المكتبة، سيتم إدخالك مباشرة إلى أداة المخططات الفنية (مرحلة 6) والمعاينة والتنزيل النهائي (مرحلة 7). 
              تم تعطيل التعديل على أبعاد القطع لحمايتها من التشوهات وضمان جاهزيتها الكاملة للتصدير بصيغ (STL/STEP/G-code).
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 flex-1 bg-black/10 border border-[#27272a]/40 rounded-3xl border-dashed">
            <div className="w-16 h-16 rounded-2xl bg-[#0c0d10] border border-[#27272a] flex items-center justify-center mb-4 text-zinc-650 shadow-inner">
              <Box size={24} />
            </div>
            <h3 className="text-sm font-bold text-zinc-400">لا توجد مساحات عمل تطابق معايير البحث</h3>
            <p className="text-xs text-zinc-600 mt-1 font-mono">No previous models saved under this criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(p => (
              <div 
                key={p.id} 
                className="group relative bg-[#0c0d10] border border-[#27272a] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500 hover:shadow-[0_10px_25px_rgba(79,70,229,0.15)] shadow-lg flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
                
                <div className="p-5 flex flex-col flex-1">
                  {/* Card Title Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-indigo-500/10 to-indigo-500/5 flex items-center justify-center border border-indigo-500/10 text-indigo-400 shrink-0">
                      <Box size={18} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">
                        {p.timestamp ? new Date(p.timestamp).toLocaleString('ar-EG') : 'تاريخ غير معروف'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Properties */}
                  <div className="flex-1 bg-[#121318]/90 border border-[#27272a]/80 rounded-xl p-4 mb-5 text-[11px] text-zinc-300 space-y-4 font-sans">
                    {/* 1. الأنبوب */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-indigo-400 border-b border-zinc-800/60 pb-1">
                        <Box size={13} className="shrink-0" />
                        <span>مواصفات هيكل الأنبوب</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">الأبعاد (W×H):</span>
                          <span className="text-zinc-200 font-bold">
                            {(p.geometryData?.tube?.width || 0)}x{(p.geometryData?.tube?.height || p.geometryData?.tube?.width || 0)} مم
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">السمك:</span>
                          <span className="text-emerald-400 font-bold">{(p.geometryData?.tube?.thickness || 0)} مم</span>
                        </div>
                        <div className="flex justify-between col-span-2 border-t border-zinc-900/60 pt-1 mt-0.5">
                          <span className="text-zinc-500">الشكل والامتداد:</span>
                          <span className="text-zinc-200 font-bold">
                            {p.geometryData?.tube?.shape === 'rectangular' || p.geometryData?.tube?.shape === 'مستطيل' ? 'مستطيل (مربع)' : 
                             p.geometryData?.tube?.shape === 'circular' || p.geometryData?.tube?.shape === 'دائري' ? 'دائري دقيق' : 
                             p.geometryData?.tube?.shape === 'oval' || p.geometryData?.tube?.shape === 'بيضاوي' ? 'بيضاوي انسيابي' : 'مخصص'} 
                            {' • '}{(p.geometryData?.tube?.totalLength || p.geometryData?.tube?.partLength || 0)} مم
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. المقلاة */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-amber-500 border-b border-zinc-800/60 pb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500 shrink-0" />
                        <span>مواصفات المقلاة (الوعاء)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">الأقطار (قاع × فم):</span>
                          <span className="text-zinc-200 font-bold">
                            D{(p.geometryData?.pan?.bottomDiameter || 0)} × D{(p.geometryData?.pan?.topDiameter || 0)} مم
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">الارتفاع الكلي:</span>
                          <span className="text-zinc-200 font-bold">{(p.geometryData?.pan?.height || 0)} مم</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">مسار الجدار:</span>
                          <span className="text-zinc-200 font-bold">
                            {p.geometryData?.pan?.wallProfile === 'curved' ? 'منحني طوقي' : 'جدار مستقيم'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">سمك الحديد:</span>
                          <span className="text-amber-400 font-bold">{(p.geometryData?.pan?.wallThickness || p.geometryData?.pan?.rimThickness || 1.5)} مم</span>
                        </div>
                        {p.geometryData?.pan?.addRim && (
                          <div className="flex justify-between col-span-2 border-t border-zinc-900/60 pt-1 mt-0.5 text-zinc-400">
                            <span className="text-zinc-500">حافة الدعم الجانبية:</span>
                            <span className="text-emerald-405 font-bold">مدعومة بدرجة {(p.geometryData?.pan?.rimHeight || 0)} مم</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. المقبض وصنع التثبيت */}
                    {p.geometryData?.handle && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-400 border-b border-zinc-800/60 pb-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-400 shrink-0" />
                          <span>تثبيت المقبض (Handle)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-mono text-zinc-400">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">شكل المقبض:</span>
                            <span className="text-zinc-200 font-bold">
                              {p.geometryData?.handle?.shape === 'cylindrical' ? 'أسطواني' : 'مستطيل'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">الأبعاد (W×D):</span>
                            <span className="text-zinc-200 font-bold">
                              {(p.geometryData?.handle?.width || 0)}x{(p.geometryData?.handle?.depth || 0)} مم
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">السمك الفعلي:</span>
                            <span className="text-zinc-200 font-bold">{(p.geometryData?.handle?.thickness || 0)} مم</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">عمق التداخل:</span>
                            <span className="text-emerald-400 font-bold">{(p.geometryData?.handle?.insertionDepth || 0)} مم</span>
                          </div>
                          <div className="flex justify-between col-span-2 border-t border-zinc-900/60 pt-1 mt-0.5">
                            <span className="text-zinc-500">زوايا ثني التثبيت:</span>
                            <span className="text-amber-500 font-bold col-span-2 text-left">
                              X: {(p.geometryData?.handle?.angleX || 0)}° / Y: {(p.geometryData?.handle?.angleY || 0)}°
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. معايير القطع والإنشاء */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-teal-400 border-b border-zinc-800/60 pb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-500/20 border border-teal-400 shrink-0" />
                        <span>زوايا التجميع والقطع الذكي</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">زاوية الميل:</span>
                          <span className="text-zinc-200 font-bold">{(p.geometryData?.assembly?.tiltAngle || 0)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">إزاحة الارتفاع:</span>
                          <span className="text-zinc-200 font-bold">{(p.geometryData?.assembly?.heightOffset || 0)} مم</span>
                        </div>
                        <div className="flex justify-between col-span-2 border-t border-zinc-900/60 pt-1 mt-0.5 text-[9.5px]">
                          <span className="text-zinc-500">خيارات الإنتاج والتحصين:</span>
                          <span className="text-zinc-300 font-semibold flex gap-1.5 flex-wrap mt-1">
                            {p.geometryData?.addFillet && <span className="bg-emerald-950/40 text-emerald-400 px-1 rounded border border-emerald-900/30">تنعيم اللحام</span>}
                            {p.geometryData?.thermalClearance && <span className="bg-indigo-950/40 text-indigo-400 px-1 rounded border border-indigo-900/30">خلوص حراري</span>}
                            {p.geometryData?.markOrientation && <span className="bg-teal-950/40 text-teal-400 px-1 rounded border border-teal-900/30">مؤشر الاتجاه</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (p.id) onLoadProject(p.id, p.geometryData);
                      }}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
                    >
                      <Eye size={14} />
                      <span>عرض ومخطط القطعة</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (p.id) setProjectToDelete(p.id);
                      }}
                      className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all cursor-pointer shrink-0"
                      title="حذف هذا المشروع"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Overlay */}
      {projectToDelete && (
        <div className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 font-sans text-right" dir="rtl">
          <div className="bg-[#0c0d10] border border-[#27272a] rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <h2 className="text-lg font-bold text-white mb-2">تأكيد عملية الحذف</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              هل أنت متأكد من حذف هذا العمل نهائياً؟ هذا الإجراء فوري وسيتخلص من المخطط من قاعدة البيانات المحلية دون تراجع.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setProjectToDelete(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء الرجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
