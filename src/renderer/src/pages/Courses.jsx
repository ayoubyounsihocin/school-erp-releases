import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { BookOpen, Tag, Plus, RefreshCw, AlertCircle, User, BookOpenCheck, Edit, Trash2, X, Users, Search, Calendar, MapPin, CheckCircle, Printer, FileText } from 'lucide-react'
import { ipcService } from '../services/ipcService'
import { toLocalYYYYMMDD } from '../utils/billing'
import CustomDatePicker from '../components/CustomDatePicker'
import { TEACHER_PRINT_STYLES } from '../utils/printStyles'

export default function Courses() {
  const { language, t, isRTL } = useLanguage()
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}')
  const isAdmin = currentUser.role === 'Admin'
  const hasPermission = (permissionKey) => {
    if (currentUser.role === 'Admin') return true;
    const userPerms = currentUser.permissions || '';
    const permsArr = userPerms.split(',').map(s => s.trim());
    if (permsArr.includes(permissionKey)) return true;
    const parts = permissionKey.split(':');
    if (parts.length > 1 && permsArr.includes(parts[0])) return true;
    return false;
  };

  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekDatesMap = {};
    
    weekdays.forEach((wd, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      
      const d = date.getDate();
      const mNameEn = date.toLocaleString('en-US', { month: 'short' });
      const clean = mNameEn.toLowerCase().substring(0, 3);
      const key = `finances.${clean}`;
      const result = t(key);
      const mName = (language === 'ar' && result !== key) ? result : mNameEn;
      weekDatesMap[wd] = `${d} ${mName}`;
    });
    
    return weekDatesMap;
  };

  const weekDatesMap = getWeekDates();
  const [courses, setCourses] = useState([])
  const [classroomsCount, setClassroomsCount] = useState(5)
  const [teachers, setTeachers] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('catalog') // 'catalog' | 'schedule' | 'requests'
  const [scheduleRequests, setScheduleRequests] = useState([])
  const [isAddRequestModalOpen, setIsAddRequestModalOpen] = useState(false)
  const [requestForm, setRequestForm] = useState({
    type: 'Rescheduling',
    course_name: '',
    description: '',
    requested_by: ''
  })
  const [requestErrors, setRequestErrors] = useState({})

  // Weekly Schedule States
  const [schedules, setSchedules] = useState([])
  const classroomsList = React.useMemo(() => {
    const count = Math.max(1, Math.min(50, classroomsCount || 5));
    const list = Array.from({ length: count }, (_, i) => String(i + 1));
    const existingRooms = (schedules || []).map(s => s.room).filter(Boolean);
    const combined = [...new Set([...list, ...existingRooms])].sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });
    return combined;
  }, [classroomsCount, schedules]);
  const [schedulingLoading, setSchedulingLoading] = useState(false)
  const [timeProgress, setTimeProgress] = useState(null)
  const [currentTimeString, setCurrentTimeString] = useState('')

  // Track weekly schedule current time indicator position
  useEffect(() => {
    const calculateProgress = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const totalMinutes = hours * 60 + minutes
      
      const startMinutes = 8 * 60 // 08:00 AM
      const endMinutes = 18 * 60  // 06:00 PM
      
      if (totalMinutes >= startMinutes && totalMinutes <= endMinutes) {
        const pct = ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 100
        setTimeProgress(pct)
        setCurrentTimeString(now.toLocaleTimeString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }))
      } else {
        setTimeProgress(null)
      }
    }
    
    calculateProgress()
    const interval = setInterval(calculateProgress, 60000)
    return () => clearInterval(interval)
  }, [language])

  const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false)
  const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState(null)

  const [scheduleForm, setScheduleForm] = useState({
    CourseId: '',
    day_of_week: 'Monday',
    time_slot: '08:00',
    room: 'A'
  })
  const [scheduleFormErrors, setScheduleFormErrors] = useState({})

  // Reset schedule validation errors on modal open
  useEffect(() => {
    if (isAddScheduleModalOpen || isEditScheduleModalOpen) {
      setScheduleFormErrors({})
    }
  }, [isAddScheduleModalOpen, isEditScheduleModalOpen])

  const [roomFilter, setRoomFilter] = useState('All')
  const [schedulingSpecialtyFilter, setSchedulingSpecialtyFilter] = useState('All')
  const [schedulingTeacherFilter, setSchedulingTeacherFilter] = useState('All')
  const [activePrintTeacherSchedule, setActivePrintTeacherSchedule] = useState(null)
  const [activePrintGeneralSchedule, setActivePrintGeneralSchedule] = useState(false)
  const [schoolName, setSchoolName] = useState('School Name')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolWebsite, setSchoolWebsite] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [timetableMode, setTimetableMode] = useState('standard')
  const [matrixActiveDay, setMatrixActiveDay] = useState('Monday')

  // Filter States for Course Catalog
  const [searchTerm, setSearchTerm] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('All')
  const [priceFilter, setPriceFilter] = useState('All')
  const [enrolledFilter, setEnrolledFilter] = useState('All')

  // Form State for Adding Course
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    TeacherId: '',
    default_payout_rate: '50',
    has_exam: false,
    payout_type: 'Percentage',
    fixed_payout_amount: ''
  })
  const [formErrors, setFormErrors] = useState({})

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    price: '',
    TeacherId: '',
    default_payout_rate: '50',
    has_exam: false,
    payout_type: 'Percentage',
    fixed_payout_amount: ''
  })
  const [editFormErrors, setEditFormErrors] = useState({})

  // Enroll Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [studentToEnrollId, setStudentToEnrollId] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollmentDate, setEnrollmentDate] = useState(toLocalYYYYMMDD(new Date()))

  const handleDownloadTeacherSchedulePDF = async (teacher, action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert("PDF export is only available in the desktop application.");
      return;
    }

    setPdfLoading(true);
    try {
      const teacherSchedules = schedules.filter(s => s.Course?.TeacherId === teacher.id);
      
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sortedSchedules = [...teacherSchedules].sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        if (dayDiff !== 0) return dayDiff;
        return a.time_slot.localeCompare(b.time_slot);
      });

      let tableRowsHtml = '';
      if (sortedSchedules.length === 0) {
        tableRowsHtml = `<tr><td colspan="5" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 8px; color: #64748b;">${language === 'ar' ? 'لا توجد حصص مجدولة لهذا الأستاذ' : 'No lectures scheduled for this instructor'}</td></tr>`;
      } else {
        for (const sched of sortedSchedules) {
          const courseObj = courses.find(c => c.id === sched.CourseId);
          const studentCount = courseObj && courseObj.Students ? courseObj.Students.length : 0;
          const day = sched.day_of_week;
          const slot = sched.time_slot;
          const slotEnd = `${parseInt(slot) + 2}:00`;
          const dayLabel = language === 'ar' ? t('courses.' + day.toLowerCase()) : day;

          tableRowsHtml += `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: #0f172a; font-size: 8px; text-align: center; background-color: #f8fafc;">
                ${dayLabel}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-family: monospace; font-size: 8px; color: #334155;">
                ${slot} - ${slotEnd}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: #0f172a; font-size: 8px;">
                ${sched.Course?.title || 'Unknown'}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-size: 8px; color: #334155;">
                ${sched.room}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-size: 8px; color: #475569;">
                ${studentCount} ${t('courses.studsLabel', { count: '' }).replace('0 ', '').replace(' ', '')}
              </td>
            </tr>
          `;
        }
      }

      const logoHtml = schoolLogo 
        ? `<img src="${schoolLogo}" style="max-height: 20px; max-width: 100px; object-fit: contain;" />`
        : `<div style="font-size: 9px; font-weight: bold; color: #1e293b;">${schoolName.substring(0,3).toUpperCase()}</div>`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Teacher Weekly Timetable</title>
  <style>
    ${TEACHER_PRINT_STYLES}
  </style>
</head>
<body>
  <div class="page-container">
    <div class="timetable-half">
      <div>
        <table class="header-table">
          <tr>
            <td class="header-logo">
              ${logoHtml}
              <div class="school-name">${schoolName}</div>
            </td>
            <td class="header-info">
              ${schoolAddress ? `<div>${schoolAddress}</div>` : ''}
              ${schoolPhone ? `<div style="margin-top: 2px;">Phone: ${schoolPhone}</div>` : ''}
            </td>
          </tr>
        </table>

        <div class="divider"></div>

        <h1 class="title">${language === 'ar' ? 'جدول الحصص الأسبوعي للأستاذ' : 'INSTRUCTOR WEEKLY LECTURE TIMETABLE'}</h1>
        <div class="subtitle">${language === 'ar' ? 'تاريخ الاستخراج' : 'DATE EXPORTED'}: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>

        <table class="details-table">
          <tr>
            <td class="details-col" style="border-right: 1px solid #e2e8f0; width: 60%; text-align: left;">
              <div class="details-label">${language === 'ar' ? 'تفاصيل الأستاذ' : 'Instructor Details'}</div>
              <div class="details-value">${teacher.full_name}</div>
              <div style="font-size: 7px; color: #64748b; margin-top: 2px;">${language === 'ar' ? 'مجال التخصص' : 'Specialty Area'}: ${teacher.specialty || (language === 'ar' ? 'دراسات عامة' : 'General Studies')}</div>
            </td>
            <td class="details-col" style="width: 40%;">
              <div class="details-label">${language === 'ar' ? 'التقويم الأكاديمي' : 'Academic Calendar'}</div>
              <div class="details-value">${language === 'ar' ? 'السنة الدراسية' : 'Term Session'}: ${academicYear}</div>
            </td>
          </tr>
        </table>

        <table class="timetable-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-top: 5px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; font-weight: 800; text-align: center; color: #1e293b; text-transform: uppercase; width: 15%;">${language === 'ar' ? 'اليوم' : 'Day'}</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; font-weight: 800; text-align: center; color: #1e293b; text-transform: uppercase; width: 25%;">${language === 'ar' ? 'الوقت' : 'Time'}</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; font-weight: 800; text-align: left; color: #1e293b; text-transform: uppercase; width: 35%;">${language === 'ar' ? 'المادة' : 'Course'}</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; font-weight: 800; text-align: center; color: #1e293b; text-transform: uppercase; width: 12%;">${language === 'ar' ? 'القاعة' : 'Room'}</th>
              <th style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; font-weight: 800; text-align: center; color: #1e293b; text-transform: uppercase; width: 13%;">${language === 'ar' ? 'الطلاب' : 'Students'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5', true);
        if (res && res.success) {
          alert("Teacher schedule printed successfully!");
        }
      } else {
        const filename = `Schedule_${teacher.full_name.replace(/\s+/g, '_')}.pdf`;
        const res = await ipcService.printPdf(html, filename, 'A5', true);
        if (res && res.success) {
          alert("Teacher schedule PDF generated successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to generate PDF schedule:", err);
      alert("Failed to export PDF weekly schedule.");
    } finally {
      setPdfLoading(false);
    }
  }

  const handleDownloadGeneralSchedulePDF = async (action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert("PDF export is only available in the desktop application.");
      return;
    }

    setPdfLoading(true);
    try {
      const filteredSchedules = schedules.filter(s => {
        let match = true;
        if (roomFilter !== 'All' && s.room !== roomFilter) match = false;
        if (schedulingSpecialtyFilter !== 'All' && s.Course?.Teacher?.specialty !== schedulingSpecialtyFilter) match = false;
        if (schedulingTeacherFilter !== 'All' && s.Course?.TeacherId?.toString() !== schedulingTeacherFilter) match = false;
        return match;
      });

      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sortedSchedules = [...filteredSchedules].sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        if (dayDiff !== 0) return dayDiff;
        return a.time_slot.localeCompare(b.time_slot);
      });

      let tableRowsHtml = '';
      if (sortedSchedules.length === 0) {
        tableRowsHtml = `<tr><td colspan="5" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 8px; color: #64748b;">${language === 'ar' ? 'لا توجد حصص مطابقة للمرشحات' : 'No lectures match the active filters'}</td></tr>`;
      } else {
        for (const sched of sortedSchedules) {
          const day = sched.day_of_week;
          const slot = sched.time_slot;
          const slotEnd = `${parseInt(slot) + 2}:00`;
          const dayLabel = language === 'ar' ? t('courses.' + day.toLowerCase()) : day;

          tableRowsHtml += `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: #0f172a; font-size: 8px; text-align: center; background-color: #f8fafc;">
                ${dayLabel}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-family: monospace; font-size: 8px; color: #334155;">
                ${slot} - ${slotEnd}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: #0f172a; font-size: 8px;">
                ${sched.Course?.title || 'Unknown'}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-size: 8px; color: #334155;">
                ${sched.room}
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8px; color: #475569;">
                ${sched.Course?.Teacher?.full_name || 'No instructor'}
              </td>
            </tr>
          `;
        }
      }

      const logoHtml = schoolLogo 
        ? `<img src="${schoolLogo}" style="max-height: 20px; max-width: 100px; object-fit: contain;" />`
        : `<div style="font-size: 9px; font-weight: bold; color: #1e293b;">${schoolName.substring(0,3).toUpperCase()}</div>`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>General Weekly Timetable</title>
  <style>
    ${TEACHER_PRINT_STYLES}
  </style>
