const api = window.api || {};

export const ipcService = {
  // Students
  getStudents: () => api.getStudents ? api.getStudents() : Promise.resolve([]),
  addStudent: (data) => api.addStudent ? api.addStudent(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateStudent: (id, data) => api.updateStudent ? api.updateStudent(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteStudent: (id) => api.deleteStudent ? api.deleteStudent(id) : Promise.resolve({ error: 'IPC Offline' }),
  bulkImportStudents: (studentsList) => api.bulkImportStudents ? api.bulkImportStudents(studentsList) : Promise.resolve({ error: 'IPC Offline' }),
  bulkImportTeachers: (teachersList) => api.bulkImportTeachers ? api.bulkImportTeachers(teachersList) : Promise.resolve({ error: 'IPC Offline' }),
  enrollStudentInCourse: (studentId, courseId, enrollmentDate) => 
    api.enrollStudentInCourse ? api.enrollStudentInCourse(studentId, courseId, enrollmentDate) : Promise.resolve({ error: 'IPC Offline' }),
  getStudentCourses: (studentId) => api.getStudentCourses ? api.getStudentCourses(studentId) : Promise.resolve([]),
  getCourseStudents: (courseId) => api.getCourseStudents ? api.getCourseStudents(courseId) : Promise.resolve([]),
  unenrollStudentFromCourse: (studentId, courseId) => 
    api.unenrollStudentFromCourse ? api.unenrollStudentFromCourse(studentId, courseId) : Promise.resolve({ error: 'IPC Offline' }),

  // Teachers
  getTeachers: () => api.getTeachers ? api.getTeachers() : Promise.resolve([]),
  addTeacher: (data) => api.addTeacher ? api.addTeacher(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateTeacher: (id, data) => api.updateTeacher ? api.updateTeacher(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteTeacher: (id) => api.deleteTeacher ? api.deleteTeacher(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Courses
  getCourses: () => api.getCourses ? api.getCourses() : Promise.resolve([]),
  addCourse: (data) => api.addCourse ? api.addCourse(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateCourse: (id, data) => api.updateCourse ? api.updateCourse(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteCourse: (id) => api.deleteCourse ? api.deleteCourse(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Payments (Student Tuition)
  getPayments: () => api.getPayments ? api.getPayments() : Promise.resolve([]),
  addPayment: (data) => api.addPayment ? api.addPayment(data) : Promise.resolve({ error: 'IPC Offline' }),
  updatePayment: (id, data) => api.updatePayment ? api.updatePayment(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deletePayment: (id) => api.deletePayment ? api.deletePayment(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Teacher Payments (Salary/Payout)
  getTeacherPayments: () => api.getTeacherPayments ? api.getTeacherPayments() : Promise.resolve([]),
  addTeacherPayment: (data) => api.addTeacherPayment ? api.addTeacherPayment(data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteTeacherPayment: (id) => api.deleteTeacherPayment ? api.deleteTeacherPayment(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Expenses
  getExpenses: () => api.getExpenses ? api.getExpenses() : Promise.resolve([]),
  addExpense: (data) => api.addExpense ? api.addExpense(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateExpense: (id, data) => api.updateExpense ? api.updateExpense(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteExpense: (id) => api.deleteExpense ? api.deleteExpense(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Dashboard & Financial Summary
  getFinancialSummary: () => api.getFinancialSummary ? api.getFinancialSummary() : Promise.resolve({ totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' }),
  getChartData: () => api.getChartData ? api.getChartData() : Promise.resolve(null),

  // Schedules & Weekly Timetable
  getSchedules: () => api.getSchedules ? api.getSchedules() : Promise.resolve([]),
  addSchedule: (data) => api.addSchedule ? api.addSchedule(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateSchedule: (id, data) => api.updateSchedule ? api.updateSchedule(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteSchedule: (id) => api.deleteSchedule ? api.deleteSchedule(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Schedule Requests
  getScheduleRequests: () => api.getScheduleRequests ? api.getScheduleRequests() : Promise.resolve([]),
  addScheduleRequest: (data) => api.addScheduleRequest ? api.addScheduleRequest(data) : Promise.resolve({ error: 'IPC Offline' }),
  resolveScheduleRequest: (id, decision) => api.resolveScheduleRequest ? api.resolveScheduleRequest(id, decision) : Promise.resolve({ error: 'IPC Offline' }),
  deleteScheduleRequest: (id) => api.deleteScheduleRequest ? api.deleteScheduleRequest(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Attendance & Absences
  getAbsences: (filters) => api.getAbsences ? api.getAbsences(filters) : Promise.resolve([]),
  addAbsence: (data) => api.addAbsence ? api.addAbsence(data) : Promise.resolve({ error: 'IPC Offline' }),
  updateAbsence: (id, data) => api.updateAbsence ? api.updateAbsence(id, data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteAbsence: (id) => api.deleteAbsence ? api.deleteAbsence(id) : Promise.resolve({ error: 'IPC Offline' }),

  // Settings & Db Management
  getSettings: () => api.getSettings ? api.getSettings() : Promise.resolve({}),
  saveSettings: (settingsObj) => api.saveSettings ? api.saveSettings(settingsObj) : Promise.resolve({ error: 'IPC Offline' }),
  getDbPath: () => api.getDbPath ? api.getDbPath() : Promise.resolve(''),
  exportData: () => api.exportData ? api.exportData() : Promise.resolve({ error: 'IPC Offline' }),
  importData: () => api.importData ? api.importData() : Promise.resolve({ error: 'IPC Offline' }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0 }),
  wipeDatabase: () => api.wipeDatabase ? api.wipeDatabase() : Promise.resolve({ error: 'IPC Offline' }),
  relaunchApp: () => api.relaunchApp ? api.relaunchApp() : undefined,
  checkLicense: () => api.checkLicense ? api.checkLicense() : Promise.resolve({ valid: false, reason: 'MOCK', error: 'IPC Offline' }),
  getGlobalNotification: () => api.getGlobalNotification ? api.getGlobalNotification() : Promise.resolve({ globalMessage: '', customMessage: '' }),
  activateLicense: (keyStr) => api.activateLicense ? api.activateLicense(keyStr) : Promise.resolve({ success: false, error: 'IPC Offline' }),
  confirmLicenseActivation: (keyStr, wipeData) => api.confirmLicenseActivation ? api.confirmLicenseActivation(keyStr, wipeData) : Promise.resolve({ success: false, error: 'IPC Offline' }),

  // Authentication
  login: (username, password) => api.login ? api.login(username, password) : Promise.resolve({ error: 'IPC Offline' }),
  updatePassword: (username, oldPassword, newPassword) => api.updatePassword ? api.updatePassword(username, oldPassword, newPassword) : Promise.resolve({ error: 'IPC Offline' }),
  updateUserProfile: (data) => api.updateUserProfile ? api.updateUserProfile(data) : Promise.resolve({ error: 'IPC Offline' }),
  getUsers: () => api.getUsers ? api.getUsers() : Promise.resolve([]),
  addUser: (userData) => api.addUser ? api.addUser(userData) : Promise.resolve({ error: 'IPC Offline' }),
  deleteUser: (id) => api.deleteUser ? api.deleteUser(id) : Promise.resolve({ error: 'IPC Offline' }),
  updateUserPermissions: (id, permissions) => api.updateUserPermissions ? api.updateUserPermissions(id, permissions) : Promise.resolve({ error: 'IPC Offline' }),
  setActiveUser: (userPayload) => api.setActiveUser ? api.setActiveUser(userPayload) : Promise.resolve({ error: 'IPC Offline' }),

  // PDF & Printing Services
  printPdf: (html, filename, pageSize, landscape) => 
    api.printPdf ? api.printPdf(html, filename, pageSize, landscape) : Promise.resolve({ error: 'IPC Offline' }),
  printWeb: (html, pageSize, landscape) => 
    api.printWeb ? api.printWeb(html, pageSize, landscape) : Promise.resolve({ error: 'IPC Offline' }),

  // Audit Logs
  getAuditLogs: (params) => api.getAuditLogs ? api.getAuditLogs(params) : Promise.resolve({ logs: [], total: 0, hasMore: false }),

  // Grades
  getGrades: (studentId) => api.getGrades ? api.getGrades(studentId) : Promise.resolve([]),
  addGrade: (data) => api.addGrade ? api.addGrade(data) : Promise.resolve({ error: 'IPC Offline' }),
  deleteGrade: (id) => api.deleteGrade ? api.deleteGrade(id) : Promise.resolve({ error: 'IPC Offline' }),
  
  // Email Communication
  testSMTP: (config) => api.testSMTP ? api.testSMTP(config) : Promise.resolve({ success: false, error: 'IPC Offline' }),
  sendEmail: (params) => api.sendEmail ? api.sendEmail(params) : Promise.resolve({ success: false, error: 'IPC Offline' }),
  sendBulkEmails: (params) => api.sendBulkEmails ? api.sendBulkEmails(params) : Promise.resolve({ success: false, error: 'IPC Offline' }),
  selectAttachmentFile: () => api.selectAttachmentFile ? api.selectAttachmentFile() : Promise.resolve(null),
  getTemplates: () => api.getTemplates ? api.getTemplates() : Promise.resolve([]),
  saveTemplate: (template) => api.saveTemplate ? api.saveTemplate(template) : Promise.resolve({ success: false, error: 'IPC Offline' }),
  deleteTemplate: (id) => api.deleteTemplate ? api.deleteTemplate(id) : Promise.resolve({ success: false, error: 'IPC Offline' }),

  // Custom Window Controls
  minimizeWindow: () => api.minimizeWindow ? api.minimizeWindow() : undefined,
  maximizeWindow: () => api.maximizeWindow ? api.maximizeWindow() : undefined,
  closeWindow: () => api.closeWindow ? api.closeWindow() : undefined
};
