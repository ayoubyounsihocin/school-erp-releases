import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getStudents: () => ipcRenderer.invoke('get-students'),
  addStudent: (studentData) => ipcRenderer.invoke('add-student', studentData),
  addPayment: (paymentData) => ipcRenderer.invoke('add-payment', paymentData),
  getPayments: () => ipcRenderer.invoke('get-payments'),
  addExpense: (expenseData) => ipcRenderer.invoke('add-expense', expenseData),
  getExpenses: () => ipcRenderer.invoke('get-expenses'),
  getFinancialSummary: () => ipcRenderer.invoke('get-financial-summary'),
  getCourses: () => ipcRenderer.invoke('get-courses'),
  addCourse: (courseData) => ipcRenderer.invoke('add-course', courseData),
  getTeachers: () => ipcRenderer.invoke('get-teachers'),
  addTeacher: (teacherData) => ipcRenderer.invoke('add-teacher', teacherData),
  enrollStudentInCourse: (studentId, courseId, enrollmentDate) => ipcRenderer.invoke('enroll-student-in-course', { studentId, courseId, enrollmentDate }),
  getStudentCourses: (studentId) => ipcRenderer.invoke('get-student-courses', studentId),
  getCourseStudents: (courseId) => ipcRenderer.invoke('get-course-students', courseId),
  updateStudent: (id, studentData) => ipcRenderer.invoke('update-student', { id, studentData }),
  deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
  bulkImportStudents: (studentsList) => ipcRenderer.invoke('bulk-import-students', studentsList),
  bulkImportTeachers: (teachersList) => ipcRenderer.invoke('bulk-import-teachers', teachersList),
  updateTeacher: (id, teacherData) => ipcRenderer.invoke('update-teacher', { id, teacherData }),
  deleteTeacher: (id) => ipcRenderer.invoke('delete-teacher', id),
  updateCourse: (id, courseData) => ipcRenderer.invoke('update-course', { id, courseData }),
  deleteCourse: (id) => ipcRenderer.invoke('delete-course', id),
  getAuditLogs: ({ limit, offset } = {}) => ipcRenderer.invoke('get-audit-logs', { limit, offset }),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (scheduleData) => ipcRenderer.invoke('add-schedule', scheduleData),
  updateSchedule: (id, scheduleData) => ipcRenderer.invoke('update-schedule', { id, scheduleData }),
  deleteSchedule: (id) => ipcRenderer.invoke('delete-schedule', id),
  getScheduleRequests: () => ipcRenderer.invoke('get-schedule-requests'),
  addScheduleRequest: (requestData) => ipcRenderer.invoke('add-schedule-request', requestData),
  resolveScheduleRequest: (id, decision) => ipcRenderer.invoke('resolve-schedule-request', { id, decision }),
  updatePayment: (id, paymentData) => ipcRenderer.invoke('update-payment', { id, paymentData }),
  deletePayment: (id) => ipcRenderer.invoke('delete-payment', id),
  updateExpense: (id, expenseData) => ipcRenderer.invoke('update-expense', { id, expenseData }),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  login: (username, password) => ipcRenderer.invoke('login', { username, password }),
  requestPasswordReset: (username) => ipcRenderer.invoke('request-password-reset', { username }),
  submitPasswordResetRequest: (data) => ipcRenderer.invoke('submit-password-reset-request', data),
  checkResetRequestStatus: (data) => ipcRenderer.invoke('check-reset-request-status', data),
  checkUserSetup: () => ipcRenderer.invoke('check-user-setup'),
  setupInitialAdmin: (data) => ipcRenderer.invoke('setup-initial-admin', data),
  updatePassword: (username, oldPassword, newPassword) => ipcRenderer.invoke('update-password', { username, oldPassword, newPassword }),
  updateUserProfile: (data) => ipcRenderer.invoke('update-user-profile', data),
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (userData) => ipcRenderer.invoke('add-user', userData),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
  updateUserPermissions: (id, permissions) => ipcRenderer.invoke('update-user-permissions', { id, permissions }),
  setActiveUser: (userPayload) => ipcRenderer.invoke('set-active-user', userPayload),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settingsObj) => ipcRenderer.invoke('save-settings', settingsObj),
  unenrollStudentFromCourse: (studentId, courseId) => ipcRenderer.invoke('unenroll-student-from-course', { studentId, courseId }),
  getChartData: () => ipcRenderer.invoke('get-chart-data'),
  printPdf: (html, filename, pageSize, landscape) => ipcRenderer.invoke('print-pdf', { html, filename, pageSize, landscape }),
  printWeb: (html, pageSize, landscape) => ipcRenderer.invoke('print-web', { html, pageSize, landscape }),
  getTeacherPayments: () => ipcRenderer.invoke('get-teacher-payments'),
  addTeacherPayment: (paymentData) => ipcRenderer.invoke('add-teacher-payment', paymentData),
  deleteTeacherPayment: (id) => ipcRenderer.invoke('delete-teacher-payment', id),
  getAbsences: (filters) => ipcRenderer.invoke('get-absences', filters),
  addAbsence: (absenceData) => ipcRenderer.invoke('add-absence', absenceData),
  updateAbsence: (id, absenceData) => ipcRenderer.invoke('update-absence', { id, absenceData }),
  deleteAbsence: (id) => ipcRenderer.invoke('delete-absence', id),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  wipeDatabase: () => ipcRenderer.invoke('wipe-database'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  deleteScheduleRequest: (id) => ipcRenderer.invoke('delete-schedule-request', id),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  getGlobalNotification: () => ipcRenderer.invoke('get-global-notification'),
  activateLicense: (keyStr) => ipcRenderer.invoke('activate-license', keyStr),
  confirmLicenseActivation: (keyStr, wipeData) => ipcRenderer.invoke('confirm-license-activation', { keyStr, wipeData }),
  getGrades: (studentId) => ipcRenderer.invoke('get-grades', studentId),
  addGrade: (gradeData) => ipcRenderer.invoke('add-grade', gradeData),
  deleteGrade: (id) => ipcRenderer.invoke('delete-grade', id),
  testSMTP: (config) => ipcRenderer.invoke('test-smtp', config),
  sendEmail: (params) => ipcRenderer.invoke('send-email', params),
  sendBulkEmails: (params) => ipcRenderer.invoke('send-bulk-emails', params),
  selectAttachmentFile: () => ipcRenderer.invoke('select-attachment-file'),
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  saveTemplate: (template) => ipcRenderer.invoke('save-template', template),
  deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  resizeToLogin: () => ipcRenderer.send('resize-to-login'),
  resizeToMain: () => ipcRenderer.send('resize-to-main'),
  showConfirmDialog: (message) => ipcRenderer.sendSync('show-confirm-dialog', message),
  showAlertDialog: (message) => ipcRenderer.sendSync('show-alert-dialog', message)
}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
