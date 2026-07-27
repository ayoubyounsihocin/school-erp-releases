import React, { useState, useEffect, useRef } from 'react'
import { User, Lock, AlertCircle, RefreshCw, Eye, EyeOff, X, Sun, Moon, Minus, ShieldCheck, CheckCircle2, HelpCircle, Copy, Check } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'

export default function Login({ onLogin, theme, toggleTheme }) {
  const { language, setLanguage, t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [isDefaultAdmin, setIsDefaultAdmin] = useState(false)
  const [isMandatorySetup, setIsMandatorySetup] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Password Reset Modal state
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetData, setResetData] = useState(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // null | 'submitting' | 'success' | 'error'
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  const inputRef = useRef(null)

  // Auto-hide error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error])
  const handleOpenResetModal = async () => {
    setShowResetModal(true)
    setResetLoading(true)
    setSubmitStatus(null)
    setSubmitErrorMsg('')
    setIsApproved(false)
    setRetrievedUsername('')
    setRetrievedPin('')
    try {
      const ticketRes = await ipcService.requestPasswordReset(username)
      if (ticketRes && ticketRes.success) {
        setResetData(ticketRes)
      }
    } catch (err) {
      console.error("Failed to generate reset ticket:", err)
    } finally {
      setResetLoading(false)
    }
  }

  const handleCopyTicket = () => {
    if (!resetData) return
    const textToCopy = `=== SCHOOL ERP PASSWORD RESET TICKET ===\nSystem ID: ${resetData.systemId}\nUsername: ${resetData.username}\nTicket Code: ${resetData.ticketCode}\nTimestamp: ${resetData.timestamp}\n========================================`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleSubmitResetTicket = async () => {
    if (!resetData) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    try {
      const res = await ipcService.submitPasswordResetRequest({
        systemId: resetData.systemId,
        username: resetData.username,
        ticketCode: resetData.ticketCode
      })
      if (res && res.success) {
        setSubmitStatus('success')
      } else {
        setSubmitStatus('error')
        setSubmitErrorMsg(res.error || 'Server error')
      }
    } catch (err) {
      console.error("Failed to submit ticket:", err)
      setSubmitStatus('error')
      setSubmitErrorMsg(err.message || 'Network error')
    }
  }

  // Approval verification states
  const [statusChecking, setStatusChecking] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [retrievedUsername, setRetrievedUsername] = useState('')
  const [retrievedPin, setRetrievedPin] = useState('')

  const handleCheckResetStatus = async (silent = false) => {
    if (!resetData) return
    if (!silent) setStatusChecking(true)
    setSubmitErrorMsg('')
    try {
      const res = await ipcService.checkResetRequestStatus({
        ticketCode: resetData.ticketCode,
        requestedUsername: resetData.username
      })
      if (res && res.approved) {
        setIsApproved(true)
        setRetrievedUsername(res.tempUsername)
        setRetrievedPin(res.tempPin)
      } else if (res && res.error) {
        if (!silent) {
          setSubmitStatus('error')
          setSubmitErrorMsg(res.error)
        }
      }
    } catch (err) {
      console.error("Failed to verify status:", err)
      if (!silent) {
        setSubmitStatus('error')
        setSubmitErrorMsg(err.message || 'Connection failed')
      }
    } finally {
      if (!silent) setStatusChecking(false)
    }
  }

  // Auto-polling status check hook
  useEffect(() => {
    let intervalId = null;
    if (showResetModal && submitStatus === 'success' && !isApproved && resetData) {
      // Poll every 7 seconds silently
      intervalId = setInterval(() => {
        handleCheckResetStatus(true);
      }, 7000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showResetModal, submitStatus, isApproved, resetData]);

  useEffect(() => {
    let isMounted = true;
    ipcService.checkUserSetup().then(res => {
      if (!isMounted) return;
      if (res && res.needsSetup) {
        setIsSetupMode(true);
        setIsMandatorySetup(true);
      } else if (res && res.isDefaultAdmin) {
        setIsDefaultAdmin(true);
      }
    }).catch(err => {
      console.error("Failed to check user setup status:", err);
    });
    return () => { isMounted = false; };
  }, [])

  useEffect(() => {
    // Force browser-level focus on username input box on screen load or mode switch
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 200)
  }, [isSetupMode])

  const handleLoginSubmit = async (e) => {
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
          setError(res.error === 'Invalid username or password.' ? t('login.errorInvalid') : res.error)
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

  const handleSetupSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError(t('login.errorFields'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('login.passwordMismatch'))
      return
    }

    if (password.length < 4) {
      setError(t('login.passwordMinLength'))
      return
    }

    setLoading(true)
    setError('')
    try {
      if (window.api) {
        const res = await ipcService.setupInitialAdmin({ username: username.trim(), password })
        if (res && res.error) {
          setError(res.error)
        } else if (res) {
          onLogin(res)
        }
      } else {
        // Fallback for standalone web view testing
        onLogin({ id: 1, username: username.trim(), role: 'Admin' })
      }
    } catch (err) {
      console.error('Setup error:', err)
      setError(t('login.errorConnection'))
    } finally {
      setLoading(false)
    }
  }

  const isRtl = language === 'ar';

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
      <div className="w-full max-w-md p-6 sm:p-8 bg-slate-955 dark:bg-transparent rounded-3xl relative z-10 animate-fade-in-up">

        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-4" dir={isRtl ? 'rtl' : 'ltr'}>
          {isSetupMode ? (
            <div className="h-10 w-10 bg-blue-600/15 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-1">
              <ShieldCheck className="h-5 w-5" />
            </div>
          ) : null}
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${
              theme === 'light' ? 'text-black' : 'text-white'
            }`}>
              {isSetupMode ? t('login.setupTitle') : t('login.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium max-w-xs mx-auto">
              {isSetupMode ? t('login.setupSubtitle') : t('login.subtitle')}
            </p>
          </div>
        </div>



        {/* Form */}
        <form onSubmit={isSetupMode ? handleSetupSubmit : handleLoginSubmit} className="space-y-3.5 mt-4" dir={isRtl ? 'rtl' : 'ltr'}>
          {/* Username */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-455 uppercase font-semibold tracking-wider px-1">{t('common.username')}</label>
            <div className="relative">
              <User className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder')}
                disabled={loading}
                className={`w-full ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-2 bg-slate-955/60 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors`}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] text-slate-455 uppercase font-semibold tracking-wider">{t('common.password')}</label>
            </div>
            <div className="relative">
              <Lock className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={loading}
                className={`w-full ${isRtl ? 'pr-11 pl-11' : 'pl-11 pr-11'} py-2 bg-slate-955/60 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors`}
                autoComplete={isSetupMode ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isRtl ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer`}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Only in Setup Mode) */}
          {isSetupMode && (
            <div className="flex flex-col gap-1 animate-fade-in">
              <label className="text-[10px] text-slate-455 uppercase font-semibold tracking-wider px-1">{t('login.confirmPassword')}</label>
              <div className="relative">
                <CheckCircle2 className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('login.confirmPasswordPlaceholder')}
                  disabled={loading}
                  className={`w-full ${isRtl ? 'pr-11 pl-11' : 'pl-11 pr-11'} py-2 bg-slate-955/60 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute ${isRtl ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer`}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-550 text-white text-xs font-semibold rounded-xl tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isSetupMode ? (
              t('login.createAdminBtn')
            ) : (
              t('login.signIn')
            )}
          </button>
        </form>

        {/* Setup Toggle Links */}
        {!isMandatorySetup && (
          <div className="mt-3.5 text-center">
            {isSetupMode ? (
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setIsSetupMode(false)
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer"
              >
                {t('login.switchToLogin')}
              </button>
            ) : isDefaultAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setIsSetupMode(true)
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                {t('login.switchToSetup')}
              </button>
            ) : null}
          </div>
        )}

        {/* Forgot Credentials Link */}
        {!isSetupMode && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={handleOpenResetModal}
              className="text-[11.5px] text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 mx-auto"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t('login.forgotCredentials')}
            </button>
          </div>
        )}

        {/* Footer info note */}
        <div className="text-center pt-3">
          <p className="text-[10px] text-slate-505 font-mono">{t('login.version')}</p>
        </div>
      </div>

      {/* Account Recovery & Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('login.resetModalTitle')}</h3>
                  <p className="text-[11px] text-slate-400">{t('login.resetModalSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="h-7 w-7 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-850">
              {t('login.resetInstructions')}
            </p>

            {resetLoading ? (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
                <span className="text-xs text-slate-400">Generating secure ticket...</span>
              </div>
            ) : resetData ? (
              <div className="space-y-3 pt-1">
                {isApproved ? (
                  <div className="space-y-3 animate-fade-in">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{t('login.approvedSuccess')}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-955/60 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">{t('login.tempUsernameLabel')}</span>
                        <span className="text-slate-200 font-mono font-bold truncate block select-text">{retrievedUsername}</span>
                      </div>
                      <div className="p-2.5 bg-slate-955/60 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">{t('login.tempPasswordLabel')}</span>
                        <span className="text-slate-200 font-mono font-bold truncate block select-text">{retrievedPin}</span>
                      </div>
                    </div>

                    <p className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
                      {t('login.savedLocallyMsg')}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* System ID & Username */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-955/60 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">{t('login.systemId')}</span>
                        <span className="text-slate-200 font-mono font-bold truncate block">{resetData.systemId}</span>
                      </div>
                      <div className="p-2.5 bg-slate-955/60 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">{t('common.username')}</span>
                        <span className="text-slate-200 font-bold truncate block">{resetData.username}</span>
                      </div>
                    </div>

                    {/* Ticket Code */}
                    <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider block">{t('login.ticketCode')}</span>
                        <span className="text-sm font-mono font-bold text-blue-200">{resetData.ticketCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyTicket}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? t('login.ticketCopied') : t('login.copyTicket')}
                      </button>
                    </div>

                    {/* Submit to Web Portal Button */}
                    <button
                      type="button"
                      disabled={submitStatus === 'submitting' || submitStatus === 'success'}
                      onClick={handleSubmitResetTicket}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        submitStatus === 'success'
                          ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default'
                          : submitStatus === 'submitting'
                          ? 'bg-blue-600/50 text-white cursor-wait'
                          : 'bg-blue-600 hover:bg-blue-550 text-white shadow-lg shadow-blue-500/10'
                      }`}
                    >
                      {submitStatus === 'submitting' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          {t('login.submitting')}
                        </>
                      ) : submitStatus === 'success' ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-400" />
                          {t('login.submitSuccess')}
                        </>
                      ) : (
                        t('login.submitPortalBtn')
                      )}
                    </button>

                    {/* Check Status Button (Only shown after successful submission) */}
                    {submitStatus === 'success' && (
                      <div className="space-y-2.5 w-full">
                        {/* Auto-checking pulse indicator */}
                        <div className="p-3 bg-indigo-550/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center gap-2.5 text-xs animate-pulse font-medium">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>{t('login.waitingApproval')}</span>
                        </div>

                        <button
                          type="button"
                          disabled={statusChecking}
                          onClick={() => handleCheckResetStatus(false)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 transition-all cursor-pointer animate-fade-in"
                        >
                          {statusChecking ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {t('login.checkingStatus')}
                            </>
                          ) : (
                            t('login.checkStatusBtn')
                          )}
                        </button>
                      </div>
                    )}

                    {/* Submit Status Alerts */}
                    {submitStatus === 'error' && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-2.5 text-xs animate-fade-in">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium">{t('login.submitError')}</span>
                          {submitErrorMsg && (
                            <p className="mt-1 text-[10px] font-mono text-rose-500/80 leading-normal">{submitErrorMsg}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{t('login.contactAdminHelp')}</span>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t('login.closeModal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Error Toast */}
      {error && (
        <div 
          className="absolute top-14 sm:top-15 inset-x-0 mx-auto z-[100] w-max min-w-[280px] max-w-[90vw] p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shadow-xl flex items-center gap-3 text-xs animate-fade-in" 
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-start">{error}</span>
        </div>
      )}
    </div>
  )
}
