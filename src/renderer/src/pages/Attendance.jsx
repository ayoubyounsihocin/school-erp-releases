import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import CustomDatePicker from '../components/CustomDatePicker'
import {
  CalendarCheck,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Check,
  Trash2,
  Edit2,
  Calendar,
  Users,
  FileText,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Mail
} from 'lucide-react'

function Attendance() {
  const { language, t, isRTL } = useLanguage()
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}')
  const hasPermission = (permissionKey) => {
    if (currentUser.role === 'Admin') return true;
    const userPerms = currentUser.permissions || '';
    const permsArr = userPerms.split(',').map(s => s.trim());
    if (permsArr.includes(permissionKey)) return true;
    const parts = permissionKey.split(':');
    if (parts.length > 1 && permsArr.includes(parts[0])) return true;
    return false;
  };
  const [activeTab, setActiveTab] = useState('daily')
  const [expandedSheetKeys, setExpandedSheetKeys] = useState([])
  const triggeredNotifications = React.useRef(new Set())

  const toggleSheetExpand = (key) => {
    setExpandedSheetKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }
  
  // Daily Sheet State
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')

  // Saved Sheets Filters & Search
  const [savedSearch, setSavedSearch] = useState('')
  const [savedDateFilter, setSavedDateFilter] = useState('')

  // Edit Saved Sheet Modal State
  const [editingSavedSheet, setEditingSavedSheet] = useState(null) // { date, CourseId, courseTitle }
  const [editingPeople, setEditingPeople] = useState([])
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [loadingEditSheet, setLoadingEditSheet] = useState(false)
  const [savingEditSheet, setSavingEditSheet] = useState(false)
  const [editSheetSearch, setEditSheetSearch] = useState('')
  
  const getTodayString = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const toLocalYYYYMMDD = (date) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const [selectedDate, setSelectedDate] = useState(getTodayString())

  const [sheetStudents, setSheetStudents] = useState([])
  const [sheetTeacher, setSheetTeacher] = useState(null)
  const [existingAbsences, setExistingAbsences] = useState([])
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [sheetSearch, setSheetSearch] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  
  // History Logs State
  const [absencesLog, setAbsencesLog] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const list = await ipcService.getTeachers()
        setTeachers(list.filter(t => t.status === 'Active'))
      } catch (err) {
        console.error("Failed to load teachers in Attendance page:", err)
      }
    }
    fetchTeachers()
  }, [])
  
  // Log Filters
  const [logSearch, setLogSearch] = useState('')
  const [logCourseFilter, setLogCourseFilter] = useState('All')
  const [logRoleFilter, setLogRoleFilter] = useState('All')
  const [logStatusFilter, setLogStatusFilter] = useState('All')
  
  // Inline edit state for logs
  const [editingLogId, setEditingLogId] = useState(null)
  const [editingReasonText, setEditingReasonText] = useState('')

  const getDayOfWeekString = (dateStr) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dateObj.getDay()]
  }

  const getTranslatedDay = (dayName) => {
    const translations = {
      'Sunday': language === 'ar' ? 'الأحد' : 'Sunday',
      'Monday': language === 'ar' ? 'الاثنين' : 'Monday',
      'Tuesday': language === 'ar' ? 'الثلاثاء' : 'Tuesday',
      'Wednesday': language === 'ar' ? 'الأربعاء' : 'Wednesday',
      'Thursday': language === 'ar' ? 'الخميس' : 'Thursday',
      'Friday': language === 'ar' ? 'الجمعة' : 'Friday',
      'Saturday': language === 'ar' ? 'السبت' : 'Saturday'
    }
    return translations[dayName] || dayName
  }

  const currentDayOfWeek = getDayOfWeekString(selectedDate)
  const translatedDayName = getTranslatedDay(currentDayOfWeek)

  const isBirthdayToday = (dobString) => {
    if (!dobString) return false;
    try {
      const today = new Date();
      const todayStr = today.toISOString().substring(5, 10); // "MM-DD"
      const cleanDob = dobString.trim();
      if (cleanDob.length >= 10) {
        return cleanDob.substring(5, 10) === todayStr;
      } else if (cleanDob.length === 5) {
        return cleanDob === todayStr;
      }
      const dob = new Date(dobString);
      if (!isNaN(dob.getTime())) {
        return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleCourseChange = async (newCourseId) => {
    if (isDirty) {
      const msg = language === 'ar'
        ? 'لديك تعديلات غير محفوظة. هل أنت متأكد من تغيير المادة؟ سيتم فقدان التغييرات.'
        : 'You have unsaved changes. Are you sure you want to change the course? Your changes will be lost.'
      if (!(await confirm(msg))) return
    }
    setSelectedCourseId(newCourseId)
    setIsDirty(false)
  }

  const handleDateChange = async (newDateStr) => {
    if (isDirty) {
      const msg = language === 'ar'
        ? 'لديك تعديلات غير محفوظة. هل أنت متأكد من تغيير التاريخ؟ سيتم فقدان التغييرات.'
        : 'You have unsaved changes. Are you sure you want to change the date? Your changes will be lost.'
      if (!(await confirm(msg))) return
    }
    setSelectedDate(newDateStr)
    setIsDirty(false)
  }

  const handleTabChange = async (newTab) => {
    if (activeTab === 'daily' && isDirty) {
      const msg = language === 'ar'
        ? 'لديك تعديلات غير محفوظة. هل أنت متأكد من الانتقال إلى تبويب آخر؟ سيتم فقدان التغييرات.'
        : 'You have unsaved changes. Are you sure you want to switch tabs? Your changes will be lost.'
      if (!(await confirm(msg))) return
    }
    setActiveTab(newTab)
  }

  const coursesScheduledToday = courses.filter(c => {
    if (!c.Schedules || c.Schedules.length === 0) return false
    return c.Schedules.some(s => s.day_of_week === currentDayOfWeek)
  })

  const filteredCourses = courses.filter(c => {
    if (!c.Schedules || c.Schedules.length === 0) return false
    const matchesDay = c.Schedules.some(s => s.day_of_week === currentDayOfWeek)
    if (!matchesDay) return false
    
    // Hide if already saved (i.e. has records in absencesLog for selectedDate)
    const alreadySaved = absencesLog.some(log => log.date === selectedDate && log.CourseId === c.id)
    return !alreadySaved
  })

  // Load all courses on mount
  useEffect(() => {
    loadCourses()
    loadAbsencesLog()
  }, [])

  // Auto-select valid course for the selected day of the week
  useEffect(() => {
    const currentDay = getDayOfWeekString(selectedDate)
    const validCourses = courses.filter(c => {
      if (!c.Schedules || c.Schedules.length === 0) return false
      const matchesDay = c.Schedules.some(s => s.day_of_week === currentDay)
      if (!matchesDay) return false
      const alreadySaved = absencesLog.some(log => log.date === selectedDate && log.CourseId === c.id)
      return !alreadySaved
    })
    
    if (validCourses.length > 0) {
      const isStillValid = validCourses.some(c => String(c.id) === String(selectedCourseId))
      if (!isStillValid) {
        setSelectedCourseId(String(validCourses[0].id))
      }
    } else {
      setSelectedCourseId('')
    }
  }, [selectedDate, courses, absencesLog])

  // Reload Daily Sheet when course, date, or courses list changes
  useEffect(() => {
    if (selectedCourseId) {
      loadDailySheet()
    } else {
      setSheetStudents([])
      setSheetTeacher(null)
    }
  }, [selectedCourseId, selectedDate, courses])

  const speakText = (text) => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US'
        window.speechSynthesis.speak(utterance)
      }
    } catch (err) {
      console.error("Speech synthesis failed:", err)
    }
  }

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.5)
    } catch (err) {
      console.error("Failed to play beep:", err)
    }
  }

  const showNotification = (title, body) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (courses.length === 0) return

    const checkSchedules = () => {
      const todayStr = getTodayString()
      const currentDay = getDayOfWeekString(todayStr)
      
      const now = new Date()
      const currentHours = now.getHours()
      const currentMinutes = now.getMinutes()
      const currentTimeInMinutes = currentHours * 60 + currentMinutes

      courses.forEach(course => {
        if (!course.Schedules || course.Schedules.length === 0) return
        course.Schedules.forEach(s => {
          if (s.day_of_week !== currentDay) return

          // Parse slot time (e.g. "14:00")
          const parts = s.time_slot.split(':')
          const slotHours = parseInt(parts[0], 10)
          const slotMinutes = parts[1] ? parseInt(parts[1], 10) : 0
          const slotTimeInMinutes = slotHours * 60 + slotMinutes

          const timeDiff = slotTimeInMinutes - currentTimeInMinutes

          const key30 = `${todayStr}_${course.id}_30`
          const key15 = `${todayStr}_${course.id}_15`
          const key0 = `${todayStr}_${course.id}_0`

          if (timeDiff === 30 && !triggeredNotifications.current.has(key30)) {
            triggeredNotifications.current.add(key30)
            const title = language === 'ar' ? 'تذكير بالدرس' : 'Class Reminder'
            const body = language === 'ar' 
              ? `درس "${course.title}" سيبدأ بعد 30 دقيقة في ${s.time_slot}.` 
              : `Class "${course.title}" is starting in 30 minutes at ${s.time_slot}.`
            showNotification(title, body)
            speakText(language === 'ar' ? `درس ${course.title} سيبدأ بعد ثلاثين دقيقة` : `Class ${course.title} starts in 30 minutes`)
          }

          if (timeDiff === 15 && !triggeredNotifications.current.has(key15)) {
            triggeredNotifications.current.add(key15)
            const title = language === 'ar' ? 'تذكير بالدرس' : 'Class Reminder'
            const body = language === 'ar' 
              ? `درس "${course.title}" سيبدأ بعد 15 دقيقة في ${s.time_slot}.` 
              : `Class "${course.title}" is starting in 15 minutes at ${s.time_slot}.`
            showNotification(title, body)
            speakText(language === 'ar' ? `درس ${course.title} سيبدأ بعد خمسة عشر دقيقة` : `Class ${course.title} starts in 15 minutes`)
          }

          if (timeDiff === 0 && !triggeredNotifications.current.has(key0)) {
            triggeredNotifications.current.add(key0)
            const title = language === 'ar' ? 'بدء الدرس الآن' : 'Class Starting Now'
            const body = language === 'ar' 
              ? `درس "${course.title}" يبدأ الآن في ${s.room}.` 
              : `Class "${course.title}" is starting now in ${s.room}.`
            showNotification(title, body)
            playBeep()
            speakText(language === 'ar' ? `بدأ درس ${course.title} الآن` : `Class ${course.title} is starting now`)
          }
        })
      })
    }

    const interval = setInterval(checkSchedules, 10000)
    checkSchedules()

    return () => clearInterval(interval)
  }, [courses, language])

  async function loadCourses() {
    try {
      const data = await ipcService.getCourses()
      if (Array.isArray(data)) {
        setCourses(data)
      } else {
        console.error("Failed to load courses (expected array):", data)
        setCourses([])
      }
    } catch (error) {
      console.error("Failed to load courses:", error)
      setCourses([])
    }
  }

  async function loadAbsencesLog() {
    setLoadingLogs(true)
    try {
      const data = await ipcService.getAbsences({})
      if (Array.isArray(data)) {
        setAbsencesLog(data)
      } else {
        console.error("Failed to load absences log (expected array):", data)
        setAbsencesLog([])
      }
    } catch (error) {
      console.error("Failed to load absences log:", error)
      setAbsencesLog([])
    } finally {
      setLoadingLogs(false)
    }
  }

  async function loadDailySheet() {
    setLoadingSheet(true)
    setIsDirty(false)
    try {
      let fetchedAbsences = []
      if (window.api) {
        fetchedAbsences = await ipcService.getAbsences({
          CourseId: selectedCourseId,
          date: selectedDate
        })
        setExistingAbsences(fetchedAbsences)
      }

      const selectedCourseObj = courses.find(c => String(c.id) === selectedCourseId)
      
      // Load Teacher
      const teacher = selectedCourseObj?.Teacher
      if (teacher) {
        const absRecord = fetchedAbsences.find(a => a.TeacherId === teacher.id)
        setSheetTeacher({
          id: teacher.id,
          full_name: teacher.full_name,
          info: teacher.specialty || '',
          status: absRecord ? absRecord.status : 'Present',
          reason: absRecord ? (absRecord.reason || '') : '',
          absenceId: absRecord ? absRecord.id : null
        })
      } else {
        setSheetTeacher(null)
      }

      // Load Students
      const students = await ipcService.getCourseStudents(selectedCourseId)
      
      let allCourseAbsences = await ipcService.getAbsences({ CourseId: selectedCourseId })
      const uniqueDatesForCourse = [...new Set(allCourseAbsences.map(a => a.date))].sort()
      
      const coursePrice = selectedCourseObj ? selectedCourseObj.price : 0
      const schedulesPerWeek = selectedCourseObj?.Schedules?.length || 2
      const sessionsPerMonth = schedulesPerWeek * 4

      const filteredStudents = students.filter(s => {
        // Show if student already has a saved attendance/absence record for this date
        const hasRecordForThisDate = fetchedAbsences.some(a => a.StudentId === s.id)
        if (hasRecordForThisDate) return true

        const studentCourseAbsences = (s.Absences || []).filter(a => String(a.CourseId) === String(selectedCourseId))
        let studyStartDate = ''
        if (studentCourseAbsences.length > 0) {
          const sorted = [...studentCourseAbsences].sort((a, b) => a.date.localeCompare(b.date))
          studyStartDate = sorted[0].date
        } else {
          const enrollmentDateStr = s.StudentCourses?.createdAt || s.createdAt || null
          studyStartDate = toLocalYYYYMMDD(enrollmentDateStr) || getTodayString()
        }
        
        return selectedDate >= studyStartDate
      })

      const mapped = filteredStudents.map(s => {
        const absRecord = fetchedAbsences.find(a => a.StudentId === s.id)
        
        const totalPaid = (s.Payments || [])
          .filter(p => String(p.CourseId) === String(selectedCourseId))
          .reduce((sum, p) => sum + (p.amount || 0), 0)
        const paidSessions = coursePrice > 0 ? Math.floor((totalPaid / coursePrice) * sessionsPerMonth) : 0
        
        const studentCourseAbsences = (s.Absences || []).filter(a => String(a.CourseId) === String(selectedCourseId))
        let studyStartDate = ''
        if (studentCourseAbsences.length > 0) {
          const sorted = [...studentCourseAbsences].sort((a, b) => a.date.localeCompare(b.date))
          studyStartDate = sorted[0].date
        } else {
          const enrollmentDateStr = s.StudentCourses?.createdAt || s.createdAt || null
          studyStartDate = toLocalYYYYMMDD(enrollmentDateStr) || getTodayString()
        }
        const studentUniqueDates = uniqueDatesForCourse.filter(d => d >= studyStartDate)

        let attended = 0
        studentUniqueDates.forEach(d => {
          // Check if instructor was absent on this date
          const teacherAbsence = allCourseAbsences.find(a => a.date === d && a.TeacherId !== null)
          if (teacherAbsence && teacherAbsence.status !== 'Present') {
            // Instructor was absent, class does not count as attended/billed for the student!
            return
          }

          const record = studentCourseAbsences.find(a => a.date === d)
          if (record) {
            if (record.status === 'Present') attended++
          } else {
            attended++
          }
        })
        const remaining = paidSessions - attended

        return {
          id: s.id,
          full_name: s.full_name,
          info: s.phone || '',
          status: absRecord ? absRecord.status : 'Present',
          reason: absRecord ? (absRecord.reason || '') : '',
          absenceId: absRecord ? absRecord.id : null,
          remaining,
          date_of_birth: s.date_of_birth,
          email: s.email,
          parent_email: s.parent_email
        }
      })
      setSheetStudents(mapped)

    } catch (error) {
      console.error("Error loading daily sheet:", error)
    } finally {
      setLoadingSheet(false)
    }
  }

  const handleStatusChange = (personId, newStatus) => {
    setSheetStudents(prev =>
      prev.map(p => {
        if (p.id === personId) {
          return { ...p, status: newStatus }
        }
        return p
      })
    )
    setIsDirty(true)
  }

  const handleSendAbsenceEmail = async (person) => {
    if (!person.parent_email) {
      alert(language === 'ar' ? 'البريد الإلكتروني لولي الأمر غير مسجل لهذا الطالب. يرجى إضافته في شاشة الطلاب أولاً.' : 'Parent email is not registered for this student. Please set it in Students page.')
      return
    }
    
    const confirmSend = await confirm(
      language === 'ar' 
        ? `هل تريد إرسال بريد إلكتروني تنبيهي لولي أمر الطالب ${person.full_name}؟` 
        : `Do you want to send an absence notification email to ${person.full_name}'s parent?`
    )
    if (!confirmSend) return

    try {
      const subject = language === 'ar' ? `إشعار غياب: ${person.full_name}` : `Absence Notification: ${person.full_name}`
      const body = language === 'ar' 
        ? `عزيزي ولي الأمر،\n\nنود إعلامكم بأن ابنكم/ابنتكم {student_name} قد تم تسجيل غيابه اليوم الموافق {date} عن حصة مادة {course_title}.\n\nنشكر تفهمكم وتعاونكم.\nإدارة المدرسة.`
        : `Dear Parent,\n\nWe would like to inform you that your child {student_name} was marked absent today ({date}) for the course {course_title}.\n\nThank you for your cooperation.\nSchool Administration.`
      
      const selectedCourseObj = courses.find(c => String(c.id) === String(selectedCourseId))
      const courseTitle = selectedCourseObj ? selectedCourseObj.title : 'Course'

      const res = await ipcService.sendEmail({
        to: person.parent_email,
        subject,
        body,
        placeholders: {
          student_name: person.full_name,
          date: selectedDate,
          course_title: courseTitle
        }
      })

      if (res && res.success) {
        alert(language === 'ar' ? 'تم إرسال إيميل التنبيه بنجاح!' : 'Absence alert email sent successfully!')
      } else {
        alert(language === 'ar' ? `فشل في إرسال الإيميل: ${res.error}` : `Failed to send email: ${res.error}`)
      }
    } catch (err) {
      console.error(err)
      alert(language === 'ar' ? 'حدث خطأ أثناء عملية الإرسال.' : 'Error occurred while sending email.')
    }
  }

  const handleReasonChange = (personId, newReason) => {
    setSheetStudents(prev =>
      prev.map(p => {
        if (p.id === personId) {
          return { ...p, reason: newReason }
        }
        return p
      })
    )
    setIsDirty(true)
  }

  const handleTeacherStatusChange = (newStatus) => {
    setSheetTeacher(prev => {
      if (!prev) return null
      const subId = newStatus === 'Present' ? '' : prev.substitute_teacher_id
      return { ...prev, status: newStatus, substitute_teacher_id: subId }
    })
    setIsDirty(true)
  }

  const handleTeacherReasonChange = (newReason) => {
    setSheetTeacher(prev => prev ? { ...prev, reason: newReason } : null)
    setIsDirty(true)
  }

  const handleMarkAllPresent = () => {
    setSheetStudents(prev => prev.map(p => ({ ...p, status: 'Present', reason: '' })))
    if (sheetTeacher) {
      setSheetTeacher(prev => ({ ...prev, status: 'Present', reason: '' }))
    }
    setIsDirty(true)
  }

  const handleMarkAllAbsent = () => {
    setSheetStudents(prev => prev.map(p => ({ ...p, status: 'Unexcused', reason: '' })))
    if (sheetTeacher) {
      setSheetTeacher(prev => ({ ...prev, status: 'Unexcused', reason: '' }))
    }
    setIsDirty(true)
  }

  const handleSaveAttendance = async () => {
    setSavingSheet(true)
    try {
      if (!window.api) {
        alert("IPC API not available.")
        return
      }

      // Save Instructor
      if (sheetTeacher) {
        const hasExisting = sheetTeacher.absenceId !== null
        const payload = {
          date: selectedDate,
          type: 'Teacher',
          status: sheetTeacher.status,
          reason: sheetTeacher.reason || null,
          CourseId: Number(selectedCourseId),
          StudentId: null,
          TeacherId: sheetTeacher.id,
          substitute_teacher_id: sheetTeacher.substitute_teacher_id ? Number(sheetTeacher.substitute_teacher_id) : null
        }

        if (hasExisting) {
          const orig = existingAbsences.find(a => a.id === sheetTeacher.absenceId)
          if (orig && (
            orig.status !== sheetTeacher.status || 
            orig.reason !== sheetTeacher.reason || 
            orig.substitute_teacher_id !== payload.substitute_teacher_id
          )) {
            await ipcService.updateAbsence(sheetTeacher.absenceId, payload)
          }
        } else {
          await ipcService.addAbsence(payload)
        }
      }

      // Save Students
      for (const p of sheetStudents) {
        const hasExisting = p.absenceId !== null
        const payload = {
          date: selectedDate,
          type: 'Student',
          status: p.status,
          reason: p.reason || null,
          CourseId: Number(selectedCourseId),
          StudentId: p.id,
          TeacherId: null
        }

        if (hasExisting) {
          const orig = existingAbsences.find(a => a.id === p.absenceId)
          if (orig && (orig.status !== p.status || orig.reason !== p.reason)) {
            await ipcService.updateAbsence(p.absenceId, payload)
          }
        } else {
          await ipcService.addAbsence(payload)
        }
      }

      alert(t('attendance.successRecorded') || "Attendance saved successfully!")
      setIsDirty(false)
      await loadDailySheet()
      await loadAbsencesLog()
    } catch (error) {
      console.error("Failed to save attendance:", error)
      alert("An error occurred while saving attendance.")
    } finally {
      setSavingSheet(false)
    }
  }

  const handleToggleLogExcuse = async (log) => {
    try {
      const newStatus = log.status === 'Excused' ? 'Unexcused' : 'Excused'
      const res = await ipcService.updateAbsence(log.id, { status: newStatus })
      if (res.error) {
        alert(res.error)
      } else {
        loadAbsencesLog()
        if (selectedCourseId) loadDailySheet()
      }
    } catch (error) {
      console.error("Failed to toggle excuse status:", error)
    }
  }

  const handleDeleteLog = async (id) => {
    if (!(await confirm(t('common.confirmDelete') || "Are you sure you want to delete this record?"))) return
    try {
      const res = await ipcService.deleteAbsence(id)
      if (res.error) {
        alert(res.error)
      } else {
        loadAbsencesLog()
        if (selectedCourseId) loadDailySheet()
      }
    } catch (error) {
      console.error("Failed to delete absence log:", error)
    }
  }

  const handleSaveReasonEdit = async (id) => {
    try {
      const res = await ipcService.updateAbsence(id, { reason: editingReasonText })
      if (res.error) {
        alert(res.error)
      } else {
        setEditingLogId(null)
        loadAbsencesLog()
        if (selectedCourseId) loadDailySheet()
      }
    } catch (error) {
      console.error("Failed to save reason edit:", error)
    }
  }

  // Load sheet people for edit modal
  useEffect(() => {
    if (editingSavedSheet) {
      loadEditingSheetPeople()
    }
  }, [editingSavedSheet])

  async function loadEditingSheetPeople() {
    if (!editingSavedSheet) return
    setLoadingEditSheet(true)
    setEditSheetSearch('')
    try {
      const { CourseId, date } = editingSavedSheet
      let fetchedAbsences = await ipcService.getAbsences({
        CourseId: String(CourseId),
        date
      })
      
      const selectedCourseObj = courses.find(c => String(c.id) === String(CourseId))

      // Load Teacher
      const teacher = selectedCourseObj?.Teacher
      if (teacher) {
        const absRecord = fetchedAbsences.find(a => a.TeacherId === teacher.id)
        setEditingTeacher({
          id: teacher.id,
          full_name: teacher.full_name,
          info: teacher.specialty || '',
          status: absRecord ? absRecord.status : 'Present',
          reason: absRecord ? (absRecord.reason || '') : '',
          substitute_teacher_id: absRecord ? (absRecord.substitute_teacher_id || '') : '',
          absenceId: absRecord ? absRecord.id : null
        })
      } else {
        setEditingTeacher(null)
      }

      // Load Students
      const students = await ipcService.getCourseStudents(String(CourseId))
      
      const coursePrice = selectedCourseObj ? selectedCourseObj.price : 0
      const schedulesPerWeek = selectedCourseObj?.Schedules?.length || 2
      const sessionsPerMonth = schedulesPerWeek * 4

      let allCourseAbsences = await ipcService.getAbsences({ CourseId: String(CourseId) })
      const uniqueDatesForCourse = [...new Set(allCourseAbsences.map(a => a.date))].sort()

      const filteredStudents = students.filter(s => {
        // Show if student already has a saved attendance/absence record for this date
        const hasRecordForThisDate = fetchedAbsences.some(a => a.StudentId === s.id)
        if (hasRecordForThisDate) return true

        const studentCourseAbsences = (s.Absences || []).filter(a => String(a.CourseId) === String(CourseId))
        let studyStartDate = ''
        if (studentCourseAbsences.length > 0) {
          const sorted = [...studentCourseAbsences].sort((a, b) => a.date.localeCompare(b.date))
          studyStartDate = sorted[0].date
        } else {
          const enrollmentDateStr = s.StudentCourses?.createdAt || s.createdAt || null
          studyStartDate = toLocalYYYYMMDD(enrollmentDateStr) || getTodayString()
        }
        
        return date >= studyStartDate
      })

      const mapped = filteredStudents.map(s => {
        const absRecord = fetchedAbsences.find(a => a.StudentId === s.id)
        
        const totalPaid = (s.Payments || [])
          .filter(p => String(p.CourseId) === String(CourseId))
          .reduce((sum, p) => sum + (p.amount || 0), 0)
        const paidSessions = coursePrice > 0 ? Math.floor((totalPaid / coursePrice) * sessionsPerMonth) : 0
        
        const studentCourseAbsences = (s.Absences || []).filter(a => String(a.CourseId) === String(CourseId))
        let studyStartDate = ''
        if (studentCourseAbsences.length > 0) {
          const sorted = [...studentCourseAbsences].sort((a, b) => a.date.localeCompare(b.date))
          studyStartDate = sorted[0].date
        } else {
          const enrollmentDateStr = s.StudentCourses?.createdAt || s.createdAt || null
          studyStartDate = toLocalYYYYMMDD(enrollmentDateStr) || getTodayString()
        }
        const studentUniqueDates = uniqueDatesForCourse.filter(d => d >= studyStartDate)

        let attended = 0
        studentUniqueDates.forEach(d => {
          // Check if instructor was absent on this date
          const teacherAbsence = allCourseAbsences.find(a => a.date === d && a.TeacherId !== null)
          if (teacherAbsence && teacherAbsence.status !== 'Present') {
            return
          }

          const record = studentCourseAbsences.find(a => a.date === d)
          if (record) {
            if (record.status === 'Present') attended++
          } else {
            attended++
          }
        })
        const remaining = paidSessions - attended

        return {
          id: s.id,
          full_name: s.full_name,
          info: s.phone || '',
          status: absRecord ? absRecord.status : 'Present',
          reason: absRecord ? (absRecord.reason || '') : '',
          absenceId: absRecord ? absRecord.id : null,
          remaining,
          date_of_birth: s.date_of_birth
        }
      })
      setEditingPeople(mapped)

    } catch (error) {
      console.error("Error loading editing sheet people:", error)
      alert("Error loading editing sheet: " + error.message)
    } finally {
      setLoadingEditSheet(false)
    }
  }

  const handleEditStatusChange = (personId, newStatus) => {
    setEditingPeople(prev =>
      prev.map(p => {
        if (p.id === personId) {
          return { ...p, status: newStatus }
        }
        return p
      })
    )
  }

  const handleEditReasonChange = (personId, newReason) => {
    setEditingPeople(prev =>
      prev.map(p => {
        if (p.id === personId) {
          return { ...p, reason: newReason }
        }
        return p
      })
    )
  }

  const handleEditTeacherStatusChange = (newStatus) => {
    setEditingTeacher(prev => prev ? { ...prev, status: newStatus } : null)
  }

  const handleEditTeacherReasonChange = (newReason) => {
    setEditingTeacher(prev => prev ? { ...prev, reason: newReason } : null)
  }

  const handleEditMarkAllPresent = () => {
    setEditingPeople(prev => prev.map(p => ({ ...p, status: 'Present', reason: '' })))
  }

  const handleSaveEditSheet = async () => {
    if (!editingSavedSheet) return
    setSavingEditSheet(true)
    try {
      const { CourseId, date } = editingSavedSheet
      
      // Save Students
      for (const p of editingPeople) {
        const hasExisting = p.absenceId !== null
        const payload = {
          date,
          type: 'Student',
          status: p.status,
          reason: p.reason || null,
          CourseId: Number(CourseId),
          StudentId: p.id,
          TeacherId: null
        }

        if (hasExisting) {
          await ipcService.updateAbsence(p.absenceId, payload)
        } else {
          await ipcService.addAbsence(payload)
        }
      }

      // Save Instructor
      if (editingTeacher) {
        const hasExisting = editingTeacher.absenceId !== null
        const payload = {
          date,
          type: 'Teacher',
          status: editingTeacher.status,
          reason: editingTeacher.reason || null,
          CourseId: Number(CourseId),
          StudentId: null,
          TeacherId: editingTeacher.id,
          substitute_teacher_id: editingTeacher.substitute_teacher_id ? Number(editingTeacher.substitute_teacher_id) : null
        }

        if (hasExisting) {
          await ipcService.updateAbsence(editingTeacher.absenceId, payload)
        } else {
          await ipcService.addAbsence(payload)
        }
      }

      alert(t('attendance.sheetSavedSuccess') || "Attendance updated successfully!")
      setEditingSavedSheet(null)
      await loadAbsencesLog()
      if (selectedCourseId) await loadDailySheet()
    } catch (error) {
      console.error("Failed to save edited attendance sheet:", error)
      alert("An error occurred while saving edited attendance.")
    } finally {
      setSavingEditSheet(false)
    }
  }

  const handleDeleteSavedSheet = async (sheet) => {
    const confirmMessage = t('attendance.confirmDeleteSheet') || "Are you sure you want to delete this saved attendance sheet? This will delete all attendance records associated with it."
    if (!(await confirm(confirmMessage))) return
    
    setLoadingLogs(true)
    try {
      for (const record of sheet.records) {
        await ipcService.deleteAbsence(record.id)
      }
      alert(t('attendance.sheetResetSuccess') || "Attendance sheet deleted successfully.")
      await loadAbsencesLog()
      if (selectedCourseId) await loadDailySheet()
    } catch (error) {
      console.error("Failed to delete attendance sheet:", error)
      alert("An error occurred while deleting the attendance sheet.")
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleResetDailySheet = async () => {
    if (!(await confirm(t('attendance.confirmDeleteSheet') || "Are you sure you want to reset this sheet? This will delete all attendance records associated with this session."))) return
    setSavingSheet(true)
    try {
      for (const record of existingAbsences) {
        await ipcService.deleteAbsence(record.id)
      }
      alert(t('attendance.sheetResetSuccess') || "Attendance sheet deleted successfully. You can now re-take attendance.")
      await loadDailySheet()
      await loadAbsencesLog()
    } catch (error) {
      console.error("Failed to reset daily sheet:", error)
      alert("Failed to reset attendance sheet.")
    } finally {
      setSavingSheet(false)
    }
  }

  const courseTitleMap = courses.reduce((acc, c) => {
    acc[c.id] = c.title
    return acc
  }, {})

  const getDatesForDayOfWeek = (dayName, startDate, endDate) => {
    const dates = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const targetDayIndex = days.indexOf(dayName)
    if (targetDayIndex === -1) return dates

    let current = new Date(start)
    while (current <= end) {
      if (current.getDay() === targetDayIndex) {
        const yyyy = current.getFullYear()
        const mm = String(current.getMonth() + 1).padStart(2, '0')
        const dd = String(current.getDate()).padStart(2, '0')
        dates.push(`${yyyy}-${mm}-${dd}`)
      }
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const savedSheets = React.useMemo(() => {
    const groups = {}
    absencesLog.forEach(log => {
      const key = `${log.date}_${log.CourseId}`
      if (!groups[key]) {
        groups[key] = {
          key,
          date: log.date,
          CourseId: log.CourseId,
          courseTitle: log.Course ? log.Course.title : (courseTitleMap[log.CourseId] || 'Unknown Course'),
          records: [],
          isFilled: true
        }
      }
      groups[key].records.push(log)
    })

    // Generate virtual pending sheets for the last 30 days
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)

    courses.forEach(course => {
      if (!course.Schedules || course.Schedules.length === 0) return

      // Limit start date by course creation
      let courseCreatedDate = null
      if (course.createdAt) {
        courseCreatedDate = new Date(course.createdAt)
      }

      // Limit start date by teacher creation
      let teacherCreatedDate = null
      if (course.Teacher && course.Teacher.createdAt) {
        teacherCreatedDate = new Date(course.Teacher.createdAt)
      }

      course.Schedules.forEach(s => {
        let limitStartDate = thirtyDaysAgo
        if (courseCreatedDate && courseCreatedDate > limitStartDate) {
          limitStartDate = courseCreatedDate
        }
        if (teacherCreatedDate && teacherCreatedDate > limitStartDate) {
          limitStartDate = teacherCreatedDate
        }

        const startDateStr = toLocalYYYYMMDD(limitStartDate)
        const endDateStr = toLocalYYYYMMDD(today)

        const scheduleDates = getDatesForDayOfWeek(s.day_of_week, startDateStr, endDateStr)
        scheduleDates.forEach(date => {
          // Check if there is at least one active student enrolled in this course on or before this date
          const hasStudentsEnrolled = (course.Students || []).some(student => {
            const enrollmentDateStr = student.StudentCourses?.createdAt || student.createdAt || null
            const studyStartDate = toLocalYYYYMMDD(enrollmentDateStr) || getTodayString()
            return date >= studyStartDate
          })

          if (hasStudentsEnrolled) {
            const key = `${date}_${course.id}`
            if (!groups[key]) {
              groups[key] = {
                key,
                date,
                CourseId: course.id,
                courseTitle: course.title,
                records: [],
                isFilled: false
              }
            }
          }
        })
      })
    })

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
  }, [absencesLog, courses, courseTitleMap])

  const filteredSavedSheets = savedSheets.filter(sheet => {
    if (savedSearch.trim()) {
      const q = savedSearch.toLowerCase()
      const titleMatch = (sheet.courseTitle || '').toLowerCase().includes(q)
      const dateMatch = (sheet.date || '').includes(q)
      if (!titleMatch && !dateMatch) return false
    }
    if (savedDateFilter) {
      if (sheet.date !== savedDateFilter) return false
    }
    return true
  })

  const filteredLogs = absencesLog.filter(log => {
    if (log.status === 'Present') return false

    const name = log.type === 'Student'
      ? (log.Student?.full_name || '')
      : (log.Teacher?.full_name || '')
    
    if (logSearch.trim()) {
      if (!(name || '').toLowerCase().includes(logSearch.toLowerCase())) {
        return false
      }
    }

    if (logCourseFilter !== 'All') {
      if (log.CourseId !== Number(logCourseFilter)) return false
    }

    if (logRoleFilter !== 'All') {
      if (log.type !== logRoleFilter) return false
    }

    if (logStatusFilter !== 'All') {
      if (log.status !== logStatusFilter) return false
    }

    return true
  })

  const filteredDailyList = sheetStudents.filter(p => {
    if (!sheetSearch.trim()) return true
    return (p.full_name || '').toLowerCase().includes(sheetSearch.toLowerCase())
  })


  return (
    <div className="no-print" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {t('attendance.title') || 'Attendance & Absences'}
          </h1>
          <p className="text-xs text-slate-400">
            {t('attendance.subtitle') || 'Daily attendance registry and comprehensive absence logs.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'daily') {
                if (selectedCourseId) loadDailySheet()
              } else {
                loadAbsencesLog()
              }
            }}
            disabled={loadingSheet || loadingLogs}
            className="p-2.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 disabled:opacity-50 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title={t('common.refresh') || 'Refresh'}
          >
            <RefreshCw className={`h-4 w-4 ${(loadingSheet || loadingLogs) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800/60 gap-2">
        <button
          onClick={() => handleTabChange('daily')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'daily'
              ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
              : 'border-transparent text-slate-450 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          {t('attendance.tabDaily') || 'Daily Attendance Sheet'}
        </button>
        <button
          onClick={() => handleTabChange('logs')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'logs'
              ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
              : 'border-transparent text-slate-455 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <FileText className="h-4 w-4" />
          {t('attendance.tabLogs') || 'Absences History Log'}
        </button>
        <button
          onClick={() => handleTabChange('sheets')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'sheets'
              ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
              : 'border-transparent text-slate-455 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          {t('attendance.tabSavedSheets') || 'Saved Attendance Sheets'}
        </button>
      </div>

      {/* Tab 1: Daily Attendance Sheet */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Filters / Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Course Select */}
              <div className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{t('attendance.courseSelect') || 'Course'}</span>
                <select
                  value={selectedCourseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="px-3 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-blue-500/45 cursor-pointer min-h-[36px]"
                >
                  {filteredCourses.length === 0 ? (
                    <option value="">{t('attendance.noCourses') || 'No courses'}</option>
                  ) : (
                    filteredCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Date Select */}
              <div className="flex flex-col gap-1 min-w-[140px]">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{t('attendance.dateSelect') || 'Date'}</span>
                <CustomDatePicker
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  language={language}
                  t={t}
                  placeholder={t('attendance.dateSelect') || 'Date'}
                />
              </div>

              {/* Search Inside Sheet */}
              <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{t('common.search') || 'Search'}</span>
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder={t('attendance.searchByName') || 'Search name...'}
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-350 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors min-h-[36px]"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Unsaved Changes Indicator */}
          {isDirty && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {language === 'ar' ? 'لديك تعديلات غير محفوظة في ورقة الحضور هذه.' : 'You have unsaved changes in this attendance sheet.'}
              </span>
              {hasPermission('attendance:write') ? (
                <button
                  onClick={handleSaveAttendance}
                  disabled={savingSheet}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-all cursor-pointer font-bold"
                >
                  {savingSheet ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save Changes')}
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 italic">
                  {language === 'ar' ? 'ليس لديك صلاحية الحفظ.' : 'No write permission.'}
                </span>
              )}
            </div>
          )}

          {/* Daily Sheet Directory Table */}
          <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
            {loadingSheet ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-xs">{t('common.loading') || 'Loading...'}</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-955/40 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-200 flex flex-wrap items-center gap-2">
                    <span>{t('attendance.tabDaily') || 'Daily Attendance Sheet'}</span>
                    {translatedDayName && (
                      <span className="text-xs text-slate-400 font-normal">
                        ({translatedDayName})
                      </span>
                    )}
                    {existingAbsences.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-fade-in">
                        <Check className="h-3 w-3" />
                        {language === 'ar' ? 'محفوظ ومكتمل' : 'Saved & Completed'}
                      </span>
                    )}
                  </h3>
                  {(sheetStudents.length > 0 || sheetTeacher !== null) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkAllPresent}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {language === 'ar' ? 'تعليم الجميع كحضور' : 'Mark All Present'}
                      </button>
                      <button
                        onClick={handleMarkAllAbsent}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        {language === 'ar' ? 'تعليم الجميع كغياب' : 'Mark All Absent'}
                      </button>
                    </div>
                  )}
                </div>

                {filteredCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3 text-center px-4">
                    <Calendar className="h-8 w-8 text-slate-650 animate-pulse" />
                    {coursesScheduledToday.length > 0 ? (
                      <>
                        <p className="text-xs font-semibold text-slate-400">
                          {language === 'ar' 
                            ? 'تم إكمال جميع حضور حصص اليوم!' 
                            : 'All scheduled classes for today have been completed!'}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs">{t('attendance.noClassesToday') || 'No classes scheduled for today.'}</p>
                    )}
                  </div>
                ) : (sheetStudents.length === 0 && sheetTeacher === null) ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                    <Users className="h-8 w-8 text-slate-600" />
                    <p className="text-xs">{t('attendance.noPeopleFound') || 'No registered individuals found.'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/40">
                    {/* Instructor section */}
                    {sheetTeacher && (
                      <div className="px-6 py-5 bg-slate-900/10">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                          {language === 'ar' ? 'الأستاذ' : 'Instructor'}
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-850 rounded-2xl">
                          <div>
                            <span className="font-semibold text-slate-200 block text-xs md:text-sm">{sheetTeacher.full_name}</span>
                            <span className="text-[10px] text-slate-400 mt-1 block">{sheetTeacher.info || '—'}</span>
                          </div>
                          <div className="flex flex-col gap-3 sm:items-end w-full sm:w-auto">
                            {/* Status Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleTeacherStatusChange('Present')}
                                title={t('attendance.statusPresent')}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  sheetTeacher.status === 'Present'
                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/10'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {t('attendance.statusPresent') || 'Present'}
                              </button>
                              <button
                                onClick={() => handleTeacherStatusChange('Excused')}
                                title={t('attendance.statusAbsentExcused')}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  sheetTeacher.status === 'Excused'
                                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {t('attendance.statusAbsentExcusedShort') || 'Excused'}
                              </button>
                              <button
                                onClick={() => handleTeacherStatusChange('Unexcused')}
                                title={t('attendance.statusAbsentUnexcused')}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                  sheetTeacher.status === 'Unexcused'
                                    ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/10'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {t('attendance.statusAbsentUnexcusedShort') || 'Unexcused'}
                              </button>
                            </div>
                            
                            {/* Reason & Substitute Block */}
                            {(sheetTeacher.status === 'Excused' || sheetTeacher.status === 'Unexcused') && (
                              <div className="flex flex-col gap-2 w-full sm:max-w-xs text-left">
                                <input
                                  type="text"
                                  value={sheetTeacher.reason}
                                  onChange={(e) => handleTeacherReasonChange(e.target.value)}
                                  placeholder={t('attendance.reasonPlaceholder') || 'Reason (Optional)...'}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-350 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                                />
                                
                                <div className="flex flex-col gap-1 mt-0.5">
                                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">
                                    {language === 'ar' ? 'الأستاذ البديل (اختياري)' : 'Substitute Instructor (Optional)'}
                                  </label>
                                  <select
                                    value={sheetTeacher.substitute_teacher_id || ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setSheetTeacher(prev => ({ ...prev, substitute_teacher_id: val ? Number(val) : '' }))
                                      setIsDirty(true)
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-800 bg-slate-900 text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                                  >
                                    <option value="">{language === 'ar' ? '— بدون بديل —' : '— No Substitute —'}</option>
                                    {teachers
                                      .filter(t => t.id !== sheetTeacher.id)
                                      .map(t => (
                                        <option key={t.id} value={t.id}>{t.full_name}</option>
                                      ))
                                    }
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Students section */}
                    {sheetStudents.length > 0 && (
                      <div className="px-6 py-5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                          {language === 'ar' ? 'قائمة الطلاب' : 'Students Roster'} ({sheetStudents.length})
                        </span>
                        
                        <div className="overflow-x-auto border border-slate-800/40 rounded-xl">
                          <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                            <thead>
                              <tr className="border-b border-slate-800/60 bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-12">#</th>
                                <th className="px-4 py-3">{t('attendance.historyTableName') || 'Name'}</th>
                                <th className="px-4 py-3 hidden md:table-cell">{t('students.gradeLevel') || 'Grade'}</th>
                                <th className="px-4 py-3 text-center w-48">{t('attendance.historyTableStatus') || 'Status'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                              {filteredDailyList.map((person, index) => (
                                <tr key={person.id} className="hover:bg-slate-900/30 transition-all duration-150">
                                  <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{index + 1}</td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200 block text-xs md:text-sm flex items-center gap-1.5 flex-wrap">
                                          {person.full_name}
                                          {isBirthdayToday(person.date_of_birth) && (
                                            <span 
                                              className="inline-flex items-center px-1.5 py-0.2 rounded bg-pink-500/15 border border-pink-500/20 text-[8.5px] font-bold text-pink-400 cursor-help"
                                              title={language === 'ar' ? 'عيد ميلاد اليوم! 🎂' : 'Today is their Birthday! 🎂'}
                                            >
                                              🎂 {language === 'ar' ? 'عيد ميلاد اليوم' : 'Birthday Today'}
                                            </span>
                                          )}
                                        </span>
                                        {person.remaining !== undefined && (
                                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${
                                            person.remaining <= 1
                                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                              : person.remaining <= 3
                                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-450'
                                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                          }`}>
                                            {language === 'ar' ? `متبقي: ${person.remaining}` : `Rem: ${person.remaining}`}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-500 mt-0.5 block md:hidden">{person.info}</span>
                                      
                                      {(person.status === 'Excused' || person.status === 'Unexcused') && (
                                        <div className="mt-2 animate-fade-in">
                                          <input
                                            type="text"
                                            value={person.reason}
                                            onChange={(e) => handleReasonChange(person.id, e.target.value)}
                                            placeholder={t('attendance.reasonPlaceholder') || 'Reason (Optional)...'}
                                            className="w-full max-w-sm px-2.5 py-1.5 text-xs rounded-xl border border-slate-800 bg-slate-950 text-slate-300 placeholder-slate-650 focus:outline-none focus:border-blue-500/40 transition-colors"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{person.info || '—'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleStatusChange(person.id, 'Present')}
                                        title={t('attendance.statusPresent')}
                                        className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                          person.status === 'Present'
                                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/10'
                                            : 'bg-slate-955 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                        }`}
                                      >
                                        {t('attendance.statusPresentShort') || 'P'}
                                      </button>

                                      <button
                                        onClick={() => handleStatusChange(person.id, 'Excused')}
                                        title={t('attendance.statusAbsentExcused')}
                                        className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                          person.status === 'Excused'
                                            ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                                            : 'bg-slate-955 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                        }`}
                                      >
                                        {t('attendance.statusAbsentExcusedShort') || 'E'}
                                      </button>

                                      <button
                                        onClick={() => handleStatusChange(person.id, 'Unexcused')}
                                        title={t('attendance.statusAbsentUnexcused')}
                                        className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                          person.status === 'Unexcused'
                                            ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/10'
                                            : 'bg-slate-955 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                        }`}
                                      >
                                        {t('attendance.statusAbsentUnexcusedShort') || 'U'}
                                      </button>

                                      {(person.status === 'Unexcused' || person.status === 'Excused') && (
                                        <button
                                          onClick={() => handleSendAbsenceEmail(person)}
                                          title={language === 'ar' ? 'إرسال إيميل تنبيه لولي الأمر' : 'Send notification email to parent'}
                                          className="h-7 w-7 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all flex items-center justify-center cursor-pointer ml-1.5 shrink-0"
                                        >
                                          <Mail className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Action area */}
                {!loadingSheet && (sheetStudents.length > 0 || sheetTeacher !== null) && (
                  <div className="p-4 border-t border-slate-800/60 bg-slate-955/40 flex justify-end gap-3">
                    <button
                      onClick={loadDailySheet}
                      disabled={savingSheet}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-850 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    {hasPermission('attendance:write') && existingAbsences.length > 0 && (
                      <button
                        onClick={handleResetDailySheet}
                        disabled={savingSheet}
                        className="px-4 py-2 bg-rose-600/10 border border-rose-500/20 text-rose-455 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('attendance.reFillBtn') || 'Reset / Re-fill'}
                      </button>
                    )}
                    {hasPermission('attendance:write') && (
                      <button
                        onClick={handleSaveAttendance}
                        disabled={savingSheet || !selectedCourseId}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-xs hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {savingSheet ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            {t('common.saving') || 'Saving...'}
                          </>
                        ) : (
                          <>
                            <CalendarCheck className="h-3.5 w-3.5" />
                            {t('attendance.saveAttendanceBtn') || 'Save Attendance Sheet'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Absences History Log */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters & Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              {/* Search Name */}
              <div className="relative w-full sm:max-w-xs shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('attendance.searchByName') || 'Search name...'}
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors min-h-[36px]"
                />
              </div>

              {/* Course filter */}
              <select
                value={logCourseFilter}
                onChange={(e) => setLogCourseFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-305 focus:outline-none focus:border-blue-500/45 cursor-pointer min-h-[36px]"
              >
                <option value="All">{t('attendance.allCourses') || 'All Courses'}</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              {/* Role filter */}
              <select
                value={logRoleFilter}
                onChange={(e) => setLogRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer min-h-[36px]"
              >
                <option value="All">{t('attendance.allRoles') || 'All Roles'}</option>
                <option value="Student">{t('attendance.roleStudent') || 'Student'}</option>
                <option value="Teacher">{t('attendance.roleTeacher') || 'Instructor'}</option>
              </select>

              {/* Status filter */}
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer min-h-[36px]"
              >
                <option value="All">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="Unexcused">{t('attendance.statusAbsentUnexcused') || 'Absent (Unexcused)'}</option>
                <option value="Excused">{t('attendance.statusAbsentExcused') || 'Absent (Excused)'}</option>
              </select>
            </div>
            <div className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider shrink-0 lg:mr-2">
              {language === 'ar' ? `المجموع (${filteredLogs.length}) غياب` : `Total (${filteredLogs.length}) records`}
            </div>
          </div>

          {/* Directory Log Table */}
          <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-955/40">
              <h3 className="text-sm font-semibold text-slate-200">{t('attendance.tabLogs') || 'Absences History Log'}</h3>
            </div>

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-xs">{t('common.loading') || 'Loading...'}</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <FileText className="h-8 w-8 text-slate-600" />
                <p className="text-xs">{t('attendance.noAbsencesRecorded') || 'No absences recorded.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                  <thead>
                    <tr className="border-b border-slate-800/60 bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">{t('attendance.historyTableDate') || 'Date'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableName') || 'Name'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableRole') || 'Role'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableCourse') || 'Course'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableStatus') || 'Status'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableReason') || 'Reason'}</th>
                      <th className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4 w-52`}>{t('attendance.historyTableActions') || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-xs">
                    {filteredLogs.map(log => {
                      const name = log.type === 'Student'
                        ? (log.Student ? log.Student.full_name : 'Unknown Student')
                        : (log.Teacher ? log.Teacher.full_name : 'Unknown Teacher')
                      
                      const courseTitle = log.Course ? log.Course.title : (courseTitleMap[log.CourseId] || 'Unknown Course')

                      return (
                        <tr key={log.id} className="hover:bg-slate-900/30 transition-all duration-150 text-slate-350">
                          <td className="px-6 py-4 font-mono font-medium text-slate-400">{log.date}</td>
                          <td className="px-6 py-4 font-semibold text-slate-200">{name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              log.type === 'Student'
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                            }`}>
                              {log.type === 'Student' ? (t('attendance.roleStudent') || 'Student') : (t('attendance.roleTeacher') || 'Instructor')}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-300">{courseTitle}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              log.status === 'Excused'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${log.status === 'Excused' ? 'bg-amber-400' : 'bg-rose-500'}`}></span>
                              {log.status === 'Excused'
                                ? (t('attendance.statusAbsentExcused') || 'Excused')
                                : (t('attendance.statusAbsentUnexcused') || 'Unexcused')}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            {editingLogId === log.id ? (
                              <div className="flex items-center gap-2 animate-fade-in">
                                <input
                                  type="text"
                                  value={editingReasonText}
                                  onChange={(e) => setEditingReasonText(e.target.value)}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 w-full"
                                  placeholder={t('attendance.notesPlaceholder') || "Notes..."}
                                />
                                <button
                                  onClick={() => handleSaveReasonEdit(log.id)}
                                  className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
                                  title={t('common.save')}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setEditingLogId(null)}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 cursor-pointer transition-colors"
                                  title={t('common.cancel')}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span className="text-slate-400 truncate max-w-[150px] block" title={log.reason || ''}>
                                  {log.reason || '—'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingLogId(log.id)
                                    setEditingReasonText(log.reason || '')
                                  }}
                                  className="p-1 text-slate-550 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title={t('common.edit') || "Edit Note"}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleLogExcuse(log)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                  log.status === 'Excused'
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950'
                                }`}
                              >
                                {log.status === 'Excused'
                                  ? (t('attendance.unexcuseBtn') || 'Mark Unexcused')
                                  : (t('attendance.excuseBtn') || 'Excuse Absence')}
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer"
                                title={t('attendance.deleteLogBtn') || 'Delete Record'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Saved Attendance Sheets */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          {/* Filters & Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              {/* Search Course Title / Date */}
              <div className="relative w-full sm:max-w-xs shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'البحث عن مادة أو تاريخ...' : 'Search course or date...'}
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors min-h-[36px]"
                />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <CustomDatePicker
                  value={savedDateFilter}
                  onChange={(e) => setSavedDateFilter(e.target.value)}
                  language={language}
                  t={t}
                  placeholder={language === 'ar' ? 'تاريخ الحصة...' : 'Date filter...'}
                  className="min-w-[140px]"
                />
                {savedDateFilter && (
                  <button
                    onClick={() => setSavedDateFilter('')}
                    className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer min-h-[36px] flex items-center justify-center"
                    title={language === 'ar' ? 'مسح التاريخ' : 'Clear Date'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0 lg:mr-2">
              {language === 'ar' ? `المجموع (${filteredSavedSheets.length}) قائمة` : `Total (${filteredSavedSheets.length}) sheets`}
            </div>
          </div>

          {/* Saved Sheets List Table */}
          <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-955/40">
              <h3 className="text-sm font-semibold text-slate-200">{t('attendance.tabSavedSheets') || 'Saved Attendance Sheets'}</h3>
            </div>

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-xs">{t('common.loading') || 'Loading...'}</p>
              </div>
            ) : filteredSavedSheets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <ClipboardList className="h-8 w-8 text-slate-650" />
                <p className="text-xs">{language === 'ar' ? 'لم يتم العثور على أي قوائم تحضير محفوظة.' : 'No saved attendance sheets found.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                  <thead>
                    <tr className="border-b border-slate-800/60 bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">{t('attendance.historyTableDate') || 'Date'}</th>
                      <th className="px-6 py-4">{t('attendance.historyTableCourse') || 'Course'}</th>
                      <th className="px-6 py-4">{language === 'ar' ? 'الأستاذ' : 'Instructor'}</th>
                      <th className="px-6 py-4">{t('attendance.ratioPresent') || 'Attendance Rate'}</th>
                      <th className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4 w-52`}>{t('attendance.historyTableActions') || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-xs">
                    {filteredSavedSheets.map(sheet => {
                      const courseObj = courses.find(c => String(c.id) === String(sheet.CourseId))
                      const teacherName = courseObj?.Teacher?.full_name
                      const isExpanded = expandedSheetKeys.includes(sheet.key)

                      if (sheet.isFilled === false) {
                        const enrolledStudents = courseObj?.Students || []

                        return (
                          <React.Fragment key={sheet.key}>
                            <tr className="hover:bg-slate-900/30 transition-all duration-150 text-slate-350">
                              <td className="px-6 py-4 font-mono font-medium text-slate-400">
                                <button
                                  onClick={() => toggleSheetExpand(sheet.key)}
                                  className="flex items-center gap-2 hover:text-slate-200 transition-colors cursor-pointer text-left focus:outline-none"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                  )}
                                  <span>{sheet.date}</span>
                                </button>
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-200">
                                <div className="flex items-center gap-2">
                                  <span>{sheet.courseTitle}</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border bg-rose-500/10 border-rose-500/20 text-rose-455">
                                    {language === 'ar' ? 'معلق' : 'Pending'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {teacherName ? (
                                  <span className="font-semibold text-slate-400">{teacherName}</span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-500 font-mono">—</td>
                              <td className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedDate(sheet.date)
                                      setSelectedCourseId(String(sheet.CourseId))
                                      setActiveTab('daily')
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <CalendarCheck className="h-3 w-3" />
                                    {language === 'ar' ? 'تعبئة الحضور' : 'Fill Attendance'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-950/20 border-b border-slate-800/40">
                                <td colSpan={5} className="px-6 py-4">
                                  <div className="space-y-3 animate-fade-in text-left">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      {language === 'ar' ? 'الطلاب المسجلين' : 'Enrolled Students'} ({enrolledStudents.length})
                                    </span>
                                    {enrolledStudents.length === 0 ? (
                                      <div className="text-xs text-slate-500 py-1">
                                        {language === 'ar' ? 'لا يوجد طلاب مسجلين في هذا القسم.' : 'No enrolled students in this course.'}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {enrolledStudents.map(s => (
                                          <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-slate-850 rounded-xl text-xs">
                                            <span className="font-semibold text-slate-350">{s.full_name}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border bg-slate-900 border-slate-800 text-slate-500">
                                              {language === 'ar' ? 'معلق' : 'Pending'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      }

                      const teacherRecord = sheet.records.find(r => r.type === 'Teacher')
                      const studentRecords = sheet.records.filter(r => r.type === 'Student')
                      const totalStudents = studentRecords.length
                      const presentStudents = studentRecords.filter(r => r.status === 'Present').length
                      const rate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0

                      const tName = teacherRecord 
                        ? (teacherRecord.Teacher ? teacherRecord.Teacher.full_name : 'Teacher')
                        : (teacherName || null)

                      return (
                        <React.Fragment key={sheet.key}>
                          <tr className="hover:bg-slate-900/30 transition-all duration-150 text-slate-350">
                            <td className="px-6 py-4 font-mono font-medium text-slate-400">
                              <button
                                onClick={() => toggleSheetExpand(sheet.key)}
                                className="flex items-center gap-2 hover:text-slate-200 transition-colors cursor-pointer text-left focus:outline-none"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                )}
                                <span>{sheet.date}</span>
                              </button>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-200">{sheet.courseTitle}</td>
                            <td className="px-6 py-4">
                              {teacherRecord ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-200">{tName}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                                    teacherRecord.status === 'Present'
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                      : teacherRecord.status === 'Excused'
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      : 'bg-rose-500/10 border-rose-500/20 text-rose-455'
                                  }`}>
                                    {teacherRecord.status === 'Present'
                                      ? (t('attendance.statusPresent') || 'Present')
                                      : teacherRecord.status === 'Excused'
                                      ? (t('attendance.statusAbsentExcused') || 'Excused')
                                      : (t('attendance.statusAbsentUnexcused') || 'Unexcused')}
                                  </span>
                                </div>
                              ) : tName ? (
                                <span className="font-semibold text-slate-400">{tName}</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-300 font-mono">
                              {totalStudents > 0 ? (
                                <span>{presentStudents} / {totalStudents} ({rate}%)</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingSavedSheet(sheet)}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  {t('attendance.viewEdit') || 'View / Edit'}
                                </button>
                                <button
                                  onClick={() => handleDeleteSavedSheet(sheet)}
                                  className="p-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer"
                                  title={t('attendance.deleteSheet') || 'Delete Sheet'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-950/20 border-b border-slate-800/40">
                              <td colSpan={5} className="px-6 py-4">
                                <div className="space-y-3 animate-fade-in text-left">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    {language === 'ar' ? 'تفاصيل حضور الطلاب' : 'Student Attendance Details'} ({studentRecords.length})
                                  </span>
                                  {studentRecords.length === 0 ? (
                                    <div className="text-xs text-slate-500 py-1">
                                      {language === 'ar' ? 'لا توجد سجلات حضور طلاب لهذه الحصة.' : 'No student attendance records for this session.'}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {studentRecords.map(r => {
                                        const sName = r.Student ? r.Student.full_name : 'Unknown Student'
                                        return (
                                          <div key={r.id} className="flex items-center justify-between p-2.5 bg-slate-955 border border-slate-850 rounded-xl text-xs">
                                            <span className="font-semibold text-slate-350">{sName}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border ${
                                              r.status === 'Present'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                                                : r.status === 'Excused'
                                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-450'
                                                : 'bg-rose-500/10 border-rose-500/20 text-rose-455'
                                            }`}>
                                              {r.status === 'Present'
                                                ? (t('attendance.statusPresent') || 'Present')
                                                : r.status === 'Excused'
                                                ? (t('attendance.statusAbsentExcused') || 'Excused')
                                                : (t('attendance.statusAbsentUnexcused') || 'Unexcused')}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* View/Edit Saved Sheet Modal */}
      {editingSavedSheet && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setEditingSavedSheet(null)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down" dir={isRTL ? 'rtl' : 'ltr'}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {t('attendance.editSavedSheet') || 'Edit Saved Attendance Sheet'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  {editingSavedSheet.courseTitle} • {editingSavedSheet.date}
                </p>
              </div>
              <button
                onClick={() => setEditingSavedSheet(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[65vh]">
              
              {/* Search Inside Modal */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('attendance.searchByName') || 'Search name...'}
                  value={editSheetSearch}
                  onChange={(e) => setEditSheetSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors min-h-[36px]"
                />
              </div>

              {/* Instructor Edit Section */}
              {!loadingEditSheet && editingTeacher && (
                <div className="p-4 bg-slate-950 border border-slate-800/60 rounded-2xl text-left space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-850/45">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {language === 'ar' ? 'الأستاذ' : 'Instructor'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-xs text-slate-200 block">{editingTeacher.full_name}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{editingTeacher.info || '—'}</span>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
                      {/* Status Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(prev => ({ ...prev, status: 'Present', substitute_teacher_id: '' }))
                          }}
                          className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                            editingTeacher.status === 'Present'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                          }`}
                        >
                          {t('attendance.statusPresent') || 'Present'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(prev => ({ ...prev, status: 'Excused' }))
                          }}
                          className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                            editingTeacher.status === 'Excused'
                              ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                          }`}
                        >
                          {t('attendance.statusAbsentExcusedShort') || 'Excused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(prev => ({ ...prev, status: 'Unexcused' }))
                          }}
                          className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                            editingTeacher.status === 'Unexcused'
                              ? 'bg-rose-600 border-rose-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                          }`}
                        >
                          {t('attendance.statusAbsentUnexcusedShort') || 'Unexcused'}
                        </button>
                      </div>

                      {/* Reason & Substitute Block */}
                      {(editingTeacher.status === 'Excused' || editingTeacher.status === 'Unexcused') && (
                        <div className="flex flex-col gap-2 w-full sm:w-48 text-left mt-1">
                          <input
                            type="text"
                            value={editingTeacher.reason || ''}
                            onChange={(e) => handleEditTeacherReasonChange(e.target.value)}
                            placeholder={t('attendance.reasonPlaceholder') || 'Reason (Optional)...'}
                            className="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-350 placeholder-slate-655 focus:outline-none focus:border-blue-500/40 transition-colors"
                          />
                          <div className="flex flex-col gap-1 mt-0.5">
                            <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wide">
                              {language === 'ar' ? 'الأستاذ البديل (اختياري)' : 'Substitute Instructor (Optional)'}
                            </label>
                            <select
                              value={editingTeacher.substitute_teacher_id || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setEditingTeacher(prev => ({ ...prev, substitute_teacher_id: val ? Number(val) : '' }))
                              }}
                              className="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                            >
                              <option value="">{language === 'ar' ? '— بدون بديل —' : '— No Substitute —'}</option>
                              {teachers
                                .filter(t => t.id !== editingTeacher.id)
                                .map(t => (
                                  <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))
                              }
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Roster list */}
              {loadingEditSheet ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  <p className="text-[10px]">{t('common.loading') || 'Loading...'}</p>
                </div>
              ) : editingPeople.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  {t('attendance.noPeopleFound') || 'No registered individuals found.'}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {language === 'ar' ? 'الأعضاء' : 'Roster'} ({editingPeople.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleEditMarkAllPresent}
                      className="text-[10px] font-semibold text-emerald-450 hover:underline cursor-pointer"
                    >
                      {language === 'ar' ? 'الجميع حضور' : 'Mark All Present'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-1">
                    {editingPeople
                      .filter(p => !editSheetSearch.trim() || (p.full_name || '').toLowerCase().includes(editSheetSearch.toLowerCase()))
                      .map((person, idx) => (
                        <div key={person.id} className="p-3.5 rounded-xl bg-slate-955 border border-slate-800/60 flex flex-col justify-between gap-3 text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold text-xs text-slate-200 block">{person.full_name}</span>
                              {person.remaining !== undefined && (
                                <span className={`inline-flex items-center mt-1 px-1.5 py-0.2 rounded text-[8px] font-bold font-mono border ${
                                  person.remaining <= 1
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-455 font-bold'
                                    : person.remaining <= 3
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-450 font-bold'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-405 font-bold'
                                }`}>
                                  {language === 'ar' ? `متبقي: ${person.remaining}` : `Rem: ${person.remaining}`}
                                </span>
                              )}
                            </div>

                            {/* Status Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditStatusChange(person.id, 'Present')}
                                className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                                  person.status === 'Present'
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                                }`}
                              >
                                {t('attendance.statusPresentShort') || 'P'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditStatusChange(person.id, 'Excused')}
                                className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                                  person.status === 'Excused'
                                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                                    : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                                }`}
                              >
                                {t('attendance.statusAbsentExcusedShort') || 'E'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditStatusChange(person.id, 'Unexcused')}
                                className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                                  person.status === 'Unexcused'
                                    ? 'bg-rose-600 border-rose-500 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-405 hover:text-slate-205'
                                }`}
                              >
                                {t('attendance.statusAbsentUnexcusedShort') || 'U'}
                              </button>
                            </div>
                          </div>

                          {/* Reason Input */}
                          {(person.status === 'Excused' || person.status === 'Unexcused') ? (
                            <input
                              type="text"
                              value={person.reason || ''}
                              onChange={(e) => handleEditReasonChange(person.id, e.target.value)}
                              placeholder={t('attendance.reasonPlaceholder') || 'Reason (Optional)...'}
                              className="w-full px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-800 bg-slate-950 text-slate-350 placeholder-slate-655 focus:outline-none focus:border-blue-500/40 transition-colors"
                            />
                          ) : (
                            <div className="h-[28px]"></div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800/60 shrink-0 bg-slate-900/50">
              <button
                onClick={() => setEditingSavedSheet(null)}
                disabled={savingEditSheet}
                className="px-4 py-2 bg-slate-900 border border-slate-850 hover:border-slate-750 text-slate-350 hover:text-slate-100 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              {hasPermission('attendance:write') && (
                <button
                  onClick={handleSaveEditSheet}
                  disabled={savingEditSheet || loadingEditSheet || editingPeople.length === 0}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-xs hover:from-blue-500 hover:to-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                >
                {savingEditSheet ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {t('common.saving') || 'Saving...'}
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {t('common.save') || 'Save Changes'}
                  </>
                )}
              </button>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl mx-auto my-10 text-left">
          <h2 className="text-sm font-bold text-red-400 mb-2">Something went wrong in the Attendance component</h2>
          <p className="text-[11px] text-slate-400 mb-4">We've caught a rendering exception. Please share the details below to help us fix it:</p>
          <pre className="p-4 bg-slate-950 text-rose-450 rounded-xl text-xs overflow-auto font-mono max-h-60 whitespace-pre-wrap">
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function AttendanceWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Attendance />
    </ErrorBoundary>
  )
}
