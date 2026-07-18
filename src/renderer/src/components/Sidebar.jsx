import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
  DollarSign,
  Settings,
  GraduationCap,
  LogOut,
  User,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Shield,
  Database,
  Key,
  Mail
} from 'lucide-react'
import { useLanguage } from '../i18n'
import logoDark from '../assets/logo_dark.png'
import logoLight from '../assets/logo_light.png'

export default function Sidebar({ user, onLogout, hasUnpaidStudents, hasPendingPayouts, theme }) {
  const { language, t, isRTL } = useLanguage()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  React.useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed)
  }, [isCollapsed])

  const menuItems = [
    { key: 'dashboard', name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { key: 'students', name: 'Students', path: '/students', icon: Users },
    { key: 'teachers', name: 'Teachers', path: '/teachers', icon: UserCheck },
    { key: 'courses', name: 'Courses', path: '/courses', icon: BookOpen },
    { key: 'attendance', name: 'Attendance', path: '/attendance', icon: CalendarCheck },
    { key: 'finances', name: 'Finances', path: '/finances', icon: DollarSign },
    { key: 'communication', name: 'Communication', path: '/communication', icon: Mail },
    { key: 'settings', name: 'Settings', path: '/settings', icon: Settings },
  ]

  const hasPermission = (moduleKey) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    const userPerms = user.permissions || '';
    const permsArr = Array.isArray(userPerms)
      ? userPerms
      : userPerms.split(',').map(s => s.trim());
    if (permsArr.includes(moduleKey)) return true;
    if (permsArr.some(p => p.startsWith(moduleKey + ':'))) return true;
    return false;
  }

  const visibleMenuItems = menuItems.filter(item => hasPermission(item.key))

  const getPermissionsTooltip = () => {
    if (!user) return ''
    if (user.role === 'Admin') return language === 'ar' ? 'صلاحية كاملة (مدير)' : 'All Access (Admin)'
    const list = (user.permissions || '').split(',').map(s => s.trim()).filter(Boolean)
    if (list.length === 0) return language === 'ar' ? 'لا توجد صلاحيات نشطة' : 'No active permissions'
    
    const names = {
      dashboard: language === 'ar' ? 'الرئيسية' : 'Dashboard',
      students: language === 'ar' ? 'الطلاب' : 'Students',
      teachers: language === 'ar' ? 'المدرسين' : 'Teachers',
      courses: language === 'ar' ? 'الدورات' : 'Courses',
      attendance: language === 'ar' ? 'الحضور' : 'Attendance',
      finances: language === 'ar' ? 'المالية' : 'Finances',
      communication: language === 'ar' ? 'التواصل' : 'Communication',
      settings: language === 'ar' ? 'الإعدادات' : 'Settings'
    }
    const readable = list.map(k => names[k] || k).join(', ')
    return `${language === 'ar' ? 'الصلاحيات النشطة:' : 'Active Permissions:'} ${readable}`
  }

  // Determine collapse button title and icon based on RTL direction
  const toggleTitle = isCollapsed 
    ? (language === 'ar' ? 'توسيع القائمة' : 'Expand Sidebar') 
    : (language === 'ar' ? 'طي القائمة' : 'Collapse Sidebar')

  const renderToggleIcon = () => {
    if (isRTL) {
      return isCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
    }
    return isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />
  }

  return (
    <aside className={`no-print relative flex flex-col h-full text-slate-100 select-none transition-all duration-300 ease-in-out bg-slate-950 border-r border-slate-800/60 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="sidebar-toggle-btn absolute top-5 right-[-12px] h-6 w-6 rounded-full bg-slate-900 border border-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-200 shadow-md hover:bg-slate-800 hover:border-slate-700 transition-all z-50 cursor-pointer"
        title={toggleTitle}
      >
        {renderToggleIcon()}
      </button>

      {/* Brand Header */}
      <div className={`h-16 flex items-center border-b border-slate-800/60 gap-3 transition-all duration-300 overflow-hidden ${isCollapsed ? 'px-4 justify-center' : 'px-6'}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="h-10 w-10 flex items-center justify-center shrink-0">
          <img 
            src={theme === 'light' ? logoDark : logoLight} 
            alt="School Logo" 
            className="h-8 w-8 object-contain" 
          />
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in">
            <h1 className="font-bold text-base leading-tight tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">EduManage</h1>
            <span className="text-[10px] text-slate-550 uppercase font-semibold tracking-wider block -mt-0.5">{t('layout.title')}</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {visibleMenuItems.map((item) => {
          const Icon = item.icon
          const translatedName = t('sidebar.' + item.key)
          return (
            <div key={item.key} className="w-full">
              <NavLink
                to={item.path}
                title={isCollapsed ? translatedName : undefined}
                className={({ isActive }) =>
                  `relative flex items-center rounded-xl transition-all duration-200 group border ${
                    isCollapsed ? 'justify-center p-3' : 'gap-3.5 px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/15 to-indigo-600/5 text-blue-400 border-blue-500/20 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                      isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`} />
                    {!isCollapsed && <span className="text-sm animate-fade-in whitespace-nowrap">{translatedName}</span>}
                    {item.key === 'finances' && (hasUnpaidStudents || hasPendingPayouts) && (
                      <span className={`absolute flex h-2.5 w-2.5 ${isCollapsed ? 'top-2 right-2' : 'top-3.5 right-4 rtl:right-auto rtl:left-4'}`}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-950"></span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* User Section / Footer */}
      <div className={`border-t border-slate-800/60 bg-slate-950/50 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 py-3 rounded-xl bg-slate-900/40 border border-slate-800/40" title={getPermissionsTooltip()}>
            <div className="h-9 w-9 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center shrink-0 bg-slate-900">
              {user?.avatar ? (
                <img src={user.avatar} alt="User Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-blue-600/10 text-blue-400">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
              title={t('sidebar.signOut')}
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/40 animate-fade-in" title={getPermissionsTooltip()}>
            <div className="h-9 w-9 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center shrink-0 bg-slate-900">
              {user?.avatar ? (
                <img src={user.avatar} alt="User Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-blue-600/10 text-blue-400">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">{user?.username || 'Ayoub Admin'}</p>
              <p className="text-[10px] text-slate-555 truncate">{user?.role || 'Admin'}</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
              title={t('sidebar.signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

