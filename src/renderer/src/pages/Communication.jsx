import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import { getCoursePaymentsBalance } from '../utils/billing'
import { 
  Mail, Send, FileText, Plus, Trash2, Edit2, AlertCircle, CheckCircle, 
  RefreshCw, Paperclip, X, Copy, Info, Users, School, Save, Eye, Search, DollarSign 
} from 'lucide-react'

export default function Communication() {
  const { language, t } = useLanguage()
  const isAr = language === 'ar'
  const textAlign = isAr ? 'text-right' : 'text-left font-sans'

  // Refs
  const bodyTextareaRef = useRef(null)

  // Loading States
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [templateActionLoading, setTemplateActionLoading] = useState(false)
  
  // Data Lists
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([])
  const [templates, setTemplates] = useState([])

  // Active Tab
  const [activeTab, setActiveTab] = useState('composer') // 'composer' or 'directory'

  // Form Fields
  const [recipientGroup, setRecipientGroup] = useState('teachers') // 'teachers', 'students', 'parents', 'course'
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState(null) // { filename, path }

  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false)
  const recipientDropdownRef = useRef(null)

  // Directory Search
  const [directorySearch, setDirectorySearch] = useState('')

  // Template Manager States
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  // Status Reports
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (recipientDropdownRef.current && !recipientDropdownRef.current.contains(event.target)) {
        setShowRecipientDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [recipientDropdownRef]);

  const loadData = async () => {
    setLoading(true)
    try {
      const [stdList, tchList, crsList, tmplList] = await Promise.all([
        ipcService.getStudents(),
        ipcService.getTeachers(),
        ipcService.getCourses(),
        ipcService.getTemplates()
      ])
      setStudents(stdList || [])
      setTeachers(tchList || [])
      setCourses(crsList || [])
      setTemplates(tmplList || [])
    } catch (err) {
      console.error('Failed to load Communication page data:', err)
    } finally {
      setLoading(false)
    }
  }

  // File Picker
  const handleSelectAttachment = async () => {
    try {
      const file = await ipcService.selectAttachmentFile()
      if (file) {
        setAttachment(file)
      }
    } catch (err) {
      console.error('Failed to select file:', err)
    }
  }

  // Click handler to insert tags at textarea cursor position
  const handleInsertTag = (tag) => {
    if (!bodyTextareaRef.current) return
    const textarea = bodyTextareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    
    setBody(before + tag + after)
    
    // Refocus and place cursor right after the inserted tag
    textarea.focus()
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length
    }, 0)
  }

  // Save new template modal trigger
  const triggerSaveTemplateAsNew = () => {
    if (!subject.trim() || !body.trim()) {
      alert(isAr ? 'الرجاء ملء موضوع الرسالة ونصها لحفظ القالب.' : 'Please enter a subject and body first.')
      return
    }
    setNewTemplateName(selectedTemplateId ? `${selectedTemplateName} (${isAr ? 'نسخة' : 'Copy'})` : '')
    setShowSaveModal(true)
  }

  // Save template operation (either new or existing update)
  const handleSaveTemplate = async (isNew = false) => {
    const nameToSave = isNew ? newTemplateName : selectedTemplateName
    if (!nameToSave.trim()) {
      alert(isAr ? 'الرجاء إدخال اسم للقالب.' : 'Please enter template name.')
      return
    }

    setTemplateActionLoading(true)
    try {
      const res = await ipcService.saveTemplate({
        id: isNew ? null : (selectedTemplateId || null),
        name: nameToSave,
        subject,
        body
      })
      if (res && res.success) {
        alert(isAr ? 'تم حفظ القالب بنجاح!' : 'Template saved successfully!')
        setShowSaveModal(false)
        setNewTemplateName('')
        
        if (isNew || !selectedTemplateId) {
          // If we created a new one, select it as active
          setSelectedTemplateId(res.template.id)
          setSelectedTemplateName(res.template.name)
        }

        // Refresh templates list
        const tmplList = await ipcService.getTemplates()
        setTemplates(tmplList || [])
      } else {
        alert(res.error || 'Failed to save template')
      }
    } catch (err) {
      console.error(err)
      alert(isAr ? 'خطأ أثناء حفظ القالب.' : 'Error saving template.')
    } finally {
      setTemplateActionLoading(false)
    }
  }

  // Delete Template
  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation()
    if (!(await confirm(isAr ? 'هل أنت متأكد من حذف هذا القالب؟' : 'Are you sure you want to delete this template?'))) return
    try {
      const res = await ipcService.deleteTemplate(id)
      if (res && res.success) {
        const tmplList = await ipcService.getTemplates()
        setTemplates(tmplList || [])
        if (selectedTemplateId === id) {
          handleUnloadTemplate()
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Load selected template into composer
  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplateId(tmpl.id)
    setSelectedTemplateName(tmpl.name)
    setSubject(tmpl.subject)
    setBody(tmpl.body)
    setActiveTab('composer')
  }

  // Reset composer template state
  const handleUnloadTemplate = () => {
    setSelectedTemplateId('')
    setSelectedTemplateName('')
    setSubject('')
    setBody('')
  }

  // Quick Action: Compose Unpaid Fees Reminder
  const handleComposeUnpaidFeesReminder = () => {
    const unpaidStudents = students.filter(s => {
      const info = getCoursePaymentsBalance(s, null)
      return info.balance > 0
    })

    if (unpaidStudents.length === 0) {
      alert(isAr ? 'لا يوجد طلاب لديهم رسوم معلقة حالياً في النظام.' : 'No students with outstanding unpaid balances found.')
      return
    }

    setRecipientGroup('parents')
    // Get all valid parent emails for unpaid students
    const unpaidEmails = unpaidStudents
      .map(s => s.parent_email)
      .filter(email => email && email.trim() !== '')

    setSelectedRecipients(unpaidEmails)
    setSubject(isAr ? 'تذكير هام: سداد الرسوم الدراسية المعلقة' : 'Important: Outstanding Fee Payment Reminder')
    setBody(isAr 
      ? 'عزيزي ولي الأمر،\n\nنود تذكيركم بلطف بأن هناك رسوماً دراسية معلقة ومستحقة الدفع لنجلكم/ابنتكم. يرجى التكرم بزيارة الإدارة لتسوية الحساب في أقرب وقت.\n\nنشكر تعاونكم وتفهمكم،\nإدارة المدرسة.'
      : 'Dear Parent,\n\nThis is a friendly reminder that there is an outstanding fee balance for your child. Please visit the school administration office to settle the payment at your earliest convenience.\n\nThank you for your cooperation and support,\nSchool Administration.'
    )
    
    alert(isAr 
      ? `تم التجهيز! تم تحديد ${unpaidEmails.length} ولي أمر لطلاب لديهم مستحقات مالية.`
      : `Ready! Drafted message for ${unpaidEmails.length} parents with outstanding balances.`
    )
  }

  // Quick Action: Compose Welcome Message
  const handleComposeWelcomeMessage = () => {
    if (students.length === 0) {
      alert(isAr ? 'لا يوجد طلاب مسجلين في النظام حالياً.' : 'No registered students found.')
      return
    }

    setRecipientGroup('students')
    setSelectedRecipients(students.map(s => s.email).filter(email => email && email.trim() !== ''))
    setSubject(isAr ? 'مرحباً بكم في مدرستنا!' : 'Welcome to our School!')
    setBody(isAr
      ? 'أعزاءنا الطلاب وأولياء الأمور،\n\nيسعدنا جداً أن نرحب بكم في العام الدراسي الجديد! نتمنى لكم رحلة تعليمية مليئة بالنجاح والتميز.\n\nإذا كان لديكم أي استفسار، فلا تترددوا في التواصل معنا.\n\nمع أطيب التمنيات،\nإدارة المدرسة.'
      : 'Dear Students and Parents,\n\nWe are absolutely thrilled to welcome you to our school! We wish you an educational journey filled with success and excellence.\n\nIf you have any questions or need assistance, please feel free to reach out to us.\n\nBest regards,\nSchool Administration.'
    )
    
    alert(isAr 
      ? 'تم تجهيز الرسالة الترحيبية وتحديد جميع الطلاب المستلمين!'
      : 'Welcome message drafted and all students selected!'
    )
  }

  // Get active recipient list based on group selection (all potential recipients)
  const getRecipientsRaw = () => {
    let list = []
    if (recipientGroup === 'teachers') {
      list = teachers.map(t => ({
        email: t.email,
        name: t.full_name,
        type: 'Teacher',
        placeholders: {
          teacher_name: t.full_name,
          specialty: t.specialty || 'General',
          email: t.email || ''
        }
      }))
    } else if (recipientGroup === 'students') {
      list = students.map(s => ({
        email: s.email,
        name: s.full_name,
        type: 'Student',
        placeholders: {
          student_name: s.full_name,
          grade_level: s.grade_level || 'Primary',
          phone: s.phone || ''
        }
      }))
    } else if (recipientGroup === 'parents') {
      list = students.map(s => ({
        email: s.parent_email,
        name: `${s.full_name} (${isAr ? 'ولي أمر' : 'Parent'})`,
        type: 'Parent',
        placeholders: {
          student_name: s.full_name,
          parent_name: s.full_name + ' Parent',
          parent_phone: s.parent_phone || ''
        }
      }))
    } else if (recipientGroup === 'course' && selectedCourseId) {
      const selectedCourse = courses.find(c => String(c.id) === String(selectedCourseId))
      if (selectedCourse && selectedCourse.Students) {
        list = selectedCourse.Students.map(s => ({
          email: s.email,
          name: s.full_name,
          type: 'Student',
          placeholders: {
            student_name: s.full_name,
            course_title: selectedCourse.title,
            grade_level: s.grade_level || 'Primary'
          }
        }))
      }
    }
    // Filter out entries with invalid/empty emails
    return list.filter(r => r.email && r.email.trim() !== '')
  }

  const getRecipients = () => {
    const raw = getRecipientsRaw()
    return raw.filter(r => selectedRecipients.includes(r.email))
  }

  const getPreviewText = (rawText) => {
    if (!rawText) return ''
    const recipientsList = getRecipients()
    if (recipientsList.length === 0) return rawText
    
    const firstRecipient = recipientsList[0]
    const placeholders = firstRecipient.placeholders || {}
    
    let preview = rawText
    // Replace all placeholders dynamically
    Object.keys(placeholders).forEach(key => {
      const placeholderVal = placeholders[key] || ''
      preview = preview.replaceAll(`{${key}}`, placeholderVal)
    })
    return preview
  }

  useEffect(() => {
    const raw = getRecipientsRaw()
    setSelectedRecipients(raw.map(r => r.email))
    setRecipientSearch('')
  }, [recipientGroup, selectedCourseId, students, teachers, courses])

  // Bulk Email Submission
  const handleSendEmails = async (e) => {
    e.preventDefault()
    const recipients = getRecipients()
    
    if (recipients.length === 0) {
      alert(isAr ? 'لا يوجد مستلمون صالحون (يرجى التأكد من ملء بريدهم الإلكتروني في قاعدة البيانات).' : 'No valid recipients found (ensure their emails are set).')
      return
    }

    if (!subject.trim() || !body.trim()) {
      alert(isAr ? 'الموضوع والرسالة مطلوبان.' : 'Subject and Body are required.')
      return
    }

    if (!(await confirm(isAr ? `هل أنت متأكد من رغبتك في إرسال البريد الإلكتروني إلى ${recipients.length} مستلم؟` : `Are you sure you want to send emails to ${recipients.length} recipients?`))) {
      return
    }

    setSending(true)
    setSendResult(null)

    try {
      const res = await ipcService.sendBulkEmails({
        recipients,
        subject,
        body,
        attachments: attachment ? [attachment] : []
      })
      setSendResult(res)
      if (res && res.success) {
        alert(isAr ? `تمت عملية الإرسال بنجاح! تم إرسال ${res.successCount} من أصل ${res.total} رسالة.` : `Sending complete! Sent ${res.successCount} of ${res.total} emails successfully.`)
        setAttachment(null)
      } else {
        alert(res.error || 'Failed bulk email execution')
      }
    } catch (err) {
      console.error(err)
      alert(isAr ? 'حدث خطأ أثناء عملية الإرسال.' : 'Error sending bulk emails.')
    } finally {
      setSending(false)
    }
  }

  const placeholdersList = [
    { key: '{student_name}', desc: isAr ? 'اسم الطالب الفعلي' : 'Actual student name' },
    { key: '{parent_name}', desc: isAr ? 'اسم ولي الأمر' : 'Parent name' },
    { key: '{teacher_name}', desc: isAr ? 'اسم المعلم الفعلي' : 'Actual teacher name' },
    { key: '{course_title}', desc: isAr ? 'عنوان المادة الدراسية' : 'Course title' },
    { key: '{grade_level}', desc: isAr ? 'المستوى الدراسي للطالب' : "Student's grade level" }
  ]

  // Filter lists for Directory Tab
  const getFilteredDirectoryList = () => {
    let rawList = []
    students.forEach(s => {
      rawList.push({ id: `s-${s.id}`, name: s.full_name, role: isAr ? 'طالب' : 'Student', email: s.email });
      if (s.parent_email) {
        rawList.push({ id: `p-${s.id}`, name: `${s.full_name} (${isAr ? 'ولي أمر' : 'Parent'})`, role: isAr ? 'ولي أمر' : 'Parent', email: s.parent_email });
      }
    });
    teachers.forEach(t => {
      rawList.push({ id: `t-${t.id}`, name: t.full_name, role: isAr ? 'أستاذ' : 'Teacher', email: t.email });
    });

    if (!directorySearch.trim()) return rawList;
    const term = directorySearch.toLowerCase()
    return rawList.filter(item => 
      item.name.toLowerCase().includes(term) || 
      (item.email && item.email.toLowerCase().includes(term))
    )
  }

  const directoryList = getFilteredDirectoryList()

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* SaaS Header */}
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/40 pb-5 ${textAlign}`}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {isAr ? 'مركز الاتصالات والبريد' : 'Communication & Mail Hub'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'إرسال رسائل بريدية جماعية وفردية ذكية لأولياء الأمور والطلاب والمدرسين بنقرة واحدة.' : 'Send personalized bulk and single emails to Parents, Students, and Teachers instantly.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900/60 p-1 border border-slate-800/50 rounded-xl self-start md:self-auto select-none">
          <button
            onClick={() => setActiveTab('composer')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'composer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isAr ? 'إنشاء رسالة' : 'Compose Email'}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'templates' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isAr ? 'قوالب الرسائل' : 'Saved Templates'}
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'directory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isAr ? 'دليل الاتصالات' : 'Contacts Directory'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
          <RefreshCw className="h-7 w-7 text-blue-400 animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">{isAr ? 'جاري تحميل البيانات والتأكد من إعدادات البريد...' : 'Loading data and preparing services...'}</span>
        </div>
      ) : activeTab === 'composer' ? (
        <div className="max-w-6xl mx-auto w-full bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md space-y-6 flex flex-col justify-between">
          <form onSubmit={handleSendEmails} className="space-y-4 text-start flex-1">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-blue-400" />
                {isAr ? 'إنشاء رسالة بريدية جديدة' : 'Compose New Email Message'}
              </h3>
            </div>

            {/* Two-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column - Mail Editor (takes 2 cols on wide screens) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Active Template Status Banner */}
                {selectedTemplateId && (
                  <div className="flex items-center justify-between p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl animate-fade-in text-start mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-blue-500/25 rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">
                          {isAr ? 'قالب نشط' : 'Active Template'}
                        </span>
                        <span className="text-[11px] font-black text-slate-100 truncate block">
                          {selectedTemplateName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveTemplate(false)}
                        disabled={templateActionLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/10"
                        title={isAr ? 'حفظ التعديلات على هذا القالب' : 'Save changes to this template'}
                      >
                        <Save className="h-3 w-3" />
                        {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleUnloadTemplate}
                        className="p-1.5 bg-slate-955 hover:bg-slate-850 border border-slate-850 text-slate-450 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
                        title={isAr ? 'إلغاء تحميل القالب' : 'Unload Template'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                    {/* Subject */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isAr ? 'موضوع الرسالة' : 'Email Subject'}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isAr ? 'أدخل عنوان الرسالة...' : 'Enter subject line...'}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold font-sans"
                  />
                </div>

                {/* Body */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isAr ? 'نص الرسالة' : 'Email Message Body'}
                  </label>
                  <textarea
                    ref={bodyTextareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    placeholder={isAr ? 'اكتب نص الرسالة هنا بالتفصيل...' : 'Type your email message body here...'}
                    required
                    className="w-full px-4 py-3 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium leading-relaxed resize-none font-sans"
                  />
                </div>

                {/* Attachment */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isAr ? 'إرفاق ملف إضافي (اختياري)' : 'Attachment File (Optional)'}
                  </label>
                  <div className="flex items-center justify-between gap-4 p-3 bg-slate-955/20 border border-slate-805/80 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-slate-950/80 rounded-lg text-slate-400 border border-slate-850">
                        <Paperclip className="h-4 w-4" />
                      </div>
                      <div className="text-start min-w-0">
                        <div className="text-[10px] font-bold text-slate-350 truncate">
                          {attachment ? attachment.filename : (isAr ? 'لا يوجد ملف مرفق' : 'No file attached')}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[280px]">
                          {attachment ? attachment.path : (isAr ? 'مثل التقارير، النشرات الإخبارية، إلخ.' : 'PDF, document, newsletter...')}
                        </div>
                      </div>
                    </div>
                    {attachment ? (
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-lg hover:bg-rose-500/20 transition-all cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSelectAttachment}
                        className="px-3 py-1.5 bg-slate-805 hover:bg-slate-755 border border-slate-700/60 rounded-xl text-[10px] text-slate-200 cursor-pointer font-semibold transition-all"
                      >
                        {isAr ? 'اختر ملفاً' : 'Select File'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Sidebar Parameters (takes 1 col) */}
              <div className="space-y-4">
                {/* Recipient Settings Box */}
                <div className="bg-slate-955/20 border border-slate-855/50 rounded-2xl p-4 space-y-4">
                  <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2">
                    {isAr ? 'إعدادات المستلمين' : 'Recipient Settings'}
                  </h4>

                  {/* Recipient Group select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {isAr ? 'فئة المستلمين' : 'Recipient Group'}
                    </label>
                    <select
                      value={recipientGroup}
                      onChange={(e) => { setRecipientGroup(e.target.value); setSelectedCourseId(''); }}
                      className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-800/80 rounded-xl text-xs text-slate-255 focus:outline-none focus:border-blue-500/50 transition-all font-semibold cursor-pointer"
                    >
                      <option value="teachers">{isAr ? 'كل المعلمين' : 'All Teachers'}</option>
                      <option value="students">{isAr ? 'كل الطلاب' : 'All Students'}</option>
                      <option value="parents">{isAr ? 'أولياء أمور الطلاب' : 'All Parents'}</option>
                      <option value="course">{isAr ? 'حسب المادة الدراسية' : 'By Course Enrolled'}</option>
                    </select>
                  </div>

                  {/* Course selection (if course is active) */}
                  {recipientGroup === 'course' && (
                    <div className="flex flex-col gap-1.5 animate-fade-in text-start">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {isAr ? 'اختر المادة الدراسية' : 'Select Course'}
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 bg-slate-955/45 border border-slate-805/85 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold cursor-pointer"
                      >
                        <option value="">{isAr ? '-- اختر مادة --' : '-- Select Course --'}</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Individual selection dropdown button */}
                  {recipientGroup !== 'course' ? (
                    <div className="flex flex-col gap-1.5 relative" ref={recipientDropdownRef}>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {isAr ? 'تحديد المستلمين فردياً' : 'Select Individual Recipients'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                        className="w-full px-4 py-2.5 bg-slate-955/45 hover:bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold flex items-center justify-between gap-2 cursor-pointer text-left"
                      >
                        <span className="truncate text-left block w-full">
                          {isAr 
                            ? `تم تحديد ${selectedRecipients.length} من ${getRecipientsRaw().length}`
                            : `${selectedRecipients.length} of ${getRecipientsRaw().length} selected`}
                        </span>
                        <Users className="h-4 w-4 text-slate-400 shrink-0" />
                      </button>

                      {/* Floating Popover Dropdown */}
                      {showRecipientDropdown && getRecipientsRaw().length > 0 && (
                        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5 animate-fade-in text-start w-[280px] sm:w-[320px]">
                          <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {isAr ? 'قائمة المستلمين' : 'Recipient Checklist'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedRecipients(getRecipientsRaw().map(r => r.email))}
                                className="text-[9px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer transition-colors"
                              >
                                {isAr ? 'تحديد الكل' : 'Select All'}
                              </button>
                              <span className="text-[9px] text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedRecipients([])}
                                className="text-[9px] text-rose-450 hover:text-rose-350 font-bold cursor-pointer transition-colors"
                              >
                                {isAr ? 'إلغاء تحديد الكل' : 'Clear All'}
                              </button>
                            </div>
                          </div>

                          {/* Recipient Search Filter */}
                          <input
                            type="text"
                            value={recipientSearch}
                            onChange={(e) => setRecipientSearch(e.target.value)}
                            placeholder={isAr ? 'البحث بالاسم أو البريد...' : 'Search name or email...'}
                            className="w-full px-3 py-1.5 bg-slate-955/45 border border-slate-850/60 rounded-xl text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                          />

                          {/* Scrollable Checklist */}
                          <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                            {getRecipientsRaw()
                              .filter(r => 
                                r.name.toLowerCase().includes(recipientSearch.toLowerCase()) || 
                                r.email.toLowerCase().includes(recipientSearch.toLowerCase())
                              )
                              .map(r => {
                                const isChecked = selectedRecipients.includes(r.email);
                                return (
                                  <label
                                    key={r.email}
                                    className={`flex items-center justify-between gap-3 p-2 border rounded-xl cursor-pointer transition-all ${
                                      isChecked 
                                        ? 'bg-slate-950 border-blue-500/30 text-slate-200' 
                                        : 'bg-slate-955/10 border-slate-850/40 text-slate-500 hover:text-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setSelectedRecipients(prev => prev.filter(e => e !== r.email))
                                          } else {
                                            setSelectedRecipients(prev => [...prev, r.email])
                                          }
                                        }}
                                        className="h-3.5 w-3.5 rounded border-slate-800 text-blue-600 focus:ring-blue-500/20 cursor-pointer bg-slate-955"
                                      />
                                      <div className="truncate text-left">
                                        <span className="text-[11px] font-bold block truncate">{r.name}</span>
                                        <span className="text-[9px] font-mono text-slate-550 block truncate">{r.email}</span>
                                      </div>
                                    </div>
                                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                      r.type === 'Student' 
                                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                        : r.type === 'Teacher' 
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    }`}>
                                      {r.type}
                                    </span>
                                  </label>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Course individual selection checklist */
                    selectedCourseId && (
                      <div className="flex flex-col gap-1.5 relative" ref={recipientDropdownRef}>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {isAr ? 'تحديد طلاب المادة فردياً' : 'Select Individual Course Students'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                          className="w-full px-4 py-2.5 bg-slate-950/45 hover:bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold flex items-center justify-between gap-2 cursor-pointer text-left"
                        >
                          <span className="truncate text-left block w-full">
                            {isAr 
                              ? `تم تحديد ${selectedRecipients.length} من ${getRecipientsRaw().length}`
                              : `${selectedRecipients.length} of ${getRecipientsRaw().length} selected`}
                          </span>
                          <Users className="h-4 w-4 text-slate-400 shrink-0" />
                        </button>

                        {/* Floating Popover Dropdown for Course */}
                        {showRecipientDropdown && getRecipientsRaw().length > 0 && (
                          <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5 animate-fade-in text-start w-[280px] sm:w-[320px]">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-2">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {isAr ? 'طلاب هذه المادة' : 'Course Students'}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecipients(getRecipientsRaw().map(r => r.email))}
                                  className="text-[9px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer transition-colors"
                                >
                                  {isAr ? 'تحديد الكل' : 'Select All'}
                                </button>
                                <span className="text-[9px] text-slate-700">|</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecipients([])}
                                  className="text-[9px] text-rose-455 hover:text-rose-350 font-bold cursor-pointer transition-colors"
                                >
                                  {isAr ? 'إلغاء تحديد الكل' : 'Clear All'}
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={recipientSearch}
                              onChange={(e) => setRecipientSearch(e.target.value)}
                              placeholder={isAr ? 'البحث بالاسم أو البريد...' : 'Search name or email...'}
                              className="w-full px-3 py-1.5 bg-slate-950/45 border border-slate-850/60 rounded-xl text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                            />

                            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                              {getRecipientsRaw()
                                .filter(r => 
                                  r.name.toLowerCase().includes(recipientSearch.toLowerCase()) || 
                                  r.email.toLowerCase().includes(recipientSearch.toLowerCase())
                                )
                                .map(r => {
                                  const isChecked = selectedRecipients.includes(r.email);
                                  return (
                                    <label
                                      key={r.email}
                                      className={`flex items-center justify-between gap-3 p-2 border rounded-xl cursor-pointer transition-all ${
                                        isChecked 
                                          ? 'bg-slate-950 border-blue-500/35 text-slate-205' 
                                          : 'bg-slate-955/10 border-slate-855/40 text-slate-500 hover:text-slate-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              setSelectedRecipients(prev => prev.filter(e => e !== r.email))
                                            } else {
                                              setSelectedRecipients(prev => [...prev, r.email])
                                            }
                                          }}
                                          className="h-3.5 w-3.5 rounded border-slate-805 text-blue-600 focus:ring-blue-500/20 cursor-pointer bg-slate-955"
                                        />
                                        <div className="truncate text-left">
                                          <span className="text-[11px] font-bold block truncate">{r.name}</span>
                                          <span className="text-[9px] font-mono text-slate-550 block truncate">{r.email}</span>
                                        </div>
                                      </div>
                                    </label>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Quick Actions Panel Card */}
                <div className="bg-slate-955/20 border border-slate-855/50 rounded-2xl p-4 space-y-3">
                  <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2 text-start">
                    {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
                  </h4>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleComposeUnpaidFeesReminder}
                      className="w-full px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-[10.5px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      {isAr ? 'تذكير الرسوم المعلقة' : 'Fee Payment Reminder'}
                    </button>
                    <button
                      type="button"
                      onClick={handleComposeWelcomeMessage}
                      className="w-full px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 text-[10.5px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <School className="h-3.5 w-3.5" />
                      {isAr ? 'رسالة ترحيبية عامة' : 'Welcome Message'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Actions Panel */}
          <div className="pt-4 mt-6 border-t border-slate-800/55 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-start flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/15">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10.5px] font-bold text-slate-300">
                  {isAr ? `سيتم الإرسال إلى ${getRecipients().length} مستلم` : `Will send to ${getRecipients().length} recipients`}
                </div>
                <p className="text-[9px] text-slate-500">
                  {isAr ? 'تم استبعاد الحسابات التي لا تملك بريداً مسجلاً.' : 'Skipped users with missing email fields.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Clear Composer */}
              <button
                type="button"
                onClick={handleUnloadTemplate}
                className="px-3.5 py-2.5 bg-slate-955 hover:bg-slate-850 border border-slate-850 text-slate-450 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer rounded-xl"
                title={isAr ? 'مسح كل الحقول والبدء برسالة فارغة' : 'Clear all fields and start fresh'}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isAr ? 'مسح الحقول' : 'Clear Composer'}
              </button>

              <button
                type="button"
                onClick={triggerSaveTemplateAsNew}
                className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-755 border border-slate-700/80 rounded-xl text-slate-350 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAr ? 'حفظ كقالب جديد' : 'Save As Template'}
              </button>

              <button
                type="button"
                onClick={handleSendEmails}
                disabled={sending || getRecipients().length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:shadow-none cursor-pointer disabled:cursor-not-allowed border border-blue-500/10 disabled:border-slate-300 dark:disabled:border-slate-800 shrink-0"
              >
                {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isAr ? 'إرسال البريد الإلكتروني' : 'Broadcast Email Message'}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'templates' ? (
        <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md space-y-6 text-start">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-400" />
                {isAr ? 'مكتبة قوالب الرسائل' : 'Message Templates Library'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {isAr 
                  ? 'عرض وإدارة واستخدام قوالب الرسائل البريدية المخصصة للإرسال السريع.'
                  : 'Manage, view and apply custom templates for fast message dispatch.'}
              </p>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 text-xs font-semibold">
                {isAr ? 'لا توجد أي قوالب محفوظة حالياً.' : 'No templates saved yet.'}
              </div>
            ) : (
              templates.map(tmpl => (
                <div 
                  key={tmpl.id}
                  className="group p-4 bg-slate-950/40 border border-slate-850/65 rounded-2xl flex flex-col justify-between gap-4 hover:border-blue-500/35 transition-all shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{tmpl.name}</h4>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                        className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all cursor-pointer shrink-0"
                        title={isAr ? 'حذف القالب' : 'Delete Template'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      <strong>{isAr ? 'الموضوع: ' : 'Subject: '}</strong>
                      <span className="text-slate-300 font-medium">{tmpl.subject}</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 line-clamp-4 leading-relaxed bg-slate-950/45 p-2.5 rounded-xl border border-slate-850/45 whitespace-pre-wrap">
                      {tmpl.body}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className="w-full py-2 bg-blue-600/15 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isAr ? 'تطبيق هذا القالب' : 'Apply Template'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Directory Tab */
        <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md space-y-6 text-start">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-blue-400" />
                {isAr ? 'دليل بريد المدرسة' : 'School Contacts Directory'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {isAr 
                  ? 'عرض جميع المسجلين للتحقق من سلامة حساباتهم البريدية قبل إرسال الرسائل الجماعية.'
                  : 'View all users in the system to verify their email status before broadcasting.'}
              </p>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold"
              />
            </div>
          </div>

          {/* Directory Table/List */}
          <div className="max-h-[500px] overflow-y-auto rounded-xl border border-slate-800/40 bg-slate-950/10">
            <table className="w-full text-xs text-slate-300">
              <thead className="bg-slate-900/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider select-none">
                <tr className="border-b border-slate-800/80">
                  <th className="px-5 py-3 text-start border-r border-slate-200 dark:border-slate-700/60 last:border-none rtl:border-l rtl:border-r-0 rtl:last:border-none">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="px-5 py-3 text-start border-r border-slate-200 dark:border-slate-700/60 last:border-none rtl:border-l rtl:border-r-0 rtl:last:border-none">{isAr ? 'الفئة' : 'Group'}</th>
                  <th className="px-5 py-3 text-start border-r border-slate-200 dark:border-slate-700/60 last:border-none rtl:border-l rtl:border-r-0 rtl:last:border-none">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</th>
                  <th className="px-5 py-3 text-center border-r border-slate-200 dark:border-slate-700/60 last:border-none rtl:border-l rtl:border-r-0 rtl:last:border-none">{isAr ? 'الحالة البريدية' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {directoryList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      {isAr ? 'لا يوجد نتائج مطابقة للبحث.' : 'No matching contacts found.'}
                    </td>
                  </tr>
                ) : (
                  directoryList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-200">{item.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-semibold ${
                          item.role === 'Teacher' || item.role === 'أستاذ'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                            : item.role === 'Student' || item.role === 'طالب'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        }`}>
                          {item.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">{item.email || '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {item.email ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-semibold">
                            <CheckCircle className="h-3 w-3" />
                            {isAr ? 'صالح للإرسال' : 'Ready'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-450 border border-rose-500/15 text-[10px] font-semibold">
                            <AlertCircle className="h-3 w-3" />
                            {isAr ? 'بريد مفقود' : 'No Email'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-start shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-400" />
                {isAr ? 'حفظ الرسالة كقالب' : 'Save As Template'}
              </h3>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {isAr ? 'اسم القالب الجديد' : 'Template Title'}
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder={isAr ? 'مثال: إشعار موعد الامتحانات...' : 'e.g. Exam Schedule Notification...'}
                className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-350 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleSaveTemplate(true)}
                disabled={templateActionLoading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:shadow-none cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-blue-500/10 border border-blue-500/10 disabled:border-slate-300 dark:disabled:border-slate-800"
              >
                {templateActionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isAr ? 'تأكيد الحفظ' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
