import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import { 
  Mail, Send, FileText, Plus, Trash2, Edit2, AlertCircle, CheckCircle, 
  RefreshCw, Paperclip, X, Copy, Info, Users, School, Save, Eye, Search 
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
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState(null) // { filename, path }

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
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا القالب؟' : 'Are you sure you want to delete this template?')) return
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
  }

  // Reset composer template state
  const handleUnloadTemplate = () => {
    setSelectedTemplateId('')
    setSelectedTemplateName('')
    setSubject('')
    setBody('')
  }

  // Get active recipient list based on group selection
  const getRecipients = () => {
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

    if (!confirm(isAr ? `هل أنت متأكد من رغبتك في إرسال البريد الإلكتروني إلى ${recipients.length} مستلم؟` : `Are you sure you want to send emails to ${recipients.length} recipients?`)) {
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
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'composer' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isAr ? 'منشئ البريد' : 'Email Composer'}
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'directory' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* Left Panel: Composer Card */}
          <div className="xl:col-span-2 bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md space-y-6 flex flex-col justify-between">
            <form onSubmit={handleSendEmails} className="space-y-4 text-start flex-1">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Mail className="h-4.5 w-4.5 text-blue-400" />
                  {isAr ? 'إنشاء رسالة بريدية جديدة' : 'Compose New Email Message'}
                </h3>
                {selectedTemplateId && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    {isAr ? `قالب: ${selectedTemplateName}` : `Template: ${selectedTemplateName}`}
                    <button type="button" onClick={handleUnloadTemplate} className="hover:text-rose-400 transition-colors" title={isAr ? 'إلغاء تحميل القالب' : 'Unload Template'}>
                      <X className="h-3 w-3 ml-1" />
                    </button>
                  </span>
                )}
              </div>

              {/* Recipient Selector Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isAr ? 'فئة المستلمين' : 'Recipient Group'}
                  </label>
                  <select
                    value={recipientGroup}
                    onChange={(e) => { setRecipientGroup(e.target.value); setSelectedCourseId(''); }}
                    className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold cursor-pointer"
                  >
                    <option value="teachers">{isAr ? 'كل المعلمين' : 'All Teachers'}</option>
                    <option value="students">{isAr ? 'كل الطلاب' : 'All Students'}</option>
                    <option value="parents">{isAr ? 'أولياء أمور الطلاب' : 'All Parents'}</option>
                    <option value="course">{isAr ? 'حسب المادة الدراسية' : 'By Course Enrolled'}</option>
                  </select>
                </div>

                {recipientGroup === 'course' && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {isAr ? 'اختر المادة الدراسية' : 'Select Course'}
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all font-semibold cursor-pointer"
                    >
                      <option value="">{isAr ? '-- اختر مادة --' : '-- Select Course --'}</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {isAr ? 'موضوع الرسالة' : 'Email Subject'}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={isAr ? 'أدخل عنوان الرسالة...' : 'Enter subject lines...'}
                  required
                  className="w-full px-4 py-2.5 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-semibold"
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
                  rows={9}
                  placeholder={isAr ? 'اكتب نص الرسالة هنا، يمكنك استخدام التسميات التلقائية مثل {student_name} لتخصيص جماعي...' : 'Type message here... Use dynamic placeholders like {student_name} for bulk personalization.'}
                  required
                  className="w-full px-4 py-3 bg-slate-950/45 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Attachment */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-955/20 border border-slate-850/40 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-800/60 rounded-lg text-slate-400 border border-slate-700/40">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div className="text-start">
                    <div className="text-[10px] font-bold text-slate-350">
                      {attachment ? attachment.filename : (isAr ? 'إرفاق ملف إضافي (اختياري)' : 'Attachment File (Optional)')}
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
                    className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSelectAttachment}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-755 border border-slate-700/60 rounded-xl text-[10px] text-slate-200 cursor-pointer font-semibold transition-all"
                  >
                    {isAr ? 'اختر ملفاً' : 'Select File'}
                  </button>
                )}
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
                {/* Template actions */}
                {selectedTemplateId ? (
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(false)}
                    disabled={templateActionLoading}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isAr ? 'تحديث هذا القالب' : 'Update Template'}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={triggerSaveTemplateAsNew}
                  className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-755 border border-slate-700/80 rounded-xl text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isAr ? 'حفظ كقالب جديد' : 'Save As Template'}
                </button>

                <button
                  type="button"
                  onClick={handleSendEmails}
                  disabled={sending || getRecipients().length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-800 disabled:to-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10 cursor-pointer border border-blue-500/10 shrink-0"
                >
                  {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {isAr ? 'إرسال البريد الإلكتروني' : 'Broadcast Email Message'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Templates & Placeholders */}
          <div className="space-y-6">
            {/* Dynamic Placeholders Helper */}
            <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-5 backdrop-blur-md text-start space-y-4">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Info className="h-4 w-4 text-blue-400" />
                {isAr ? 'التسميات التلقائية الذكية' : 'Smart Email Tags'}
              </h4>
              <p className="text-[10px] text-slate-400 leading-normal">
                {isAr 
                  ? 'اضغط على التسمية لإدراجها تلقائياً عند مؤشر الكتابة في الرسالة لبرمجتها لكل مستلم:'
                  : 'Click on any tag to automatically insert it at your cursor position in the message body:'}
              </p>
              <div className="space-y-2 pt-1.5">
                {placeholdersList.map(tag => (
                  <div 
                    key={tag.key} 
                    onClick={() => handleInsertTag(tag.key)}
                    className="flex items-center justify-between gap-3 p-2 bg-slate-950/40 hover:bg-slate-950/90 border border-slate-850/50 rounded-xl cursor-pointer group transition-all"
                  >
                    <code className="text-[10px] font-mono text-blue-400 font-bold">{tag.key}</code>
                    <span className="text-[9px] text-slate-400 truncate group-hover:text-slate-200 transition-colors">{tag.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Templates List */}
            <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-5 backdrop-blur-md text-start space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  {isAr ? 'قوالب الرسائل الجاهزة' : 'Saved Templates'}
                </h4>
              </div>

              {/* Templates List */}
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {templates.length === 0 ? (
                  <div className="text-[10px] text-slate-500 text-center py-6">
                    {isAr ? 'لا يوجد قوالب محفوظة حالياً.' : 'No templates saved yet.'}
                  </div>
                ) : (
                  templates.map(tmpl => (
                    <div 
                      key={tmpl.id}
                      className={`group p-2.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        selectedTemplateId === tmpl.id 
                          ? 'bg-blue-600/10 border-blue-500/30' 
                          : 'bg-slate-950/20 border-slate-850 hover:bg-slate-950/50'
                      }`}
                      onClick={() => handleSelectTemplate(tmpl)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] font-bold text-slate-200 truncate">{tmpl.name}</div>
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">{tmpl.subject}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          title={isAr ? 'حذف القالب' : 'Delete Template'}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
              <thead className="bg-slate-900/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="px-5 py-3 text-start">{isAr ? 'الفئة' : 'Group'}</th>
                  <th className="px-5 py-3 text-start">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</th>
                  <th className="px-5 py-3 text-center">{isAr ? 'الحالة البريدية' : 'Status'}</th>
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
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10 border border-blue-500/10"
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
