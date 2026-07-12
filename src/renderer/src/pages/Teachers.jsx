import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import { UserCheck, UserPlus, Phone, Mail, Award, AlertCircle, RefreshCw, Search, Plus, Edit, Trash2, X } from 'lucide-react'
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
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="h-4 w-4" />
              {t('teachers.addTeacher')}
            </button>
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
    </div>
  )
}
