import React, { lazy, Suspense } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'
import LicenseActivation from './components/LicenseActivation'
import { ipcService } from './services/ipcService'
import { LanguageProvider } from './i18n'

// Lazy loaded page components
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Students = lazy(() => import('./pages/Students'))
const Teachers = lazy(() => import('./pages/Teachers'))
const Courses = lazy(() => import('./pages/Courses'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Finances = lazy(() => import('./pages/Finances'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./components/Login'))

function AppContent() {
  const [licenseValid, setLicenseValid] = React.useState(null)
  const [user, setUser] = React.useState(() => {
    const saved = sessionStorage.getItem('currentUser')
    return saved ? JSON.parse(saved) : null
  })

  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('app-theme') || 'dark'
  })

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    sessionStorage.setItem('currentUser', JSON.stringify(loggedInUser))
  }

  const handleLogout = () => {
    setUser(null)
    sessionStorage.removeItem('currentUser')
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  React.useEffect(() => {
    ipcService.setActiveUser(user)
  }, [user])

  // Manage light-mode class on document.documentElement
  React.useEffect(() => {
    const root = document.documentElement
    if (!user) {
      root.classList.add('transparent-window')
      document.body.classList.add('transparent-window')
    } else {
      root.classList.remove('transparent-window')
      document.body.classList.remove('transparent-window')
    }

    if (theme === 'light') {
      root.classList.add('light-mode')
    } else {
      root.classList.remove('light-mode')
    }
    localStorage.setItem('app-theme', theme)
  }, [theme, user])

  // Manage window size for login/main screen
  React.useEffect(() => {
    if (window.api) {
      if (user) {
        if (window.api.resizeToMain) window.api.resizeToMain()
      } else {
        if (window.api.resizeToLogin) window.api.resizeToLogin()
      }
    }
  }, [user])

  // Perform startup license validation check
  React.useEffect(() => {
    const checkAppLicense = async () => {
      try {
        const res = await ipcService.checkLicense()
        setLicenseValid(res.valid)
      } catch (err) {
        console.error("License check error:", err)
        setLicenseValid(false)
      }
    }
    checkAppLicense()
  }, [])

  const hasPermission = (moduleKey) => {
    if (!user) return false
    if (user.role === 'Admin') return true
    const userPerms = user.permissions || ''
    const permsArr = Array.isArray(userPerms)
      ? userPerms
      : userPerms.split(',').map(s => s.trim());
    if (permsArr.includes(moduleKey)) return true;
    if (permsArr.some(p => p.startsWith(moduleKey + ':'))) return true;
    return false;
  }

  const getFirstAllowedPath = () => {
    if (!user) return '/login'
    if (user.role === 'Admin') return '/'
    const modules = ['dashboard', 'students', 'teachers', 'courses', 'attendance', 'finances', 'settings']
    for (const mod of modules) {
      if (hasPermission(mod)) {
        return mod === 'dashboard' ? '/' : `/${mod}`
      }
    }
    return '/no-access'
  }

  if (licenseValid === null) {
    return <LoadingScreen />
  }

  if (licenseValid === false) {
    return <LicenseActivation onActivated={() => setLicenseValid(true)} theme={theme} toggleTheme={toggleTheme} />
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {!user ? (
          // When logged out, render Login screen for any route
          <Route path="*" element={<Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />} />
        ) : (
          // When logged in, render main layout with pages
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />}>
            <Route index element={
              hasPermission('dashboard') 
                ? <Dashboard /> 
                : <Navigate to={getFirstAllowedPath()} replace />
            } />
            <Route path="students" element={hasPermission('students') ? <Students /> : <Navigate to="/" replace />} />
            <Route path="teachers" element={hasPermission('teachers') ? <Teachers /> : <Navigate to="/" replace />} />
            <Route path="courses" element={hasPermission('courses') ? <Courses /> : <Navigate to="/" replace />} />
            <Route path="attendance" element={hasPermission('attendance') ? <Attendance /> : <Navigate to="/" replace />} />
            <Route path="finances" element={hasPermission('finances') ? <Finances /> : <Navigate to="/" replace />} />
            <Route path="settings" element={hasPermission('settings') ? <Settings currentUser={user} onUserUpdate={handleLogin} /> : <Navigate to="/" replace />} />
            <Route path="no-access" element={
              <div className="flex flex-col items-center justify-center h-[70vh] text-slate-300 p-6 text-center select-none animate-fade-in">
                <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
                <p className="text-xs max-w-sm leading-relaxed text-slate-400 mb-6">
                  You do not have permission to view any modules in this application. Please contact your administrator.
                </p>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            } />
            {/* Redirect any unknown routes to home page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  )
}

export default App