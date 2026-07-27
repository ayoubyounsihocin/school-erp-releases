import React, { useState, useEffect } from 'react'
import { Users, DollarSign, ArrowDownRight, ArrowUpRight, Activity, Calendar, RefreshCw, BookOpen, GraduationCap, CreditCard } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'

import PageHelpModal from '../components/PageHelpModal'

export default function Dashboard() {
  const { language, t } = useLanguage()
  const [studentsCount, setStudentsCount] = useState(0)
  const [financials, setFinancials] = useState({ totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' })
  const [totalReceivables, setTotalReceivables] = useState(0)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  // Smart Alerts and Advanced Analytics States
  const [alerts, setAlerts] = useState([])
  const [courseDistribution, setCourseDistribution] = useState([])
  const [attendanceTrend, setAttendanceTrend] = useState([])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
        const [students, summary, chartResult, absences] = await Promise.all([
          ipcService.getStudents(),
          ipcService.getFinancialSummary(),
          ipcService.getChartData(),
          ipcService.getAbsences()
        ])

        setStudentsCount(students.length)
        setFinancials(summary)
        
        setChartData(chartResult || [])

        // 1. Calculate Receivables
        const receivables = students.reduce((sum, student) => {
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

        // 2. Calculate Course Popularity Distribution (Doughnut Chart)
        const activeStudents = students.filter(s => s.status === 'Active');
        const courseEnrollmentCounts = {};
        let totalEnrollmentsCount = 0;

        activeStudents.forEach(student => {
          (student.Courses || []).forEach(course => {
            courseEnrollmentCounts[course.title] = (courseEnrollmentCounts[course.title] || 0) + 1;
            totalEnrollmentsCount++;
          });
        });

        const colorsPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];
        const distributionData = Object.keys(courseEnrollmentCounts).map((title, idx) => {
          const count = courseEnrollmentCounts[title];
          const pct = totalEnrollmentsCount > 0 ? Math.round((count / totalEnrollmentsCount) * 100) : 0;
          return {
            name: title,
            count: count,
            pct: pct,
            color: colorsPalette[idx % colorsPalette.length]
          };
        }).sort((a, b) => b.count - a.count);

        let currentOffsetAngle = 0;
        const distributionWithAngles = distributionData.map(d => {
          const angle = currentOffsetAngle;
          currentOffsetAngle += (d.pct / 100) * 360;
          return {
            ...d,
            offsetAngle: angle
          };
        });
        setCourseDistribution(distributionWithAngles);

        // 3. Calculate Daily Attendance Trend (Last 5 Days)
        const studentAbsences = (absences || []).filter(a => a.type === 'Student');
        const dateRecordsMap = {};
        studentAbsences.forEach(a => {
          if (!dateRecordsMap[a.date]) {
            dateRecordsMap[a.date] = [];
          }
          dateRecordsMap[a.date].push(a);
        });

        const uniqueSortedDates = Object.keys(dateRecordsMap).sort().slice(-5);
        const trendData = uniqueSortedDates.map(dateStr => {
          const dayRecords = dateRecordsMap[dateStr];
          const total = dayRecords.length;
          const presentOrLate = dayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
          const rate = total > 0 ? Math.round((presentOrLate / total) * 100) : 100;
          
          let formattedDate = dateStr;
          try {
            const dateObj = new Date(dateStr);
            const day = dateObj.getDate();
            const monthNames = [
              t('finances.jan') || 'Jan', t('finances.feb') || 'Feb', t('finances.mar') || 'Mar',
              t('finances.apr') || 'Apr', t('finances.may') || 'May', t('finances.jun') || 'Jun',
              t('finances.jul') || 'Jul', t('finances.aug') || 'Aug', t('finances.sep') || 'Sep',
              t('finances.oct') || 'Oct', t('finances.nov') || 'Nov', t('finances.dec') || 'Dec'
            ];
            formattedDate = `${day} ${monthNames[dateObj.getMonth()]}`;
          } catch (e) {
            console.error(e);
          }

          return {
            date: formattedDate,
            rate: rate
          };
        });
        setAttendanceTrend(trendData);

        // 4. Calculate Smart Alerts
        const calculatedAlerts = [];

        // Alert Type A: Low Attendance (<75%)
        activeStudents.forEach(student => {
          const totalRecords = (student.Absences || []).length;
          if (totalRecords >= 3) {
            const missed = (student.Absences || []).filter(a => a.status === 'Absent' || a.status === 'Unexcused').length;
            const rate = ((totalRecords - missed) / totalRecords) * 100;
            if (rate < 75) {
              calculatedAlerts.push({
                id: `low-att-${student.id}`,
                type: 'attendance',
                title: language === 'ar' ? 'انخفاض نسبة الحضور' : 'Low Attendance Alert',
                desc: language === 'ar' 
                  ? `نسبة حضور الطالب ${student.full_name} هي ${Math.round(rate)}% (غاب ${missed} من ${totalRecords} حصص)`
                  : `Student ${student.full_name} attendance rate is ${Math.round(rate)}% (missed ${missed} of ${totalRecords} sessions)`,
                severity: 'danger'
              });
            }
          }
        });

        // Alert Type B: Outstanding Dues (>30 Days)
        activeStudents.forEach(student => {
          (student.Courses || []).forEach(course => {
            const enrollmentDateStr = course.StudentCourses?.createdAt || student.createdAt || '';
            if (!enrollmentDateStr) return;
            const startDate = new Date(enrollmentDateStr);
            startDate.setHours(0, 0, 0, 0);
            
            const coursePayments = (student.Payments || []).filter(p => String(p.CourseId) === String(course.id));
            const totalPaid = coursePayments.reduce((s, p) => s + (p.amount || 0), 0);
            const monthlyPrice = course.price || 0;
            if (monthlyPrice === 0) return;

            const monthsPaid = Math.floor(totalPaid / monthlyPrice);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = Math.max(0, today - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const monthsElapsed = Math.floor(diffDays / 30) + 1;

            if (monthsElapsed > monthsPaid) {
              const dueDate = new Date(startDate);
              dueDate.setDate(dueDate.getDate() + (monthsPaid * 30));
              
              const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 30) {
                const balance = (monthsElapsed * monthlyPrice) - totalPaid;
                calculatedAlerts.push({
                  id: `overdue-${student.id}-${course.id}`,
                  type: 'dues',
                  title: language === 'ar' ? 'رسوم متأخرة' : 'Outstanding Dues Alert',
                  desc: language === 'ar' 
                    ? `تأخر الطالب ${student.full_name} في دفع رسوم مادة "${course.title}" منذ ${daysOverdue} يوماً (المبلغ المستحق: ${balance.toLocaleString()} د.ج)`
                    : `Student ${student.full_name} is overdue for "${course.title}" by ${daysOverdue} days (Outstanding: ${balance.toLocaleString()} DA)`,
                  severity: 'danger'
                });
              }
            }
          });
        });

        // Alert Type C: Courses Nearing Completion (>=80% hours)
        const courseDatesMap = {};
        (absences || []).forEach(a => {
          if (!courseDatesMap[a.CourseId]) {
            courseDatesMap[a.CourseId] = new Set();
          }
          courseDatesMap[a.CourseId].add(a.date);
        });

        const uniqueActiveCourses = {};
        activeStudents.forEach(student => {
          (student.Courses || []).forEach(course => {
            if (!uniqueActiveCourses[course.id]) {
              uniqueActiveCourses[course.id] = course;
            }
          });
        });

        Object.values(uniqueActiveCourses).forEach(course => {
          const totalHours = course.total_hours || 0;
          if (totalHours === 0) return;
          
          const uniqueDates = courseDatesMap[course.id] ? courseDatesMap[course.id].size : 0;
          const hoursCompleted = uniqueDates * 2;
          
          if (hoursCompleted > 0 && totalHours > 0) {
            const rate = (hoursCompleted / totalHours) * 100;
            if (rate >= 80 && rate < 100) {
              calculatedAlerts.push({
                id: `completion-${course.id}`,
                type: 'completion',
                title: language === 'ar' ? 'اقتراب انتهاء دورة' : 'Course Completion Alert',
                desc: language === 'ar' 
                  ? `دورة "${course.title}" تقترب من الانتهاء (أُنجز ${hoursCompleted} من أصل ${totalHours} ساعة، بنسبة ${Math.round(rate)}%)`
                  : `Course "${course.title}" is nearing completion (${hoursCompleted} of ${totalHours} hours completed, ${Math.round(rate)}%)`,
                severity: 'warning'
              });
            }
          }
        });

        setAlerts(calculatedAlerts);
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">{t('dashboard.title')}</h1>
            <PageHelpModal pageKey="dashboard" />
          </div>
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

      {/* Charts & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts Column */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 space-y-6">
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
                <div className="absolute left-2 top-0 bottom-2 flex flex-col justify-between text-[9px] text-slate-600 font-mono pointer-events-none select-none text-left">
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
                            className="w-5 bg-gradient-to-t from-blue-660 to-blue-450 border border-blue-500/35 hover:from-blue-500/30 hover:to-blue-400/20 rounded-t-md transition-all duration-300 relative group/bar cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
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
                            className="w-5 bg-gradient-to-t from-rose-660 to-rose-450 border border-rose-500/35 hover:from-rose-500/30 hover:to-rose-400/20 rounded-t-md transition-all duration-300 relative group/bar cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.05)] hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
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

        {/* Alerts Column */}
        <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800/60">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Activity className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">
                {language === 'ar' ? 'التنبيهات الذكية للنظام' : 'Smart System Alerts'}
              </h3>
            </div>
            
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-14 bg-slate-850/40 rounded-xl" />
                <div className="h-14 bg-slate-850/40 rounded-xl" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                  {language === 'ar' ? 'لا توجد تنبيهات نشطة حالياً.' : 'No active alerts at this time.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {alerts.map((alert, index) => (
                  <div 
                    key={index} 
                    className={`p-3.5 rounded-xl border flex gap-3 text-start transition-all hover:scale-[1.01] ${
                      alert.severity === 'danger' 
                        ? 'bg-rose-500/5 border-rose-500/20 text-rose-300' 
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                    }`}
                  >
                    <div className={`p-1.5 h-fit rounded-lg border shrink-0 ${
                      alert.severity === 'danger' 
                        ? 'bg-rose-500/10 border-rose-500/20' 
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {alert.type === 'attendance' && <Users className="h-3.5 w-3.5" />}
                      {alert.type === 'dues' && <DollarSign className="h-3.5 w-3.5" />}
                      {alert.type === 'completion' && <BookOpen className="h-3.5 w-3.5" />}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-[11px] font-bold">
                        {alert.title}
                      </h4>
                      <p className="text-[10px] leading-relaxed opacity-85">
                        {alert.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Advanced Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Course Popularity (SVG Doughnut Chart) */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <GraduationCap className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">
                {language === 'ar' ? 'الكورسات الأكثر طلباً' : 'Most Popular Courses'}
              </h3>
            </div>
            <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 border border-slate-850 font-bold uppercase tracking-wider">
              {language === 'ar' ? 'توزيع الطلاب' : 'Student Distribution'}
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center animate-pulse">
              <div className="w-32 h-32 rounded-full border-4 border-slate-850 border-t-blue-500 animate-spin" />
            </div>
          ) : courseDistribution.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              {language === 'ar' ? 'لا توجد بيانات تسجيل نشطة حالياً.' : 'No active enrollment records found.'}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
              {/* SVG Doughnut */}
              <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                  {/* Background Track */}
                  <circle cx="80" cy="80" r="52" fill="transparent" stroke="#1e293b" strokeWidth="14" />
                  {/* Segments */}
                  {courseDistribution.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="80"
                      cy="80"
                      r="52"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="14"
                      strokeDasharray="326.72"
                      strokeDashoffset={326.72 - (seg.pct * 326.72) / 100}
                      transform={`rotate(${seg.offsetAngle} 80 80)`}
                      strokeLinecap="round"
                      className="transition-all duration-300 hover:scale-[1.03] origin-center"
                    />
                  ))}
                </svg>
                {/* Text overlay in the middle */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    {language === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}
                  </span>
                  <span className="text-xl font-extrabold text-slate-100 font-mono mt-0.5">
                    {studentsCount}
                  </span>
                </div>
              </div>

              {/* Legends list */}
              <div className="flex-1 space-y-2 max-h-[160px] overflow-y-auto w-full pr-1">
                {courseDistribution.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 text-[11px] font-semibold hover:bg-slate-850/20 p-1.5 rounded-lg transition-colors select-text">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-slate-355 truncate">{seg.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-slate-500">({seg.count})</span>
                      <span className="text-slate-100 font-bold">{seg.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Daily Attendance Trend */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">
                {language === 'ar' ? 'مؤشر الحضور اليومي' : 'Daily Attendance Index'}
              </h3>
            </div>
            <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded text-emerald-400 border border-slate-850 font-bold uppercase tracking-wider">
              {language === 'ar' ? 'آخر 5 أيام دراسية' : 'Last 5 Active Days'}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse py-4">
              <div className="h-4 bg-slate-850/40 rounded w-2/3" />
              <div className="h-3 bg-slate-850/40 rounded w-full" />
              <div className="h-4 bg-slate-850/40 rounded w-2/3" />
              <div className="h-3 bg-slate-850/40 rounded w-full" />
            </div>
          ) : attendanceTrend.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              {language === 'ar' ? 'لا توجد سجلات حضور نشطة حالياً.' : 'No active attendance logs found.'}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {attendanceTrend.map((day, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-400">{day.date}</span>
                    <span className="text-slate-255 font-mono">{day.rate}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        day.rate >= 90 
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' 
                          : day.rate >= 75 
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500' 
                            : 'bg-gradient-to-r from-rose-600 to-rose-500'
                      }`}
                      style={{ width: `${day.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
