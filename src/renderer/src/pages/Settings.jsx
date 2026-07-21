import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { useSearchParams } from 'react-router-dom'
import { Shield, Monitor, Save, UserPlus, Trash2, User, Users, Lock, RefreshCw, Key, Database, Download, Upload, X, School, Phone, MapPin, Mail, Globe, Calendar, Sliders, FileText, Activity, CreditCard, BookOpen, GraduationCap, ShoppingCart, Search, Filter } from 'lucide-react'
import AdvancedTable from '../components/AdvancedTable'
import { ipcService } from '../services/ipcService'

export default function Settings({ currentUser, onUserUpdate }) {
  const { language, setLanguage, t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = searchParams.get('tab') || 'general'

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)
  const [auditSearchTerm, setAuditSearchTerm] = useState('')
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('All')

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true)
    try {
      const res = await ipcService.getAuditLogs({ limit: 500, offset: 0 })
      console.log("fetchAuditLogs IPC response:", res)
      const logsList = (res && Array.isArray(res)) ? res : ((res && res.logs) || [])
      setAuditLogs(logsList)
    } catch (err) {
      console.error("Failed to load audit logs:", err)
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'audit') {
      fetchAuditLogs()
    }
  }, [activeSection])

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
    if (!action) return '';
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

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = new Date() - d;
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (minutes < 1) return language === 'ar' ? 'الآن' : 'Just now';
    if (minutes < 60) return language === 'ar' ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    if (hours < 24) return language === 'ar' ? `منذ ${hours} ساعة` : `${hours}h ago`;
    return d.toLocaleDateString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  const [schoolName, setSchoolName] = useState('School Name')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolWebsite, setSchoolWebsite] = useState('')
  const [schoolBankDetails, setSchoolBankDetails] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [licenseVerificationServerUrl, setLicenseVerificationServerUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // SMTP Settings
  const [smtpEmail, setSmtpEmail] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState('465')
  const [smtpSenderName, setSmtpSenderName] = useState('')
  const [smtpTesting, setSmtpTesting] = useState(false)

  // Users management states
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('Receptionist')
  const [newUserAvatar, setNewUserAvatar] = useState('')
  const [userErrors, setUserErrors] = useState({})
  
  const [classroomsCountSetting, setClassroomsCountSetting] = useState('5')
  const [editingUser, setEditingUser] = useState(null)
  const [editingUserPermissions, setEditingUserPermissions] = useState({})
  const [defaultPermissionsTemplate, setDefaultPermissionsTemplate] = useState('dashboard,students,attendance')

  const permissionGroups = [
    {
      title: language === 'ar' ? 'الرئيسية' : 'Dashboard',
      items: [
        { key: 'dashboard', label: language === 'ar' ? 'عرض لوحة التحكم' : 'View Dashboard' }
      ]
    },
    {
      title: language === 'ar' ? 'إدارة الطلاب' : 'Student Management',
      items: [
        { key: 'students:view', label: language === 'ar' ? 'عرض الطلاب' : 'View Students' },
        { key: 'students:write', label: language === 'ar' ? 'تسجيل وتعديل الطلاب' : 'Register & Edit Students' },
        { key: 'students:delete', label: language === 'ar' ? 'حذف الطلاب نهائياً' : 'Delete Student Records' }
      ]
    },
    {
      title: language === 'ar' ? 'إدارة المدرسين' : 'Teacher Management',
      items: [
        { key: 'teachers:view', label: language === 'ar' ? 'عرض المدرسين' : 'View Teachers' },
        { key: 'teachers:write', label: language === 'ar' ? 'إضافة وتعديل المدرسين' : 'Add & Edit Teachers' },
        { key: 'teachers:delete', label: language === 'ar' ? 'حذف المدرسين نهائياً' : 'Delete Teacher Records' }
      ]
    },
    {
      title: language === 'ar' ? 'المواد والجدول الأسبوعي' : 'Courses & Scheduling',
      items: [
        { key: 'courses:view', label: language === 'ar' ? 'عرض المواد والجدول' : 'View Courses & Timetable' },
        { key: 'courses:write', label: language === 'ar' ? 'إضافة وتعديل الحصص والمواد' : 'Manage Courses & Schedules' },
        { key: 'courses:delete', label: language === 'ar' ? 'حذف المواد أو الحصص' : 'Delete Courses & Schedules' }
      ]
    },
    {
      title: language === 'ar' ? 'تسجيل الحضور والغياب' : 'Attendance Tracking',
      items: [
        { key: 'attendance:view', label: language === 'ar' ? 'عرض سجلات الحضور' : 'View Attendance' },
        { key: 'attendance:write', label: language === 'ar' ? 'تسجيل الحضور والغياب' : 'Record Attendance' }
      ]
    },
    {
      title: language === 'ar' ? 'الحسابات والمالية' : 'Financial Management',
      items: [
        { key: 'finances:view', label: language === 'ar' ? 'عرض التقارير والرسوم والمصاريف' : 'View Financial Reports' },
        { key: 'finances:payment', label: language === 'ar' ? 'استخلاص الواجبات الشهرية' : 'Collect Student Payments' },
        { key: 'finances:payout', label: language === 'ar' ? 'دفع مستحقات المدرسين' : 'Pay Instructor Salaries' },
        { key: 'finances:write', label: language === 'ar' ? 'إضافة وتعديل المصاريف' : 'Manage Expenses' },
        { key: 'finances:delete', label: language === 'ar' ? 'حذف المعاملات والمدفوعات' : 'Delete Transactions' }
      ]
    },
    {
      title: language === 'ar' ? 'إعدادات النظام والأمان' : 'System & Security Settings',
      items: [
        { key: 'settings:view', label: language === 'ar' ? 'عرض الإعدادات العامة' : 'View Settings' },
        { key: 'settings:write', label: language === 'ar' ? 'تعديل بيانات المدرسة' : 'Edit School Information' },
        { key: 'settings:users', label: language === 'ar' ? 'إدارة حسابات المستخدمين وصلاحياتهم' : 'Manage User Accounts & Perms' },
        { key: 'settings:audit', label: language === 'ar' ? 'سجل العمليات والنسخ الاحتياطي' : 'Access Audit Logs & Backups' }
      ]
    }
  ]

  const getPermissionsObj = (templateStr) => {
    const arr = templateStr.split(',').map(s => s.trim())
    const obj = {}
    
    permissionGroups.forEach(group => {
      group.items.forEach(item => {
        obj[item.key] = false
      })
    })

    arr.forEach(k => {
      if (k === 'dashboard') {
        obj['dashboard'] = true
      } else if (k === 'students') {
        obj['students:view'] = true
        obj['students:write'] = true
      } else if (k === 'teachers') {
        obj['teachers:view'] = true
        obj['teachers:write'] = true
      } else if (k === 'courses') {
        obj['courses:view'] = true
        obj['courses:write'] = true
      } else if (k === 'attendance') {
        obj['attendance:view'] = true
        obj['attendance:write'] = true
      } else if (k === 'finances') {
        obj['finances:view'] = true
        obj['finances:payment'] = true
      } else if (k === 'settings') {
        obj['settings:view'] = true
        obj['settings:write'] = true
      } else {
        obj[k] = true
      }
    })
    return obj
  }

  const [newUserPermissions, setNewUserPermissions] = useState({})

  useEffect(() => {
    setNewUserPermissions(getPermissionsObj(defaultPermissionsTemplate))
  }, [defaultPermissionsTemplate])

  // Profile / Password States
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '')
  const [oldPassword, setOldPassword] = useState('')
  const [changeNewPassword, setChangeNewPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [wiping, setWiping] = useState(false)
  
  // Wipe Confirmation Modal States
  const [showWipeConfirm, setShowWipeConfirm] = useState(false)
  const [wipeConfirmInput, setWipeConfirmInput] = useState('')
  const [wipeConfirmWord, setWipeConfirmWord] = useState('')

  useEffect(() => {
    if (currentUser?.avatar) {
      setProfileAvatar(currentUser.avatar)
    } else {
      setProfileAvatar('')
    }
  }, [currentUser])

  const handleProfileAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 1024 * 1024) {
        alert(language === 'ar' ? "حجم ملف الصورة يجب أن يكون أقل من 1 ميجابايت." : "Image file size must be less than 1MB.")
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileAvatar(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNewUserAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 1024 * 1024) {
        alert(language === 'ar' ? "حجم ملف الصورة يجب أن يكون أقل من 1 ميجابايت." : "Image file size must be less than 1MB.")
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewUserAvatar(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await ipcService.getSettings()
        if (settings.school_name) setSchoolName(settings.school_name)
        if (settings.academic_year) setAcademicYear(settings.academic_year)
        if (settings.school_address) setSchoolAddress(settings.school_address)
        if (settings.school_phone) setSchoolPhone(settings.school_phone)
        if (settings.school_email) setSchoolEmail(settings.school_email)
        if (settings.school_website) setSchoolWebsite(settings.school_website)
        if (settings.school_bank_details) setSchoolBankDetails(settings.school_bank_details)
        if (settings.school_logo) setSchoolLogo(settings.school_logo)
        if (settings.license_verification_server_url) setLicenseVerificationServerUrl(settings.license_verification_server_url)
        if (settings.default_receptionist_permissions) setDefaultPermissionsTemplate(settings.default_receptionist_permissions)
        if (settings.classrooms_count) setClassroomsCountSetting(settings.classrooms_count)
        
        // Load SMTP config
        if (settings.smtp_email) setSmtpEmail(settings.smtp_email)
        if (settings.smtp_password) setSmtpPassword(settings.smtp_password)
        if (settings.smtp_host) setSmtpHost(settings.smtp_host)
        if (settings.smtp_port) setSmtpPort(settings.smtp_port)
        if (settings.smtp_sender_name) setSmtpSenderName(settings.smtp_sender_name)
      } catch (err) {
        console.error("Failed to load settings:", err)
      }
    }

    fetchSettings()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const usersList = await ipcService.getUsers()
      setUsers(usersList)
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const [licenseDetails, setLicenseDetails] = useState(null)
  const [loadingLicense, setLoadingLicense] = useState(false)
  const [renewKey, setRenewKey] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [licenseError, setLicenseError] = useState('')

  const fetchLicenseInfo = async () => {
    setLoadingLicense(true)
    setLicenseError('')
    try {
      const res = await ipcService.checkLicense()
      if (res.valid) {
        setLicenseDetails(res.payload)
      } else {
        setLicenseError(res.error || 'No active license key.')
        setLicenseDetails(res.payload || null)
      }
    } catch (err) {
      console.error(err)
      setLicenseError('Failed to fetch license details.')
    } finally {
      setLoadingLicense(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'security') {
      fetchUsers()
    } else if (activeSection === 'license') {
      fetchLicenseInfo()
    }
  }, [activeSection])

  const handleRenewLicense = async (e) => {
    e.preventDefault()
    if (!renewKey.trim()) return
    setActivatingLicense(true)
    try {
      const res = await ipcService.activateLicense(renewKey.trim())
      if (res.success) {
        alert(language === 'ar' ? 'تم تنشيط الترخيص بنجاح!' : 'License plan activated successfully!')
        setRenewKey('')
        fetchLicenseInfo()
      } else {
        alert(res.error || 'Failed to activate license')
      }
    } catch (err) {
      console.error(err)
      alert('Internal error activating license')
    } finally {
      setActivatingLicense(false)
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 1024 * 1024) {
        alert(language === 'ar' ? "حجم ملف الصورة يجب أن يكون أقل من 1 ميجابايت." : "Image file size must be less than 1MB.")
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setSchoolLogo(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      if (window.api) {
        const res = await ipcService.saveSettings({
          school_name: schoolName,
          academic_year: academicYear,
          school_address: schoolAddress,
          school_phone: schoolPhone,
          school_email: schoolEmail,
          school_website: schoolWebsite,
          school_bank_details: schoolBankDetails,
          school_logo: schoolLogo,
          license_verification_server_url: licenseVerificationServerUrl,
          classrooms_count: classroomsCountSetting,
          smtp_email: smtpEmail,
          smtp_password: smtpPassword,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_sender_name: smtpSenderName
        })
        if (res && res.error) {
          alert(res.error)
        } else {
          alert(t('settings.successSettingsSaved') || "System configuration saved successfully!")
        }
      } else {
        alert(t('settings.successSettingsSaved') || "Settings saved successfully (Mock View)!")
      }
    } catch (err) {
      console.error("Failed to save settings:", err)
      alert(language === 'ar' ? "فشل في حفظ إعدادات النظام." : "Failed to save system settings.")
    } finally {
      setSaving(false)
    }
  }

  const handleTestSMTP = async () => {
    if (!smtpEmail || !smtpPassword || !smtpHost || !smtpPort) {
      alert(language === 'ar' ? 'الرجاء إدخال جميع معلومات السيرفر للتحقق.' : 'Please fill out all SMTP details to test connection.')
      return
    }
    setSmtpTesting(true)
    try {
      if (window.api && window.api.testSMTP) {
        const res = await ipcService.testSMTP({
          email: smtpEmail,
          password: smtpPassword,
          host: smtpHost,
          port: smtpPort
        })
        if (res && res.success) {
          alert(language === 'ar' ? 'تم الاتصال بخادم البريد بنجاح!' : 'SMTP connection tested successfully!')
        } else {
          alert(language === 'ar' ? `فشل الاتصال: ${res.error}` : `SMTP connection failed: ${res.error}`)
        }
      } else {
        alert(language === 'ar' ? 'اختبار الاتصال غير متاح في بيئة العرض.' : 'SMTP testing is not available in mock view.')
      }
    } catch (err) {
      console.error(err)
      alert(language === 'ar' ? 'حدث خطأ أثناء اختبار الاتصال.' : 'Error testing SMTP connection.')
    } finally {
      setSmtpTesting(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!newUsername.trim()) errors.username = t('settings.validationUsernameRequired')
    if (!newPassword.trim()) errors.password = t('settings.validationPasswordRequired')
    if (newPassword.length < 4) errors.password = t('settings.validationNewPassword')
    
    if (Object.keys(errors).length > 0) {
      setUserErrors(errors)
      return
    }
    setUserErrors({})
    setActionLoading(true)

    const permissionsList = newRole === 'Admin'
      ? 'dashboard,students,teachers,courses,attendance,finances,settings'
      : Object.keys(newUserPermissions).filter(k => newUserPermissions[k]).join(',')

    try {
      if (window.api) {
        const res = await ipcService.addUser({
          username: newUsername,
          password: newPassword,
          role: newRole,
          avatar: newUserAvatar || null,
          permissions: permissionsList
        })
        if (res && res.error) {
          alert(res.error)
        } else {
          setNewUsername('')
          setNewPassword('')
          setNewRole('Receptionist')
          setNewUserAvatar('')
          setNewUserPermissions({
            dashboard: true,
            students: true,
            teachers: true,
            courses: true,
            attendance: true,
            finances: true,
            settings: false
          })
          alert(t('settings.successUserCreated') || "User account registered successfully!")
          fetchUsers()
        }
      } else {
        alert("User mock created! (window.api offline)")
      }
    } catch (err) {
      console.error("Failed to create user:", err)
      alert(language === 'ar' ? "فشل في تسجيل حساب المستخدم." : "Failed to register user account.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async (id, name) => {
    let currentSessionUser = null
    try {
      const savedUser = sessionStorage.getItem('currentUser')
      if (savedUser) {
        currentSessionUser = JSON.parse(savedUser)
      }
    } catch (e) {
      console.error(e)
    }

    if (currentSessionUser && currentSessionUser.id === id) {
      alert(language === 'ar' ? "لا يمكنك حذف حساب المستخدم الخاص بك والمفتوح حالياً." : "You cannot delete your own currently active user account.")
      return
    }

    if (!(await window.confirm(language === 'ar' ? `هل أنت متأكد أنك تريد حذف حساب المستخدم "${name}" نهائياً؟` : `Are you sure you want to permanently delete user account "${name}"?`))) return;
    
    setActionLoading(true)
    try {
      if (window.api) {
        const res = await ipcService.deleteUser(id)
        if (res && res.error) {
          alert(res.error)
        } else {
          fetchUsers()
        }
      }
    } catch (err) {
      console.error("Failed to delete user:", err)
      alert(language === 'ar' ? "فشل في حذف حساب المستخدم." : "Failed to delete user account.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleTogglePermission = async (userObj, moduleKey) => {
    const currentPermsStr = userObj.permissions || ''
    let permsArr = currentPermsStr ? currentPermsStr.split(',').map(s => s.trim()) : []
    
    if (permsArr.includes(moduleKey)) {
      permsArr = permsArr.filter(p => p !== moduleKey)
    } else {
      permsArr.push(moduleKey)
    }
    const newPermsStr = permsArr.join(',')
    
    // Optimistic update of local users state
    setUsers(prevUsers => prevUsers.map(u => 
      u.id === userObj.id ? { ...u, permissions: newPermsStr } : u
    ))
    
    try {
      const res = await ipcService.updateUserPermissions(userObj.id, newPermsStr)
      if (res && res.error) {
        alert(res.error)
        // Revert local users state on error
        setUsers(prevUsers => prevUsers.map(u => 
          u.id === userObj.id ? { ...u, permissions: currentPermsStr } : u
        ))
      }
    } catch (err) {
      console.error(err)
      alert(language === 'ar' ? "فشل في تحديث الصلاحيات." : "Failed to update permissions.")
      // Revert local users state on error
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === userObj.id ? { ...u, permissions: currentPermsStr } : u
      ))
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    const errors = {}
    if (changeNewPassword.trim()) {
      if (!oldPassword.trim()) errors.oldPassword = t('settings.validationOldPassword')
      if (changeNewPassword.length < 4) errors.newPassword = t('settings.validationNewPassword')
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }
    setPasswordErrors({})
    setPasswordLoading(true)

    try {
      if (window.api) {
        // If password is being changed, update it first
        if (changeNewPassword.trim()) {
          const passRes = await ipcService.updatePassword(currentUser.username, oldPassword, changeNewPassword)
          if (passRes && passRes.error) {
            alert(passRes.error)
            setPasswordLoading(false)
            return
          }
        }

        // Update profile (avatar)
        const profileRes = await ipcService.updateUserProfile({
          id: currentUser.id,
          avatar: profileAvatar
        })

        if (profileRes && profileRes.error) {
          alert(profileRes.error)
        } else {
          setOldPassword('')
          setChangeNewPassword('')
          alert(language === 'ar' ? "تم تحديث الحساب الشخصي بنجاح!" : "Profile updated successfully!")
          if (onUserUpdate && profileRes.user) {
            onUserUpdate(profileRes.user)
          }
        }
      } else {
        alert("Profile updated! (window.api offline)")
      }
    } catch (err) {
      console.error("Failed to update profile:", err)
      alert(language === 'ar' ? "فشل في تحديث الحساب الشخصي." : "Failed to update profile.")
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleExportData = async () => {
    if (!window.api) {
      alert("window.api offline");
      return;
    }
    setExporting(true);
    try {
      const res = await ipcService.exportData();
      if (res && res.success) {
        alert(t('settings.exportSuccess') || "Database backup exported successfully!");
      } else if (res && res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!window.api) {
      alert("window.api offline");
      return;
    }
    
    const confirmImport = await window.confirm(
      t('settings.importConfirm') || 
      "WARNING: Importing a backup will completely overwrite all your current database records. This cannot be undone. Are you sure you want to proceed?"
    );
    if (!confirmImport) return;

    setImporting(true);
    try {
      const res = await ipcService.importData();
      if (res && res.success) {
        alert(t('settings.importSuccess') || "Data imported successfully! The application will restart now to apply the changes.");
        await ipcService.relaunchApp();
      } else if (res && res.error) {
        alert(t('settings.importError') || "Failed to import backup file. The file may be corrupt or invalid.");
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  const handleWipeDatabase = () => {
    const confirmWord = language === 'ar' ? 'مسح' : 'DELETE';
    setWipeConfirmWord(confirmWord);
    setWipeConfirmInput('');
    setShowWipeConfirm(true);
  };

  const handleConfirmWipe = async () => {
    if (wipeConfirmInput !== wipeConfirmWord) {
      alert(language === 'ar' ? 'تأكيد خاطئ. تم إلغاء العملية.' : 'Incorrect confirmation. Operation cancelled.');
      setShowWipeConfirm(false);
      setWipeConfirmInput('');
      return;
    }

    if (!window.api) {
      alert("window.api offline");
      return;
    }

    setWiping(true);
    try {
      const res = await ipcService.wipeDatabase();
      if (res && res.success) {
        alert(t('settings.wipeSuccess') || "Database has been wiped and reset successfully. The application will restart now.");
        await ipcService.relaunchApp();
      } else if (res && res.error) {
        alert(res.error);
      } else {
        alert(t('settings.wipeError') || "Failed to wipe database.");
      }
    } catch (err) {
      console.error("Wipe database error:", err);
      alert(t('settings.wipeError') || "Failed to wipe database.");
    } finally {
      setWiping(false);
      setShowWipeConfirm(false);
      setWipeConfirmInput('');
    }
  };

  const auditLogsColumns = React.useMemo(() => [
    {
      accessorKey: 'action',
      header: language === 'ar' ? 'نوع العملية' : 'Action Type',
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${getLogIconBg(log.action)}`}>
              {getLogIcon(log.action)}
            </div>
            <span className="font-bold text-slate-200 text-xs">
              {formatLogAction(log.action, language)}
            </span>
          </div>
        );
      },
      size: 190
    },
    {
      id: 'user',
      accessorFn: row => row.User?.full_name || row.User?.username || 'System Admin',
      header: language === 'ar' ? 'المستخدم' : 'Operator / User',
      cell: ({ row }) => {
        const log = row.original;
        const userName = log.User?.full_name || log.User?.username || (language === 'ar' ? 'مسؤول النظام' : 'System Admin');
        const userRole = log.User?.role || 'Admin';
        return (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-200 text-xs leading-none truncate">{userName}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{userRole}</p>
            </div>
          </div>
        );
      },
      size: 180
    },
    {
      accessorKey: 'description',
      header: language === 'ar' ? 'تفاصيل السجل' : 'Event Description',
      cell: ({ getValue }) => (
        <span className="text-slate-300 text-xs leading-relaxed max-w-md block truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
      size: 320
    },
    {
      accessorKey: 'createdAt',
      header: language === 'ar' ? 'التاريخ والوقت' : 'Timestamp',
      cell: ({ getValue }) => {
        const val = getValue();
        if (!val) return '-';
        const d = new Date(val);
        if (isNaN(d.getTime())) return '-';
        const formatted = d.toLocaleString(language === 'ar' ? 'ar-DZ-u-nu-latn' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        return (
          <div className="space-y-0.5">
            <span className="text-slate-400 font-mono text-[11px] block">{formatted}</span>
            <span className="text-[9px] text-slate-500 block font-semibold">{formatTimeAgo(val)}</span>
          </div>
        );
      },
      size: 180
    }
  ], [language]);

  const filteredAuditLogs = React.useMemo(() => {
    return auditLogs.filter(log => {
      if (auditSearchTerm.trim()) {
        const q = auditSearchTerm.toLowerCase();
        const actionText = formatLogAction(log.action, language).toLowerCase();
        const descText = (log.description || '').toLowerCase();
        const userText = (log.User?.full_name || log.User?.username || '').toLowerCase();
        if (!actionText.includes(q) && !descText.includes(q) && !userText.includes(q)) {
          return false;
        }
      }
      if (auditCategoryFilter !== 'All') {
        if (auditCategoryFilter === 'Payments' && !['RECORD_PAYMENT', 'DELETE_PAYMENT'].includes(log.action)) return false;
        if (auditCategoryFilter === 'Expenses' && !['RECORD_EXPENSE', 'DELETE_EXPENSE'].includes(log.action)) return false;
        if (auditCategoryFilter === 'Students' && !['ADD_STUDENT', 'UPDATE_STUDENT', 'DELETE_STUDENT', 'ENROLL_STUDENT'].includes(log.action)) return false;
        if (auditCategoryFilter === 'Teachers' && !['ADD_TEACHER', 'UPDATE_TEACHER', 'DELETE_TEACHER'].includes(log.action)) return false;
        if (auditCategoryFilter === 'Courses' && !['ADD_COURSE', 'UPDATE_COURSE', 'DELETE_COURSE'].includes(log.action)) return false;
        if (auditCategoryFilter === 'Absences' && !['RECORD_ABSENCE'].includes(log.action)) return false;
      }
      return true;
    });
  }, [auditLogs, auditSearchTerm, auditCategoryFilter, language]);

  return (
    <div className="w-full">
      <div className="space-y-6 animate-fade-in-up">
        {/* Modern SaaS Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/40 pb-5 text-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {t('settings.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1">{t('settings.subtitle')}</p>
          </div>
        </div>

        {/* Settings Layout: Top navigation bar, Panel Content below */}
        <div className="space-y-6">
          
          {/* Top Navigation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 bg-slate-955/25 p-2 rounded-2xl border border-slate-850/60 backdrop-blur-md w-full">
            {[
              { id: 'general', label: t('settings.tabGeneral'), icon: Monitor, color: 'text-blue-400' },
              { id: 'security', label: t('settings.tabSecurity'), icon: Shield, color: 'text-emerald-400' },
              { id: 'audit', label: language === 'ar' ? 'سجل العمليات' : 'System Logs', icon: FileText, color: 'text-cyan-400' },
              { id: 'email', label: language === 'ar' ? 'إعدادات البريد' : 'Email Setup', icon: Mail, color: 'text-sky-400' },
              { id: 'backup', label: t('settings.tabBackup'), icon: Database, color: 'text-purple-400' },
              { id: 'license', label: t('settings.tabLicense'), icon: Key, color: 'text-amber-400' },
              { id: 'shortcuts', label: language === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts', icon: Sliders, color: 'text-pink-400' }
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeSection === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setSearchParams({ tab: tab.id })}
                  className={`flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border w-full ${
                    isActive
                      ? 'bg-slate-900/60 border-slate-800/85 text-white shadow-lg shadow-slate-950/20 active-settings-tab'
                      : 'border-transparent text-slate-400 hover:text-slate-205 hover:bg-slate-900/30'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? tab.color : 'text-slate-550'}`} />
                  <span className="truncate">{tab.label}</span>
                  {isActive && <div className={`h-1.5 w-1.5 rounded-full bg-current ${tab.color} ml-1.5 shrink-0`} />}
                </button>
              )
            })}
          </div>

          {/* Bottom Panel Content */}
          <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md min-h-[520px] flex flex-col justify-between">
            
            {/* ==================== GENERAL PREFERENCES ==================== */}
            {activeSection === 'general' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  
                  {/* Column 1: School Identity & Contacts */}
                  <div className="space-y-6 flex flex-col justify-between">
                    {/* School Identity */}
                    <div className="bg-slate-900/35 border border-slate-850/60 rounded-2xl p-6 space-y-4 backdrop-blur-md flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                          <School className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{language === 'ar' ? 'هوية المؤسسة' : 'School Identity'}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'تعديل شعار واسم المؤسسة التعليمية' : 'Configure name and logo identity'}</p>
                        </div>
                      </div>

                      {/* Logo Upload */}
                      <div className="flex items-center gap-4 p-4 bg-slate-950/20 border border-slate-850/50 rounded-xl">
                        {schoolLogo ? (
                          <div className="relative h-14 w-14 rounded-xl border border-slate-800 overflow-hidden bg-white flex items-center justify-center p-1 group shrink-0">
                            <img src={schoolLogo} alt="School Logo" className="max-h-full max-w-full object-contain" />
                            <button
                              type="button"
                              onClick={() => setSchoolLogo('')}
                              className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-500 text-[9px] font-bold transition-opacity cursor-pointer"
                            >
                              {t('settings.removeLogo')}
                            </button>
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-500 bg-slate-950/40 text-[8px] font-bold uppercase tracking-wider shrink-0 text-center">
                            {t('settings.noLogo')}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <input
                            type="file"
                            accept="image/*"
                            id="logo-upload"
                            onChange={handleLogoChange}
                            className="hidden"
                          />
                          <label
                            htmlFor="logo-upload"
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700/60 rounded-xl text-[10px] text-slate-200 cursor-pointer transition-colors inline-block font-semibold"
                          >
                            {t('settings.uploadLogo')}
                          </label>
                          <p className="text-[9px] text-slate-550 mt-1 truncate">{t('settings.logoHint')}</p>
                        </div>
                      </div>

                      {/* School Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.schoolNameLabel')}</label>
                        <input
                          type="text"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Official Contact Details */}
                    <div className="bg-slate-900/35 border border-slate-850/60 rounded-2xl p-6 space-y-4 backdrop-blur-md flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{language === 'ar' ? 'معلومات الاتصال الرسمية' : 'Official Contacts'}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'العناوين وتفاصيل الاتصال الهاتفي للمراسلات' : 'Manage addresses, phone details, and inbox'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.schoolAddressLabel')}</label>
                          <div className="relative">
                            <MapPin className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="text"
                              value={schoolAddress}
                              onChange={(e) => setSchoolAddress(e.target.value)}
                              placeholder={t('settings.addressPlaceholder')}
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.schoolPhoneLabel')}</label>
                          <div className="relative">
                            <Phone className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="text"
                              value={schoolPhone}
                              onChange={(e) => setSchoolPhone(e.target.value)}
                              placeholder={t('settings.phonePlaceholder')}
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.schoolEmailLabel')}</label>
                          <div className="relative">
                            <Mail className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="email"
                              value={schoolEmail}
                              onChange={(e) => setSchoolEmail(e.target.value)}
                              placeholder={t('settings.emailPlaceholder')}
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: System & Finance Details */}
                  <div className="space-y-6 flex flex-col justify-between">
                    {/* Academic Settings */}
                    <div className="bg-slate-900/35 border border-slate-850/60 rounded-2xl p-6 space-y-4 backdrop-blur-md flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{language === 'ar' ? 'إعدادات النظام والأكاديمية' : 'Academic & Online Info'}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'العام الدراسي وتخصيص قاعات الحصص' : 'Configure current year sessions and licensing servers'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.academicYearLabel')}</label>
                          <input
                            type="text"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.schoolWebsiteLabel')}</label>
                          <div className="relative">
                            <Globe className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="text"
                              value={schoolWebsite}
                              onChange={(e) => setSchoolWebsite(e.target.value)}
                              placeholder="e.g. www.brightschool.com"
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{language === 'ar' ? 'خادم ترخيص النظام (سرية)' : 'License Verification Server'}</label>
                          <input
                            type="text"
                            value={licenseVerificationServerUrl}
                            onChange={(e) => setLicenseVerificationServerUrl(e.target.value)}
                            placeholder="https://license-server.example.com/verify"
                            className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-205 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5 border-t border-slate-900/60 pt-4 mt-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                            {language === 'ar' ? 'عدد القاعات الدراسية المتوفرة' : 'Number of Available Classrooms'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={classroomsCountSetting}
                            onChange={(e) => setClassroomsCountSetting(e.target.value)}
                            className="px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold font-mono"
                          />
                          <p className="text-[9px] text-slate-500 italic mt-0.5 leading-relaxed">
                            {language === 'ar' 
                              ? 'يحدد هذا العدد إجمالي الحجرات/القاعات الدراسية في جدول الحصص للمادة. سيقوم النظام بعرض أعمدة مساوية لهذا العدد في جدول التوزيع الأسبوعي للقاعات.' 
                              : 'Determines the total classrooms available for scheduling. The matrix timetable view will render exactly this number of classroom columns.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="bg-slate-900/35 border border-slate-850/60 rounded-2xl p-6 space-y-4 backdrop-blur-md flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                          <Sliders className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{t('settings.bankDetailsHeader') || 'Official Bank Details'}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'بيانات الحساب البنكي والتحصيل المالي' : 'Account routing or IBAN instructions'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.bankDetailsLabel') || 'Payment Instructions / Bank Account details'}</label>
                        <textarea
                          value={schoolBankDetails}
                          onChange={(e) => setSchoolBankDetails(e.target.value)}
                          rows={4}
                          placeholder={t('settings.bankDetailsPlaceholder')}
                          className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-205 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono resize-none leading-normal"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="pt-4 mt-6 border-t border-slate-800/55 flex justify-end">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 cursor-pointer border border-blue-500/10"
                  >
                    {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('settings.saveProfileBtn')}
                  </button>
                </div>
              </div>
            )}

            
            {/* ==================== SYSTEM LOGS (AUDIT TRAIL) PANEL ==================== */}
            {activeSection === 'audit' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {language === 'ar' ? 'سجل العمليات والنشاطات' : 'System Logs & Audit Trail'}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {language === 'ar' 
                          ? 'مراجعة جميع الأحداث والتغييرات الإدارية والمعاملات والأنشطة الأمنية المسجلة في النظام.'
                          : 'Review all system events, administrative changes, transactions, and security audit history.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAuditLogs()}
                      disabled={loadingAuditLogs}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                      {language === 'ar' ? 'تحديث' : 'Refresh'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const headers = ["ID", "Action", "Description", "User", "Role", "Date"];
                        const rows = filteredAuditLogs.map(l => [
                          l.id,
                          l.action,
                          `"${(l.description || '').replace(/"/g, '""')}"`,
                          `"${l.User?.full_name || l.User?.username || 'System'}"`,
                          l.User?.role || 'Admin',
                          new Date(l.createdAt).toLocaleString()
                        ]);
                        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `system_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-955/40 p-3 rounded-xl border border-slate-850">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'البحث في سجل العمليات (الوصف، المستخدم، العملية)...' : 'Search logs by description, user, action...'}
                      value={auditSearchTerm}
                      onChange={(e) => setAuditSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <select
                      value={auditCategoryFilter}
                      onChange={(e) => setAuditCategoryFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500/40 transition-colors cursor-pointer"
                    >
                      <option value="All">{language === 'ar' ? 'جميع التصنيفات' : 'All Categories'}</option>
                      <option value="Payments">{language === 'ar' ? 'المدفوعات والمالية' : 'Payments & Finances'}</option>
                      <option value="Expenses">{language === 'ar' ? 'المصاريف التشغيلية' : 'Expenses'}</option>
                      <option value="Students">{language === 'ar' ? 'إدارة الطلاب' : 'Students'}</option>
                      <option value="Teachers">{language === 'ar' ? 'إدارة المدرسين' : 'Teachers'}</option>
                      <option value="Courses">{language === 'ar' ? 'المواد والدورات' : 'Courses'}</option>
                      <option value="Absences">{language === 'ar' ? 'الحضور والغياب' : 'Absences'}</option>
                    </select>
                  </div>
                </div>

                {/* Audit Logs Table */}
                {loadingAuditLogs ? (
                  <div className="p-10 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                    {language === 'ar' ? 'جاري تحميل سجل العمليات...' : 'Loading audit logs...'}
                  </div>
                ) : filteredAuditLogs.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs space-y-2">
                    <FileText className="h-8 w-8 text-slate-650 mx-auto opacity-50" />
                    <p className="font-semibold text-slate-400">{language === 'ar' ? 'لا توجد سجلات مطابقة' : 'No matching audit records'}</p>
                    <p className="text-[10px] text-slate-500">{language === 'ar' ? 'لم يتم العثور على أي عمليات مطابقة لمعايير البحث.' : 'No system activity logs found matching your criteria.'}</p>

                  </div>
                ) : (
                  <div className="pt-2">
                    <AdvancedTable
                      data={filteredAuditLogs}
                      columns={auditLogsColumns}
                      enablePagination={true}
                      defaultPageSize={10}
                    />
                  </div>
                )}
              </div>
            )}


            {/* ==================== SECURITY & USER MANAGEMENT ==================== */}
            {activeSection === 'security' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  
                  {/* Card 1: Admin Password & Profile Change Form */}
                  <form onSubmit={handleUpdateProfile} className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl space-y-4 backdrop-blur-md flex flex-col justify-between h-full">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                          <Key className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{language === 'ar' ? 'تعديل الملف الشخصي وكلمة المرور' : 'Edit Profile & Credentials'}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'تعديل كلمة السر الخاصة بحسابك الحالي' : 'Configure current session logins'}</p>
                        </div>
                      </div>

                      {/* Profile Photo Upload */}
                      <div className="flex items-center gap-4 p-4 bg-slate-950/20 border border-slate-850/50 rounded-xl">
                        <div className="relative h-14 w-14 rounded-xl border border-slate-800 overflow-hidden bg-slate-955 flex items-center justify-center shrink-0 shadow-inner">
                          {profileAvatar ? (
                            <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{language === 'ar' ? 'الصورة الشخصية' : 'Profile Photo'}</label>
                          <div className="flex gap-2">
                            <label className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-755 border border-slate-700/50 text-slate-200 text-[10px] font-semibold rounded-xl cursor-pointer transition-colors">
                              {language === 'ar' ? 'تحميل صورة' : 'Upload Photo'}
                              <input type="file" accept="image/*" onChange={handleProfileAvatarChange} className="hidden" />
                            </label>
                            {profileAvatar && (
                              <button
                                type="button"
                                onClick={() => setProfileAvatar('')}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/15 text-[10px] font-semibold rounded-xl cursor-pointer transition-colors"
                              >
                                {language === 'ar' ? 'إزالة' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                            {t('settings.oldPasswordLabel')} <span className="text-[9px] text-slate-500 font-normal">({language === 'ar' ? 'مطلوب فقط لتغيير كلمة المرور' : 'only required to change password'})</span>
                          </label>
                          <div className="relative">
                            <Lock className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="password"
                              value={oldPassword}
                              onChange={(e) => {
                                setOldPassword(e.target.value)
                                if (passwordErrors.oldPassword) setPasswordErrors(prev => ({ ...prev, oldPassword: '' }))
                              }}
                              placeholder={t('settings.oldPasswordPlaceholder')}
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                          {passwordErrors.oldPassword && <span className="text-[9px] text-rose-450 font-semibold">{passwordErrors.oldPassword}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.newPasswordLabel')}</label>
                          <div className="relative">
                            <Lock className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="password"
                              value={changeNewPassword}
                              onChange={(e) => {
                                setChangeNewPassword(e.target.value)
                                if (passwordErrors.newPassword) setPasswordErrors(prev => ({ ...prev, newPassword: '' }))
                              }}
                              placeholder={t('settings.newPasswordPlaceholder')}
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                          {passwordErrors.newPassword && <span className="text-[9px] text-rose-450 font-semibold">{passwordErrors.newPassword}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-900/60 mt-4">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-blue-500/10"
                      >
                        {passwordLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {t('settings.updateCredentialsBtn')}
                      </button>
                    </div>
                  </form>
                  
                  {/* Card 2: User Registration Form */}
                  <form onSubmit={handleCreateUser} className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl space-y-4 backdrop-blur-md flex flex-col justify-between h-full">
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 mb-4">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                          <UserPlus className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-150">{t('settings.createUserHeader')}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{language === 'ar' ? 'إضافة حساب جديد وتعيين صلاحياته' : 'Register receptionist or admin'}</p>
                        </div>
                      </div>

                      {/* User Photo Upload */}
                      <div className="flex items-center gap-4 p-4 bg-slate-950/20 border border-slate-850/50 rounded-xl">
                        <div className="relative h-14 w-14 rounded-xl border border-slate-800 overflow-hidden bg-slate-955 flex items-center justify-center shrink-0 shadow-inner">
                          {newUserAvatar ? (
                            <img src={newUserAvatar} alt="New User" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{language === 'ar' ? 'الصورة الشخصية (اختياري)' : 'Profile Photo (Optional)'}</label>
                          <div className="flex gap-2">
                            <label className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-755 border border-slate-700/50 text-slate-200 text-[10px] font-semibold rounded-xl cursor-pointer transition-colors">
                              {language === 'ar' ? 'تحميل صورة' : 'Upload Photo'}
                              <input type="file" accept="image/*" onChange={handleNewUserAvatarChange} className="hidden" />
                            </label>
                            {newUserAvatar && (
                              <button
                                type="button"
                                onClick={() => setNewUserAvatar('')}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/15 text-[10px] font-semibold rounded-xl cursor-pointer transition-colors"
                              >
                                {language === 'ar' ? 'إزالة' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('common.username')}</label>
                          <div className="relative">
                            <User className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="text"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              placeholder="e.g. receptionist2"
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                          {userErrors.username && <span className="text-[9px] text-rose-450 font-semibold">{userErrors.username}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('common.password')}</label>
                          <div className="relative">
                            <Lock className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className={`w-full ${language === 'ar' ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold`}
                            />
                          </div>
                          {userErrors.password && <span className="text-[9px] text-rose-450 font-semibold">{userErrors.password}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">{t('settings.newUserRoleLabel')}</label>
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-205 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold cursor-pointer"
                          >
                            <option value="Receptionist">{t('settings.roleReceptionist')}</option>
                            <option value="Admin">{t('settings.roleAdmin')}</option>
                          </select>
                        </div>

                        {newRole === 'Receptionist' && (
                          <div className="flex flex-col gap-2 p-4 bg-slate-950/20 border border-slate-850/60 rounded-xl mt-3 animate-fade-in text-start">
                            <div className="flex items-center justify-between border-b border-slate-800/50 pb-2 mb-2">
                              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {language === 'ar' ? 'صلاحيات الوصول التفصيلية' : 'Granular Access Permissions'}
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allSet = {}
                                    permissionGroups.forEach(g => g.items.forEach(i => allSet[i.key] = true))
                                    setNewUserPermissions(allSet)
                                  }}
                                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer select-none bg-transparent border-0 p-0"
                                >
                                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                                </button>
                                <span className="text-slate-800 text-[10px] select-none">|</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cleared = {}
                                    permissionGroups.forEach(g => g.items.forEach(i => cleared[i.key] = false))
                                    setNewUserPermissions(cleared)
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors cursor-pointer select-none bg-transparent border-0 p-0"
                                >
                                  {language === 'ar' ? 'إلغاء' : 'Clear'}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 mt-1">
                              {permissionGroups.map(group => (
                                <div key={group.title} className="space-y-2">
                                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block border-b border-slate-800/25 pb-0.5">
                                    {group.title}
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {group.items.map(item => {
                                      const hasPerm = !!newUserPermissions[item.key]
                                      return (
                                        <button
                                          key={item.key}
                                          type="button"
                                          onClick={() => setNewUserPermissions(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                          className={`px-3 py-2 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center justify-between border cursor-pointer select-none ${
                                            hasPerm
                                              ? 'bg-blue-600/10 border-blue-500/35 text-blue-300 shadow-md shadow-blue-500/5'
                                              : 'bg-slate-950/40 border-slate-850/60 text-slate-500 hover:text-slate-400 hover:bg-slate-900/40'
                                          }`}
                                        >
                                          <span>{item.label}</span>
                                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition-all ${
                                            hasPerm ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-950'
                                          }`}>
                                            {hasPerm && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-900/60 mt-4">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-500/10"
                      >
                        {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {t('settings.createUserBtn')}
                      </button>
                    </div>
                  </form>
                </div>

                {/* User Directory */}
                <div className="space-y-3 pt-6 border-t border-slate-850/40">
                  <div className="flex items-center gap-2 px-1">
                    <Users className="h-4.5 w-4.5 text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-200">{t('settings.userAccountsHeader')}</h4>
                  </div>
                  
                  {loadingUsers ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      <span>{t('common.loading')}</span>
                    </div>
                  ) : (
                    <div className="border border-slate-850/60 rounded-2xl overflow-hidden bg-slate-950/15 backdrop-blur-md shadow-xl">
                      <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                        <thead>
                          <tr className="bg-slate-950/40 border-b border-slate-850/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                            <th className="px-6 py-3.5">{t('common.username')}</th>
                            <th className="px-6 py-3.5">{t('settings.roleCol')}</th>
                            <th className="px-6 py-3.5">{language === 'ar' ? 'صلاحيات الوصول' : 'Permissions'}</th>
                            <th className="px-6 py-3.5 text-center">{t('common.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40 text-xs text-slate-300">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-900/30 transition-colors">
                              <td className="px-6 py-3 font-semibold text-slate-200 flex items-center gap-3">
                                <div className="h-7 w-7 rounded-lg border border-slate-800 overflow-hidden bg-slate-955 flex items-center justify-center shrink-0">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="Avatar" className="h-full w-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-slate-600" />
                                  )}
                                </div>
                                {u.username}
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                  u.role === 'Admin' 
                                    ? 'bg-blue-550/15 border border-blue-500/20 text-blue-400' 
                                    : 'bg-indigo-550/15 border border-indigo-500/20 text-indigo-400'
                                }`}>
                                  {u.role === 'Admin' ? t('settings.roleAdminShort') : t('settings.roleReceptionistShort')}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                {u.role === 'Admin' ? (
                                  <span className="text-[10px] text-slate-500 font-semibold italic">
                                    {language === 'ar' ? 'كامل الصلاحيات (مسؤول)' : 'All Access (Admin)'}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingUser(u)
                                      setEditingUserPermissions(getPermissionsObj(u.permissions || ''))
                                    }}
                                    className="px-3.5 py-1.5 bg-slate-950/45 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl text-[10px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Key className="h-3 w-3 text-indigo-400" />
                                    {language === 'ar' ? 'تعديل الصلاحيات التفصيلية' : 'Manage Permissions'}
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  disabled={actionLoading}
                                  className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-455 rounded-lg transition-colors cursor-pointer inline-flex"
                                  title={t('settings.deleteAccountTooltip')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== BACKUP & RESTORE ==================== */}
            {activeSection === 'backup' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 text-start">
                    <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                      <Database className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {t('settings.backupSectionTitle') || 'Data Backup & Restore'}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {t('settings.backupSectionSubtitle') || 'Download localized snapshots or reset app settings'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                    {/* Export Section */}
                    <div className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl flex flex-col justify-between space-y-4 transition-all text-start">
                      <div className="space-y-2">
                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Download className="h-4.5 w-4.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">
                          {t('settings.exportTitle') || 'Export System Data'}
                        </h4>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {t('settings.exportDesc') || 'Download a complete backup of the database containing all students, teachers, courses, payments, and settings in a single JSON file.'}
                        </p>
                      </div>
                      
                      <div className="pt-2">
                        <button
                          onClick={handleExportData}
                          disabled={exporting || importing || wiping}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/10 border border-blue-500/10"
                        >
                          {exporting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {t('settings.exportBtn') || 'Export JSON Backup'}
                        </button>
                      </div>
                    </div>

                    {/* Import Section */}
                    <div className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl flex flex-col justify-between space-y-4 transition-all text-start">
                      <div className="space-y-2">
                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-455 flex items-center justify-center">
                          <Upload className="h-4.5 w-4.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">
                          {t('settings.importTitle') || 'Import System Data'}
                        </h4>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {t('settings.importDesc') || 'Restore system data from a previously saved JSON backup file. WARNING: This will overwrite all existing data in the application and cannot be undone!'}
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={handleImportData}
                          disabled={exporting || importing || wiping}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/10 border border-amber-500/10"
                        >
                          {importing ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {t('settings.importBtn') || 'Import JSON Backup'}
                        </button>
                      </div>
                    </div>

                    {/* Wipe/Reset Section */}
                    <div className="p-6 bg-slate-900/35 border border-red-500/15 hover:border-red-500/25 rounded-2xl flex flex-col justify-between space-y-4 transition-all text-start">
                      <div className="space-y-2">
                        <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                          <Trash2 className="h-4.5 w-4.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">
                          {t('settings.wipeTitle') || 'Reset System Data'}
                        </h4>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {t('settings.wipeDesc') || 'Permanently delete all records from the database (students, courses, payments, etc.) and reset settings to default. This action CANNOT be undone!'}
                        </p>
                      </div>
                      
                      <div className="pt-2">
                        <button
                          onClick={handleWipeDatabase}
                          disabled={exporting || importing || wiping}
                          className="w-full py-2.5 bg-red-650 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-red-500/10 border border-red-500/10"
                        >
                          {wiping ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          {t('settings.wipeBtn') || 'Wipe Database & Reset'}
                        </button>
                      </div>
                    </div>

                    {/* Auto-Updater Section */}
                    <div className="p-6 bg-slate-900/35 border border-blue-500/15 hover:border-blue-500/25 rounded-2xl flex flex-col justify-between space-y-4 transition-all text-start">
                      <div className="space-y-2">
                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center animate-pulse">
                          <RefreshCw className="h-4.5 w-4.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">
                          {language === 'ar' ? 'نظام التحديث التلقائي' : 'Auto-Updater System'}
                        </h4>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {language === 'ar' 
                            ? 'التحقق من وجود تحديثات جديدة للتطبيق وتنزيلها وتثبيتها تلقائياً.' 
                            : 'Check for new application updates, download, and install them automatically.'}
                        </p>
                      </div>
                      
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            if (window.electron && window.electron.ipcRenderer) {
                              window.electron.ipcRenderer.send('trigger-update-check')
                              alert(language === 'ar' ? 'تم إرسال طلب التحقق من التحديثات للسيرفر.' : 'Update check request sent to server.')
                            } else {
                              alert('window.electron is offline')
                            }
                          }}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-500/10 border border-blue-500/10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {language === 'ar' ? 'تحقق الآن' : 'Check Now'}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* ==================== EMAIL CONFIGURATION (SMTP) ==================== */}
            {activeSection === 'email' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 text-start">
                    <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-455 animate-pulse">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {language === 'ar' ? 'إعدادات خادم البريد الإلكتروني (SMTP)' : 'Email SMTP Server Configuration'}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {language === 'ar' ? 'قم بتهيئة الخادم الخاص بالمدرسة لإرسال الرسائل التنبيهية والتقارير لأولياء الأمور والمعلمين' : 'Configure the school official SMTP email to send alerts and notifications'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/35 border border-slate-850/60 rounded-2xl p-6 space-y-6 backdrop-blur-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* SMTP Host */}
                      <div className="flex flex-col gap-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          {language === 'ar' ? 'عنوان خادم SMTP' : 'SMTP Host'}
                        </label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="e.g. smtp.gmail.com"
                          className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold font-mono"
                        />
                      </div>

                      {/* SMTP Port */}
                      <div className="flex flex-col gap-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          {language === 'ar' ? 'منفذ SMTP (Port)' : 'SMTP Port'}
                        </label>
                        <input
                          type="text"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="e.g. 465 (SSL) or 587 (TLS)"
                          className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold font-mono"
                        />
                      </div>

                      {/* SMTP Email */}
                      <div className="flex flex-col gap-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          {language === 'ar' ? 'البريد الإلكتروني للمدرسة' : 'Sender Email Address'}
                        </label>
                        <input
                          type="email"
                          value={smtpEmail}
                          onChange={(e) => setSmtpEmail(e.target.value)}
                          placeholder="e.g. school.admin@gmail.com"
                          className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
                        />
                      </div>

                      {/* SMTP Sender Name */}
                      <div className="flex flex-col gap-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          {language === 'ar' ? 'اسم مرسل البريد (Display Name)' : 'Email Sender Name'}
                        </label>
                        <input
                          type="text"
                          value={smtpSenderName}
                          onChange={(e) => setSmtpSenderName(e.target.value)}
                          placeholder={language === 'ar' ? 'مثال: مدرسة النجاح الخاصة' : 'e.g. Hope Private Academy'}
                          className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
                        />
                      </div>

                      {/* SMTP Password */}
                      <div className="flex flex-col gap-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                          {language === 'ar' ? 'كلمة مرور التطبيق (App Password)' : 'App Password'}
                        </label>
                        <input
                          type="password"
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold font-mono"
                        />
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="p-4 bg-slate-950/30 border border-slate-850/50 rounded-xl space-y-3 text-[10px] text-slate-400 leading-relaxed text-start">
                      <div>
                        <p className="font-bold text-slate-350">
                          {language === 'ar' ? '💡 كيفية إعداد حساب Gmail:' : '💡 How to setup using Gmail:'}
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 mt-1">
                          <li>{language === 'ar' ? 'قم بتفعيل التحقق بخطوتين (2-Step Verification) في حساب Google الخاص بالمدرسة.' : 'Enable 2-Step Verification on your school Google account.'}</li>
                          <li>{language === 'ar' ? 'اذهب إلى إعدادات الأمان وابحث عن "كلمات مرور التطبيقات" (App Passwords).' : 'Go to Security settings and search for "App Passwords".'}</li>
                          <li>{language === 'ar' ? 'قم بتوليد كلمة مرور جديدة للتطبيقات واستخدمها في حقل كلمة المرور أعلاه بدلاً من كلمة المرور الأساسية للحساب.' : 'Generate a new App Password and paste it into the field above instead of your main password.'}</li>
                          <li>{language === 'ar' ? 'استخدم المنفذ 465 (مع SSL) أو 587 (مع TLS).' : 'Use Port 465 (SSL) or Port 587 (TLS).'}</li>
                        </ol>
                      </div>

                      <div className="pt-2.5 border-t border-slate-850/50">
                        <p className="font-bold text-amber-400">
                          {language === 'ar' ? '⚠️ لتفادي وصول الرسائل إلى مجلد الرسائل غير المرغوبة (Spam):' : '⚠️ To prevent emails from landing in SPAM:'}
                        </p>
                        <ul className="list-disc pl-4 space-y-1 mt-1 text-[9.5px]">
                          <li>{language === 'ar' ? 'تأكد من إعداد سجلات SPF و DKIM و DMARC في إعدادات النطاق (DNS) الخاص بالمدرسة.' : 'Ensure SPF, DKIM, and DMARC records are configured in your school domain DNS settings.'}</li>
                          <li>{language === 'ar' ? 'تجنب استخدام البريد الشخصي المجاني لإرسال كميات كبيرة من الرسائل.' : 'Avoid using free personal emails (@gmail.com) for sending bulk messages.'}</li>
                          <li>{language === 'ar' ? 'يُنصح باستخدام مزودي SMTP تجاريين مثل Resend أو SendGrid لضمان تسليم 100% للبريد الوارد.' : 'Consider commercial SMTP providers like Resend or SendGrid for guaranteed inbox delivery.'}</li>
                        </ul>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/55">
                      <button
                        onClick={handleTestSMTP}
                        disabled={smtpTesting || saving}
                        className="px-4 py-2 bg-slate-850 hover:bg-slate-755 disabled:opacity-50 border border-slate-750 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {smtpTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {language === 'ar' ? 'اختبار الاتصال' : 'Test SMTP Connection'}
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        disabled={smtpTesting || saving}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/10 cursor-pointer border border-blue-500/10"
                      >
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {t('settings.saveProfileBtn')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== LICENSE MANAGEMENT ==================== */}
            {activeSection === 'license' && (
              <div className="space-y-6 animate-fade-in text-start flex-1">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3 text-start">
                    <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-450">
                      <Key className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {t('settings.licenseTitle')}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {t('settings.licenseSubtitle')}
                      </p>
                    </div>
                  </div>

                  {loadingLicense ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      <span>{t('common.loading')}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 items-stretch">
                      {/* License Info Card */}
                      <div className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl space-y-4 backdrop-blur-md flex flex-col justify-between h-full">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                            <h4 className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">
                              {t('settings.licenseInfoHeader')}
                            </h4>
                            {/* Pulse Badge */}
                            <span className="flex h-2 w-2 relative">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${licenseError ? 'bg-rose-450' : 'bg-emerald-450'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${licenseError ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            </span>
                          </div>

                          {licenseDetails ? (
                            <div className="space-y-3 text-xs leading-normal">
                              <div className="flex justify-between border-b border-slate-850/40 pb-2">
                                <span className="text-slate-450 font-medium">{t('settings.licenseHolder')}</span>
                                <span className="font-bold text-slate-200">{licenseDetails.holder}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-850/40 pb-2">
                                <span className="text-slate-450 font-medium">{t('settings.licenseType')}</span>
                                <span className="font-extrabold text-blue-400 uppercase tracking-wider">
                                  {licenseDetails.type === 'forever' 
                                    ? t('settings.licenseForever')
                                    : licenseDetails.type === '1-year'
                                      ? t('settings.licenseYearly')
                                      : t('settings.licenseMonthly')}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-slate-850/40 pb-2">
                                <span className="text-slate-450 font-medium">{t('settings.licenseStart')}</span>
                                <span className="text-slate-350 font-semibold">{licenseDetails.createdAt}</span>
                              </div>
                              <div className="flex justify-between pb-1">
                                <span className="text-slate-450 font-medium">{t('settings.licenseExpires')}</span>
                                <span className={`font-bold ${licenseError ? 'text-rose-400' : 'text-slate-200'}`}>
                                  {licenseDetails.expiresAt || t('settings.licenseNeverExpires')}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-6 text-center text-rose-400 text-xs font-semibold">
                              {licenseError || t('settings.licenseNewKeyPlaceholder')}
                            </div>
                          )}

                          {licenseError && licenseDetails && (
                            <div className="p-3.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10 text-[10px] text-rose-400 leading-normal">
                              {licenseError}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* License Activation / Update form */}
                      <form onSubmit={handleRenewLicense} className="p-6 bg-slate-900/35 border border-slate-850/60 rounded-2xl space-y-4 backdrop-blur-md flex flex-col justify-between h-full">
                        <div className="space-y-4 flex-1">
                          <h4 className="text-[10px] text-slate-450 uppercase font-bold tracking-wider border-b border-slate-800/60 pb-2.5">
                            {t('settings.licenseRenewHeader')}
                          </h4>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                              {t('settings.licenseNewKeyLabel')}
                            </label>
                            <textarea
                              value={renewKey}
                              onChange={(e) => setRenewKey(e.target.value)}
                              placeholder={t('settings.licenseNewKeyPlaceholder')}
                              rows={4}
                              className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-205 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono resize-none leading-normal"
                              disabled={activatingLicense}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-900/60 mt-4">
                          <button
                            type="submit"
                            disabled={activatingLicense || !renewKey.trim()}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-blue-500/10 border border-blue-500/10"
                          >
                            {activatingLicense ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            {t('settings.licenseActivateBtn')}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== KEYBOARD SHORTCUTS PANEL ==================== */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-6 animate-fade-in text-start flex-1 select-none">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3">
                    <div className="p-1.5 bg-pink-500/10 border border-pink-500/20 rounded-lg text-pink-400">
                      <Sliders className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {language === 'ar' ? 'اختصارات لوحة المفاتيح المساعدة' : 'Helpful Keyboard Shortcuts'}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {language === 'ar' 
                          ? 'يمكنك استخدام هذه الاختصارات السريعة من أي مكان في النظام لتسريع العمليات اليومية في مكتب الاستقبال دون استخدام الفأرة.'
                          : 'You can use these quick global keyboard shortcuts from anywhere in the application to speed up daily operations without touching the mouse.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Section 1: Form Triggers */}
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-550 border-b border-slate-900/60 pb-1.5">
                        {language === 'ar' ? 'أدوات الإدخال والبحث السريع' : 'Quick Search & Forms'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'البحث السريع' : 'Quick Search Focus'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'التركيز فورًا على خانة البحث الحالية' : 'Instantly focus and highlight search box'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + F
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'تسجيل طالب جديد' : 'New Student Form'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'فتح نافذة إضافة طالب جديد' : 'Open the Add Student registration modal'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + N
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between col-span-1 md:col-span-2">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'استلام دفعة مالية جديدة' : 'Record Tuition Payment'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'فتح نافذة استلام الرسوم الدراسية من طالب' : 'Open the Record Tuition Payment receipt modal'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + P
                          </kbd>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Page Navigation & Systems */}
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-550 border-b border-slate-900/60 pb-1.5">
                        {language === 'ar' ? 'تصفح الصفحات وتغيير الإعدادات' : 'Page Navigation & System Toggles'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'لوحة التحكم الرئيسية' : 'Dashboard View'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى لوحة الإحصائيات' : 'Navigate to the main statistics panel'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + H
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'دليل الطلاب' : 'Students Directory'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى قسم إدارة الطلاب' : 'Navigate to the student management registry'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + S
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'إدارة المعلمين' : 'Teachers Directory'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى قسم شؤون المدرسين والرواتب' : 'Navigate to teacher database and payouts'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + T
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'المقررات الدراسية' : 'Courses Catalog'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى الفصول والمستويات الدراسية' : 'Navigate to class syllabus and pricing'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + C
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'سجل الحضور والغياب' : 'Daily Attendance'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى الحضور اليومي للمجموعات' : 'Navigate to student and teacher check-ins'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + A
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'الحسابات والميزانية' : 'Finances & Ledgers'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى المقبوضات والمصاريف اليومية' : 'Navigate to finances and expenses tracker'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + B
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'إعدادات النظام' : 'System Settings'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'الذهاب إلى تبويب الإعدادات العامة' : 'Navigate to the admin system settings'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + G
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/35 border border-slate-850/60 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'تغيير لغة العرض' : 'Toggle Language'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'التبديل بين العربية والإنجليزية فورًا' : 'Instantly swap between Arabic and English'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + L
                          </kbd>
                        </div>

                        <div className="p-3.5 bg-slate-955/30 border border-slate-850/60 rounded-2xl flex items-center justify-between col-span-1 md:col-span-2">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-250">
                              {language === 'ar' ? 'تغيير مظهر التطبيق' : 'Toggle Visual Theme'}
                            </h5>
                            <p className="text-[9.5px] text-slate-500 leading-normal">
                              {language === 'ar' ? 'التبديل بين الوضع المظلم والمضيء' : 'Instantly swap between Dark and Light mode'}
                            </p>
                          </div>
                          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono font-bold text-slate-100 shadow">
                            Ctrl + D
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
          
        </div>
      </div>
      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <>
          {/* Backdrop overlay with blur */}
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" 
            onClick={() => {
              setShowWipeConfirm(false);
              setWipeConfirmInput('');
            }}
          />
          {/* Centered Modal Card */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-zoom-in text-start">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Trash2 className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                {t('settings.wipeConfirmTitle')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowWipeConfirm(false);
                  setWipeConfirmInput('');
                }}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('settings.wipeConfirmPrompt').replace('{confirmWord}', wipeConfirmWord)}
              </p>
              
              <input
                type="text"
                value={wipeConfirmInput}
                onChange={(e) => setWipeConfirmInput(e.target.value)}
                placeholder={wipeConfirmWord}
                className="w-full px-3.5 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-250 placeholder-slate-650 focus:outline-none focus:border-red-500/50 font-mono"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-800/80 mt-2">
              <button
                onClick={() => {
                  setShowWipeConfirm(false);
                  setWipeConfirmInput('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {t('settings.wipeConfirmCancel')}
              </button>
              <button
                onClick={handleConfirmWipe}
                disabled={wiping || wipeConfirmInput !== wipeConfirmWord}
                className="px-4 py-2 bg-red-650 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {wiping ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {t('settings.wipeConfirmSubmit')}
              </button>
            </div>
          </div>
        </>
      )}
      {/* Granular Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-start">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-955/50 border-b border-slate-800/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="h-4.5 w-4.5 text-indigo-400" />
                  {language === 'ar' 
                    ? `إدارة صلاحيات المستخدم: ${editingUser.username}` 
                    : `Manage User Permissions: ${editingUser.username}`}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {language === 'ar' 
                    ? 'حدد الصلاحيات التفصيلية التي يمكن لهذا الحساب القيام بها عبر أقسام النظام.' 
                    : 'Configure granular control levels and module accesses for this account.'}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-slate-850 text-slate-550 hover:text-slate-350 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable List */}
            <div className="p-6 overflow-y-auto space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.title} className="space-y-2.5">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    {group.title}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const isChecked = !!editingUserPermissions[item.key]
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            setEditingUserPermissions(prev => ({
                              ...prev,
                              [item.key]: !prev[item.key]
                            }))
                          }}
                          className={`px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                            isChecked
                              ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-200'
                              : 'bg-slate-955/20 border-slate-850/60 text-slate-400 hover:bg-slate-955/20 hover:text-slate-300'
                          }`}
                        >
                          <span className={`text-xs font-semibold ${isChecked ? 'permission-checked-text' : ''}`}>{item.label}</span>
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-700 bg-slate-955'
                          }`}>
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-955/50 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const cleared = {}
                    permissionGroups.forEach(g => g.items.forEach(i => cleared[i.key] = false))
                    setEditingUserPermissions(cleared)
                  }}
                  className="px-3 py-1.5 bg-slate-950/50 hover:bg-slate-900 border border-slate-850 text-slate-450 hover:text-slate-350 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'إلغاء تحديد الكل' : 'Clear All'}
                </button>
                <button
                  onClick={() => {
                    const allSet = {}
                    permissionGroups.forEach(g => g.items.forEach(i => allSet[i.key] = true))
                    setEditingUserPermissions(allSet)
                  }}
                  className="px-3 py-1.5 bg-slate-950/50 hover:bg-slate-900 border border-slate-850 text-slate-450 hover:text-slate-350 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={async () => {
                    const selectedPerms = Object.keys(editingUserPermissions).filter(k => editingUserPermissions[k]).join(',')
                    setActionLoading(true)
                    try {
                      const res = await ipcService.updateUserPermissions(editingUser.id, selectedPerms)
                      if (res && res.error) {
                        alert(res.error)
                      } else {
                        setEditingUser(null)
                        fetchUsers()
                      }
                    } catch (err) {
                      console.error(err)
                      alert(language === 'ar' ? "فشل حفظ الصلاحيات." : "Failed to save permissions.")
                    } finally {
                      setActionLoading(false)
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-md shadow-indigo-500/10"
                >
                  {language === 'ar' ? 'حفظ الصلاحيات' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
