import React, { useState } from 'react'
import { User, Lock, AlertCircle, RefreshCw, Eye, EyeOff, X, Sun, Moon, Minus } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'

export default function Login({ onLogin, theme, toggleTheme }) {
  const { language, setLanguage, t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputRef = React.useRef(null)

  React.useEffect(() => {
    // Force browser-level focus on username input box on screen load
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 200)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError(t('login.errorFields'))
      return
    }

    setLoading(true)
    setError('')
    try {
      if (window.api) {
        const res = await ipcService.login(username, password)
        if (res && res.error) {
          setError(res.error)
        } else if (res) {
          onLogin(res)
        } else {
          setError(t('login.errorInvalid'))
        }
      } else {
        // Fallback for standalone web view testing
        if (username === 'admin' && password === 'admin') {
          onLogin({ id: 1, username: 'admin', role: 'Admin' })
        } else {
          setError(t('login.mockSupport'))
        }
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(t('login.errorConnection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative h-full w-full flex items-center justify-center bg-transparent overflow-hidden select-none" dir="ltr">
        {/* Top-Left Controls: Language & Theme */}
        <div className="absolute top-4 left-5 flex items-center gap-2 z-20">
          {/* Language Switch Button */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="h-8 px-3 bg-slate-955/40 dark:bg-slate-900/40 border border-slate-850/65 dark:border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center font-bold text-xs"
            title={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
          >
            {language === 'en' ? 'العربية' : 'EN'}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="h-8 w-8 bg-slate-955/40 dark:bg-slate-900/40 border border-slate-850/65 dark:border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>

        {/* Top-Right Controls: Minimize & Close */}
        <div className="absolute top-4 right-5 flex items-center gap-2 z-20">
          {/* Minimize Button */}
          <button
            type="button"
            onClick={() => window.api && window.api.minimizeWindow()}
            className="h-8 w-8 bg-slate-955/40 dark:bg-slate-900/40 border border-slate-850/65 dark:border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center"
            title={language === 'ar' ? 'تصغير' : 'Minimize'}
          >
            <Minus className="h-4 w-4" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => window.api && window.api.closeWindow()}
            className="h-8 w-8 bg-slate-955/40 dark:bg-slate-900/40 border border-slate-850/65 dark:border-slate-800/60 rounded-xl text-slate-400 hover:text-rose-550 transition-colors cursor-pointer flex items-center justify-center"
            title={t('common.close') || 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      {/* Login Card Wrapper */}
      <div className="w-full max-w-md p-8 bg-slate-955 dark:bg-transparent rounded-3xl relative z-10 animate-fade-in-up">

        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${
              theme === 'light' ? 'text-black' : 'text-white'
            }`}>
              {t('login.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">{t('login.subtitle')}</p>
          </div>
        </div>

        {/* Error Alert Panel */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3 text-xs animate-fade-in mt-4">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-455 uppercase font-semibold tracking-wider px-1">{t('common.username')}</label>
            <div className="relative">
              <User className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder')}
                disabled={loading}
                className={`w-full ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-2.5 bg-slate-955/60 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors`}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-455 uppercase font-semibold tracking-wider px-1">{t('common.password')}</label>
            <div className="relative">
              <Lock className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={loading}
                className={`w-full ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} py-2.5 bg-slate-955/60 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${language === 'ar' ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer`}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-550 text-white text-xs font-semibold rounded-xl tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              t('login.signIn')
            )}
          </button>
        </form>

        {/* Footer info note */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-500">{t('login.version')}</p>
        </div>
      </div>
    </div>
  )
}
