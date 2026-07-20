import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, GraduationCap, BookOpen, Settings, X, CornerDownLeft, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n';
import { ipcService } from '../services/ipcService';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommandPalette({ isOpen, onClose }) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Data sets
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);

  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Load datasets on mount / open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      loadDatasets();
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const [stdList, tchList, crsList] = await Promise.all([
        ipcService.getStudents(),
        ipcService.getTeachers(),
        ipcService.getCourses()
      ]);
      setStudents(stdList || []);
      setTeachers(tchList || []);
      setCourses(crsList || []);
    } catch (error) {
      console.error("Failed to load command palette index:", error);
    } finally {
      setLoading(false);
    }
  };

  // Static list of pages/routes
  const getPages = () => [
    { id: 'page-dashboard', name: t('sidebar.dashboard') || 'Dashboard', category: 'Pages', route: '/', icon: Settings },
    { id: 'page-students', name: t('sidebar.students') || 'Students Directory', category: 'Pages', route: '/students', icon: Users },
    { id: 'page-teachers', name: t('sidebar.teachers') || 'Teachers Directory', category: 'Pages', route: '/teachers', icon: GraduationCap },
    { id: 'page-courses', name: t('sidebar.courses') || 'Courses & Timetables', category: 'Pages', route: '/courses', icon: BookOpen },
    { id: 'page-finances', name: t('sidebar.finances') || 'Financial Registry', category: 'Pages', route: '/finances', icon: Settings },
    { id: 'page-communication', name: language === 'ar' ? 'التواصل والبريد' : 'Communication Composer', category: 'Pages', route: '/communication', icon: Settings },
    { id: 'page-settings', name: t('sidebar.settings') || 'System Configurations', category: 'Pages', route: '/settings', icon: Settings }
  ];

  // Perform search matching
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim().toLowerCase();
    const pages = getPages();

    if (!trimmed) {
      // Show default pages and shortcuts when empty
      setResults(pages.slice(0, 5));
      setSelectedIndex(0);
      return;
    }

    const filteredPages = pages.filter(p => p.name.toLowerCase().includes(trimmed));
    
    const filteredStudents = students
      .filter(s => s.full_name.toLowerCase().includes(trimmed) || (s.phone && s.phone.includes(trimmed)))
      .slice(0, 5)
      .map(s => ({
        id: `std-${s.id}`,
        name: s.full_name,
        subtitle: `${s.grade_level} • ${s.phone || 'No phone'}`,
        category: language === 'ar' ? 'الطلاب' : 'Students',
        action: () => navigate('/students', { state: { selectedStudentId: s.id } }),
        icon: Users
      }));

    const filteredTeachers = teachers
      .filter(t => t.full_name.toLowerCase().includes(trimmed) || (t.specialty && t.specialty.toLowerCase().includes(trimmed)))
      .slice(0, 5)
      .map(t => ({
        id: `tch-${t.id}`,
        name: t.full_name,
        subtitle: t.specialty || 'Instructor',
        category: language === 'ar' ? 'الأساتذة' : 'Teachers',
        action: () => navigate('/teachers', { state: { selectedTeacherId: t.id } }),
        icon: GraduationCap
      }));

    const filteredCourses = courses
      .filter(c => c.title.toLowerCase().includes(trimmed))
      .slice(0, 5)
      .map(c => ({
        id: `crs-${c.id}`,
        name: c.title,
        subtitle: `${c.price} DA`,
        category: language === 'ar' ? 'الدورات' : 'Courses',
        action: () => navigate('/courses', { state: { selectedCourseId: c.id } }),
        icon: BookOpen
      }));

    const searchResults = [
      ...filteredPages.map(p => ({
        id: p.id,
        name: p.name,
        subtitle: 'Navigation Link',
        category: language === 'ar' ? 'صفحات النظام' : 'System Pages',
        action: () => navigate(p.route),
        icon: p.icon
      })),
      ...filteredStudents,
      ...filteredTeachers,
      ...filteredCourses
    ];

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, students, teachers, courses, isOpen]);

  // Keyboard navigation listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          triggerAction(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Auto-scroll list when navigating with arrows
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.children[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const triggerAction = (item) => {
    if (item.action) {
      item.action();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh] px-4">
          {/* Overlay Background */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md font-sans text-start"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Search Input Box */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/80 bg-slate-955/40 relative">
              <Search className="h-5 w-5 text-slate-450 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن طالب، مدرس، دورة، أو صفحة...' : 'Search students, teachers, courses, settings...'}
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button 
                onClick={onClose}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results Box */}
            <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin space-y-1.5" ref={resultsContainerRef}>
              {loading && results.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  {language === 'ar' ? 'جاري التحميل...' : 'Searching directories...'}
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-550 italic">
                  {language === 'ar' ? 'لم يتم العثور على نتائج' : 'No records or commands matched your search.'}
                </div>
              ) : (
                // Group by category visually
                results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = item.icon || Search;
                  
                  // Show category header when it changes
                  const showHeader = idx === 0 || results[idx - 1].category !== item.category;

                  return (
                    <React.Fragment key={item.id}>
                      {showHeader && (
                        <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-bold text-slate-500 uppercase tracking-wider select-none">
                          {item.category}
                        </div>
                      )}
                      <div
                        onClick={() => triggerAction(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                          isSelected 
                            ? 'bg-blue-600/10 border-blue-500/20 text-white' 
                            : 'bg-transparent border-transparent text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg border ${isSelected ? 'bg-blue-500/15 border-blue-500/25 text-blue-400' : 'bg-slate-950/40 border-slate-800/40 text-slate-400'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-bold truncate leading-snug">{item.name}</p>
                            {item.subtitle && (
                              <p className="text-[9.5px] text-slate-450 truncate mt-0.5 leading-none">{item.subtitle}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Selector indicator */}
                        {isSelected && (
                          <span className="text-[9px] bg-slate-950/60 border border-slate-800 text-slate-450 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono tracking-tighter">
                            <span>Enter</span>
                            <CornerDownLeft className="h-2 w-2" />
                          </span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Bottom Command Guide */}
            <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-[9.5px] text-slate-500 select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="border border-slate-800 bg-slate-900 px-1 rounded">↑↓</span> {language === 'ar' ? 'للتنقل' : 'to navigate'}</span>
                <span className="flex items-center gap-1"><span className="border border-slate-800 bg-slate-900 px-1.5 rounded">Enter</span> {language === 'ar' ? 'للاختيار' : 'to select'}</span>
                <span className="flex items-center gap-1"><span className="border border-slate-800 bg-slate-900 px-1.5 rounded">Esc</span> {language === 'ar' ? 'للإغلاق' : 'to close'}</span>
              </div>
              <div className="font-semibold text-blue-500 flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                <span>Quick Jump Palette</span>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