</head>
<body>
  <div class="page-container">
    <div class="timetable-half">
      <div>
        <table class="header-table">
          <tr>
            <td class="header-logo">
              ${logoHtml}
              <div class="school-name">${schoolName}</div>
            </td>
            <td class="header-info">
              ${schoolAddress ? `<div>${schoolAddress}</div>` : ''}
              ${schoolPhone ? `<div style="margin-top: 2px;">${language === 'ar' ? 'الهاتف' : 'Phone'}: ${schoolPhone}</div>` : ''}
            </td>
          </tr>
        </table>

        <div class="divider"></div>

        <h1 class="title">${language === 'ar' ? 'جدول الحصص الأسبوعي العام' : 'GENERAL WEEKLY LECTURE TIMETABLE'}</h1>
        <div class="subtitle">${language === 'ar' ? 'تاريخ الاستخراج' : 'DATE EXPORTED'}: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>

        <table class="details-table">
          <tr>
            <td class="details-col" style="border-right: 1px solid #e2e8f0; width: 50%;">
              <div class="details-label">${language === 'ar' ? 'ملف الجدول الزمني' : 'Timetable Profile'}</div>
              <div class="details-value">${language === 'ar' ? 'جدول المواد العام' : 'General Course Timetable'}</div>
              <div style="font-size: 7px; color: #64748b; margin-top: 2px;">${language === 'ar' ? 'إجمالي حصص المحاضرات النشطة' : 'Total Active Lecture Slots'}: ${filteredSchedules.length}</div>
            </td>
            <td class="details-col" style="width: 50%;">
              <div class="details-label">${language === 'ar' ? 'التقويم الأكاديمي' : 'Academic Calendar'}</div>
              <div class="details-value">${language === 'ar' ? 'السنة الدراسية' : 'Term Session'}: ${academicYear}</div>
            </td>
          </tr>
        </table>

        </table>
      </div>
  </div>
