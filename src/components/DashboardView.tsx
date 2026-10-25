import React, { useState, useMemo } from 'react';
import { useProfiles } from '../hooks/useProfiles';
import { ProfileDetails } from './ProfileDetails';
import { MonitorPlay, Box, Search, Star, Eye, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import InteractiveDocumentation from './InteractiveDocumentation';

// Constant engineering icons styled with precision
export const TubeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <ellipse cx="12" cy="12" rx="9" ry="3" strokeDasharray="3, 3" />
  </svg>
);

export const PanIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="8" rx="8" ry="3.5" />
    <path d="M4 8v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5V8" />
    <path d="M22 8h-2" />
    <path d="M4 8H2" />
  </svg>
);

export const HandleIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="7" y="2" width="10" height="20" rx="3" />
    <path d="M12 6V18" />
    <circle cx="12" cy="6" r="1.2" fill="currentColor" />
    <circle cx="12" cy="18" r="1.2" fill="currentColor" />
  </svg>
);

interface DashboardViewProps {
  onNewPart: () => void;
  onLoadSTL: (buffer: ArrayBuffer, name: string) => void;
  onLoadConfig: () => void;
  hasSavedConfig: boolean;
  onOpenViewer: () => void;
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  onLoadProfile?: (type: 'tube' | 'pan' | 'handle', data: any, name: string) => void;
  onPreviewProfile?: (profile: any) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  onNewPart,
  onLoadSTL,
  onLoadConfig,
  hasSavedConfig,
  onOpenViewer,
  showLibrary,
  setShowLibrary,
  showHelp,
  setShowHelp,
  onLoadProfile,
  onPreviewProfile,
}) => {
  const { profiles, deleteProfile, toggleProfileFavorite } = useProfiles();
  const [selectedType, setSelectedType] = useState<'tube' | 'pan' | 'handle'>('tube');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);

  if (showHelp) {
    return (
      <div className="absolute inset-0 bg-[#09090b] z-50 overflow-y-auto font-sans flex flex-col" dir="rtl">
        <header className="sticky top-0 z-40 bg-[#0c0d10] border-b border-[#27272a] pt-4 pb-4 px-6 flex justify-between items-center shadow-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHelp(false)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/40 border border-[#27272a] hover:bg-white/5 hover:border-[var(--accent)] text-zinc-400 hover:text-[var(--accent)] transition-all cursor-pointer"
              title="العودة للمنصة الرئيسية"
            >
              <ArrowRight size={20} />
            </button>
            <h2 className="text-xl font-bold text-white tracking-widest">المساعدة والتوثيق</h2>
          </div>
        </header>
        <div className="flex-1 p-6">
          <InteractiveDocumentation />
        </div>
      </div>
    );
  }

  if (showLibrary) {
    const searchLower = searchQuery.toLowerCase();
    
    // Search across all types if there is a query or favorite filter, else just current tab
    const filteredProfiles = profiles.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchLower) || p.id.toLowerCase().includes(searchLower);
      const matchFavorite = filterFavorites ? p.isFavorite : true;
      const matchType = (searchQuery.length > 0 || filterFavorites) ? true : p.type === selectedType;
      
      return matchSearch && matchFavorite && matchType;
    });
    
    const parametricProfiles = filteredProfiles.filter(p => !p.data?.isUnique);
    const uniqueProfiles = filteredProfiles.filter(p => p.data?.isUnique);

    // إحصائيات سريعة للوحة
    const stats = {
      tube: profiles.filter(p => p.type === 'tube').length,
      pan: profiles.filter(p => p.type === 'pan').length,
      handle: profiles.filter(p => p.type === 'handle').length,
      favorites: profiles.filter(p => p.isFavorite).length,
    };

    const renderProfileCard = (p: typeof profiles[0]) => (
      <div 
        key={p.id} 
        className="group relative bg-[#0c0d10] border border-[#27272a] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] shadow-lg"
        dir="rtl"
      >
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${
          p.type === 'tube' ? 'from-cyan-500/10 to-transparent' : 
          p.type === 'pan' ? 'from-blue-500/10 to-transparent' : 
          'from-amber-500/10 to-transparent'
        }`} />

        <div className="relative p-5 z-10 h-full flex flex-col">
          <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center border ${p.data?.isUnique ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[#27272a] text-[#a1a1aa]'} shrink-0`}>
                  {p.data?.isUnique ? (
                    <Box size={16} />
                  ) : p.type === 'tube' ? (
                    <TubeIcon className="w-5 h-5" />
                  ) : p.type === 'pan' ? (
                    <PanIcon className="w-5 h-5" />
                  ) : (
                    <HandleIcon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-100 group-hover:text-[var(--accent)] transition-colors line-clamp-1">{p.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-black/40 border border-[#27272a] text-[var(--text-dim)] font-mono tracking-wider">
                      {p.id.split('-')[0]}
                    </span>
                    <span className="text-[9px] text-[var(--text-dim)] font-mono">
                      {new Date(p.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* أزرار العمليات السريعة (المفضلة وغيرها) */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => toggleProfileFavorite(p.id, !p.isFavorite)}
                className={`p-1.5 rounded-lg border transition-all ${
                  p.isFavorite 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-500 hover:bg-amber-500/30' 
                    : 'bg-black/40 border-[#27272a] text-zinc-500 hover:text-amber-500 hover:border-amber-500/30'
                }`}
                title={p.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              >
                <Star size={14} className={p.isFavorite ? "fill-amber-500" : ""} />
              </button>
            </div>
          </div>

          <div className="flex-1 mb-4 select-none">
            <ProfileDetails profile={p} />
          </div>

          <div className="flex items-center gap-2">
            <button 
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.25)]"
              title="تفعيل معايير وأبعاد النموذج"
              onClick={() => {
                if (onLoadProfile) {
                  onLoadProfile(p.type, p.data, p.name);
                } else {
                  console.log(`سيتم تطبيق معايير ${p.name} بالمشروع!`);
                }
              }}
            >
              <CheckCircle2 size={14} />
              <span>تفعيل بالمشروع</span>
            </button>
            
            <button 
              className="px-3 py-2 rounded-lg bg-black/60 hover:bg-white/10 text-zinc-300 border border-[#27272a] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="معاينة النموذج في بيئة 3D"
              onClick={() => {
                if (onPreviewProfile) onPreviewProfile(p);
              }}
            >
              <Eye size={14} />
            </button>
            
            <button 
              className="px-3 py-2 rounded-lg bg-black/60 hover:bg-white/10 text-zinc-300 border border-[#27272a] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="إضافة وتكرار"
              onClick={() => console.log("Adding/Duplicating model", p.id)}
            >
              <Plus size={14} />
            </button>

            <button 
              onClick={() => deleteProfile(p.id)}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all cursor-pointer shrink-0"
              title="حذف من المكتبة"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="absolute inset-0 bg-[#09090b] z-50 overflow-y-auto font-sans flex flex-col" dir="rtl">
        {/* Header Section */}
        <header className="sticky top-0 z-40 bg-[#0c0d10] border-b border-[#27272a] pt-4 pb-4 px-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => setShowLibrary(false)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/40 border border-[#27272a] hover:bg-white/5 hover:border-[var(--accent)] text-zinc-400 hover:text-[var(--accent)] transition-all cursor-pointer shrink-0"
              title="العودة للمنصة الرئيسية"
            >
              <ArrowRight size={20} />
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest flex items-center gap-2">
                مكتبة النماذج الهندسية
              </h2>
              <p className="text-[10px] text-[var(--accent)] font-mono mt-0.5 tracking-wider uppercase">
                Database // Repository Active
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input 
                type="text"
                placeholder="بحث في جميع النماذج..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-[#27272a] rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
              />
              <Search className="absolute right-3.5 top-1.5 w-4 h-4 text-zinc-500 pointer-events-none mt-1" />
            </div>
            
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all h-full ${
                filterFavorites 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' 
                  : 'bg-black/40 border-[#27272a] text-zinc-400 hover:text-amber-500 hover:border-white/10'
              }`}
            >
              <Star size={14} className={filterFavorites ? "fill-amber-500" : ""} />
              <span className="hidden sm:inline">المفضلة</span>
              <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded-md font-mono">{stats.favorites}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 w-full flex flex-col p-6 lg:px-10 xl:px-16 gap-8">
          
          {/* Advanced Filter Tabs */}
          {(!searchQuery && !filterFavorites) && (
            <div className="flex justify-center">
              <div className="inline-flex items-center p-1.5 bg-[#0c0d10] border border-[#27272a] rounded-2xl shadow-lg gap-1.5">
                {[
                  { id: 'tube', label: 'الأنابيب الهيكلية', count: stats.tube, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
                  { id: 'pan', label: 'المقالي المعدنية', count: stats.pan, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
                  { id: 'handle', label: 'المقابض التقنية', count: stats.handle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' }
                ].map(tab => {
                  const isActive = selectedType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedType(tab.id as any)}
                      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 overflow-hidden ${
                        isActive 
                          ? `${tab.bg} text-white border border-[var(--accent)]/50 shadow-inner bg-white/5` 
                          : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {tab.id === 'tube' && <TubeIcon className="w-4 h-4" />}
                        {tab.id === 'pan' && <PanIcon className="w-4 h-4" />}
                        {tab.id === 'handle' && <HandleIcon className="w-4 h-4" />}
                        <span>{tab.label}</span>
                      </span>
                      <span className={`relative z-10 px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-[var(--accent)]/30 text-[var(--accent)]' : 'bg-black/50'} font-mono`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results Summary if Searching */}
          {(searchQuery || filterFavorites) && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <span>نتائج البحث عن:</span>
              {searchQuery && <span className="font-bold text-white px-2 py-0.5 rounded-md bg-white/5 border border-white/10">{searchQuery}</span>}
              {filterFavorites && <span className="font-bold text-amber-500 flex items-center gap-1"><Star size={14} className="fill-amber-500" /> المفضلة</span>}
              <span className="text-xs font-mono ml-auto">({filteredProfiles.length} نتيجة)</span>
            </div>
          )}

          {/* أقسام الفهارس المصنفة */}
          <div className="flex flex-col gap-10 pb-12 w-full text-right h-full">
            {/* القسم الأول: النماذج البارامترية القياسية */}
            {parametricProfiles.length > 0 || (!searchQuery && !filterFavorites) ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 text-right border-r-2 border-[var(--border)] pr-3.5">
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center justify-start gap-2">
                    <MonitorPlay size={16} className="text-[var(--text-dim)]" /> النماذج البارامترية القياسية (Parametric Designs)
                  </h3>
                  <p className="text-[10px] text-[var(--text-dim)]">التصاميم الهندسية المعالجة بارامترية وقابلة للتخصيص الفوري في المنصة.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {parametricProfiles.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-10 bg-[#0c0d10] border border-[#27272a] rounded-2xl border-dashed">
                      <span className="text-[10.5px] text-zinc-500">لا توجد نماذج ميكانيكية بارامترية مسجلة.</span>
                    </div>
                  ) : (
                    parametricProfiles.map(p => renderProfileCard(p))
                  )}
                </div>
              </div>
            ) : null}

            {/* القسم الثاني: النماذج الميكانيكية الفريدة */}
            {uniqueProfiles.length > 0 || (!searchQuery && !filterFavorites) ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 text-right border-r-2 border-[var(--accent)] pr-3.5">
                  <div className="flex justify-between items-center w-full flex-row-reverse">
                    <span className="text-[8px] bg-black/40 text-[var(--accent)] px-2 py-0.5 rounded font-mono font-bold border border-white/5">IMPORTED 3D MESH</span>
                    <h3 className="text-sm font-bold text-zinc-200 flex items-center justify-start gap-2">
                      <Box className="text-[var(--accent)]" size={16} /> النماذج الميكانيكية الفريدة (Unique Models)
                    </h3>
                  </div>
                  <p className="text-[10px] text-[var(--text-dim)]">النماذج المستوردة والمسجلة من المعاينة ثلاثية الأبعاد والتي تحمل فلسفة تعشييق ميكانيكية دقيقة.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {uniqueProfiles.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-[#0c0d10] border border-[#27272a] rounded-2xl border-dashed" dir="rtl">
                      <div className="w-10 h-10 mb-3 text-[var(--text-dim)] opacity-50 flex items-center justify-center bg-white/5 rounded-full">
                        <Box size={20} />
                      </div>
                      <span className="text-[11px] text-zinc-300 font-bold mb-1">لا توجد نماذج فريدة في هذا التصنيف بعد</span>
                      <p className="text-[9px] text-[var(--text-dim)] leading-relaxed max-w-sm text-center">قم باستيراد ملف من بيئة العرض 3D، حدد الوجه المرجعي (الوجه A)، واضغط على "حفظ كنموذج فريد" ليظهر هنا ويمكن مزامنته مع مشروعك.</p>
                    </div>
                  ) : (
                    uniqueProfiles.map(p => renderProfileCard(p))
                  )}
                </div>
              </div>
            ) : null}
            
            {filteredProfiles.length === 0 && (searchQuery || filterFavorites) && (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                <div className="w-16 h-16 rounded-full bg-[#0c0d10] border border-[#27272a] flex items-center justify-center mb-4">
                  <Search size={24} className="text-zinc-600" />
                </div>
                <h3 className="text-sm font-bold text-zinc-300">لا توجد نتائج مطابقة</h3>
                <p className="text-[10px] text-zinc-500 mt-1">جرّب استخدام كلمات بحث مختلفة أو قم بإلغاء فلتر المفضلة.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-view" id="dashboard-view">
      <div className="dashboard-glow" />

      {/* Logo */}
      <div className="dashboard-logo-section">
        <div className="dashboard-logo-wrapper splash-logo-container scale-[0.6] mb-0" id="dashboard-3d-logo">
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
        <h1 className="dashboard-title">MecaFlow-CAD</h1>
        <p className="dashboard-subtitle">نظام القطع بالليزر بتطابق صفري</p>
        <p className="dashboard-version">ZERO-GAP LASER SYSTEM v2.3</p>
      </div>

      {/* Cards */}
      <div className="dashboard-cards flex-wrap justify-center max-w-4xl max-w-[800px] gap-6">
        {/* New Part */}
        <button className="dashboard-card card-upload" onClick={onNewPart}>
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h3 className="card-title">قطعة جديدة</h3>
          <p className="card-desc">تصميم أنبوب ومقلاة ومقبض من الصفر</p>
        </button>

        {/* Load Saved */}
        <button
          className={`dashboard-card card-previous ${!hasSavedConfig ? 'disabled opacity-50' : ''}`}
          onClick={onLoadConfig}
          disabled={!hasSavedConfig}
        >
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="card-title">العمل السابق</h3>
          <p className="card-desc">
            {hasSavedConfig
              ? 'متابعة آخر مساحة عمل'
              : 'لا يوجد عمل سابق'}
          </p>
        </button>

        {/* Profiles Library */}
        <button className="dashboard-card card-saved" onClick={() => setShowLibrary(true)}>
          <div className="card-icon !bg-[var(--accent)]/10 !text-[var(--accent)] !border-[var(--accent)]/30">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </div>
          <h3 className="card-title">مكتبة النماذج</h3>
          <p className="card-desc">تصفح الأنابيب، المقالي، والمقابض المحفوظة</p>
        </button>

        {/* Help */}
        <button className="dashboard-card card-saved" onClick={() => setShowHelp(true)}>
          <div className="card-icon !bg-zinc-500/10 !text-zinc-500 !border-zinc-500/30">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="card-title">المساعدة والتوثيق</h3>
          <p className="card-desc">تعرف على أساسيات النظام ومبادئ التصميم</p>
        </button>

        {/* File Viewer */}
        <button className="dashboard-card card-upload" onClick={onOpenViewer}>
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h3 className="card-title">معاينة الملفات 3D</h3>
          <p className="card-desc">رفع ملفات STL وعرضها في بيئة ثلاثية الأبعاد</p>
        </button>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <span>CIOB Engineering</span>
        <span>·</span>
        <span>MecaFlow-CAD v2.3</span>
        <span>·</span>
        <span>Zero-Gap Laser Technology</span>
      </div>
    </div>
  );
};

export default DashboardView;

