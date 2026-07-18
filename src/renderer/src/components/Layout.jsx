import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import UpdateModal from './UpdateModal'
import { Bell, Calendar, Clock, AlertTriangle, Sun, Moon, RefreshCw, UserPlus, CreditCard, ShoppingCart, BookOpen, GraduationCap, Users, X, Activity, AlertCircle, Minus, Square } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import { toLocalYYYYMMDD } from '../utils/billing'

export default function Layout({ user, onLogout, theme, toggleTheme }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage, t, dir } = useLanguage()
  const [dbStatus, setDbStatus] = useState('checking') // 'checking' | 'connected' | 'disconnected'
  const [currentTime, setCurrentTime] = useState(new Date())
  const [schoolName, setSchoolName] = useState('')
  
  // Custom Auto-Updater States
  const [updateStatus, setUpdateStatus] = useState('idle') // 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateError, setUpdateError] = useState('')

  const isRTL = language === 'ar'

  const handleMinimize = () => {
    if (window.api && window.api.minimizeWindow) window.api.minimizeWindow()
  }

  const handleMaximize = () => {
    if (window.api && window.api.maximizeWindow) window.api.maximizeWindow()
  }

  const handleClose = () => {
    if (window.api && window.api.closeWindow) window.api.closeWindow()
  }

  const translateMonth = (mName) => {
    if (!mName) return '';
    if (mName.includes('-')) {
      const parts = mName.split(' - ');
      if (parts.length === 2) {
        const translatePart = (part) => {
          const tokens = part.split(' ');
          return tokens.map(token => {
            const clean = token.toLowerCase().substring(0, 3);
            const key = `finances.${clean}`;
            const result = t(key);
            return result === key ? token : result;
          }).join(' ');
        };
        return `${translatePart(parts[0])} - ${translatePart(parts[1])}`;
      }
    }
    const clean = mName.toLowerCase().substring(0, 3);
    const key = `finances.${clean}`;
    const result = t(key);
    return result === key ? mName : result;
  };

  const parsePeriodDates = (periodStr, year) => {
    if (!periodStr) return null;
    const parts = periodStr.split(' - ');
    if (parts.length === 2) {
      const parsePart = (part) => {
        const tokens = part.split(' ');
        if (tokens.length === 2) {
          const day = parseInt(tokens[0]);
          const monthAbbr = tokens[1].toLowerCase().substring(0, 3);
          const months = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          const monthIndex = months[monthAbbr] !== undefined ? months[monthAbbr] : 0;
          return new Date(year, monthIndex, day);
        }
        return null;
      };
      return {
        startDate: parsePart(parts[0]),
        endDate: parsePart(parts[1])
      };
    }
    return null;
  };

  const isMonthMatching = (paymentMonth, selectedMonth, selectedYear) => {
    if (!paymentMonth || !selectedMonth) return false;
    
    if (paymentMonth === selectedMonth) return true;
    if (paymentMonth.toLowerCase() === selectedMonth.toLowerCase()) return true;
    
    const standardMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (standardMonths.includes(selectedMonth)) {
      const periodDates = parsePeriodDates(paymentMonth, parseInt(selectedYear || new Date().getFullYear()));
      if (periodDates && periodDates.startDate) {
        const startMonthName = periodDates.startDate.toLocaleString('en-US', { month: 'long' });
        return startMonthName.toLowerCase() === selectedMonth.toLowerCase();
      }
    }
    
    if (standardMonths.includes(paymentMonth)) {
      const periodDates = parsePeriodDates(selectedMonth, parseInt(selectedYear || new Date().getFullYear()));
      if (periodDates && periodDates.startDate) {
        const startMonthName = periodDates.startDate.toLocaleString('en-US', { month: 'long' });
        return startMonthName.toLowerCase() === paymentMonth.toLowerCase();
      }
    }
    
    return false;
  };
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const notificationRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState('logs') // 'logs' | 'keep-eyes'
  const [auditLogs, setAuditLogs] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  // Click outside notification dropdown to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false)
      }
    }
    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotificationOpen])

  // Real database connection check on startup
  useEffect(() => {
    const checkConnection = async () => {
      if (window.api) {
        try {
          // Perform a fast test query
          await ipcService.getStudents()
          setDbStatus('connected')
        } catch (err) {
          console.error("SQLite query test failed:", err)
          setDbStatus('disconnected')
        }
      } else {
        // Delay slightly for visual comfort (so it doesn't just flash)
        const timeout = setTimeout(() => {
          setDbStatus('disconnected')
        }, 1000)
        return () => clearTimeout(timeout)
      }
    }
    checkConnection()
  }, [])

  // Live clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-Updater IPC Listeners
  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      const handleUpdateAvailable = (event, info) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
        // Automatically pop up the modal to inform the user
        setShowUpdateModal(true)
      }

      const handleDownloadProgress = (event, progressObj) => {
        setUpdateStatus('downloading')
        setDownloadProgress(Math.round(progressObj.percent || 0))
      }

      const handleUpdateDownloaded = (event, info) => {
        setUpdateStatus('downloaded')
        setUpdateInfo(info)
        setDownloadProgress(100)
      }

      const handleUpdateError = (event, errorText) => {
        setUpdateStatus('error')
        setUpdateError(errorText)
      }

      window.electron.ipcRenderer.on('update-available', handleUpdateAvailable)
      window.electron.ipcRenderer.on('download-progress', handleDownloadProgress)
      window.electron.ipcRenderer.on('update-downloaded', handleUpdateDownloaded)
      window.electron.ipcRenderer.on('update-error', handleUpdateError)

      // Start automatic check (delayed by 3 seconds)
      const checkTimeout = setTimeout(() => {
        window.electron.ipcRenderer.send('trigger-update-check')
      }, 3000)

      return () => {
        clearTimeout(checkTimeout)
        window.electron.ipcRenderer.removeAllListeners('update-available')
        window.electron.ipcRenderer.removeAllListeners('download-progress')
        window.electron.ipcRenderer.removeAllListeners('update-downloaded')
        window.electron.ipcRenderer.removeAllListeners('update-error')
      }
    }
  }, [])

  const startUpdateDownload = () => {
    if (window.electron && window.electron.ipcRenderer) {
      setUpdateStatus('downloading')
      window.electron.ipcRenderer.send('start-update-download')
    }
  }

  const installUpdateAndRestart = () => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('install-update-now')
    }
  }



  // Global Keyboard Shortcuts Effect
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      const key = e.key.toLowerCase();
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      );
      const hasSelection = window.getSelection().toString().length > 0;

      // 1. Global Forms & Search Triggers (always active)
      if (key === 'f') {
        // Focus search input
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[type="text"][placeholder*="بحث"], #student-search-input, #teacher-search-input, #course-search-input, #attendance-search-input, #finance-search-input');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        return;
      } else if (key === 'n') {
        e.preventDefault();
        if (location.pathname !== '/students') {
          navigate('/students');
          setTimeout(() => {
            const addBtn = document.getElementById('add-student-btn');
            if (addBtn) addBtn.click();
          }, 150);
        } else {
          const addBtn = document.getElementById('add-student-btn');
          if (addBtn) addBtn.click();
        }
        return;
      } else if (key === 'p') {
        e.preventDefault();
        if (location.pathname !== '/finances') {
          navigate('/finances');
          setTimeout(() => {
            const payTab = document.getElementById('tab-trigger-payments');
            if (payTab) payTab.click();
            setTimeout(() => {
              const payBtn = document.getElementById('record-payment-btn');
              if (payBtn) payBtn.click();
            }, 100);
          }, 150);
        } else {
          const payTab = document.getElementById('tab-trigger-payments');
          if (payTab) payTab.click();
          setTimeout(() => {
            const payBtn = document.getElementById('record-payment-btn');
            if (payBtn) payBtn.click();
          }, 100);
        }
        return;
      }

      // 2. Navigation & Toggle Triggers (disabled when user is actively typing or selecting text)
      if (isTyping || hasSelection) {
        return;
      }

      if (key === 'h') {
        e.preventDefault();
        navigate('/');
      } else if (key === 's') {
        e.preventDefault();
        navigate('/students');
      } else if (key === 't') {
        e.preventDefault();
        navigate('/teachers');
      } else if (key === 'c') {
        e.preventDefault();
        navigate('/courses');
      } else if (key === 'a') {
        e.preventDefault();
        navigate('/attendance');
      } else if (key === 'b') {
        e.preventDefault();
        navigate('/finances');
      } else if (key === 'g') {
        e.preventDefault();
        navigate('/settings');
      } else if (key === 'l') {
        e.preventDefault();
        setLanguage(language === 'ar' ? 'en' : 'ar');
      } else if (key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [location.pathname, navigate, language, setLanguage, toggleTheme]);

  const [systemNotification, setSystemNotification] = useState({ globalMessage: '', customMessage: '' })
  const [dismissedNotification, setDismissedNotification] = useState(false)

  // Fetch school name and system notifications from settings and server dynamically
  useEffect(() => {
    const fetchSettingsAndNotifications = async () => {
      try {
        if (window.api) {
          const settings = await ipcService.getSettings()
          if (settings.school_name) setSchoolName(settings.school_name)
          
          const notifications = await ipcService.getGlobalNotification()
          setSystemNotification(notifications)

          const activeMsg = notifications.customMessage || notifications.globalMessage
          if (activeMsg) {
            const savedLastMsg = localStorage.getItem('last_seen_system_notification')
            const savedFirstSeenTime = localStorage.getItem('system_notification_first_seen_time')
            const savedDismissed = localStorage.getItem('dismissed_system_notification')

            // If it is a completely new announcement, reset visibility and timer
            if (savedLastMsg !== activeMsg) {
              localStorage.setItem('last_seen_system_notification', activeMsg)
              localStorage.setItem('system_notification_first_seen_time', Date.now().toString())
              localStorage.removeItem('dismissed_system_notification')
              setDismissedNotification(false)
            } else {
              // Same announcement
              if (savedDismissed === activeMsg) {
                setDismissedNotification(true)
              } else if (savedFirstSeenTime) {
                // Dismiss if more than 1 hour (3600000 ms) has passed since first seen
                const elapsed = Date.now() - Number(savedFirstSeenTime)
                if (elapsed > 3600000) {
                  setDismissedNotification(true)
                } else {
                  setDismissedNotification(false)
                }
              } else {
                setDismissedNotification(false)
              }
            }
          } else {
            setDismissedNotification(true)
          }
        }
      } catch (err) {
        console.error("Failed to load settings in layout:", err)
      }
    }
    fetchSettingsAndNotifications()
  }, [location.pathname])

  const handleDismissNotification = () => {
    const activeMsg = systemNotification.customMessage || systemNotification.globalMessage
    if (activeMsg) {
      localStorage.setItem('dismissed_system_notification', activeMsg)
    }
    setDismissedNotification(true)
  }

  const loadNotificationsData = async () => {
    setLoadingNotifications(true)
    try {
      if (window.api) {
        const [logsResult, studentsData, teachersData, coursesData, schedulesData, paymentsData, teacherPaymentsData, absencesData] = await Promise.all([
          ipcService.getAuditLogs({ limit: 30, offset: 0 }),
          ipcService.getStudents(),
          ipcService.getTeachers(),
          ipcService.getCourses(),
          ipcService.getSchedules(),
          ipcService.getPayments(),
          ipcService.getTeacherPayments(),
          ipcService.getAbsences()
        ]);

        const logsList = Array.isArray(logsResult) ? logsResult : (logsResult.logs || []);
        setAuditLogs(logsList);

        const list = [];

        // Helper to calculate student course stats inside notifications loop
        const getStudentCourseAttendanceStats = (student, courseId, allAbs) => {
          const courseObj = student.Courses?.find(c => String(c.id) === String(courseId));
          const enrollmentDateStr = courseObj?.StudentCourses?.createdAt || student.createdAt || '';
          const enrollmentDate = toLocalYYYYMMDD(enrollmentDateStr);

          const studentCourseAbsences = (student.Absences || []).filter(a => String(a.CourseId) === String(courseId));
          const courseAbsences = allAbs.filter(a => String(a.CourseId) === String(courseId));
          const uniqueDatesForCourse = [...new Set(courseAbsences.map(a => a.date))]
            .filter(d => !enrollmentDate || d >= enrollmentDate)
            .sort();

          let attended = 0;
          let excused = 0;
          let unexcused = 0;

          uniqueDatesForCourse.forEach(d => {
            const record = studentCourseAbsences.find(a => a.date === d);
            if (record) {
              if (record.status === 'Present') {
                attended++;
              } else if (record.status === 'Excused') {
                excused++;
              } else if (record.status === 'Unexcused') {
                unexcused++;
              }
            } else {
              attended++;
            }
          });

          const coursePayments = (student.Payments || []).filter(p => String(p.CourseId) === String(courseId));
          const totalPaid = coursePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          const monthlyPrice = courseObj ? (courseObj.price || 0) : 0;
          const schedulesPerWeek = courseObj?.Schedules?.length || 2;
          const sessionsPerMonth = schedulesPerWeek * 4;
          const paidSessions = monthlyPrice > 0 ? Math.floor((totalPaid / monthlyPrice) * sessionsPerMonth) : 0;

          return {
            attended,
            totalPaid,
            sessionsPerMonth
          };
        };

        const getCoursePaymentsBalance = (student, courseId, allAbs) => {
          const course = student.Courses?.find(c => String(c.id) === String(courseId));
          if (!course) return { totalTuition: 0, balance: 0 };

          const stats = getStudentCourseAttendanceStats(student, courseId, allAbs);
          const monthsDue = Math.max(1, Math.ceil(stats.attended / stats.sessionsPerMonth));
          const monthlyPrice = course.price || 0;
          const totalTuition = monthsDue * monthlyPrice;
          const balance = Math.max(0, totalTuition - stats.totalPaid);

          return { totalTuition, balance };
        };
        
        // 1. Students Keep Eyes:
        studentsData.forEach(student => {
          if (student.status !== 'Active') return;
          if (student.Courses && student.Courses.length > 0) {
            student.Courses.forEach(c => {
              const balanceInfo = getCoursePaymentsBalance(student, c.id, absencesData);
              const unpaid = balanceInfo.balance;
              
              if (unpaid > 0) {
                list.push({
                  id: `std-bal-${student.id}-${c.id}`,
                  text: t('layout.alertStudentOwes', { name: student.full_name, amount: unpaid.toFixed(2), course: c.title }),
                  type: 'student',
                  severity: 'high'
                });
              }
            });
          } else {
            list.push({
              id: `std-no-course-${student.id}`,
              text: t('layout.alertStudentNoCourse', { name: student.full_name }),
              type: 'student',
              severity: 'medium'
            });
          }
        });

        // 2. Teachers Keep Eyes:
        teachersData.forEach(teacher => {
          if (teacher.status !== 'Active') return;
          const courseCount = coursesData.filter(c => String(c.TeacherId) === String(teacher.id)).length;
          if (courseCount === 0) {
            list.push({
              id: `tch-no-course-${teacher.id}`,
              text: t('layout.alertTeacherNoCourse', { name: teacher.full_name }),
              type: 'teacher',
              severity: 'medium'
            });
          }
        });

        // 3. Courses Keep Eyes:
        coursesData.forEach(course => {
          if (!course.TeacherId && !course.Teacher) {
            list.push({
              id: `crs-no-teacher-${course.id}`,
              text: t('layout.alertCourseNoTeacher', { course: course.title }),
              type: 'course',
              severity: 'high'
            });
          } else {
            // Course has teacher assigned. Check if it is scheduled.
            const isScheduled = (schedulesData || []).some(s => String(s.CourseId) === String(course.id));
            if (!isScheduled) {
              const teacherName = course.Teacher?.full_name || (teachersData.find(t => String(t.id) === String(course.TeacherId))?.full_name) || 'instructor';
              list.push({
                id: `crs-not-scheduled-${course.id}`,
                text: t('layout.alertCourseNotScheduled', { course: course.title, teacher: teacherName }),
                type: 'course',
                severity: 'medium'
              });
            }
          }
          const studentCount = course.Students ? course.Students.length : 0;
          if (studentCount === 0) {
            list.push({
              id: `crs-no-student-${course.id}`,
              text: t('layout.alertCourseNoStudents', { course: course.title }),
              type: 'course',
              severity: 'medium'
            });
          }
        });

        // 4. Instructor Payouts Keep Eyes (Unpaid Cycle Warnings):
        const grouped = {};
        (paymentsData || []).forEach(p => {
          if (p.CourseId && p.month && p.year) {
            const course = coursesData.find(c => String(c.id) === String(p.CourseId));
            const teacherId = course?.TeacherId;
            if (teacherId) {
              const key = `${p.CourseId}-${p.month}-${p.year}`;
              if (!grouped[key]) {
                const teacherObj = teachersData.find(t => String(t.id) === String(teacherId));
                grouped[key] = {
                  courseId: p.CourseId,
                  courseTitle: course.title,
                  teacherId: teacherId,
                  teacherName: teacherObj?.full_name || 'Instructor',
                  month: p.month,
                  year: p.year,
                  studentPaymentsSum: 0
                };
              }
              grouped[key].studentPaymentsSum += (p.amount || 0);
            }
          }
        });

        Object.keys(grouped).forEach(key => {
          const cycle = grouped[key];
          const isPaid = (teacherPaymentsData || []).some(tp => 
            String(tp.TeacherId) === String(cycle.teacherId) &&
            String(tp.CourseId) === String(cycle.courseId) &&
            isMonthMatching(tp.month, cycle.month, cycle.year) &&
            String(tp.year) === String(cycle.year)
          );
          if (!isPaid && cycle.studentPaymentsSum > 0) {
            list.push({
              id: `tch-payout-pending-${cycle.teacherId}-${cycle.courseId}-${cycle.month}-${cycle.year}`,
              text: t('layout.alertTeacherUnpaid', { teacher: cycle.teacherName, course: cycle.courseTitle, month: translateMonth(cycle.month), year: cycle.year }),
              type: 'teacher',
              severity: 'high'
            });
          }
        });

        setAlerts(list);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    loadNotificationsData();
    const interval = setInterval(loadNotificationsData, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  useEffect(() => {
    if (isNotificationOpen) {
      loadNotificationsData();
    }
  }, [isNotificationOpen]);

  const formatTimeAgo = (dateStr) => {
    const elapsed = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(elapsed / 60000)
    if (mins < 1) return t('layout.justNow')
    if (mins < 60) return t('layout.minsAgo', { mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('layout.hoursAgo', { hours })
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' })
  }

  const getLogIcon = (action) => {
    switch (action) {
      case 'ADD_STUDENT':
        return <UserPlus className="h-3.5 w-3.5 text-blue-400" />
      case 'UPDATE_STUDENT':
        return <Activity className="h-3.5 w-3.5 text-sky-400" />
      case 'DELETE_STUDENT':
        return <Activity className="h-3.5 w-3.5 text-rose-400" />
      case 'RECORD_PAYMENT':
        return <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
      case 'RECORD_EXPENSE':
        return <ShoppingCart className="h-3.5 w-3.5 text-rose-400" />
      case 'ADD_COURSE':
      case 'UPDATE_COURSE':
      case 'DELETE_COURSE':
        return <BookOpen className="h-3.5 w-3.5 text-amber-400" />
      case 'ADD_TEACHER':
      case 'UPDATE_TEACHER':
      case 'DELETE_TEACHER':
        return <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
      case 'ENROLL_STUDENT':
        return <Users className="h-3.5 w-3.5 text-purple-400" />
      default:
        return <Activity className="h-3.5 w-3.5 text-slate-400" />
    }
  }

  const getLogIconBg = (action) => {
    switch (action) {
      case 'ADD_STUDENT': return 'bg-blue-500/10 border-blue-500/20'
      case 'UPDATE_STUDENT': return 'bg-sky-500/10 border-sky-500/20'
      case 'DELETE_STUDENT': return 'bg-rose-500/10 border-rose-500/20'
      case 'RECORD_PAYMENT': return 'bg-emerald-500/10 border-emerald-500/20'
      case 'RECORD_EXPENSE': return 'bg-rose-500/10 border-rose-500/20'
      case 'ADD_COURSE':
      case 'UPDATE_COURSE':
      case 'DELETE_COURSE':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'ADD_TEACHER':
      case 'UPDATE_TEACHER':
      case 'DELETE_TEACHER':
        return 'bg-indigo-500/10 border-indigo-500/20'
      case 'ENROLL_STUDENT':
        return 'bg-purple-500/10 border-purple-500/20'
      default: return 'bg-slate-500/10 border-slate-500/20'
    }
  }

  const formatLogAction = (action, lang) => {
    const isAr = lang === 'ar';
    switch (action) {
      case 'ADD_STUDENT': return isAr ? 'إضافة طالب جديد' : 'New Student Added';
      case 'UPDATE_STUDENT': return isAr ? 'تعديل بيانات طالب' : 'Student Info Updated';
      case 'DELETE_STUDENT': return isAr ? 'حذف طالب' : 'Student Deleted';
      case 'ENROLL_STUDENT': return isAr ? 'تسجيل طالب في دورة' : 'Student Enrolled in Course';
      case 'RECORD_PAYMENT': return isAr ? 'تسجيل دفعة مالية' : 'New Payment Recorded';
      case 'DELETE_PAYMENT': return isAr ? 'حذف دفعة مالية' : 'Payment Deleted';
      case 'ADD_COURSE': return isAr ? 'إضافة دورة تعليمية' : 'New Course Created';
      case 'UPDATE_COURSE': return isAr ? 'تعديل دورة تعليمية' : 'Course Details Updated';
      case 'DELETE_COURSE': return isAr ? 'حذف دورة تعليمية' : 'Course Deleted';
      case 'ADD_TEACHER': return isAr ? 'إضافة أستاذ جديد' : 'New Teacher Added';
      case 'UPDATE_TEACHER': return isAr ? 'تعديل بيانات أستاذ' : 'Teacher Info Updated';
      case 'DELETE_TEACHER': return isAr ? 'حذف أستاذ' : 'Teacher Deleted';
      case 'RECORD_EXPENSE': return isAr ? 'تسجيل مصاريف' : 'New Expense Recorded';
      case 'DELETE_EXPENSE': return isAr ? 'حذف مصاريف' : 'Expense Deleted';
      case 'RECORD_ABSENCE': return isAr ? 'تسجيل غياب' : 'Absence Recorded';
      case 'SEND_BULK_EMAIL': return isAr ? 'إرسال بريد جماعي' : 'Bulk Email Broadcasted';
      default: return action.replace(/_/g, ' ');
    }
  }

  // Resolve page title based on path
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return t('sidebar.dashboard')
      case '/students':
        return t('sidebar.students')
      case '/teachers':
        return t('sidebar.teachers')
      case '/courses':
        return t('sidebar.courses')
      case '/finances':
        return t('sidebar.finances')
      case '/communication':
        return language === 'ar' ? 'التواصل والبريد' : 'Communication & Mail'
      case '/settings':
        return t('sidebar.settings')
      default:
        return t('layout.title')
    }
  }

  // Format date: e.g., "Thu, Jun 18, 2026"
  const formatDate = () => {
    return currentTime.toLocaleDateString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Format time: e.g., "09:22:56 AM"
  const formatTime = () => {
    return currentTime.toLocaleTimeString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }
  const hasUnpaidStudents = alerts.some(a => a.id.startsWith('std-bal-'))
  const hasPendingPayouts = alerts.some(a => a.id.startsWith('tch-payout-pending-'))

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        hasUnpaidStudents={hasUnpaidStudents} 
        hasPendingPayouts={hasPendingPayouts} 
        theme={theme}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        
        {/* Header Bar (Frameless Title Bar with drag support) */}
        <header 
          className={`no-print h-16 border-b border-slate-800/60 flex items-center justify-between px-6 bg-slate-955/80 backdrop-blur-md shrink-0 relative z-30 select-none cursor-default`}
          style={{ WebkitAppRegion: 'drag' }}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          {/* Section: Title & School Name (Left in LTR, Right in RTL) */}
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
            <h2 className="text-base font-semibold tracking-tight text-slate-100">{getPageTitle()}</h2>
            {schoolName && (
              <>
                <span className="h-4 w-[1px] bg-slate-800/60"></span>
                <span className="text-xs text-slate-400 font-medium">{schoolName}</span>
              </>
            )}
          </div>

          {/* Section: Widgets & Custom Window Controls (Right in LTR, Left in RTL) */}
          <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
            
            {/* Date and Time Widget */}
            <div className="text-[10px] text-slate-400 bg-slate-900/40 border border-slate-800/40 px-3 py-1 rounded-xl flex items-center gap-2.5 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                {formatDate()}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-800"></span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                {formatTime()}
              </span>
            </div>

            {/* Language Switch Button */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center font-bold text-[9px] min-w-[32px] h-[32px]"
              title={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
            >
              {language === 'en' ? 'العربية' : 'EN'}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={theme === 'light' ? t('layout.themeDark') : t('layout.themeLight')}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Update Available Indicator */}
            {updateStatus !== 'idle' && (
              <button
                onClick={() => setShowUpdateModal(true)}
                className={`relative p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  updateStatus === 'downloaded'
                    ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20'
                    : 'bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 animate-pulse'
                }`}
                title={language === 'ar' ? 'تحديث متوفر!' : 'Update Available!'}
              >
                <RefreshCw className={`h-4 w-4 ${updateStatus === 'downloading' ? 'animate-spin' : ''}`} />
                <span className="text-[10px] uppercase tracking-wider">
                  {updateStatus === 'downloaded' 
                    ? (language === 'ar' ? 'تثبيت التحديث' : 'Install Update') 
                    : (language === 'ar' ? 'تحديث متوفر' : 'Update Available')}
                </span>
              </button>
            )}

            {/* Notification Button & Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationOpen(prev => !prev)}
                className={`relative p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer ${isNotificationOpen ? 'text-slate-200 bg-slate-800/40 border-slate-700' : ''}`}
              >
                <Bell className="h-4 w-4" />
                {(auditLogs.length > 0 || alerts.length > 0) && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                )}
              </button>

              {isNotificationOpen && (
                <div 
                  className={`absolute ${isRTL ? 'left-8 text-right' : 'right-8 text-left'} top-[54px] w-[350px] bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 animate-fade-in backdrop-blur-md`}
                  style={{ WebkitAppRegion: 'no-drag' }}
                >
                  {/* Header Title */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">{t('layout.notifications')}</span>
                      {(auditLogs.length > 0 || alerts.length > 0) && (
                        <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-black font-mono">
                          {auditLogs.length + alerts.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button 
                        onClick={() => loadNotificationsData()}
                        disabled={loadingNotifications}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        title={t('layout.refresh') || 'Refresh'}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingNotifications ? 'animate-spin' : ''}`} />
                      </button>
                      <button 
                        onClick={() => setIsNotificationOpen(false)}
                        className="p-1 text-slate-450 hover:text-slate-200 transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
                        title={t('common.close') || 'Close'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Category Switch Tabs */}
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                    <button 
                      onClick={() => setActiveCategory('logs')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${activeCategory === 'logs' ? 'bg-slate-900 border border-slate-800 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-350 border-transparent'}`}
                    >
                      {language === 'ar' ? 'سجل العمليات' : 'System Logs'} ({auditLogs.length})
                    </button>
                    <button 
                      onClick={() => setActiveCategory('keep-eyes')}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${activeCategory === 'keep-eyes' ? 'bg-slate-900 border border-slate-800 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-350 border-transparent'}`}
                    >
                      {language === 'ar' ? 'تنبيهات المراقبة' : 'Alerts'} ({alerts.length})
                    </button>
                  </div>

                  {/* Content Scroll Area */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin font-sans">
                    {loadingNotifications && auditLogs.length === 0 && alerts.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-[10px] font-medium flex items-center justify-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        {t('layout.fetchingNotifications')}
                      </div>
                    ) : activeCategory === 'logs' ? (
                      auditLogs.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          {t('layout.noActivityLogs')}
                        </div>
                      ) : (
                        auditLogs.slice(0, 15).map(log => (
                          <div key={log.id} className="flex gap-2.5 items-start p-2.5 bg-slate-955/20 border border-slate-850/30 hover:border-slate-800/80 hover:bg-slate-850/20 rounded-xl transition-all duration-200 text-right">
                            <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${getLogIconBg(log.action)}`}>
                              {getLogIcon(log.action)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-slate-200 leading-snug">{formatLogAction(log.action, language)}</p>
                              <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">{log.description}</p>
                              <span className="text-[8px] text-slate-500 font-semibold font-mono mt-1.5 block">{formatTimeAgo(log.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      alerts.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-[10px] flex flex-col items-center justify-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-emerald-400 font-bold tracking-wider">{t('layout.allSettled') || 'ALL SETTLED'}</span>
                        </div>
                      ) : (
                        alerts.map((alertItem, idx) => (
                          <div key={alertItem.id || idx} className="flex gap-2.5 items-start p-2.5 bg-slate-955/20 border border-slate-850/40 rounded-xl hover:border-slate-800/70 transition-all duration-200 text-right">
                            <span className="mt-1 shrink-0">
                              {alertItem.severity === 'high' ? (
                                <AlertTriangle className="h-4 w-4 text-rose-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded font-mono tracking-wider border ${
                                alertItem.type === 'student' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                alertItem.type === 'teacher' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              }`}>
                                {language === 'ar' 
                                  ? (alertItem.type === 'student' ? 'طالب' : alertItem.type === 'teacher' ? 'أستاذ' : 'نظام')
                                  : alertItem.type}
                              </span>
                              <p className="text-[9.5px] text-slate-300 leading-relaxed mt-1.5 font-semibold">{alertItem.text}</p>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Window Controls (Always last in JSX -> Far Right in LTR, Far Left in RTL) */}
            <div className={`flex items-center gap-1 ${
              isRTL 
                ? 'border-r border-slate-800/80 pr-3 mr-1' 
                : 'border-l border-slate-800/85 pl-3 ml-1'
            }`}>
              {isRTL ? (
                <>
                  <button
                    onClick={handleMinimize}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
                    title={t('common.minimize') || 'Minimize'}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleMaximize}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
                    title={t('common.maximize') || 'Maximize'}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title={t('common.close') || 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleMinimize}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
                    title={t('common.minimize') || 'Minimize'}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleMaximize}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
                    title={t('common.maximize') || 'Maximize'}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title={t('common.close') || 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* System / Global / Custom Notification Banner (Slim full-width top bar - Purple theme) */}
        {!dismissedNotification && (systemNotification.globalMessage || systemNotification.customMessage) && (
          <div className="w-full bg-purple-500/10 border-b border-purple-500/20 px-6 py-2 flex items-center justify-between gap-4 animate-fade-in text-left rtl:text-right text-xs shadow-md shadow-purple-500/5 select-text shrink-0" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-lg bg-purple-600/15 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Bell className="h-3.5 w-3.5 animate-bounce" />
              </div>
              <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
                <span className="text-[8px] font-bold text-purple-400 uppercase tracking-wider bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/20 whitespace-nowrap shrink-0">
                  {isRTL ? 'تنبيه النظام' : 'System Announcement'}
                </span>
                <p className="text-[11px] text-slate-205 font-semibold truncate">
                  {systemNotification.customMessage || systemNotification.globalMessage}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissNotification}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800/40 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Page Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-900/20 select-text relative" dir="ltr">
          <div className="max-w-7xl mx-auto h-full space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <Outlet />
          </div>
        </main>

        {/* Custom Auto-Updater Modal */}
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          status={updateStatus}
          info={updateInfo}
          progress={downloadProgress}
          error={updateError}
          onStartDownload={startUpdateDownload}
          onInstall={installUpdateAndRestart}
          language={language}
        />
        
      </div>
    </div>
  )
}