</body>
</html>
      `;

      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5', true);
        if (res && res.success) {
          alert("General Weekly Timetable printed successfully!");
        }
      } else {
        const filename = `General_Weekly_Timetable_${academicYear.replace(/\s+/g, '_')}.pdf`;
        const res = await ipcService.printPdf(html, filename, 'A5', true);
        if (res && res.success) {
          alert("General Weekly Timetable PDF generated successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to generate PDF schedule:", err);
      alert("Failed to export PDF weekly schedule.");
    } finally {
      setPdfLoading(false);
    }
  }

  // Load courses, teachers, students, schedules, requests
  const loadData = async () => {
    setEnrollLoading(false)
    setLoading(true)
    try {
      const [coursesData, teachersData, studentsData, schedsData, settings, requestsData] = await Promise.all([
        ipcService.getCourses(),
        ipcService.getTeachers(),
        ipcService.getStudents(),
        ipcService.getSchedules(),
        ipcService.getSettings(),
        ipcService.getScheduleRequests()
      ])
      const safeCourses = Array.isArray(coursesData) ? coursesData : []
      setCourses(safeCourses)
      setTeachers(Array.isArray(teachersData) ? teachersData : [])
      setAllStudents(Array.isArray(studentsData) ? studentsData : [])
      setSchedules(Array.isArray(schedsData) ? schedsData : [])
      setScheduleRequests(Array.isArray(requestsData) ? requestsData : [])
      if (settings) {
        if (settings.school_name) setSchoolName(settings.school_name)
        if (settings.school_address) setSchoolAddress(settings.school_address)
        if (settings.school_phone) setSchoolPhone(settings.school_phone)
        if (settings.school_email) setSchoolEmail(settings.school_email)
        if (settings.school_website) setSchoolWebsite(settings.school_website)
        if (settings.school_logo) setSchoolLogo(settings.school_logo)
        if (settings.academic_year) setAcademicYear(settings.academic_year)
        if (settings.classrooms_count) setClassroomsCount(parseInt(settings.classrooms_count) || 5)
      }

      // If enroll or edit modal is active, refresh the selectedCourse object from the new data
      if (selectedCourse) {
        const updatedSelected = safeCourses.find(c => c.id === selectedCourse.id)
        if (updatedSelected) {
          setSelectedCourse(updatedSelected)
        }
      }
    } catch (err) {
      console.error("Failed to fetch syllabus data from SQLite:", err)
      setCourses([])
      setTeachers([])
      setAllStudents([])
      setSchedules([])
      setScheduleRequests([])
    } finally {
      setTimeout(() => {
        setLoading(false)
      }, 400)
    }
  }

  useEffect(() => {
    loadData()
  }, [])


  // Input changes for Add Form
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Validate Add Form inputs
  const validateForm = () => {
    const errors = {}
    if (!formData.title.trim()) {
      errors.title = t('courses.validationTitleRequired')
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = t('courses.validationPriceRequired')
    }
    const rate = parseInt(formData.default_payout_rate || 50)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      errors.default_payout_rate = t('courses.validationPayoutRequired')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Form Submission for Adding
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setActionLoading(true)
    try {
      const payload = {
        title: formData.title,
        price: parseFloat(formData.price),
        TeacherId: formData.TeacherId ? parseInt(formData.TeacherId) : null,
        default_payout_rate: formData.payout_type === 'Percentage' ? parseInt(formData.default_payout_rate || 50) : 50,
        has_exam: formData.has_exam || false,
        payout_type: formData.payout_type || 'Percentage',
        fixed_payout_amount: formData.payout_type === 'Fixed' ? parseFloat(formData.fixed_payout_amount || 0) : 0.0
      }
      const res = await ipcService.addCourse(payload)
      if (res && res.error) {
        alert(res.error || "Failed to add course");
        return;
      }

      // Reset fields
      setFormData({
        title: '',
        price: '',
        TeacherId: '',
        default_payout_rate: '50',
        has_exam: false,
        payout_type: 'Percentage',
        fixed_payout_amount: ''
      })

      // Refresh dynamic listing
      await loadData()
      setIsAddModalOpen(false)
    } catch (err) {
      console.error("Failed to add course:", err)
      alert(err.message || "Failed to add course.");
    } finally {
      setActionLoading(false)
    }
  }

  // Edit Course Handlers
  const handleOpenEditModal = (course) => {
    setSelectedCourse(course)
    setEditFormData({
      title: course.title || '',
      price: course.price ? course.price.toString() : '',
      TeacherId: course.TeacherId ? course.TeacherId.toString() : '',
      default_payout_rate: course.default_payout_rate !== undefined ? course.default_payout_rate.toString() : '50',
      has_exam: !!course.has_exam,
      payout_type: course.payout_type || 'Percentage',
      fixed_payout_amount: course.fixed_payout_amount ? course.fixed_payout_amount.toString() : ''
    })
    setEditFormErrors({})
    setIsEditModalOpen(true)
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({ ...prev, [name]: value }))
    if (editFormErrors[name]) {
      setEditFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateEditForm = () => {
    const errors = {}
    if (!editFormData.title.trim()) errors.title = t('courses.validationTitleRequired')
    if (!editFormData.price || parseFloat(editFormData.price) <= 0) errors.price = t('courses.validationPriceRequired')
    
    if (editFormData.payout_type === 'Percentage') {
      const rate = parseInt(editFormData.default_payout_rate || 50)
      if (isNaN(rate) || rate < 0 || rate > 100) {
        errors.default_payout_rate = 'Default payout rate must be between 0 and 100%'
      }
    } else {
      const amt = parseFloat(editFormData.fixed_payout_amount)
      if (isNaN(amt) || amt < 0) {
        errors.fixed_payout_amount = 'Fixed monthly salary must be a positive number'
      }
    }
    
    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!validateEditForm()) return

    setActionLoading(true)
    try {
      const payload = {
        title: editFormData.title,
        price: parseFloat(editFormData.price),
        TeacherId: editFormData.TeacherId ? parseInt(editFormData.TeacherId) : null,
        default_payout_rate: editFormData.payout_type === 'Percentage' ? parseInt(editFormData.default_payout_rate || 50) : 50,
        has_exam: editFormData.has_exam || false,
        payout_type: editFormData.payout_type || 'Percentage',
        fixed_payout_amount: editFormData.payout_type === 'Fixed' ? parseFloat(editFormData.fixed_payout_amount || 0) : 0.0
      }
      const res = await ipcService.updateCourse(selectedCourse.id, payload)
      if (res && res.error) {
        alert(res.error || "Failed to update course");
        return;
      }
      setIsEditModalOpen(false)
      await loadData()
    } catch (err) {
      console.error("Failed to update course:", err)
      alert(err.message || "Failed to update course details.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCourse = async (id, title) => {
    const confirmed = await window.confirm(`Are you sure you want to delete course syllabus "${title}"? All student enrollments for this course will be removed.`)
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await ipcService.deleteCourse(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        if (isEditModalOpen && selectedCourse?.id === id) {
          setIsEditModalOpen(false)
        }
        if (isEnrollModalOpen && selectedCourse?.id === id) {
          setIsEnrollModalOpen(false)
        }
        await loadData()
      }
    } catch (err) {
      console.error("Failed to delete course:", err)
      alert("Failed to delete course syllabus.")
    } finally {
      setActionLoading(false)
    }
  }

  // Enrollment Handlers
  const handleOpenEnrollModal = (course) => {
    setSelectedCourse(course)
    setStudentToEnrollId('')
    setEnrollmentDate(toLocalYYYYMMDD(new Date()))
    setIsEnrollModalOpen(true)
  }

  const handleEnrollStudent = async () => {
    if (!studentToEnrollId || !selectedCourse) return
    setEnrollLoading(true)
    try {
      await ipcService.enrollStudentInCourse(parseInt(studentToEnrollId), selectedCourse.id, enrollmentDate)
      setStudentToEnrollId('')
      // Use getCourseStudents to refresh only this course's student list
      // instead of reloading all courses data — this is the proper use of that API
      const freshStudents = await ipcService.getCourseStudents(selectedCourse.id)
      setSelectedCourse(prev => ({ ...prev, Students: freshStudents }))
      await loadData()
    } catch (err) {
      console.error("Failed to enroll student:", err)
      alert("Failed to enroll student in course.")
    } finally {
      setEnrollLoading(false)
    }
  }

  // Course filter logic
  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeacher = teacherFilter === 'All' || c.TeacherId?.toString() === teacherFilter;
    
    let matchesPrice = true;
    if (priceFilter !== 'All') {
      if (priceFilter === 'under200') matchesPrice = c.price < 200;
      else if (priceFilter === '200to500') matchesPrice = c.price >= 200 && c.price <= 500;
      else if (priceFilter === 'above500') matchesPrice = c.price > 500;
    }
    
    let matchesEnrolled = true;
    if (enrolledFilter !== 'All') {
      const studentCount = c.Students ? c.Students.length : 0;
      if (enrolledFilter === 'hasStudents') matchesEnrolled = studentCount > 0;
      else if (enrolledFilter === 'empty') matchesEnrolled = studentCount === 0;
    }
    
    return matchesSearch && matchesTeacher && matchesPrice && matchesEnrolled
  })
    
  // Scheduling Helper Handlers
  const handleScheduleInputChange = (e) => {
    const { name, value } = e.target
    setScheduleForm(prev => ({ ...prev, [name]: value }))
    if (scheduleFormErrors[name]) {
      setScheduleFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateScheduleForm = (isEdit = false, editScheduleId = null) => {
    const errors = {}
    if (!scheduleForm.CourseId) {
      errors.CourseId = 'Please select a subject course'
    }
    if (!scheduleForm.room.trim()) {
      errors.room = 'Classroom room name is required'
    }
    
    // Check conflicts
    if (scheduleForm.CourseId && scheduleForm.room.trim() && scheduleForm.day_of_week && scheduleForm.time_slot) {
      const selectedCourseObj = courses.find(c => String(c.id) === String(scheduleForm.CourseId));
      const teacherId = selectedCourseObj?.TeacherId;
      
      const hasRoomConflict = schedules.some(s => 
        (isEdit ? String(s.id) !== String(editScheduleId) : true) &&
        s.day_of_week === scheduleForm.day_of_week &&
        s.time_slot === scheduleForm.time_slot &&
        s.room.trim().toLowerCase() === scheduleForm.room.trim().toLowerCase()
      );
      
      const hasTeacherConflict = teacherId && schedules.some(s => 
        (isEdit ? String(s.id) !== String(editScheduleId) : true) &&
        s.day_of_week === scheduleForm.day_of_week &&
        s.time_slot === scheduleForm.time_slot &&
        s.Course?.TeacherId === teacherId
      );
      
      if (hasRoomConflict) {
        errors.room = `Conflict: Room '${scheduleForm.room}' is already booked at this time.`;
      }
      if (hasTeacherConflict) {
        errors.CourseId = `Conflict: Instructor is already teaching another class at this time.`;
      }
    }
    
    setScheduleFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    if (!validateScheduleForm(false, null)) return
    setActionLoading(true)
    try {
      await ipcService.addSchedule({
        CourseId: parseInt(scheduleForm.CourseId),
        day_of_week: scheduleForm.day_of_week,
        time_slot: scheduleForm.time_slot,
        room: scheduleForm.room
      })
      setIsAddScheduleModalOpen(false)
      await loadData()
    } catch (err) {
      console.error("Failed to add schedule:", err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleScheduleEditSubmit = async (e) => {
    e.preventDefault()
    if (!validateScheduleForm(true, selectedSchedule.id)) return
    setActionLoading(true)
    try {
      await ipcService.updateSchedule(selectedSchedule.id, {
        CourseId: parseInt(scheduleForm.CourseId),
        day_of_week: scheduleForm.day_of_week,
        time_slot: scheduleForm.time_slot,
        room: scheduleForm.room
      })
      setIsEditScheduleModalOpen(false)
      setSelectedSchedule(null)
      await loadData()
    } catch (err) {
      console.error("Failed to update schedule:", err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleScheduleDelete = async (id) => {
    const confirmed = await window.confirm("Are you sure you want to remove this academic schedule slot?")
    if (!confirmed) return
    setActionLoading(true)
    try {
      await ipcService.deleteSchedule(id)
      setIsEditScheduleModalOpen(false)
      setSelectedSchedule(null)
      await loadData()
    } catch (err) {
      console.error("Failed to delete schedule:", err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveRequest = async (id, decision) => {
    setActionLoading(true)
    try {
      const res = await ipcService.resolveScheduleRequest(id, decision)
      if (res && res.error) {
        alert(res.error)
      } else {
        alert(decision === 'Approved' ? t('courses.successRequestApproved') : t('courses.successRequestRejected'))
        await loadData()
      }
    } catch (err) {
      console.error("Failed to resolve request:", err)
      alert("Failed to resolve schedule request.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRequest = async (id) => {
    if (!(await window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this request?'))) return;
    setActionLoading(true)
    try {
      const res = await ipcService.deleteScheduleRequest(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        await loadData()
      }
    } catch (err) {
      console.error("Failed to delete request:", err)
      alert("Failed to delete schedule request.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!requestForm.course_name) errors.course_name = language === 'ar' ? 'يرجى اختيار المادة الدراسية' : 'Course name is required'
    if (!requestForm.description.trim()) errors.description = language === 'ar' ? 'الوصف مطلوب' : 'Description is required'
    if (!requestForm.requested_by.trim()) errors.requested_by = language === 'ar' ? 'مقدم الطلب مطلوب' : 'Requested by is required'

    if (Object.keys(errors).length > 0) {
      setRequestErrors(errors)
      return
    }
    setRequestErrors({})
    setActionLoading(true)

    try {
      const res = await ipcService.addScheduleRequest({
        type: requestForm.type,
        course_name: requestForm.course_name,
        description: requestForm.description,
        requested_by: requestForm.requested_by,
        time_elapsed: 'Just now'
      })
      if (res && res.error) {
        alert(res.error)
      } else {
        setIsAddRequestModalOpen(false)
        setRequestForm({
          type: 'Rescheduling',
          course_name: '',
          description: '',
          requested_by: ''
        })
        await loadData()
      }
    } catch (err) {
      console.error("Failed to submit request:", err)
      alert("Failed to submit schedule request.")
    } finally {
      setActionLoading(false)
    }
  }



  // Real-time scheduling conflict calculations
  const getConflicts = () => {
    const conflicts = []
    const roomsSeen = {}
    const teachersSeen = {}

    schedules.forEach(s => {
      const key = `${s.day_of_week}-${s.time_slot}`
      const roomKey = `${key}-${s.room}`
      const teacherId = s.Course?.TeacherId
      const teacherKey = teacherId ? `${key}-${teacherId}` : null

      // Room Overlap check
      if (!roomsSeen[roomKey]) roomsSeen[roomKey] = []
      roomsSeen[roomKey].push(s)

      // Teacher double booking check
      if (teacherKey) {
        if (!teachersSeen[teacherKey]) teachersSeen[teacherKey] = []
        teachersSeen[teacherKey].push(s)
      }
    })

    // Collect Room conflict items
    Object.keys(roomsSeen).forEach(k => {
      const list = roomsSeen[k]
      if (list.length > 1) {
        conflicts.push({
          id: `room-${k}`,
          type: 'ROOM_OVERLAP',
          schedules: list,
          description: `Room Overlap: ${list[0].room} (${list.map(s => s.Course?.title || 'Unknown').join(' & ')} on ${list[0].day_of_week}, ${list[0].time_slot})`
        })
      }
    })

    // Collect Teacher conflict items
    Object.keys(teachersSeen).forEach(k => {
      const list = teachersSeen[k]
      if (list.length > 1) {
        conflicts.push({
          id: `teacher-${k}`,
          type: 'TEACHER_OVERLAP',
          schedules: list,
          description: `Teacher Availability: ${list[0].Course?.Teacher?.full_name || 'Instructor'} has a lecture at the same time in ${list.map(s => s.room).join(' and ')}.`
        })
      }
    })

    return conflicts
  }

  const conflictsList = getConflicts()

  // Filtered schedules for grid view
  const filteredSchedules = schedules.filter(s => {
    const matchesRoom = roomFilter === 'All' || s.room === roomFilter
    const matchesSpecialty = schedulingSpecialtyFilter === 'All' || s.Course?.Teacher?.specialty === schedulingSpecialtyFilter
    const matchesTeacher = schedulingTeacherFilter === 'All' || s.Course?.TeacherId?.toString() === schedulingTeacherFilter
    return matchesRoom && matchesSpecialty && matchesTeacher
  })

  return (
    <div className="no-print">
      <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('courses.title')}</h1>
          <p className="text-xs text-slate-400">{t('courses.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 disabled:opacity-50 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title={t('courses.refreshTooltip')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {activeSubTab === 'catalog' && hasPermission('courses:write') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              {t('courses.addCourse')}
            </button>
          )}
          {activeSubTab === 'schedule' && hasPermission('courses:write') && (
            <button
              onClick={() => setIsAddScheduleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              {t('courses.newSchedule')}
            </button>
          )}
        </div>
      </div>

      {/* IPC API Offline Warning */}
      {!window.api && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{t('layout.ipcOffline')}</span>
        </div>
      )}

      {/* Navigation and Filters Container */}
      <div className="no-print w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
        {/* Left Side: Sub-Tab Navigation Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-955 border border-slate-800/60 rounded-xl shrink-0 w-fit h-9">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`flex items-center gap-2 px-3.5 h-full border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeSubTab === 'catalog'
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            {t('courses.tabCatalog')}
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`flex items-center gap-2 px-3.5 h-full border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeSubTab === 'schedule'
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Calendar className="h-4 w-4" />
            {t('courses.tabSchedule')}
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`flex items-center gap-2 px-3.5 h-full border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeSubTab === 'requests'
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <BookOpenCheck className="h-4 w-4" />
            {t('courses.tabRequests')}
          </button>
        </div>

        {/* Right Side: Page Specific Filters */}
        <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end flex-1 w-full lg:w-auto">
          {activeSubTab === 'catalog' && (
            <>
              <div className="relative w-full sm:w-40 shrink-0 h-9">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('courses.searchPlaceholder')}
                  className="w-full h-full pl-9 pr-4 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
              </div>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="px-3 h-9 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{t('courses.filterInstructor')}</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id.toString()}>{t.full_name}</option>
                ))}
              </select>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="px-3 h-9 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{t('courses.filterPrice')}</option>
                <option value="under200">{t('courses.priceUnder200')}</option>
                <option value="200to500">{t('courses.price200to500')}</option>
                <option value="above500">{t('courses.priceAbove500')}</option>
              </select>
              <select
                value={enrolledFilter}
                onChange={(e) => setEnrolledFilter(e.target.value)}
                className="px-3 h-9 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{language === 'ar' ? 'جميع التسجيلات' : 'All Enrollment'}</option>
                <option value="hasStudents">{language === 'ar' ? 'بها طلاب' : 'Has Students'}</option>
                <option value="empty">{language === 'ar' ? 'مواد فارغة' : 'Empty Course'}</option>
              </select>
            </>
          )}
          {activeSubTab === 'schedule' && (
            <>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-3 h-9 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{language === 'ar' ? 'جميع القاعات' : 'All Classrooms'}</option>
                {classroomsList.map(r => (
                  <option key={r} value={r}>{language === 'ar' ? `القاعة ${r}` : `Classroom ${r}`}</option>
                ))}
              </select>
              <select
                value={schedulingTeacherFilter}
                onChange={(e) => setSchedulingTeacherFilter(e.target.value)}
                className="px-3 h-9 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{t('courses.filterInstructor')}</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id.toString()}>{t.full_name}</option>
                ))}
              </select>
              <select
                value={schedulingSpecialtyFilter}
                onChange={(e) => setSchedulingSpecialtyFilter(e.target.value)}
                className="px-3 h-9 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
              >
                <option value="All">{t('teachers.specialtyAll')}</option>
                {[...new Set(teachers.map(t => t.specialty).filter(Boolean))].map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </>
          )}
          {/* Count Badge on the right */}
          {activeSubTab === 'schedule' && (
            <div className="text-[10px] text-slate-555 font-semibold uppercase tracking-wider shrink-0 lg:ml-2 font-sans">
              {t('courses.scheduleBadge')}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="w-full space-y-4">
        {activeSubTab === 'catalog' && (
          <>
            <div className="flex items-center gap-2 px-2 pt-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{language === 'ar' ? 'سجل المواد الدراسية' : 'Syllabus Registry'}</h3>
              <span className="text-[10px] text-slate-550 font-semibold font-sans normal-case tracking-normal">
                ({courses.length} {courses.length === 1 ? (language === 'ar' ? 'مادة' : 'course') : (language === 'ar' ? 'مواد' : 'courses')})
              </span>
            </div>


            {loading ? (
              /* Card Grid Skeleton Loader */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} className="p-6 bg-slate-900/40 border border-slate-800/40 rounded-2xl space-y-4 animate-pulse">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-24 bg-slate-800 rounded"></div>
                      <div className="h-4 w-12 bg-slate-800 rounded-full"></div>
                    </div>
                    <div className="h-3.5 w-3/4 bg-slate-800 rounded"></div>
                    <div className="pt-4 border-t border-slate-800 flex gap-4">
                      <div className="h-3 w-16 bg-slate-800 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : courses.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-slate-500 gap-3">
                <BookOpen className="h-8 w-8 text-slate-600" />
                <p className="text-xs">{t('courses.noCoursesRegistered')}</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              /* Empty Filter State */
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-slate-500 gap-3">
                <BookOpen className="h-8 w-8 text-slate-600" />
                <p className="text-xs">{t('courses.noMatchingRecords')}</p>
              </div>
            ) : (
              /* Real Cards Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => (
                  <div key={course.id} className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl hover:border-slate-700/60 transition-all duration-200 flex flex-col justify-between group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400 border border-blue-500/10 group-hover:scale-110 transition-transform">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-bold font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full">
                          {course.price.toLocaleString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 })} DA
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors pt-1">{course.title}</h4>
                      
                      {/* Instructor assignment info */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5">
                        <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {course.Teacher ? (
                            <>
                              {t('courses.instructorLabel')}: <strong className="text-slate-300 font-medium">{course.Teacher.full_name}</strong>
                            </>
                          ) : (
                            <span className="text-slate-500 italic">No assigned instructor</span>
                          )}
                        </span>
                      </div>

                      {/* Enrolled Students count */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-0.5">
                        <Users className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span>
                          {t('courses.enrolledStudentsLabel')}: <strong className="text-slate-300 font-medium">{course.Students ? course.Students.length : 0}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Footer with Clock and edit/delete/enrollment operations */}
                    <div className="flex items-center justify-end border-t border-slate-800/60 mt-5 pt-3.5">
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEnrollModal(course)}
                          className="px-2 py-1 bg-slate-955 border border-slate-850 hover:border-purple-500/30 text-purple-400 hover:text-purple-300 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                          title={language === 'ar' ? 'إدارة الطلاب المسجلين' : 'Manage Enrolled Students'}
                        >
                          {t('sidebar.students')} ({course.Students ? course.Students.length : 0})
                        </button>
                        {hasPermission('courses:write') && (
                          <button
                            onClick={() => handleOpenEditModal(course)}
                            className="p-1.5 bg-slate-955 border border-slate-850 hover:border-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg transition-all cursor-pointer"
                            title="Edit Course"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {hasPermission('courses:delete') && (
                          <button
                            onClick={() => handleDeleteCourse(course.id, course.title)}
                            className="p-1.5 bg-slate-955 border border-slate-850 hover:border-rose-500/30 text-rose-400 hover:text-rose-355 rounded-lg transition-all cursor-pointer"
                            title={t('courses.deleteCourseTooltip')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {activeSubTab === 'schedule' && (
          <>

            {/* Timetable and Utilities layout */}
            <div className="space-y-6">
              {/* Conflicts Panel (Full Width above schedule) */}
              <div className="no-print bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    {language === 'ar' ? 'تعارضات الجدولة' : 'Scheduling Conflicts'}
                  </h3>
                  <span className="text-[10px] bg-slate-955 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {conflictsList.length}
                  </span>
                </div>

                {conflictsList.length === 0 ? (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                    <span>{language === 'ar' ? 'لم يتم الكشف عن أي تعارض. كل شيء سليم.' : 'No conflicts detected. Everything is clear.'}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {conflictsList.map(conf => (
                      <div key={conf.id} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2 text-left flex flex-col justify-between">
                        <div className="text-[11px] font-medium text-rose-300">
                          {conf.description}
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              const targetSched = conf.schedules[0]
                              setSelectedSchedule(targetSched)
                              setScheduleForm({
                                CourseId: targetSched.CourseId?.toString() || '',
                                day_of_week: targetSched.day_of_week,
                                time_slot: targetSched.time_slot,
                                room: targetSched.room
                              })
                              setIsEditScheduleModalOpen(true)
                            }}
                            className="px-2 py-1 bg-slate-955 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded text-[9px] font-semibold transition-colors cursor-pointer"
                          >
                            Resolve Overlap
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timetable Grid (Full Width) */}
              <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <h3 className="text-sm font-semibold text-slate-200">{language === 'ar' ? 'توقيت المحاضرات الأسبوعي' : 'Weekly Lecture Schedule'}</h3>
                  <div className="flex items-center gap-2">
                    {/* Matrix/Standard Toggle */}
                    <div className="no-print flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl mr-2 rtl:mr-0 rtl:ml-2">
                      <button
                        type="button"
                        onClick={() => setTimetableMode('standard')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          timetableMode === 'standard'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('customFeatures.standardTimetable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimetableMode('matrix')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          timetableMode === 'matrix'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('customFeatures.classroomMatrixView')}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (schedulingTeacherFilter !== 'All') {
                          const tObj = teachers.find(t => t.id.toString() === schedulingTeacherFilter)
                          if (tObj) setActivePrintTeacherSchedule(tObj)
                        } else {
                          setActivePrintGeneralSchedule(true)
                        }
                      }}
                      className="no-print flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                      title={schedulingTeacherFilter !== 'All' ? t('courses.printTeacherSchedule') : t('courses.printGeneralSchedule')}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {schedulingTeacherFilter !== 'All' ? `${t('courses.printTeacherSchedule')} PDF` : t('common.print')}
                    </button>
                    <span className="text-[10px] bg-slate-955 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
                      {language === 'ar' ? `حصص نشطة: ${filteredSchedules.length}` : `${filteredSchedules.length} active slots`}
                    </span>
                  </div>
                </div>

                {timetableMode === 'standard' ? (
                  <div className="overflow-x-auto relative">
                    {timeProgress !== null && (
                      <div 
                        className="absolute left-0 right-0 border-t-2 border-dashed border-yellow-500 pointer-events-none z-20 opacity-20" 
                        style={{ top: `calc(56px + (100% - 56px) * ${timeProgress} / 100)` }}
                      >
                        {/* Half circle at the beginning of the line */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-yellow-500 left-0 rtl:left-auto rtl:right-0 rounded-r-full rtl:rounded-r-none rtl:rounded-l-full"
                        />
                      </div>
                    )}
                    <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-separate border-spacing-0 border border-slate-800/40 rounded-xl overflow-hidden`}>
                      <thead>
                        <tr className="bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
                          <th className="px-3 py-3 border-r border-slate-800/40 text-left w-24">{t('courses.timeSlotCol')}</th>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx, arr) => {
                            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const currentDayName = daysOfWeek[new Date().getDay()];
                            const isToday = day === currentDayName;
                            const isFirstCol = idx === 0;
                            const isLastCol = idx === arr.length - 1;
                            const cornerRoundClass = isToday
                              ? isFirstCol
                                ? (language === 'ar' ? 'rounded-tr-xl' : 'rounded-tl-xl')
                                : isLastCol
                                  ? (language === 'ar' ? 'rounded-tl-xl' : 'rounded-tr-xl')
                                  : ''
                              : '';
                            return (
                              <th 
                                key={t('courses.' + day.toLowerCase())} 
                                className={`px-3 py-3 text-center transition-all ${idx < arr.length - 1 ? 'border-r border-slate-800/40' : ''} ${
                                  isToday ? 'bg-yellow-500/10' : ''
                                } ${cornerRoundClass}`}
                              >
                                <div className="flex flex-col items-center justify-center">
                                  <span className={isToday ? 'text-yellow-400 font-bold' : ''}>{t('courses.' + day.toLowerCase())}</span>
                                  <span className={`text-[9px] font-normal normal-case mt-0.5 font-sans ${isToday ? 'text-yellow-500/75' : 'text-slate-500'}`}>
                                    ({weekDatesMap[day]})
                                  </span>
                                  {isToday && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 mt-1">
                                      {language === 'ar' ? 'اليوم' : 'Today'}
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {['08:00', '10:00', '12:00', '14:00', '16:00'].map(slot => (
                          <tr key={slot} className="hover:bg-slate-900/10 transition-colors relative">
                            <td className="px-3 py-4 border-r border-slate-800/40 font-mono text-xs font-semibold text-slate-400 bg-slate-955/10">
                              {slot === '12:00' ? '12:00' : `${slot} - ${parseInt(slot) + 2}:00`}
                            </td>

                            {slot === '12:00' ? (
                              <td colSpan={7} className="px-3 py-4 text-center text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-950/30">
                                {t('courses.recessLabel')}
                              </td>
                            ) : (
                              ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dIdx) => {
                                const cellSchedules = filteredSchedules.filter(
                                  s => s.day_of_week === day && s.time_slot === slot
                                )
                                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                const currentDayName = daysOfWeek[new Date().getDay()];
                                const isToday = day === currentDayName;
                                const isLastSlot = slot === '16:00';
                                const isFirstCol = dIdx === 0;
                                const isLastCol = dIdx === 6;
                                const cornerRoundClass = (isToday && isLastSlot)
                                  ? isFirstCol
                                    ? (language === 'ar' ? 'rounded-br-xl' : 'rounded-bl-xl')
                                    : isLastCol
                                      ? (language === 'ar' ? 'rounded-bl-xl' : 'rounded-br-xl')
                                      : ''
                                  : '';

                                return (
                                  <td
                                    key={day}
                                    className={`border-r border-slate-800/40 p-2 min-w-[140px] align-top relative group hover:bg-slate-955/20 transition-all ${
                                      isToday ? 'bg-yellow-500/[0.04]' : ''
                                    } ${cornerRoundClass}`}
                                  >
                                    {cellSchedules.length > 0 ? (
                                      <div className="space-y-2">
                                        {cellSchedules.map(sched => (
                                          <div
                                            key={sched.id}
                                            className="p-2.5 rounded-xl bg-slate-955 border border-slate-800 hover:border-slate-700/80 text-left relative group/item transition-all shadow-md print:bg-white print:border-slate-300 print:text-black print:shadow-none print:p-1.5"
                                          >
                                            <div className="flex justify-between items-start gap-1">
                                              <span className="text-[10px] font-bold text-slate-200 print:text-black line-clamp-2">
                                                {sched.Course?.title || 'Unknown Course'}
                                              </span>
                                              <button
                                                onClick={() => {
                                                  setSelectedSchedule(sched)
                                                  setScheduleForm({
                                                    CourseId: sched.CourseId?.toString() || '',
                                                    day_of_week: sched.day_of_week,
                                                    time_slot: sched.time_slot,
                                                    room: sched.room
                                                  })
                                                  setIsEditScheduleModalOpen(true)
                                                }}
                                                className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-all cursor-pointer no-print shrink-0"
                                                title={t('courses.editScheduleTooltip')}
                                              >
                                                <Edit className="h-3 w-3" />
                                              </button>
                                            </div>
                                            <p className="text-[9px] text-slate-500 print:text-black mt-1 truncate">
                                              {sched.Course?.Teacher?.full_name || t('courses.noInstructor')}
                                            </p>
                                            <div className="flex items-center justify-between border-t border-slate-800/60 mt-2 pt-1.5 text-[9px] text-slate-500 print:border-slate-200 print:text-black">
                                              <span className="inline-flex items-center gap-1">
                                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                                {language === 'ar' ? `قاعة ${sched.room}` : `Room ${sched.room}`}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteSchedule(sched.id)}
                                                className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-slate-800 text-rose-505 rounded transition-all cursor-pointer no-print"
                                                title={t('courses.deleteScheduleTooltip')}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center min-h-[50px]">
                                        <button
                                          onClick={() => {
                                            setScheduleForm({
                                              CourseId: '',
                                              day_of_week: day,
                                              time_slot: slot,
                                              room: roomFilter !== 'All' ? roomFilter : 'A'
                                            })
                                            setIsAddScheduleModalOpen(true)
                                          }}
                                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 bg-slate-955 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-semibold transition-all cursor-pointer"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Assign
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                )
                              })
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Day Selection Bar */}
                    <div className="no-print flex flex-wrap gap-2 pb-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setMatrixActiveDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            matrixActiveDay === day
                              ? 'bg-blue-600 text-white shadow'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t('courses.' + day.toLowerCase())}
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto relative">
                      <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-separate border-spacing-0 border border-slate-800/40 rounded-xl overflow-hidden`}>
                        <thead>
                          <tr className="bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
                            <th className="px-3 py-3 border-r border-slate-800/40 text-left w-24">{t('courses.timeSlotCol')}</th>
                            {classroomsList.map((room, idx, arr) => (
                              <th key={room} className={`px-3 py-3 text-center transition-all ${idx < arr.length - 1 ? 'border-r border-slate-800/40' : ''}`}>
                                {language === 'ar' ? `قاعة ${room}` : `Room ${room}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {['08:00', '10:00', '14:00', '16:00'].map(slot => (
                            <tr key={slot} className="hover:bg-slate-900/10 transition-colors relative">
                              <td className="px-3 py-4 border-r border-slate-800/40 font-mono text-xs font-semibold text-slate-400 bg-slate-955/10">
                                {`${slot} - ${parseInt(slot) + 2}:00`}
                              </td>
                              {classroomsList.map((room, rIdx, rArr) => {
                                const cellSched = filteredSchedules.find(
                                  s => s.day_of_week === matrixActiveDay && s.time_slot === slot && s.room.trim().toLowerCase() === room.trim().toLowerCase()
                                );
                                return (
                                  <td
                                    key={room}
                                    className={`border-r border-slate-800/40 p-2 min-w-[140px] align-middle text-center relative group hover:bg-slate-955/20 transition-all`}
                                  >
                                    {cellSched ? (
                                      <div className="p-2.5 rounded-xl bg-slate-955 border border-slate-800 hover:border-slate-700/80 text-left relative group/item transition-all shadow-md">
                                        <div className="flex justify-between items-start gap-1">
                                          <span className="text-[10px] font-bold text-slate-200 line-clamp-2">
                                            {cellSched.Course?.title || 'Unknown Course'}
                                          </span>
                                          <button
                                            onClick={() => {
                                              setSelectedSchedule(cellSched)
                                              setScheduleForm({
                                                CourseId: cellSched.CourseId?.toString() || '',
                                                day_of_week: cellSched.day_of_week,
                                                time_slot: cellSched.time_slot,
                                                room: cellSched.room
                                              })
                                              setIsEditScheduleModalOpen(true)
                                            }}
                                            className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors cursor-pointer no-print shrink-0"
                                            title="Edit"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </button>
                                        </div>
                                        <p className="text-[9px] text-slate-500 mt-1 truncate">
                                          {cellSched.Course?.Teacher?.full_name || t('courses.noInstructor')}
                                        </p>
                                        <div className="flex items-center justify-between border-t border-slate-800/60 mt-2 pt-1.5 text-[9px] text-slate-500 font-sans">
                                          <span>{matrixActiveDay}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSchedule(cellSched.id)}
                                            className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-slate-800 text-rose-500 rounded transition-all cursor-pointer no-print"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center min-h-[50px]">
                                        <button
                                          onClick={() => {
                                            setScheduleForm({
                                              CourseId: '',
                                              day_of_week: matrixActiveDay,
                                              time_slot: slot,
                                              room: room
                                            })
                                            setScheduleFormErrors({})
                                            setIsAddScheduleModalOpen(true)
                                          }}
                                          className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1.5 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 rounded-lg transition-all cursor-pointer border border-slate-700/50"
                                          title={language === 'ar' ? 'إضافة حصة هنا' : 'Schedule class here'}
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeSubTab === 'requests' && (
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{t('courses.requestsTitle')}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('courses.requestsSubtitle')}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRequestForm({
                      type: 'Rescheduling',
                      course_name: courses[0]?.title || '',
                      description: '',
                      requested_by: ''
                    })
                    setIsAddRequestModalOpen(true)
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  {language === 'ar' ? 'تقديم طلب جديد' : 'Submit New Request'}
                </button>
                <span className="text-[10px] bg-slate-955 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
                  {scheduleRequests.filter(r => r.status === 'Pending').length} {language === 'ar' ? 'معلق' : 'Pending'}
                </span>
              </div>
            </div>
            
            {scheduleRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <BookOpenCheck className="h-8 w-8 text-slate-600 animate-pulse" />
                <p className="text-xs">{t('courses.noRequests')}</p>
              </div>
            ) : (
              <div className="border border-slate-800/60 rounded-xl overflow-hidden">
                <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                  <thead>
                    <tr className="bg-slate-955 border-b border-slate-800/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left rtl:text-right">{t('courses.requestType')}</th>
                      <th className="px-4 py-3 text-left rtl:text-right">{t('courses.courseName')}</th>
                      <th className="px-4 py-3 text-left rtl:text-right">{t('courses.requestedBy')}</th>
                      <th className="px-4 py-3 text-left rtl:text-right">{t('courses.description')}</th>
                      <th className="px-4 py-3 text-left rtl:text-right">{t('courses.timeElapsed')}</th>
                      <th className="px-4 py-3 text-right rtl:text-left">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-xs text-slate-300">
                    {scheduleRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            req.type === 'Rescheduling' 
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                              : req.type === 'Teacher Swap'
                              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                              : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                          }`}>
                            {req.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-200">{req.course_name}</td>
                        <td className="px-4 py-3 text-slate-300">{req.requested_by}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={req.description}>{req.description}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{req.time_elapsed}</td>
                        <td className="px-4 py-3 text-right rtl:text-left">
                          <div className="flex items-center justify-end rtl:justify-start gap-2">
                            {req.status === 'Pending' ? (
                              isAdmin ? (
                                <>
                                  <button
                                    onClick={() => handleResolveRequest(req.id, 'Approved')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    {t('courses.actionApprove')}
                                  </button>
                                  <button
                                    onClick={() => handleResolveRequest(req.id, 'Rejected')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-455 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    {t('courses.actionReject')}
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                  {t('courses.statusPending')}
                                </span>
                              )
                            ) : req.status === 'Approved' ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                {t('courses.statusApproved')}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-450">
                                {t('courses.statusRejected')}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(req.id)}
                              disabled={actionLoading}
                              className="p-1 hover:bg-slate-800 rounded-lg text-rose-500 transition-colors cursor-pointer ml-1 rtl:mr-1"
                              title={language === 'ar' ? 'حذف الطلب' : 'Delete Request'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>


      {/* Submit Schedule Request Modal */}
      {isAddRequestModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setIsAddRequestModalOpen(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            <form 
              onSubmit={handleRequestSubmit} 
              className="flex flex-col h-full overflow-hidden text-left rtl:text-right"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <BookOpenCheck className="h-4.5 w-4.5 text-blue-500" />
                    {language === 'ar' ? 'تقديم طلب جدولة جديد' : 'Submit New Schedule Request'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {language === 'ar' ? 'أرسل طلباً لتعديل توقيت مادة، أستاذ أو قاعة' : 'Submit a request to change schedule slot, instructor, or booking'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddRequestModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Request Type */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.requestType')}</label>
                    <select
                      value={requestForm.type}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, type: e.target.value }))}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="Rescheduling">{language === 'ar' ? 'تغيير توقيت (Rescheduling)' : 'Rescheduling'}</option>
                      <option value="Teacher Swap">{language === 'ar' ? 'تغيير أستاذ (Teacher Swap)' : 'Teacher Swap'}</option>
                      <option value="Room Booking">{language === 'ar' ? 'حجز قاعة (Room Booking)' : 'Room Booking'}</option>
                    </select>
                  </div>

                  {/* Course Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.courseName')}</label>
                    <select
                      value={requestForm.course_name}
                      onChange={(e) => {
                        setRequestForm(prev => ({ ...prev, course_name: e.target.value }))
                        if (requestErrors.course_name) setRequestErrors(prev => ({ ...prev, course_name: '' }))
                      }}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors cursor-pointer ${
                        requestErrors.course_name ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    >
                      <option value="">{language === 'ar' ? '-- اختر المادة الدراسية --' : '-- Choose Course --'}</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.title}>{c.title}</option>
                      ))}
                    </select>
                    {requestErrors.course_name && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {requestErrors.course_name}
                      </span>
                    )}
                  </div>

                  {/* Requested By */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.requestedBy')}</label>
                    <input
                      type="text"
                      value={requestForm.requested_by}
                      onChange={(e) => {
                        setRequestForm(prev => ({ ...prev, requested_by: e.target.value }))
                        if (requestErrors.requested_by) setRequestErrors(prev => ({ ...prev, requested_by: '' }))
                      }}
                      placeholder={language === 'ar' ? 'مثال: أ. سمير، قسم البرمجة' : 'e.g. Prof. Smith, Academics Dept.'}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                        requestErrors.requested_by ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    />
                    {requestErrors.requested_by && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {requestErrors.requested_by}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1.5 md:col-span-3">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.description')}</label>
                    <textarea
                      value={requestForm.description}
                      onChange={(e) => {
                        setRequestForm(prev => ({ ...prev, description: e.target.value }))
                        if (requestErrors.description) setRequestErrors(prev => ({ ...prev, description: '' }))
                      }}
                      rows="2"
                      placeholder={language === 'ar' ? 'توضيح تفاصيل الطلب (مثال: طلب نقل الحصة إلى يوم الأحد الساعة 10)' : 'Details of the request...'}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors resize-none ${
                        requestErrors.description ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    />
                    {requestErrors.description && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {requestErrors.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800/60 shrink-0 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddRequestModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
                  {language === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Edit Course Modal */}
      {isEditModalOpen && selectedCourse && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setIsEditModalOpen(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            <form 
              onSubmit={handleEditSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Edit className="h-4.5 w-4.5 text-blue-500" />
                    {t('courses.modalEditTitle')}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {language === 'ar' ? `جاري تحديث تفاصيل المادة رقم #${selectedCourse.id}` : `Updating subject course #${selectedCourse.id}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Title */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.courseTitleLabel')}</label>
                    <input
                      type="text"
                      name="title"
                      value={editFormData.title}
                      onChange={handleEditInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                        editFormErrors.title ? 'border-rose-500/50' : 'border-slate-805/80'
                      }`}
                    />
                    {editFormErrors.title && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {editFormErrors.title}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.tuitionFeeLabel')}</label>
                    <input
                      type="number"
                      name="price"
                      value={editFormData.price}
                      onChange={handleEditInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                        editFormErrors.price ? 'border-rose-500/50' : 'border-slate-805/80'
                      }`}
                    />
                    {editFormErrors.price && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {editFormErrors.price}
                      </span>
                    )}
                  </div>

                  {/* Teacher */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.assignInstructorLabel')}</label>
                    <select
                      name="TeacherId"
                      value={editFormData.TeacherId}
                      onChange={handleEditInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors cursor-pointer"
                    >
                      <option value="">{language === 'ar' ? '-- بدون أستاذ مسند --' : '-- No Assigned Instructor --'}</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id.toString()}>{t.full_name} ({t.specialty})</option>
                      ))}
                    </select>
                  </div>

                  {/* Payout Mode Type */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                      {language === 'ar' ? 'طريقة الدفع للأستاذ' : 'Payout Mode'}
                    </label>
                    <select
                      name="payout_type"
                      value={editFormData.payout_type}
                      onChange={handleEditInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors cursor-pointer"
                    >
                      <option value="Percentage">{language === 'ar' ? 'نسبة مئوية (%)' : 'Percentage Cut (%)'}</option>
                      <option value="Fixed">{language === 'ar' ? 'راتب شهري ثابت' : 'Fixed Monthly Salary'}</option>
                    </select>
                  </div>

                  {/* Dynamic payout input field */}
                  {editFormData.payout_type === 'Percentage' ? (
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.payoutRateLabel')}</label>
                      <input
                        type="number"
                        name="default_payout_rate"
                        value={editFormData.default_payout_rate}
                        onChange={handleEditInputChange}
                        min="0"
                        max="100"
                        className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                          editFormErrors.default_payout_rate ? 'border-rose-500/50' : 'border-slate-805/80'
                        }`}
                      />
                      {editFormErrors.default_payout_rate && (
                        <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {editFormErrors.default_payout_rate}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                        {language === 'ar' ? 'الراتب الثابت للمادة (د.ج)' : 'Fixed Course Salary (DA)'}
                      </label>
                      <input
                        type="number"
                        name="fixed_payout_amount"
                        value={editFormData.fixed_payout_amount}
                        onChange={handleEditInputChange}
                        placeholder={language === 'ar' ? 'مثال: 30000' : 'e.g. 30000'}
                        min="0"
                        className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                          editFormErrors.fixed_payout_amount ? 'border-rose-500/50' : 'border-slate-805/80'
                        }`}
                      />
                      {editFormErrors.fixed_payout_amount && (
                        <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {editFormErrors.fixed_payout_amount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Includes Exam checkbox */}
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="edit_has_exam"
                      name="has_exam"
                      checked={editFormData.has_exam || false}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, has_exam: e.target.checked }))}
                      className="h-4 w-4 bg-slate-955 border border-slate-800 rounded focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <label htmlFor="edit_has_exam" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                      {t('customFeatures.hasExam')}
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <div className="flex gap-2">
                  {hasPermission('courses:delete') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(selectedCourse.id, selectedCourse.title)}
                      className="px-3 py-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-455 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('common.delete')}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Enrollments Modal */}
      {isEnrollModalOpen && selectedCourse && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setIsEnrollModalOpen(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-purple-400" />
                  Enrollment Manager
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Course: <strong className="text-slate-200">{selectedCourse.title}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Enroll New Student Form */}
                <div className="p-4 bg-slate-955/45 border border-slate-800 rounded-xl space-y-3 h-fit text-left rtl:text-right">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold block">
                    {language === 'ar' ? 'تسجيل طالب' : 'Enroll a Student'}
                  </label>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">
                        {language === 'ar' ? 'اختر الطالب' : 'Select Student'}
                      </label>
                      <select
                        value={studentToEnrollId}
                        onChange={(e) => setStudentToEnrollId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                      >
                        <option value="">-- {language === 'ar' ? 'اختر الطالب لتسجيله' : 'Select student to enroll'} --</option>
                        {allStudents
                          .filter(s => !(selectedCourse.Students || []).some(es => es.id === s.id))
                          .map(s => (
                            <option key={s.id} value={s.id.toString()}>{s.full_name} ({s.status})</option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">
                        {language === 'ar' ? 'تاريخ التسجيل' : 'Enrollment Date'}
                      </label>
                      <CustomDatePicker
                        value={enrollmentDate}
                        onChange={(e) => setEnrollmentDate(e.target.value)}
                        language={language}
                        t={t}
                        placeholder={language === 'ar' ? 'تاريخ التسجيل' : 'Enrollment Date'}
                      />
                    </div>
                    <button
                      onClick={handleEnrollStudent}
                      disabled={enrollLoading || !studentToEnrollId}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-500/10"
                    >
                      {enrollLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {language === 'ar' ? 'تسجيل الطالب' : 'Enroll Student'}
                    </button>
                  </div>
                </div>

                {/* Right Column: List of Enrolled Students */}
                <div className="space-y-2">
                  <h4 className="text-[9.5px] text-slate-400 uppercase font-bold tracking-wider px-0.5">Enrolled Students ({selectedCourse.Students?.length || 0})</h4>
                  
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800/80 rounded-xl bg-slate-955/35">
                    {!selectedCourse.Students || selectedCourse.Students.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 italic">
                        No students enrolled in this course yet.
                      </div>
                    ) : (
                      selectedCourse.Students.map(student => (
                        <div key={student.id} className="p-3 flex items-center justify-between hover:bg-slate-900/30 transition-colors">
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{student.full_name}</p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">Student ID: #{student.id}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                            student.status === 'Active'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                          }`}>
                            {student.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-800/60 shrink-0 bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Course Modal */}
      {isAddModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setIsAddModalOpen(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            <form 
              onSubmit={handleSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <BookOpenCheck className="h-4.5 w-4.5 text-blue-500" />
                  {t('courses.modalAddTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Title Input */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.courseTitleLabel')}</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder={t('courses.courseTitlePlaceholder')}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                        formErrors.title ? 'border-rose-500/50' : 'border-slate-805/80'
                      }`}
                    />
                    {formErrors.title && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {formErrors.title}
                      </span>
                    )}
                  </div>

                  {/* Tuition Price Input */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.priceLabel')} ({language === 'ar' ? 'د.ج' : 'DA'})</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder={t('courses.tuitionFeePlaceholder')}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                        formErrors.price ? 'border-rose-500/50' : 'border-slate-805/80'
                      }`}
                    />
                    {formErrors.price && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {formErrors.price}
                      </span>
                    )}
                  </div>

                  {/* Assign Teacher Dropdown Select */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.assignInstructorLabel')}</label>
                    <select
                      name="TeacherId"
                      value={formData.TeacherId}
                      onChange={handleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors cursor-pointer"
                    >
                      <option value="">{language === 'ar' ? '-- لا يوجد أستاذ مسند --' : '-- No Assigned Instructor --'}</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id.toString()}>{t.full_name} ({t.specialty || (language === 'ar' ? 'عام' : 'General')})</option>
                      ))}
                    </select>
                  </div>

                  {/* Payout Mode Type */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                      {language === 'ar' ? 'طريقة الدفع للأستاذ' : 'Payout Mode'}
                    </label>
                    <select
                      name="payout_type"
                      value={formData.payout_type}
                      onChange={handleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors cursor-pointer"
                    >
                      <option value="Percentage">{language === 'ar' ? 'نسبة مئوية (%)' : 'Percentage Cut (%)'}</option>
                      <option value="Fixed">{language === 'ar' ? 'راتب شهري ثابت' : 'Fixed Monthly Salary'}</option>
                    </select>
                  </div>

                  {/* Dynamic payout input field */}
                  {formData.payout_type === 'Percentage' ? (
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.payoutRateLabel')}</label>
                      <input
                        type="number"
                        name="default_payout_rate"
                        value={formData.default_payout_rate}
                        onChange={handleInputChange}
                        placeholder={t('courses.payoutRatePlaceholder')}
                        min="0"
                        max="100"
                        className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                          formErrors.default_payout_rate ? 'border-rose-500/50' : 'border-slate-800/80'
                        }`}
                      />
                      {formErrors.default_payout_rate && (
                        <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.default_payout_rate}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                        {language === 'ar' ? 'الراتب الثابت للمادة (د.ج)' : 'Fixed Course Salary (DA)'}
                      </label>
                      <input
                        type="number"
                        name="fixed_payout_amount"
                        value={formData.fixed_payout_amount}
                        onChange={handleInputChange}
                        placeholder={language === 'ar' ? 'مثال: 30000' : 'e.g. 30000'}
                        min="0"
                        className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors ${
                          formErrors.fixed_payout_amount ? 'border-rose-500/50' : 'border-slate-800/80'
                        }`}
                      />
                      {formErrors.fixed_payout_amount && (
                        <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.fixed_payout_amount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Includes Exam checkbox */}
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="has_exam"
                      name="has_exam"
                      checked={formData.has_exam || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, has_exam: e.target.checked }))}
                      className="h-4 w-4 bg-slate-955 border border-slate-800 rounded focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <label htmlFor="has_exam" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                      {t('customFeatures.hasExam')}
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('courses.createCourseBtn')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Add Schedule Modal */}
      {isAddScheduleModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setIsAddScheduleModalOpen(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            <form 
              onSubmit={handleScheduleSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-blue-500" />
                  {t('courses.modalScheduleAdd') || 'Assign Class Slot'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Course */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'المادة الدراسية' : 'Course Subject'}</label>
                    <select
                      name="CourseId"
                      value={scheduleForm.CourseId}
                      onChange={handleScheduleInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors ${
                        scheduleFormErrors.CourseId ? 'border-rose-500/50' : 'border-slate-850/80'
                      }`}
                    >
                      <option value="">{language === 'ar' ? '-- اختر المادة الدراسية --' : '-- Select Subject Course --'}</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id.toString()}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Day of Week */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.dayLabel')}</label>
                    <select
                      name="day_of_week"
                      value={scheduleForm.day_of_week}
                      onChange={handleScheduleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="Monday">{t('courses.monday')}</option>
                      <option value="Tuesday">{t('courses.tuesday')}</option>
                      <option value="Wednesday">{t('courses.wednesday')}</option>
                      <option value="Thursday">{t('courses.thursday')}</option>
                      <option value="Friday">{t('courses.friday')}</option>
                      <option value="Saturday">{t('courses.saturday')}</option>
                      <option value="Sunday">{t('courses.sunday')}</option>
                    </select>
                  </div>

                  {/* Time Slot */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      name="time_slot"
                      value={scheduleForm.time_slot}
                      onChange={handleScheduleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="08:00">08:00 - 10:00</option>
                      <option value="10:00">10:00 - 12:00</option>
                      <option value="14:00">14:00 - 16:00</option>
                      <option value="16:00">16:00 - 18:00</option>
                    </select>
                  </div>

                  {/* Classroom */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'القاعة الدراسية' : 'Classroom'}</label>
                    <select
                      name="room"
                      value={scheduleForm.room}
                      onChange={handleScheduleInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer ${
                        scheduleFormErrors.room ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    >
                      {classroomsList.map(r => (
                        <option key={r} value={r}>{language === 'ar' ? `القاعة ${r}` : `Classroom ${r}`}</option>
                      ))}
                    </select>
                    {scheduleFormErrors.room && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {scheduleFormErrors.room}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddScheduleModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('courses.addScheduleBtn')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Edit Schedule Modal */}
      {isEditScheduleModalOpen && selectedSchedule && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => {
              setIsEditScheduleModalOpen(false)
              setSelectedSchedule(null)
            }}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            <form 
              onSubmit={handleScheduleEditSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-blue-500" />
                  {language === 'ar' ? 'تعديل الحصة الدراسية' : 'Edit Class Slot'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditScheduleModalOpen(false)
                    setSelectedSchedule(null)
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Course */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'المادة الدراسية' : 'Course Subject'}</label>
                    <select
                      name="CourseId"
                      value={scheduleForm.CourseId}
                      onChange={handleScheduleInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors ${
                        scheduleFormErrors.CourseId ? 'border-rose-500/50' : 'border-slate-850/80'
                      }`}
                    >
                      <option value="">{language === 'ar' ? '-- اختر المادة الدراسية --' : '-- Select Subject Course --'}</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id.toString()}>{c.title}</option>
                      ))}
                    </select>
                    {scheduleFormErrors.CourseId && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {scheduleFormErrors.CourseId}
                      </span>
                    )}
                  </div>

                  {/* Day of Week */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('courses.dayLabel')}</label>
                    <select
                      name="day_of_week"
                      value={scheduleForm.day_of_week}
                      onChange={handleScheduleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="Monday">{t('courses.monday')}</option>
                      <option value="Tuesday">{t('courses.tuesday')}</option>
                      <option value="Wednesday">{t('courses.wednesday')}</option>
                      <option value="Thursday">{t('courses.thursday')}</option>
                      <option value="Friday">{t('courses.friday')}</option>
                      <option value="Saturday">{t('courses.saturday')}</option>
                      <option value="Sunday">{t('courses.sunday')}</option>
                    </select>
                  </div>

                  {/* Time Slot */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      name="time_slot"
                      value={scheduleForm.time_slot}
                      onChange={handleScheduleInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="08:00">08:00 - 10:00</option>
                      <option value="10:00">10:00 - 12:00</option>
                      <option value="14:00">14:00 - 16:00</option>
                      <option value="16:00">16:00 - 18:00</option>
                    </select>
                  </div>

                  {/* Classroom */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'القاعة الدراسية' : 'Classroom'}</label>
                    <select
                      name="room"
                      value={scheduleForm.room}
                      onChange={handleScheduleInputChange}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer ${
                        scheduleFormErrors.room ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    >
                      {classroomsList.map(r => (
                        <option key={r} value={r}>{language === 'ar' ? `القاعة ${r}` : `Classroom ${r}`}</option>
                      ))}
                    </select>
                    {scheduleFormErrors.room && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {scheduleFormErrors.room}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleScheduleDelete(selectedSchedule.id)}
                    className="px-4 py-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'حذف الحصة' : 'Delete Slot'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditScheduleModalOpen(false)
                      setSelectedSchedule(null)
                    }}
                    className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('common.save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

{/* ==================== TEACHER TIMETABLE PRINT PREVIEW ==================== */}
      {activePrintTeacherSchedule && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setActivePrintTeacherSchedule(null)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Instructor Schedule Preview</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Inspect A5 weekly timetable for this instructor.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTeacherSchedulePDF(activePrintTeacherSchedule, 'print')}
                  disabled={pdfLoading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTeacherSchedulePDF(activePrintTeacherSchedule, 'download')}
                  disabled={pdfLoading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  {t('common.downloadPdf')}
                </button>
                <button
                  onClick={() => setActivePrintTeacherSchedule(null)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Container for Preview */}
            <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[75vh]">
              {/* A5 Landscape sheet mockup */}
              <div className="bg-white text-slate-700 rounded-xl border border-slate-200 shadow-inner w-full max-w-4xl aspect-[1.414/1] mx-auto font-sans leading-normal text-[7.5px] select-text relative overflow-hidden flex p-5">
                <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header branding */}
                    <div className="flex justify-between items-start mb-1.5 shrink-0">
                      <div className="text-left">
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="School Logo" className="max-h-6 max-w-[120px] object-contain mb-0.5" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <svg className="w-4.5 h-4.5 fill-slate-900" viewBox="0 0 24 24">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <span className="font-black text-[9px] text-slate-900 leading-none uppercase">{schoolName}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[7px] text-slate-505 space-y-0.5">
                        {schoolAddress && <div>{schoolAddress}</div>}
                        {schoolPhone && <div>{language === 'ar' ? 'الهاتف:' : 'Phone:'} {schoolPhone}</div>}
                      </div>
                    </div>

                    <div className="border-b-2 border-slate-905 mb-2 shrink-0"></div>

                    <div className="flex justify-between items-center mb-2 shrink-0">
                      <div>
                        <h3 className="text-[10px] font-black text-slate-900 tracking-tight leading-none">{language === 'ar' ? 'جدول الحصص الأسبوعي للأستاذ' : 'INSTRUCTOR WEEKLY LECTURE TIMETABLE'}</h3>
                        <p className="text-[7px] text-slate-505 mt-0.5 uppercase font-mono">{language === 'ar' ? 'السنة الدراسية:' : 'Academic Term:'} {academicYear}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">{language === 'ar' ? 'تاريخ الاستخراج' : 'Date Exported'}</p>
                        <p className="text-[7px] font-mono font-semibold text-slate-700 mt-0.5">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>

                    {/* Profile details */}
                    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/50 mb-2 text-left text-[7.5px] shrink-0">
                      <span className="text-[6px] text-slate-400 uppercase font-bold tracking-wider block">{language === 'ar' ? 'ملف الأستاذ' : 'Instructor Profile'}</span>
                      <p className="text-[9px] font-black text-slate-900 mt-0.5 leading-none">{activePrintTeacherSchedule.full_name}</p>
                      <p className="text-[7.5px] text-slate-500 mt-0.5">{language === 'ar' ? 'مجال التخصص:' : 'Specialty Area:'} {activePrintTeacherSchedule.specialty || (language === 'ar' ? 'دراسات عامة' : 'General Studies')}</p>
                    </div>

                    {/* Timetable Grid table */}
                    {(() => {
                      const teacherSchedules = schedules.filter(s => s.Course?.TeacherId === activePrintTeacherSchedule.id);
                      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      let activeDays = daysOfWeek.filter(day => teacherSchedules.some(s => s.day_of_week === day));
                      if (activeDays.length === 0) {
                        activeDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                      }
                      const slots = ['08:00', '10:00', '12:00', '14:00', '16:00'];

                      return (
                        <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse border border-slate-200 rounded-lg overflow-hidden mb-1`}>
                          <thead>
                            <tr className="bg-slate-50 text-slate-800 text-[7px] font-bold uppercase tracking-wider text-center">
                              <th className="px-1 py-1 w-[15%] border border-slate-300">{language === 'ar' ? 'اليوم' : 'Day'}</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">08:00 - 10:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">10:00 - 12:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">12:00 - 14:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">14:00 - 16:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">16:00 - 18:00</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-[7px] text-slate-700">
                            {activeDays.map(day => (
                              <tr key={day}>
                                <td className="px-1 py-1 text-center font-bold text-slate-805 bg-slate-100/30 border border-slate-200" style={{ verticalAlign: 'middle' }}>
                                  <div>{t('courses.' + day.toLowerCase())}</div>
                                  <div className="text-[5.5px] font-normal text-slate-400 mt-0.5">({weekDatesMap[day]})</div>
                                </td>
                                {slots.map(slot => {
                                  if (slot === '12:00') {
                                    return (
                                      <td key={slot} className="px-0.5 py-1 text-center font-semibold text-slate-400 bg-slate-100/40 border border-slate-200 text-[6.5px]" style={{ verticalAlign: 'middle' }}>
                                        {t('courses.recessLabel')}
                                      </td>
                                    );
                                  }
                                  const slotSchedules = teacherSchedules.filter(
                                    s => s.day_of_week === day && s.time_slot === slot
                                  );
                                  return (
                                    <td key={slot} className="px-0.5 py-0.5 border border-slate-200 align-top bg-slate-50/10 min-h-[30px]">
                                      {slotSchedules.map(sched => {
                                        const courseObj = courses.find(c => c.id === sched.CourseId);
                                        const studentCount = courseObj && courseObj.Students ? courseObj.Students.length : 0;
                                        return (
                                          <div key={sched.id} className="p-1 rounded bg-slate-105 border border-slate-250 border-l-2 border-l-blue-650 mb-0.5 last:mb-0 text-left">
                                            <div className="font-bold text-[7.5px] text-slate-900 leading-tight">{sched.Course?.title || 'Unknown'}</div>
                                            <div className="text-[6.5px] text-slate-500 mt-0.5">{t('courses.roomLabel')}: {sched.room}</div>
                                            <div className="text-[6.5px] text-slate-450 font-medium mt-0.5">{t('courses.studsLabel', { count: studentCount })}</div>
                                          </div>
                                        );
                                      })}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ==================== GENERAL TIMETABLE PRINT PREVIEW ==================== */}
      {activePrintGeneralSchedule && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => setActivePrintGeneralSchedule(false)}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{t('courses.generalSchedulePreviewTitle')}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('courses.generalSchedulePreviewDesc')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadGeneralSchedulePDF('print')}
                  disabled={pdfLoading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadGeneralSchedulePDF('download')}
                  disabled={pdfLoading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  {t('common.downloadPdf')}
                </button>
                <button
                  onClick={() => setActivePrintGeneralSchedule(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Container for Preview */}
            <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[75vh]">
              {/* A5 Landscape sheet mockup */}
              <div className="bg-white text-slate-700 rounded-xl border border-slate-200 shadow-inner w-full max-w-4xl aspect-[1.414/1] mx-auto font-sans leading-normal text-[7.5px] select-text relative overflow-hidden flex p-5">
                <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header branding */}
                    <div className="flex justify-between items-start mb-1.5 shrink-0">
                      <div className="text-left">
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="School Logo" className="max-h-6 max-w-[120px] object-contain mb-0.5" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <svg className="w-4.5 h-4.5 fill-slate-900" viewBox="0 0 24 24">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <span className="font-black text-[9px] text-slate-900 leading-none uppercase">{schoolName}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[7px] text-slate-505 space-y-0.5">
                        {schoolAddress && <div>{schoolAddress}</div>}
                        {schoolPhone && <div>{language === 'ar' ? 'الهاتف:' : 'Phone:'} {schoolPhone}</div>}
                      </div>
                    </div>

                    <div className="border-b-2 border-slate-905 mb-2 shrink-0"></div>

                    <div className="flex justify-between items-center mb-2 shrink-0">
                      <div>
                        <h3 className="text-[10px] font-black text-slate-900 tracking-tight leading-none">{language === 'ar' ? 'جدول الحصص الأسبوعي العام' : 'GENERAL WEEKLY LECTURE TIMETABLE'}</h3>
                        <p className="text-[7px] text-slate-505 mt-0.5 uppercase font-mono">{language === 'ar' ? 'السنة الدراسية:' : 'Academic Term:'} {academicYear}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">{language === 'ar' ? 'تاريخ الاستخراج' : 'Date Exported'}</p>
                        <p className="text-[7px] font-mono font-semibold text-slate-700 mt-0.5">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>

                    {/* Profile details */}
                    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/50 mb-2 text-left text-[7.5px] shrink-0">
                      <span className="text-[6px] text-slate-400 uppercase font-bold tracking-wider block">{language === 'ar' ? 'ملف الجدول الزمني' : 'Timetable Profile'}</span>
                      <p className="text-[9px] font-black text-slate-900 mt-0.5 leading-none">{language === 'ar' ? 'جدول المواد العام' : 'General Course Timetable'}</p>
                      <p className="text-[7.5px] text-slate-500 mt-0.5">{language === 'ar' ? 'إجمالي حصص المحاضرات النشطة:' : 'Total Active Scheduled Slots:'} {filteredSchedules.length}</p>
                    </div>

                    {/* Timetable Grid table */}
                    {(() => {
                      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      let activeDays = daysOfWeek.filter(day => filteredSchedules.some(s => s.day_of_week === day));
                      if (activeDays.length === 0) {
                        activeDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                      }
                      const slots = ['08:00', '10:00', '12:00', '14:00', '16:00'];

                      return (
                        <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse border border-slate-200 rounded-lg overflow-hidden mb-1`}>
                          <thead>
                            <tr className="bg-slate-50 text-slate-800 text-[7px] font-bold uppercase tracking-wider text-center">
                              <th className="px-1 py-1 w-[15%] border border-slate-300">{language === 'ar' ? 'اليوم' : 'Day'}</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">08:00 - 10:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">10:00 - 12:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">12:00 - 14:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">14:00 - 16:00</th>
                              <th className="px-1 py-1 w-[17%] border border-slate-300">16:00 - 18:00</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-[7px] text-slate-700">
                            {activeDays.map(day => (
                              <tr key={day}>
                                <td className="px-1 py-1 text-center font-bold text-slate-805 bg-slate-100/30 border border-slate-200" style={{ verticalAlign: 'middle' }}>
                                  <div>{t('courses.' + day.toLowerCase())}</div>
                                  <div className="text-[5.5px] font-normal text-slate-400 mt-0.5">({weekDatesMap[day]})</div>
                                </td>
                                {slots.map(slot => {
                                  if (slot === '12:00') {
                                    return (
                                      <td key={slot} className="px-0.5 py-1 text-center font-semibold text-slate-400 bg-slate-100/40 border border-slate-200 text-[6.5px]" style={{ verticalAlign: 'middle' }}>
                                        {t('courses.recessLabel')}
                                      </td>
                                    );
                                  }
                                  const slotSchedules = filteredSchedules.filter(
                                    s => s.day_of_week === day && s.time_slot === slot
                                  );
                                  return (
                                    <td key={slot} className="px-0.5 py-0.5 border border-slate-200 align-top bg-slate-50/10 min-h-[30px]">
                                      {slotSchedules.map(sched => {
                                        const courseObj = courses.find(c => c.id === sched.CourseId);
                                        const studentCount = courseObj && courseObj.Students ? courseObj.Students.length : 0;
                                        return (
                                          <div key={sched.id} className="p-1 rounded bg-slate-100 border border-slate-250 border-l-2 border-l-blue-600 mb-0.5 last:mb-0 text-left">
                                            <div className="font-bold text-[7.5px] text-slate-900 leading-tight">{sched.Course?.title || 'Unknown'}</div>
                                            <div className="text-[6.5px] text-slate-550 mt-0.5">{t('courses.roomLabel')}: {sched.room}</div>
                                            <div className="text-[6.5px] text-slate-455 font-medium mt-0.5">{t('courses.studsLabel', { count: studentCount })}</div>
                                          </div>
                                        );
                                      })}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
