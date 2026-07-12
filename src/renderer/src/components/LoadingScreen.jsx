import React from 'react'
import { GraduationCap } from 'lucide-react'
import { useLanguage } from '../i18n'

export default function LoadingScreen() {
  const { t } = useLanguage()
  
  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 select-none">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* Pulsing brand icon */}
        <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-400 border border-blue-500/20 animate-pulse">
          <GraduationCap className="h-10 w-10 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>
        
        {/* Loading details */}
        <div className="text-center space-y-1">
          <h2 className="text-sm font-semibold tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{t('loading.title')}</h2>
          <p className="text-[10px] text-slate-500 font-mono tracking-wider">{t('loading.subtitle')}</p>
        </div>

        {/* Dynamic progress bar animation */}
        <div className="h-1 w-28 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40 mt-1">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-[loadingProgress_1.5s_infinite_ease-in-out]"></div>
        </div>
      </div>
    </div>
  )
}
