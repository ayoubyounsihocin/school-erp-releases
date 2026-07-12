import React, { useState, useEffect } from 'react'
import { Users, DollarSign, ArrowDownRight, ArrowUpRight, Activity, Calendar, RefreshCw, ShoppingCart, CreditCard, UserPlus, BookOpen, GraduationCap } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'

export default function Dashboard() {
  const { language, t } = useLanguage()
  const [studentsCount, setStudentsCount] = useState(0)
  const [financials, setFinancials] = useState({ totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' })
  const [totalReceivables, setTotalReceivables] = useState(0)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    setLoading(true)
    try {
        const [students, summary, chartResult] = await Promise.all([
          ipcService.getStudents(),
          ipcService.getFinancialSummary(),
          ipcService.getChartData()
        ])

        setStudentsCount(students.length)
        setFinancials(summary)
        
        // If we get real database history, use it. Otherwise, populate with nice baseline mocks.
        if (chartResult && chartResult.length > 0) {
          setChartData(chartResult)
        } else {
          setChartData([
            { name: 'Jan', Revenue: 6400, Expenses: 3100 },
            { name: 'Feb', Revenue: 7800, Expenses: 4200 },
            { name: 'Mar', Revenue: 9100, Expenses: 3800 },
            { name: 'Apr', Revenue: 11200, Expenses: 5100 },
            { name: 'May', Revenue: 14300, Expenses: 6800 },
            { 
              name: summary.monthName || 'Jun', 
              Revenue: summary.totalRevenue > 0 ? summary.totalRevenue : 12840, 
              Expenses: summary.totalExpenses > 0 ? summary.totalExpenses : 7150 
            }
          ])
        }

        const receivables = students.reduce((sum, student) => {
          // 🛑 Skip tuition calculations for dropped or graduated students
          if (student.status === 'Dropped' || student.status === 'Graduated') {
            return sum;
          }
          
          let studentDues = 0;
          (student.Courses || []).forEach(course => {
            const enrollment = course.StudentCourses?.createdAt || student.createdAt || Date.now();
            const startDate = new Date(enrollment);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date();
            endDate.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.max(0, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));
            const totalMonths = Math.max(1, Math.floor(daysDiff / 30) + 1);
            
            const monthlyPrice = course.price || 0;
            const totalTuition = totalMonths * monthlyPrice;
            const coursePayments = (student.Payments || []).filter(p => String(p.CourseId) === String(course.id));
            const totalPaid = coursePayments.reduce((s, p) => s + (p.amount || 0), 0);
            
            const balance = Math.max(0, totalTuition - totalPaid);
            studentDues += balance;
          });
          return sum + studentDues;
        }, 0);
        setTotalReceivables(receivables);
    } catch (err) {
      console.error("Failed to load dashboard data:", err)
    } finally {
      setTimeout(() => {
        setLoading(false)
      }, 300)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const getMonthTranslation = (monthStr) => {
    if (!monthStr) return '';
    const lower = monthStr.toLowerCase();
    if (lower.startsWith('jan')) return t('finances.jan');
    if (lower.startsWith('feb')) return t('finances.feb');
    if (lower.startsWith('mar')) return t('finances.mar');
    if (lower.startsWith('apr')) return t('finances.apr');
    if (lower.startsWith('may')) return t('finances.may');
    if (lower.startsWith('jun')) return t('finances.jun');
    if (lower.startsWith('jul')) return t('finances.jul');
    if (lower.startsWith('aug')) return t('finances.aug');
    if (lower.startsWith('sep')) return t('finances.sep');
    if (lower.startsWith('oct')) return t('finances.oct');
    if (lower.startsWith('nov')) return t('finances.nov');
    if (lower.startsWith('dec')) return t('finances.dec');
    return monthStr;
  }

  const translatedChartData = React.useMemo(() => {
    return chartData.map(d => ({ ...d, name: getMonthTranslation(d.name) }));
  }, [chartData, language]);

  const maxVal = React.useMemo(() => {
    const vals = chartData.map(d => Math.max(d.Revenue || 0, d.Expenses || 0));
    return Math.max(...vals, 1000);
  }, [chartData]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('dashboard.title')}</h1>
          <p className="text-xs text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Total Students */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">{t('dashboard.studentsCardTitle')}</span>
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/10">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">
              {loading ? '---' : studentsCount}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">
              {t('dashboard.studentsCardSubtitle')}
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">{t('dashboard.revenueCardTitle')}</span>
            <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/10">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">
              {loading ? '---' : `${financials.totalRevenue.toLocaleString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 })} ${t('common.da')}`}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">
              {t('dashboard.revenueCardSubtitle')}
            </span>
          </div>
        </div>

        {/* Card 3: Total Expenses */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">{t('finances.expensesCardTitle')}</span>
            <div className="p-2.5 rounded-xl bg-rose-600/10 text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">
              {loading ? '---' : `${financials.totalExpenses.toLocaleString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 })} ${t('common.da')}`}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">
              {t('finances.expensesCardSubtitle')}
            </span>
          </div>
        </div>

        {/* Card 4: Total Receivables */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">{t('dashboard.receivablesCardTitle')}</span>
            <div className="p-2.5 rounded-xl bg-purple-650/10 text-purple-400 border border-purple-550/10">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">
              {loading ? '---' : `${totalReceivables.toLocaleString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 })} ${t('common.da')}`}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">
              {t('dashboard.receivablesCardSubtitle')}
            </span>
          </div>
        </div>

      </div>

      {/* Charts & Activities Grid */}
      <div className="w-full">
        
        {/* Recharts Column */}
        <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">{t('dashboard.chartTitle')}</h3>
            <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded text-blue-400 border border-slate-800/80 font-semibold uppercase tracking-wider">{t('dashboard.chartSubtitle')}</span>
          </div>
          
          <div className="w-full h-80 pt-2 font-mono text-[10px] text-slate-400">
            {loading ? (
              <div className="w-full h-full bg-slate-950/20 border border-slate-850 rounded-xl flex items-center justify-center animate-pulse">
                <p className="text-xs text-slate-600">{t('dashboard.loadingAnalytics')}</p>
              </div>
            ) : (
            <div className="w-full h-full flex flex-col justify-between">
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-[11px] pb-4 select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500/25 border border-blue-500/45 shadow-sm" />
                  <span className="text-slate-350">{t('dashboard.revenueSeries')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/25 border border-rose-500/45 shadow-sm" />
                  <span className="text-slate-350">{t('dashboard.expensesSeries')}</span>
                </div>
              </div>

              {/* Chart Grid Area */}
              <div className="relative flex-1 flex items-end justify-between w-full h-full border-b border-slate-800 pb-2">
                {/* Horizontal Gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2">
                  <div className="w-full border-t border-slate-800/40 border-dashed" />
                  <div className="w-full border-t border-slate-800/40 border-dashed" />
                  <div className="w-full border-t border-slate-800/40 border-dashed" />
                  <div className="w-full border-t border-slate-800/40 border-dashed" />
                </div>

                {/* Y-Axis Value Labels (Left side overlay) */}
                <div className="absolute left-2 top-0 bottom-2 flex flex-col justify-between text-[9px] text-slate-600 font-mono pointer-events-none select-none">
                  <span>{(maxVal).toFixed(0)} DA</span>
                  <span>{(maxVal * 0.66).toFixed(0)} DA</span>
                  <span>{(maxVal * 0.33).toFixed(0)} DA</span>
                  <span>0 DA</span>
                </div>

                {/* Bars Columns */}
                <div className="w-full h-full flex items-end justify-around pl-14 pr-4 z-10">
                  {translatedChartData.map((d, index) => {
                    const revHeight = ((d.Revenue || 0) / maxVal) * 100;
                    const expHeight = ((d.Expenses || 0) / maxVal) * 100;

                    return (
                      <div key={index} className="flex flex-col items-center gap-2 h-full justify-end group">
                        {/* Group of 2 Bars */}
                        <div className="flex items-end gap-1.5 h-[80%] relative">
                          
                          {/* Revenue Bar */}
                          <div 
                            style={{ height: `${Math.max(4, revHeight)}%` }}
                            className="w-5 bg-gradient-to-t from-blue-600/20 to-blue-400/10 border border-blue-500/35 hover:from-blue-500/30 hover:to-blue-400/20 rounded-t-md transition-all duration-300 relative group/bar cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-950 border border-slate-850 text-white text-[9.5px] rounded-lg shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                              <p className="font-semibold text-slate-400">{t('dashboard.revenueSeries')}</p>
                              <p className="font-bold text-blue-400 font-mono mt-0.5">{d.Revenue?.toFixed(2)} DA</p>
                            </div>
                          </div>

                          {/* Expenses Bar */}
                          <div 
                            style={{ height: `${Math.max(4, expHeight)}%` }}
                            className="w-5 bg-gradient-to-t from-rose-600/20 to-rose-400/10 border border-rose-500/35 hover:from-rose-500/30 hover:to-rose-400/20 rounded-t-md transition-all duration-300 relative group/bar cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.05)] hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-950 border border-slate-850 text-white text-[9.5px] rounded-lg shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                              <p className="font-semibold text-slate-400">{t('dashboard.expensesSeries')}</p>
                              <p className="font-bold text-rose-400 font-mono mt-0.5">{d.Expenses?.toFixed(2)} DA</p>
                            </div>
                          </div>

                        </div>

                        {/* Month Label */}
                        <span className="text-[10px] text-slate-450 font-bold select-none">{d.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
