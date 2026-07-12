import React from 'react'
import { RefreshCw, Download, X, AlertTriangle, CheckCircle, Loader } from 'lucide-react'

export default function UpdateModal({
  isOpen,
  onClose,
  status,
  info,
  progress,
  error,
  onStartDownload,
  onInstall,
  language
}) {
  if (!isOpen) return null

  const isRTL = language === 'ar'

  // Clean and truncate raw error messages (avoid giant HTTP dumps)
  const cleanError = typeof error === 'string'
    ? (error.length > 120 ? error.split('\n')[0].substring(0, 120) + '...' : error)
    : String(error || '')

  // Text translations
  const text = {
    title: isRTL ? 'تحديث جديد متوفر' : 'New Update Available',
    subtitle: isRTL ? 'إصدار جديد من EduManage جاهز للتحميل.' : 'A new version of EduManage is ready for download.',
    warning: isRTL 
      ? 'تحذير: يرجى حفظ جميع أعمالك الجارية قبل بدء تثبيت التحديث. سيتم إغلاق التطبيق أثناء عملية التثبيت.' 
      : 'Warning: Please save all your ongoing work before installing. The application will close during the installation process.',
    statusAvailable: isRTL 
      ? 'هل ترغب في البدء في تحميل الإصدار الجديد الآن؟' 
      : 'Would you like to start downloading the new version now?',
    statusDownloading: isRTL 
      ? `جاري تحميل التحديث... الرجاء عدم إغلاق التطبيق.` 
      : `Downloading the update... Please do not close the application.`,
    statusDownloaded: isRTL 
      ? 'اكتمل التحميل بنجاح! يرجى إعادة تشغيل التطبيق لتطبيق التحديث الجديد.' 
      : 'Download completed successfully! Please restart the application to apply the new update.',
    statusError: isRTL 
      ? `حدث خطأ أثناء التحديث: ${cleanError || 'خطأ غير معروف'}` 
      : `An error occurred during update: ${cleanError || 'Unknown error'}`,
    btnDownload: isRTL ? 'تحميل وتثبيت' : 'Download & Install',
    btnCancel: isRTL ? 'إلغاء' : 'Cancel',
    btnLater: isRTL ? 'لاحقاً' : 'Later',
    btnRestart: isRTL ? 'إعادة التشغيل الآن' : 'Restart & Update Now',
    btnDownloading: isRTL ? 'جاري التحميل...' : 'Downloading...',
    btnClose: isRTL ? 'إغلاق' : 'Close',
    version: isRTL ? 'الإصدار:' : 'Version:',
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm select-none animate-fade-in no-print">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

        {/* Header Close button */}
        {status !== 'downloading' && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Content Wrapper */}
        <div className="flex flex-col items-center text-center mt-3">
          
          {/* Main Status Icon */}
          <div className="relative mb-5 flex items-center justify-center">
            {status === 'available' && (
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center animate-bounce">
                <Download className="h-7 w-7" />
              </div>
            )}
            {status === 'downloading' && (
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <RefreshCw className="h-7 w-7 animate-spin text-blue-400" />
              </div>
            )}
            {status === 'downloaded' && (
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse">
                <CheckCircle className="h-7 w-7" />
              </div>
            )}
            {status === 'error' && (
              <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7" />
              </div>
            )}
          </div>

          {/* Title and details */}
          <h2 className="text-lg font-black text-white leading-tight tracking-wide mb-1">
            {text.title}
          </h2>
          {info?.version && (
            <span className="text-[10px] bg-slate-800/80 border border-slate-700/50 text-slate-350 px-2.5 py-0.5 rounded-full font-semibold font-mono tracking-wider mb-4 block">
              {text.version} v{info.version}
            </span>
          )}

          {/* Status Message */}
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mt-2 mb-4">
            {status === 'available' && text.statusAvailable}
            {status === 'downloading' && text.statusDownloading}
            {status === 'downloaded' && text.statusDownloaded}
            {status === 'error' && text.statusError}
          </p>

          {/* Progress bar for download */}
          {(status === 'downloading' || status === 'downloaded') && (
            <div className="w-full mt-2 mb-6 px-2">
              <div className="flex justify-between items-center text-[10px] font-semibold font-mono text-slate-400 mb-1.5">
                <span>{status === 'downloaded' ? (isRTL ? 'اكتمل التحميل' : 'Finished') : (isRTL ? 'جاري التحميل...' : 'Downloading')}</span>
                <span className="text-blue-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div 
                  className={`h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ${
                    status === 'downloading' ? 'animate-pulse' : ''
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Warning Banner */}
          {(status === 'available' || status === 'downloaded') && (
            <div className="w-full bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3 flex gap-2.5 items-start text-right mb-6">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-relaxed text-amber-400/90 text-right w-full">
                {text.warning}
              </p>
            </div>
          )}

          {/* Button actions */}
          <div className="w-full flex gap-3 mt-1" style={{ WebkitAppRegion: 'no-drag' }}>
            {status === 'available' && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:text-white text-slate-400 text-xs font-semibold transition-all cursor-pointer"
                >
                  {text.btnCancel}
                </button>
                <button
                  onClick={onStartDownload}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {text.btnDownload}
                </button>
              </>
            )}

            {status === 'downloading' && (
              <button
                disabled
                className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Loader className="h-4.5 w-4.5 animate-spin" />
                {text.btnDownloading}
              </button>
            )}

            {status === 'downloaded' && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:text-white text-slate-400 text-xs font-semibold transition-all cursor-pointer"
                >
                  {text.btnLater}
                </button>
                <button
                  onClick={onInstall}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer animate-pulse"
                >
                  {text.btnRestart}
                </button>
              </>
            )}

            {status === 'error' && (
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                {text.btnClose}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
