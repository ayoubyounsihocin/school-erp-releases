import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { UserCheck, UserPlus, Phone, Mail, Award, AlertCircle, RefreshCw, Search, Plus, Edit, Trash2, X, Upload, Download, Check } from 'lucide-react'
import { ipcService } from '../services/ipcService'

export default function Teachers() {
  const { language, t } = useLanguage()
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
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter States
  const [statusFilter, setStatusFilter] = useState('All')
  const [specialtyFilter, setSpecialtyFilter] = useState('All')

  // Form State for Adding Teacher
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    specialty: '',
    status: 'Active',
    absence_penalty_rate: '1000'
  })
  const [formErrors, setFormErrors] = useState({})

  // Modals States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    specialty: '',
    status: 'Active',
    absence_penalty_rate: '1000'
  })
  const [editFormErrors, setEditFormErrors] = useState({})

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    full_name: '',
    phone: '',
    email: '',
    specialty: '',
    absence_penalty_rate: ''
  })
  const [selectedExtraFields, setSelectedExtraFields] = useState([])
  const [importing, setImporting] = useState(false)

  // Fetch teachers from database
  const loadTeachers = async () => {
    setLoading(true)
    try {
      const data = await ipcService.getTeachers()
      setTeachers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load teachers from SQLite:", err)
      setTeachers([])
    } finally {
      setTimeout(() => {
        setLoading(false)
      }, 400)
    }
  }

  // CSV RFC-4180 Compliant Parser with auto delimiter detection
  const parseCSVText = (text) => {
    const firstLine = text.split(/\r?\n/)[0] || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    let lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      let next = text[i+1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSVText(text);
      if (parsed.length === 0) {
        alert("Empty file or invalid CSV");
        return;
      }
      
      const headers = parsed[0].map(h => h.trim());
      const rows = parsed.slice(1)
        .filter(r => r.some(cell => cell.trim()))
        .map(r => {
          if (r.length < headers.length) {
            return [...r, ...Array(headers.length - r.length).fill("")];
          } else if (r.length > headers.length) {
            return r.slice(0, headers.length);
          }
          return r;
        });
      
      setCsvHeaders(headers);
      setCsvRows(rows);
      
      const mapping = {
        full_name: '',
        phone: '',
        email: '',
        specialty: '',
        absence_penalty_rate: ''
      };
      
      headers.forEach(h => {
        const clean = h.toLowerCase().replace(/[\s_-]/g, '');
        if (['fullname', 'name', 'nom', 'nomcomplet', 'الاسم', 'الاسمكامل', 'الاسمالكامل'].includes(clean)) {
          mapping.full_name = h;
        }
        if (['phone', 'phone_number', 'phonenumber', 'tel', 'telephone', 'mobile', 'الهاتف', 'رقمالهاتف'].includes(clean)) {
          mapping.phone = h;
        }
        if (['email', 'teacheremail', 'mail', 'emailaddress', 'البريد', 'البريدالإلكتروني', 'إيميل'].includes(clean)) {
          mapping.email = h;
        }
        if (['specialty', 'specialite', 'course', 'subject', 'matiere', 'التخصص', 'المادة'].includes(clean)) {
          mapping.specialty = h;
        }
        if (['penalty', 'penaltyrate', 'absencepenalty', 'rate', 'الغرامة', 'الخصم', 'سعرالغياب'].includes(clean)) {
          mapping.absence_penalty_rate = h;
        }
      });
      
      setColumnMapping(mapping);
      
      const extraFieldsList = headers.filter(h => !Object.values(mapping).includes(h));
      setSelectedExtraFields(extraFieldsList);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImportExecute = async () => {
    if (!columnMapping.full_name) {
      alert(language === 'ar' ? "الرجاء ربط حقل الاسم الكامل أولاً" : "Please map the Full Name field first");
      return;
    }
    
    setImporting(true);
    try {
      const nameIdx = csvHeaders.indexOf(columnMapping.full_name);
      const phoneIdx = columnMapping.phone ? csvHeaders.indexOf(columnMapping.phone) : -1;
      const emailIdx = columnMapping.email ? csvHeaders.indexOf(columnMapping.email) : -1;
      const specialtyIdx = columnMapping.specialty ? csvHeaders.indexOf(columnMapping.specialty) : -1;
      const penaltyIdx = columnMapping.absence_penalty_rate ? csvHeaders.indexOf(columnMapping.absence_penalty_rate) : -1;
      
      const mappedTeachers = csvRows.map(row => {
        return {
          full_name: row[nameIdx]?.trim() || '',
          phone: phoneIdx !== -1 ? row[phoneIdx]?.trim() : '',
          email: emailIdx !== -1 ? row[emailIdx]?.trim() : '',
          specialty: specialtyIdx !== -1 ? row[specialtyIdx]?.trim() : 'General',
          absence_penalty_rate: penaltyIdx !== -1 ? (parseFloat(row[penaltyIdx]) || 1000) : 1000
        };
      }).filter(t => t.full_name);
      
      const res = await ipcService.bulkImportTeachers(mappedTeachers);
      if (res && res.error) {
        alert((language === 'ar' ? 'فشل الاستيراد' : 'Import failed') + ": " + res.error);
      } else {
        const count = res.count || 0;
        const skipped = res.skipped || 0;
        let msg = language === 'ar' ? `تم استيراد ${count} مدرس بنجاح.` : `Successfully imported ${count} teachers.`;
        if (skipped > 0) {
          msg += ` (${language === 'ar' ? `تخطى ${skipped} مكرر` : `skipped ${skipped} duplicates`})`;
        }
        alert(msg);
        setIsImportModalOpen(false);
        setCsvHeaders([]);
        setCsvRows([]);
        await loadTeachers();
      }
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? "فشل الاستيراد" : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      language === 'ar' ? 'الاسم الكامل' : 'Full Name',
      language === 'ar' ? 'الهاتف' : 'Phone',
      language === 'ar' ? 'البريد الإلكتروني' : 'Email',
      language === 'ar' ? 'التخصص' : 'Specialty',
      language === 'ar' ? 'معدل خصم الغياب' : 'Absence Penalty Rate',
      language === 'ar' ? 'الحالة' : 'Status'
    ]

    const rows = teachers.map(t => [
      `"${(t.full_name || '').replace(/"/g, '""')}"`,
      `"${(t.phone || '')}"`,
      `"${(t.email || '')}"`,
      `"${(t.specialty || '')}"`,
      `"${(t.absence_penalty_rate || 1000)}"`,
      `"${(t.status || 'Active')}"`
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Teachers_Export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  };

  useEffect(() => {
    loadTeachers()
  }, [])

  // Handle Input Change for Add Form
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Validate Add Form
  const validateForm = () => {
    const errors = {}
    if (!formData.full_name.trim()) {
      errors.full_name = 'Teacher Name is required'
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required'
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required'
    }
    if (!formData.specialty.trim()) {
      errors.specialty = t('teachers.validationSpecialtyRequired')
    }
    const penalty = parseFloat(formData.absence_penalty_rate)
    if (isNaN(penalty) || penalty < 0) {
      errors.absence_penalty_rate = 'Please enter a valid penalty rate'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Form Submit for Adding
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setActionLoading(true)
    try {
      await ipcService.addTeacher(formData)
      
      // Reset Form
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        specialty: '',
        status: 'Active',
        absence_penalty_rate: '1000'
      })

      // Auto-refresh
      await loadTeachers()
      setIsAddModalOpen(false)
    } catch (err) {
      console.error("Failed to add teacher:", err)
      alert("Failed to save teacher record.")
    } finally {
      setActionLoading(false)
    }
  }

  // Edit Handlers
  const handleOpenEditModal = (teacher) => {
    setSelectedTeacher(teacher)
    setEditFormData({
      full_name: teacher.full_name || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      specialty: teacher.specialty || '',
      status: teacher.status || 'Active',
      absence_penalty_rate: teacher.absence_penalty_rate !== undefined ? teacher.absence_penalty_rate.toString() : '1000'
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
    if (!editFormData.full_name.trim()) {
      errors.full_name = 'Teacher Name is required'
    }
    if (!editFormData.phone.trim()) {
      errors.phone = 'Phone number is required'
    }
    if (!editFormData.email.trim()) {
      errors.email = 'Email address is required'
    }
    if (!editFormData.specialty.trim()) {
      errors.specialty = t('teachers.validationSpecialtyRequired')
    }
    const penalty = parseFloat(editFormData.absence_penalty_rate)
    if (isNaN(penalty) || penalty < 0) {
      errors.absence_penalty_rate = 'Please enter a valid penalty rate'
    }
    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!validateEditForm()) return

    setActionLoading(true)
    try {
      await ipcService.updateTeacher(selectedTeacher.id, editFormData)
      setIsEditModalOpen(false)
      await loadTeachers()
    } catch (err) {
      console.error("Failed to update teacher:", err)
      alert("Failed to update teacher details.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteTeacher = async (id, name) => {
    const confirmed = window.confirm(t('teachers.deleteConfirm', { name }))
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await ipcService.deleteTeacher(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        if (isEditModalOpen && selectedTeacher?.id === id) {
          setIsEditModalOpen(false)
        }
        await loadTeachers()
      }
    } catch (err) {
      console.error("Failed to delete teacher:", err)
      alert("Failed to delete teacher record.")
    } finally {
      setActionLoading(false)
    }
  }

  // Local Search Filter
  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesSpecialty = specialtyFilter === 'All' || t.specialty === specialtyFilter;
    
    return matchesSearch && matchesStatus && matchesSpecialty;
  })

  return (
    <div className="no-print">
      <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('teachers.title')}</h1>
          <p className="text-xs text-slate-400">{t('teachers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTeachers}
            disabled={loading}
            className="p-2.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 disabled:opacity-50 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Reload Faculty"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {hasPermission('teachers:write') && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-350 border border-slate-800 rounded-xl text-xs font-semibold tracking-wide shadow-md transition-all cursor-pointer shrink-0"
              >
                <Upload className="h-4 w-4" />
                {language === 'ar' ? 'استيراد CSV' : 'Import CSV'}
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-350 border border-slate-800 rounded-xl text-xs font-semibold tracking-wide shadow-md transition-all cursor-pointer shrink-0"
              >
                <Download className="h-4 w-4" />
                {language === 'ar' ? 'تصدير كـ Excel' : 'Export CSV'}
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                {t('teachers.addTeacher')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* IPC API Offline Warning */}
      {!window.api && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Electron IPC API is offline. Make sure the application is running inside Electron context to manage faculty records.</span>
        </div>
      )}

      {/* Filters & Count bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-3xl">
          {/* Text Search */}
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('teachers.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* Specialty Filter */}
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer"
          >
            <option value="All">{t('teachers.specialtyAll')}</option>
            {Array.from(new Set(teachers.map(t => t.specialty).filter(Boolean))).map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-955 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer"
          >
            <option value="All">{t('common.all')} {t('teachers.statusCol')}</option>
            <option value="Active">{t('common.active')}</option>
            <option value="Inactive">{t('common.inactive')}</option>
          </select>
        </div>
        <div className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider shrink-0 lg:mr-2">
          {t('teachers.recordsCount', { filtered: filteredTeachers.length, total: teachers.length })}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="w-full">
        
        {/* Directory Table */}
        <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-955/40">
            <h3 className="text-sm font-semibold text-slate-200">{t('teachers.registryTitle')}</h3>
          </div>
          
          {loading ? (
            /* Table Skeletons */
            <div className="overflow-x-auto">
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                <thead>
                  <tr className="border-b border-slate-800/60 bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">{t('teachers.fullNameCol')}</th>
                    <th className="px-6 py-4">{t('teachers.specialtyCol')}</th>
                    <th className="px-6 py-4">{t('teachers.contactsCol')}</th>
                    <th className="px-6 py-4">{t('teachers.statusCol')}</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {[1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3.5 w-32 bg-slate-800 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-3.5 w-24 bg-slate-800 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-3 w-40 bg-slate-800 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-5 w-16 bg-slate-800 rounded-full"></div></td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}><div className="h-6 w-12 bg-slate-800 rounded ml-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <UserCheck className="h-8 w-8 text-slate-600" />
            <p className="text-xs">{t('teachers.noTeachersRegistered')}</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
              <p className="text-xs">{language === 'ar' ? `لم يتم العثور على أساتذة يطابقون "${searchTerm}"` : `No matching teachers found for "${searchTerm}"`}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse`}>
                <thead>
                  <tr className="border-b border-slate-800/60 bg-slate-955/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">{t('teachers.fullNameCol')}</th>
                    <th className="px-6 py-4">{t('teachers.specialtyCol')}</th>
                    <th className="px-6 py-4">{t('students.coursesCol')}</th>
                    <th className="px-6 py-4">{t('teachers.contactsCol')}</th>
                    <th className="px-6 py-4">{t('teachers.statusCol')}</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-xs text-slate-300">
                  {filteredTeachers.map(teacher => (
                    <tr key={teacher.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-200">{teacher.full_name}</td>
                      <td className="px-6 py-4 font-medium text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-blue-500" />
                          {teacher.specialty}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {teacher.Courses && teacher.Courses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                              {teacher.Courses.length} {teacher.Courses.length === 1 ? t('teachers.courseSingle') : t('teachers.courseMultiple')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">{t('teachers.noCoursesAssigned')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-600" />
                          <span>{teacher.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-600" />
                          <span className="text-[10px] truncate max-w-xs">{teacher.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          teacher.status === 'Active'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                          {teacher.status === 'Active' ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} px-6 py-4`}>
                        <div className="flex items-center justify-end gap-2">
                          {hasPermission('teachers:write') && (
                            <button
                              onClick={() => handleOpenEditModal(teacher)}
                              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/30 rounded-lg transition-all cursor-pointer"
                              title="Edit Instructor"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {hasPermission('teachers:delete') && (
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id, teacher.full_name)}
                              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer"
                              title="Delete Instructor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      
      </div>
    </div>

      {/* Edit Modal Overlay */}
      {isEditModalOpen && selectedTeacher && (
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
                  {t('teachers.modalEditTitle')}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? `تحديث تفاصيل ملف الأستاذ "${selectedTeacher.full_name}"` : `Updating details for "${selectedTeacher.full_name}"`}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.fullNameLabel')}</label>
                <input
                  type="text"
                  name="full_name"
                  value={editFormData.full_name}
                  onChange={handleEditInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    editFormErrors.full_name ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {editFormErrors.full_name && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {editFormErrors.full_name}
                  </span>
                )}
              </div>

              {/* Specialty */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.specialtyLabel')}</label>
                <input
                  type="text"
                  name="specialty"
                  value={editFormData.specialty}
                  onChange={handleEditInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    editFormErrors.specialty ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {editFormErrors.specialty && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {editFormErrors.specialty}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.phoneLabel')}</label>
                <input
                  type="text"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    editFormErrors.phone ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {editFormErrors.phone && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {editFormErrors.phone}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.emailLabel')}</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    editFormErrors.email ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {editFormErrors.email && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {editFormErrors.email}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.statusLabel')}</label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditInputChange}
                  className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                >
                  <option value="Active">{t('common.active')}</option>
                  <option value="Inactive">{t('common.inactive')}</option>
                </select>
              </div>

              {/* Absence Penalty Rate */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                  {language === 'ar' ? 'معدل غرامة الغياب (د.ج)' : 'Absence Penalty (DA)'}
                </label>
                <input
                  type="number"
                  name="absence_penalty_rate"
                  value={editFormData.absence_penalty_rate}
                  onChange={handleEditInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    editFormErrors.absence_penalty_rate ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {editFormErrors.absence_penalty_rate && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {editFormErrors.absence_penalty_rate}
                  </span>
                )}
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
                {hasPermission('teachers:delete') && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(selectedTeacher.id, selectedTeacher.full_name)}
                    className="px-3 py-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
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
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('common.save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </>
    )}

      {/* Add Teacher Modal */}
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
                <UserPlus className="h-4.5 w-4.5 text-blue-500" />
                {t('teachers.modalAddTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.fullNameLabel')}</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder={t('teachers.fullNamePlaceholder')}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    formErrors.full_name ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {formErrors.full_name && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.full_name}
                  </span>
                )}
              </div>

              {/* Specialty */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.specialtyLabel')}</label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleInputChange}
                  placeholder={t('teachers.specialtyPlaceholder')}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    formErrors.specialty ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {formErrors.specialty && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.specialty}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.phoneLabel')}</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={t('teachers.phonePlaceholder')}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    formErrors.phone ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {formErrors.phone && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.phone}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.emailLabel')}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={t('teachers.emailPlaceholder')}
                  className={`px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    formErrors.email ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {formErrors.email && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.email}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('teachers.statusLabel')}</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                >
                  <option value="Active">{t('common.active')}</option>
                  <option value="Inactive">{t('common.inactive')}</option>
                </select>
              </div>

              {/* Absence Penalty Rate */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] text-slate-400 uppercase font-semibold">
                  {language === 'ar' ? 'معدل غرامة الغياب (د.ج)' : 'Absence Penalty (DA)'}
                </label>
                <input
                  type="number"
                  name="absence_penalty_rate"
                  value={formData.absence_penalty_rate}
                  onChange={handleInputChange}
                  className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors ${
                    formErrors.absence_penalty_rate ? 'border-rose-500/50' : 'border-slate-800/80'
                  }`}
                />
                {formErrors.absence_penalty_rate && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.absence_penalty_rate}
                  </span>
                )}
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
                {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : t('teachers.registerBtn')}
              </button>
            </div>
          </form>
        </div>
      </>
    )}

    {/* Import CSV Modal */}
    {isImportModalOpen && (
      <>
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-[150]" onClick={() => setIsImportModalOpen(false)} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] z-[200] overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'استيراد بيانات المعلمين' : 'Import Teachers Database'}
              </h3>
            </div>
            <button 
              onClick={() => setIsImportModalOpen(false)}
              className="p-1.5 rounded-lg bg-slate-955 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {csvRows.length === 0 ? (
              // File Upload Zone
              <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-955/20 transition-colors cursor-pointer relative group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-200">
                    {language === 'ar' ? 'اختر ملف CSV لرفعه' : 'Choose CSV file to upload'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {language === 'ar' ? 'تنسيق الملف المدعوم: .csv بترميز UTF-8' : 'Supported format: .csv encoded in UTF-8'}
                  </p>
                </div>
              </div>
            ) : (
              // Column Mapping & Preview
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Column Mapper Column */}
                <div className="lg:col-span-7 bg-slate-955/25 border border-slate-850 rounded-2xl p-5 space-y-5">
                  <h4 className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-2 flex items-center justify-between">
                    <span>{language === 'ar' ? 'ربط الأعمدة' : 'Map Columns'}</span>
                    <span className="text-[9px] text-emerald-400 font-mono">
                      {language === 'ar' ? `تم تحميل ${csvRows.length} صف` : `Loaded ${csvRows.length} rows`}
                    </span>
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Full Name Mapping */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] text-slate-450 uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>{language === 'ar' ? 'الاسم الكامل' : 'Full Name'} <span className="text-rose-500">*</span></span>
                        {columnMapping.full_name && (
                          <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                        )}
                      </label>
                      <select
                        value={columnMapping.full_name}
                        onChange={(e) => setColumnMapping({ ...columnMapping, full_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                      >
                        <option value="">-- {language === 'ar' ? 'اختر عموداً' : 'Select Column'} --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Phone Mapping */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>{language === 'ar' ? 'الهاتف' : 'Phone'}</span>
                        {columnMapping.phone && (
                          <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                        )}
                      </label>
                      <select
                        value={columnMapping.phone}
                        onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                      >
                        <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Email Mapping */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                        {columnMapping.email && (
                          <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                        )}
                      </label>
                      <select
                        value={columnMapping.email}
                        onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                      >
                        <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Specialty Mapping */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>{language === 'ar' ? 'التخصص' : 'Specialty'}</span>
                        {columnMapping.specialty && (
                          <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                        )}
                      </label>
                      <select
                        value={columnMapping.specialty}
                        onChange={(e) => setColumnMapping({ ...columnMapping, specialty: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                      >
                        <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Penalty Rate Mapping */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                        <span>{language === 'ar' ? 'معدل الخصم للغياب' : 'Absence Penalty Rate'}</span>
                        {columnMapping.absence_penalty_rate && (
                          <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                        )}
                      </label>
                      <select
                        value={columnMapping.absence_penalty_rate}
                        onChange={(e) => setColumnMapping({ ...columnMapping, absence_penalty_rate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                      >
                        <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-955/25 border border-slate-850 rounded-2xl p-5 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-2">
                      {language === 'ar' ? 'معاينة الصف الأول' : 'First Row Preview'}
                    </h4>
                    
                    <div className="space-y-3.5 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-850/40">
                        <span className="text-slate-500">{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}:</span>
                        <span className="text-slate-200 font-medium font-semibold">
                          {columnMapping.full_name ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.full_name)] : '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-850/40">
                        <span className="text-slate-500">{language === 'ar' ? 'الهاتف' : 'Phone'}:</span>
                        <span className="text-slate-200 font-medium">
                          {columnMapping.phone ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.phone)] : '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-850/40">
                        <span className="text-slate-500">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}:</span>
                        <span className="text-slate-200 font-medium font-mono">
                          {columnMapping.email ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.email)] : '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-850/40">
                        <span className="text-slate-500">{language === 'ar' ? 'التخصص' : 'Specialty'}:</span>
                        <span className="text-slate-200 font-medium">
                          {columnMapping.specialty ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.specialty)] : '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500">{language === 'ar' ? 'معدل الخصم للغياب' : 'Absence Penalty'}:</span>
                        <span className="text-slate-200 font-medium font-mono">
                          {columnMapping.absence_penalty_rate ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.absence_penalty_rate)] : '---'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
            <button
              onClick={() => {
                setCsvHeaders([]);
                setCsvRows([]);
                setIsImportModalOpen(false);
              }}
              className="px-4 py-2 bg-slate-955 border border-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              {language === 'ar' ? 'تراجع' : 'Cancel'}
            </button>
            
            {csvRows.length > 0 && (
              <button
                onClick={handleImportExecute}
                disabled={importing}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all disabled:opacity-55 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {language === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {language === 'ar' ? `استيراد ${csvRows.length} معلم` : `Import ${csvRows.length} Teachers`}
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
