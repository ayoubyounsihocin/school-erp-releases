import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import { Mail, Send, FileText, Plus, Trash2, Edit2, AlertCircle, CheckCircle, RefreshCw, Paperclip, X, Copy, Info, Users, School } from 'lucide-react'

export default function Communication() {
  const { language, t } = useLanguage()
  const isAr = language === 'ar'
  const textAlign = isAr ? 'text-right' : 'text-left font-sans'

  // Loaders & State
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  
  // Data Lists
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([])
  const [templates, setTemplates] = useState([])

  // Form Fields
  const [recipientGroup, setRecipientGroup] = useState('teachers') // 'teachers', 'students', 'parents', 'course'
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState(null) // { filename, path }

  // Template Manager States
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)
  const [templateActionLoading, setTemplateActionLoading] = useState(false)

  // Status Reports
  const [sendResult, setSendResult] = useState(null) // { success: true/false, count, results: [] }

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

  // Templates CRUD
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !body.trim()) {
      alert(isAr ? 'الرجاء إدخال اسم القالب والموضوع ونص الرسالة لحفظه.' : 'Please fill template name, subject, and body.')
      return
    }
    setTemplateActionLoading(true)
    try {
      const res = await ipcService.saveTemplate({
        id: selectedTemplateId || null,
        name: templateName,
        subject,
        body
      })
      if (res && res.success) {
        alert(isAr ? 'تم حفظ القالب بنجاح!' : 'Template saved successfully!')
        setTemplateName('')
        setSelectedTemplateId('')
        setIsEditingTemplate(false)
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

  const handleDeleteTemplate = async (id) => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا القالب؟' : 'Are you sure you want to delete this template?')) return
    try {
      const res = await ipcService.deleteTemplate(id)
      if (res && res.success) {
        const tmplList = await ipcService.getTemplates()
        setTemplates(tmplList || [])
        if (selectedTemplateId === id) {
          setSelectedTemplateId('')
          setTemplateName('')
          setSubject('')
          setBody('')
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplateId(tmpl.id)
    setTemplateName(tmpl.name)
    setSubject(tmpl.subject)
    setBody(tmpl.body)
    setIsEditingTemplate(true)
  }

  const handleCreateNewTemplate = () => {
    setSelectedTemplateId('')
    setTemplateName('')
    setSubject('')
    setBody('')
    setIsEditingTemplate(true)
  }

  // Get active recipient list based on group selection
  const getRecipients = () => {
    let list = []
    if (recipientGroup === 'teachers') {
      list = teachers.map(t => ({
        email: t.email,
        name: t.full_name,
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
        placeholders: {
          student_name: s.full_name,
          parent_name: s.full_name + ' Parent', // Mock parent name placeholder
          parent_phone: s.parent_phone || ''
        }
      }))
    } else if (recipientGroup === 'course' && selectedCourseId) {
      // Find students enrolled in the selected course
      const selectedCourse = courses.find(c => String(c.id) === String(selectedCourseId))
      if (selectedCourse && selectedCourse.Students) {
        list = selectedCourse.Students.map(s => ({
          email: s.email,
          name: s.full_name,
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
        // Reset form
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

  const copyPlaceholder = (key) => {
    navigator.clipboard.writeText(key)
    alert(isAr ? `تم نسخ ${key} للحافظة!` : `Copied ${key} to clipboard!`)
  }

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* SaaS Header */}
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/40 pb-5 ${textAlign}`}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {isAr ? 'مركز الاتصالات والبريد' : 'Communication & Mail Hub'}
          </h1>
          <p className="text-xs text-slate-450 mt-1">
            {isAr ? 'إرسال رسائل بريدية جماعية وفردية ذكية لأولياء الأمور والطلاب والمدرسين بنقرة واحدة.' : 'Send personalized bulk and single emails to Parents, Students, and Teachers instantly.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
          <RefreshCw className="h-7 w-7 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">{isAr ? 'جاري تحميل البيانات والتأكد من إعدادات البريد...' : 'Loading data and preparing services...'}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* Main Composing Card */}
          <div className="xl:col-span-2 bg-slate-900/20 border border-slate-850/60 rounded-2xl p-6 backdrop-blur-md space-y-6 flex flex-col justify-between">
            <form onSubmit={handleSendEmails} className="space-y-4 text-start flex-1">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800/60 pb-3 mb-4 flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-sky-400" />
                {isAr ? 'إنشاء رسالة بريدية جديدة' : 'Compose New Email Message'}
              </h3>

              {/* Recipient Selector Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isAr ? 'فئة المستلمين' : 'Recipient Group'}
                  </label>
                  <select
                    value={recipientGroup}
                    onChange={(e) => setRecipientGroup(e.target.value)}
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
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
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

            {/* Recipients Summary & Send Action */}
            <div className="pt-4 mt-6 border-t border-slate-800/55 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-start flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/15">
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

              <button
                onClick={handleSendEmails}
                disabled={sending || getRecipients().length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:from-slate-800 disabled:to-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10 cursor-pointer border border-blue-500/10 shrink-0"
              >
                {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isAr ? 'إرسال البريد الإلكتروني' : 'Broadcast Email Message'}
              </button>
            </div>
          </div>

          {/* Sidebar - Templates & Placeholders */}
          <div className="space-y-6">
            {/* Dynamic Placeholders Helper */}
            <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-5 backdrop-blur-md text-start space-y-4">
              <h4 className="text-xs font-bold text-slate-205 flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Info className="h-4 w-4 text-sky-400" />
                {isAr ? 'التسميات التلقائية الذكية' : 'Smart Email Tags'}
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal">
                {isAr 
                  ? 'استخدم هذه الحقول في الموضوع أو نص الرسالة وسيتم استبدالها تلقائياً ببيانات كل مستلم:'
                  : 'Double-click or copy tags to place them in your email subject or body. They resolve per recipient:'}
              </p>
              <div className="space-y-2 pt-1.5">
                {placeholdersList.map(tag => (
                  <div 
                    key={tag.key} 
                    onClick={() => copyPlaceholder(tag.key)}
                    className="flex items-center justify-between gap-3 p-2 bg-slate-955/40 hover:bg-slate-955/90 border border-slate-850/50 rounded-xl cursor-pointer group transition-all"
                  >
                    <code className="text-[10px] font-mono text-sky-400 font-bold">{tag.key}</code>
                    <span className="text-[9px] text-slate-450 truncate group-hover:text-slate-200 transition-colors">{tag.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Templates List */}
            <div className="bg-slate-900/20 border border-slate-850/60 rounded-2xl p-5 backdrop-blur-md text-start space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <h4 className="text-xs font-bold text-slate-205 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-400" />
                  {isAr ? 'قوالب الرسائل الجاهزة' : 'Saved Templates'}
                </h4>
                <button
                  onClick={handleCreateNewTemplate}
                  className="p-1 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-all cursor-pointer"
                  title={isAr ? 'جديد' : 'Create New'}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* List */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {templates.length === 0 ? (
                  <div className="text-[10px] text-slate-550 text-center py-4">
                    {isAr ? 'لا يوجد قوالب محفوظة حالياً.' : 'No templates saved yet.'}
                  </div>
                ) : (
                  templates.map(tmpl => (
                    <div 
                      key={tmpl.id}
                      className={`group p-2.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        selectedTemplateId === tmpl.id 
                          ? 'bg-sky-500/10 border-sky-500/30' 
                          : 'bg-slate-950/20 border-slate-850 hover:bg-slate-950/50'
                      }`}
                      onClick={() => handleSelectTemplate(tmpl)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] font-bold text-slate-200 truncate">{tmpl.name}</div>
                        <div className="text-[9px] text-slate-500 truncate mt-0.5">{tmpl.subject}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                          className="p-1 text-slate-500 hover:text-rose-455 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Save/Edit form if editing */}
              {isEditingTemplate && (
                <div className="pt-4 border-t border-slate-800/60 space-y-3 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">
                      {isAr ? 'اسم القالب' : 'Template Title'}
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder={isAr ? 'مثال: إشعار عطلة' : 'e.g. Exam Schedule Notification'}
                      className="w-full px-3 py-1.5 bg-slate-950/45 border border-slate-800 rounded-lg text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setIsEditingTemplate(false)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-755 text-slate-350 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={templateActionLoading}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-blue-500/10 border border-blue-500/10"
                    >
                      {templateActionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <SaveIcon className="h-3 w-3" />}
                      {isAr ? 'حفظ كقالب' : 'Save Template'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaveIcon({ className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}
