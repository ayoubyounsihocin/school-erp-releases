import React, { useState, useRef, useEffect } from 'react'
import { Key, Lock, RefreshCw, AlertTriangle, CheckCircle2, Database, Trash2, ArrowLeft, Sun, Moon, X, Minus } from 'lucide-react'
import { ipcService } from '../services/ipcService'
import { useLanguage } from '../i18n'

export default function LicenseActivation({ onActivated, theme, toggleTheme }) {
  const { language, setLanguage, t } = useLanguage()
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' }) // type: 'success' | 'error'

  const inputRef = useRef(null)

  useEffect(() => {
    // Autofocus license key textarea on mount
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 200)
  }, [])

  // Safety confirmation states
  const [showWipeConfirm, setShowWipeConfirm] = useState(false)
  const [confirmationDetails, setConfirmationDetails] = useState(null) // { oldHolder, newHolder, keyStr }
  const [wipeOption, setWipeOption] = useState('keep') // 'keep' | 'wipe'
  const [wipeTextInput, setWipeTextInput] = useState('')

  const isRTL = language === 'ar'

  const handleActivate = async (e) => {
    e.preventDefault()
    if (!licenseKey.trim()) return

    setLoading(true)
    setStatus({ type: '', message: '' })

    try {
      const res = await ipcService.activateLicense(licenseKey.trim())
      if (res.success) {
        if (res.differentHolder) {
          // Different school holder name detected! Show confirmation step
          setConfirmationDetails({
            oldHolder: res.oldHolder,
            newHolder: res.newHolder,
            keyStr: res.keyStr
          })
          setShowWipeConfirm(true)
        } else {
          // Normal activation successful
          setStatus({
            type: 'success',
            message: language === 'ar' 
              ? 'تم تفعيل الترخيص بنجاح! يتم الآن إعادة تحميل التطبيق...' 
              : 'License activated successfully! Reloading application...'
          })
          setTimeout(() => {
            onActivated()
          }, 1500)
        }
      } else {
        // Map common errors for localized display
        let errorMsg = res.error
        if (res.error.includes('expired')) {
          const dateMatch = res.error.match(/\d{4}-\d{2}-\d{2}/)
          const dateStr = dateMatch ? dateMatch[0] : ''
          errorMsg = language === 'ar'
            ? `انتهت صلاحية مفتاح الترخيص هذا في ${dateStr}.`
            : `This license key expired on ${dateStr}.`
        } else if (res.error.includes('signature')) {
          errorMsg = language === 'ar'
            ? 'توقيع الترخيص غير صالح. يرجى التأكد من نسخ المفتاح كاملاً وبشكل صحيح.'
            : 'Invalid license key signature. Make sure you copied the entire key correctly.'
        } else if (res.error.includes('tampering') || res.error.includes('clock')) {
          errorMsg = language === 'ar'
            ? 'تم كشف تلاعب في ساعة النظام. يرجى تصحيح ساعة جهاز الكمبيوتر الخاص بك.'
            : 'System clock tampering detected. Please correct your computer system clock.'
        }

        setStatus({
          type: 'error',
          message: errorMsg
        })
      }
    } catch (err) {
      console.error(err)
      setStatus({
        type: 'error',
        message: language === 'ar' ? 'فشل الاتصال بخدمة الترخيص.' : 'Failed to connect to license service.'
      })
    } finally {
      setLoading(false)
    }
  }

  const isValidWipeInput = (text) => {
    const val = text.trim().toLowerCase()
    return val === 'مسح' || val === 'wipe' || val === 'delete'
  }

  const handleConfirmActivation = async (e) => {
    e.preventDefault()
    if (!confirmationDetails) return

    const wipeData = wipeOption === 'wipe'

    if (wipeData && !isValidWipeInput(wipeTextInput)) {
      alert(language === 'ar' ? 'يرجى كتابة كلمة التاكيد بشكل صحيح.' : 'Please type the confirmation word correctly.')
      return
    }

    setLoading(true)
    try {
      const res = await ipcService.confirmLicenseActivation(confirmationDetails.keyStr, wipeData)
      if (res.success) {
        setStatus({
          type: 'success',
          message: language === 'ar' 
            ? 'تم التفعيل وإعداد قاعدة البيانات بنجاح! جاري التشغيل...' 
            : 'Activation and database setup successful! Booting app...'
        })
        setShowWipeConfirm(false)
        setTimeout(() => {
          onActivated()
        }, 1500)
      } else {
        alert(res.error || 'Failed to complete activation')
      }
    } catch (err) {
      console.error(err)
      alert('Internal error confirming activation')
    } finally {
      setLoading(false)
    }
  }

  const confirmWord = language === 'ar' ? 'مسح' : 'WIPE'

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-100 select-none p-4 font-sans" dir="ltr">
      <div className={`w-full max-w-xl max-h-[580px] overflow-y-auto p-6 rounded-3xl relative animate-fade-in ${
        theme === 'light'
          ? 'bg-[#f8fafc] text-slate-100'
          : 'bg-slate-955 dark:bg-slate-950 text-slate-100'
      }`}>
        
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
            className="h-8 w-8 bg-slate-955/40 dark:bg-slate-900/40 border border-slate-850/65 dark:border-slate-800/60 rounded-xl text-slate-400 hover:text-rose-550 transition-colors cursor-pointer flex items-center justify-center z-20"
            title={t('common.close') || 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div dir={isRTL ? 'rtl' : 'ltr'}>
          {/* ================================= SCREEN 1: PASTE KEY ================================= */}
          {!showWipeConfirm ? (
            <>
              {/* Top brand header */}
              <div className="flex flex-col items-center text-center space-y-4 mb-8 pt-4">
                <div className="h-14 w-14 rounded-2xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/5 animate-pulse">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h1 className={`text-xl font-bold tracking-wide ${
                    theme === 'light' ? 'text-black' : 'text-white'
                  }`}>
                    School ERP
                  </h1>
                  <p className="text-xs text-slate-400 mt-1.5 font-medium">
                    {language === 'ar' 
                      ? 'تفعيل ترخيص البرنامج' 
                      : 'Software License Activation'}
                  </p>
                </div>
              </div>

            {/* Form */}
            <form onSubmit={handleActivate} className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-450 uppercase font-bold tracking-wider px-1">
                  {language === 'ar' ? 'أدخل مفتاح الترخيص' : 'Enter License Key'}
                </label>
                <div className="relative">
                  <Key className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-4 h-4.5 w-4.5 text-slate-500`} />
                  <textarea
                    ref={inputRef}
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder={language === 'ar' ? 'الصق مفتاح الترخيص الخاص بك هنا...' : 'Paste your license key here...'}
                    rows={5}
                    className={`w-full ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/15 font-mono resize-none transition-all leading-normal`}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Feedback status messages */}
              {status.message && (
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 animate-slide-in-down ${
                  status.type === 'success' 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                }`}>
                  {status.type === 'success' ? (
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  )}
                  <span>{status.message}</span>
                </div>
              )}

              {/* Action button */}
              <button
                type="submit"
                disabled={loading || !licenseKey.trim()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                {language === 'ar' ? 'تفعيل الترخيص' : 'Activate License'}
              </button>
            </form>

            {/* Footer Support Info */}
            <div className="mt-8 pt-6 border-t border-slate-900/80 text-center">
              <p className="text-[10px] text-slate-550 leading-normal">
                {language === 'ar' 
                  ? 'يرجى التواصل مع مسؤول النظام لشراء أو تجديد رخصة البرنامج.' 
                  : 'Please contact the system administrator to purchase or renew your software license.'}
              </p>
            </div>
          </>
        ) : (
          
          // ================================= SCREEN 2: SAFETY RESET PROMPT =================================
          <form onSubmit={handleConfirmActivation} className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-900">
              <button
                type="button"
                onClick={() => {
                  setShowWipeConfirm(false)
                  setWipeTextInput('')
                  setStatus({ type: '', message: '' })
                }}
                className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title={language === 'ar' ? 'الرجوع' : 'Go Back'}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-sm font-bold text-slate-200">
                  {language === 'ar' ? 'تغيير مالك ترخيص البرنامج' : 'Switching School License'}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {language === 'ar' ? 'تم الكشف عن مدرسة مختلفة في الترخيص الجديد' : 'A different license holder has been detected'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl flex gap-3 text-xs text-yellow-500 leading-normal text-left">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">
                  {language === 'ar' ? 'تنبيه الأمان' : 'Security Warning'}
                </p>
                <p>
                  {language === 'ar'
                    ? `أنت تقوم بتنشيط ترخيص للمدرسة الجديدة "${confirmationDetails.newHolder}" ولكن قاعدة البيانات تحتوي حالياً على بيانات مدرسة أخرى "${confirmationDetails.oldHolder}". يرجى تحديد الخيار الصحيح أدناه لتجنب خلط البيانات.`
                    : `You are activating a license for a different school ("${confirmationDetails.newHolder}"), but the database currently contains records for ("${confirmationDetails.oldHolder}"). Please select the correct option to prevent mixing data.`}
                </p>
              </div>
            </div>

            {/* Options selection cards */}
            <div className="grid grid-cols-1 gap-3 text-left">
              {/* Option A: Keep Data */}
              <div 
                onClick={() => setWipeOption('keep')}
                className={`p-3 border rounded-2xl cursor-pointer transition-all ${
                  wipeOption === 'keep' 
                    ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5' 
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    checked={wipeOption === 'keep'} 
                    onChange={() => setWipeOption('keep')}
                    className="accent-blue-500 cursor-pointer h-4 w-4 shrink-0" 
                  />
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span>{language === 'ar' ? 'الاحتفاظ بالبيانات الحالية' : 'Keep Existing Data'}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-450 mt-1.5 leading-relaxed pl-7 rtl:pl-0 rtl:pr-7">
                  {language === 'ar'
                    ? 'سيتم تفعيل الترخيص الجديد للبرنامج مع الاحتفاظ بجميع ملفات الطلاب والأساتذة والمدفوعات الحالية دون حذف أي شيء.'
                    : 'Applies the new license but preserves all current students, courses, billing records, and audit logs.'}
                </p>
              </div>

              {/* Option B: Wipe Data */}
              <div 
                onClick={() => setWipeOption('wipe')}
                className={`p-3 border rounded-2xl cursor-pointer transition-all ${
                  wipeOption === 'wipe' 
                    ? 'bg-red-600/10 border-red-500/40 shadow-lg shadow-red-500/5' 
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    checked={wipeOption === 'wipe'} 
                    onChange={() => setWipeOption('wipe')}
                    className="accent-red-500 cursor-pointer h-4 w-4 shrink-0" 
                  />
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span>{language === 'ar' ? 'مسح قاعدة البيانات بالكامل (بدء جديد)' : 'Wipe Database and Start Fresh'}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-450 mt-1.5 leading-relaxed pl-7 rtl:pl-0 rtl:pr-7">
                  {language === 'ar'
                    ? 'حذف جميع السجلات القديمة نهائياً وبدء قاعدة بيانات فارغة مخصصة بالكامل للمدرسة الجديدة (الاسم الافتراضي للمدرسة سيتطابق مع الترخيص الجديد).'
                    : 'Permanently deletes all old data. The app will launch in a clean state, and the default school name will match the new license.'}
                </p>
              </div>
            </div>

            {/* If Wipe is selected, show confirmation word text input */}
            {wipeOption === 'wipe' && (
              <div className="flex flex-col gap-2 p-3 bg-red-950/10 border border-red-900/30 rounded-2xl text-left animate-slide-in-down">
                <label className="text-[10px] text-red-400 uppercase font-bold tracking-wider">
                  {language === 'ar' 
                    ? `يرجى كتابة الكلمة "${confirmWord}" لتأكيد الحذف النهائي:` 
                    : `Please type the word "${confirmWord}" to confirm permanent deletion:`}
                </label>
                <input
                  type="text"
                  value={wipeTextInput}
                  onChange={(e) => setWipeTextInput(e.target.value)}
                  placeholder={confirmWord}
                  className="px-3.5 py-2 bg-slate-900 border border-red-500/20 focus:border-red-500/50 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                  disabled={loading}
                />
              </div>
            )}

            {/* Confirm button */}
            <button
              type="submit"
              disabled={loading || (wipeOption === 'wipe' && !isValidWipeInput(wipeTextInput))}
              className={`w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-semibold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                wipeOption === 'wipe' 
                  ? 'bg-red-600 hover:bg-red-550 shadow-red-500/10' 
                  : 'bg-blue-600 hover:bg-blue-550 shadow-blue-500/10'
              }`}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : wipeOption === 'wipe' ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {language === 'ar' ? 'تأكيد التفعيل والمتابعة' : 'Confirm and Activate'}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
