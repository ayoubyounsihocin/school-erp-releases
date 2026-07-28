import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

import icon from '../../resources/icon.png?asset'
import { sequelize, User, Student, Payment, Expense, Course, Teacher, AuditLog, Schedule, ScheduleRequest, SystemSetting, TeacherPayment, StudentCourses, Absence, Grade, EmailTemplate } from './database/models.js'; // Good job adding this!
import { checkLicenseStatus, activateLicense, confirmActivationAndWipe, initMachineId, getMachineHardwareId } from './license.js';
import { testSMTPConnection, sendEmail, sendBulkEmails } from './emailService.js';
import { Op } from 'sequelize';
import crypto from 'crypto';

// --- Password Hashing Helpers (scrypt with legacy SHA-256 fallback) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || typeof password !== 'string') return false;
  if (!storedHash.includes(':')) {
    // Legacy SHA-256 fallback
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    const b1 = Buffer.from(legacyHash, 'utf8');
    const b2 = Buffer.from(storedHash, 'utf8');
    if (b1.length !== b2.length) return false;
    return crypto.timingSafeEqual(b1, b2);
  }
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  const b1 = Buffer.from(derivedKey, 'hex');
  const b2 = Buffer.from(key, 'hex');
  if (b1.length !== b2.length) return false;
  return crypto.timingSafeEqual(b1, b2);
}

// In-memory brute force protection: username/IP -> { count, lockUntil }
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 5 * 60 * 1000; // 5 minutes lockout



let currentSessionUser = null;

function hasPermission(moduleKey) {
  if (!currentSessionUser) return false;
  if (currentSessionUser.role === 'Admin') return true;
  const perms = currentSessionUser.permissions || '';
  const permsArr = perms.split(',').map(s => s.trim());
  if (permsArr.includes(moduleKey)) return true;
  if (permsArr.some(p => p.startsWith(moduleKey + ':'))) return true;
  return false;
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 480,
    height: 540,
    show: false,
    frame: false, // Make window frameless
    transparent: false, // Make window background opaque
    backgroundColor: '#000000', // Black background matching dark mode theme
    hasShadow: true, // Keep OS window shadow
    autoHideMenuBar: true,
    resizable: false, // Start as non-resizable for login
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Register maximize/unmaximize events to keep renderer in sync
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-state', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-state', false);
  });

  // IPC handlers for custom window controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('change-window-theme', (event, theme) => {
    if (mainWindow) {
      const bgColor = theme === 'light' ? '#f8fafc' : '#000000';
      mainWindow.setBackgroundColor(bgColor);
    }
  });

  ipcMain.on('show-alert-dialog', (event, message) => {
    const isAr = /[\u0600-\u06FF]/.test(message);
    dialog.showMessageBoxSync(mainWindow || null, {
      type: 'info',
      title: isAr ? 'تنبيه النظام' : 'System Alert',
      message: String(message),
      buttons: [isAr ? 'موافق' : 'OK'],
      noLink: true
    });
    event.returnValue = null;
  });

  ipcMain.on('show-confirm-dialog', (event, message) => {
    const isAr = /[\u0600-\u06FF]/.test(message);
    const response = dialog.showMessageBoxSync(mainWindow || null, {
      type: 'question',
      title: isAr ? 'تأكيد الإجراء' : 'Confirm Action',
      message: String(message),
      buttons: isAr ? ['موافق', 'إلغاء'] : ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    event.returnValue = response === 0;
  });

  ipcMain.on('resize-to-login', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(480, 540);
      mainWindow.setMaximumSize(480, 540);
      mainWindow.setSize(480, 540);
      mainWindow.setResizable(false);
      mainWindow.center();
    }
  });

  ipcMain.on('resize-to-main', () => {
    if (mainWindow) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(1024, 768);
      // Setting 0, 0 completely removes any maximum size restriction,
      // allowing the user to freely resize the window on any screen.
      mainWindow.setMaximumSize(0, 0);
      mainWindow.setSize(1280, 800);
      mainWindow.center();
      
      // Use a short timeout to let the OS register the 1280x800 bounds
      // as the "restored" size before maximizing the window.
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.maximize();
        }
      }, 150);
    }
  });



  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('focus', () => {
    mainWindow.webContents.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Redirect renderer logs to main terminal and local debug file
  const logFile = join(app.getPath('userData'), 'production_debug.log');
  try {
    if (!fs.existsSync(app.getPath('userData'))) {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
    }
  } catch(e) {}

  mainWindow.webContents.on('console-message', (event, ...args) => {
    let level, message, line, sourceId;
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      // Modern Electron (event, details)
      const details = args[0];
      level = details.level;
      message = details.message;
      line = details.line;
      sourceId = details.sourceId;
    } else {
      // Legacy Electron (event, level, message, line, sourceId)
      level = args[0];
      message = args[1];
      line = args[2];
      sourceId = args[3];
    }

    const logLine = `[RENDERER] [Level ${level}] ${message} (at ${sourceId}:${line})\n`;
    try {
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch(e) {}
    console.log(`[RENDERER CONSOLE] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // Open DevTools in development mode only
  if (is.dev) {
    mainWindow.webContents.openDevTools();
  }
}



// Notice we added 'async' here 👇
app.whenReady().then(async () => {
  // Initialize motherboard hardware UUID asynchronously
  await initMachineId();

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // ========================================================
  // 🚀 THIS IS WHERE THE DATABASE SYNC HAPPENS
  // It ensures tables exist before the window is shown.
  // ========================================================
  try {
    await sequelize.query('PRAGMA foreign_keys = OFF;');

    // Migration: Check if StudentCourses has incorrect UNIQUE constraints
    const [tableInfo] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='StudentCourses';");
    if (tableInfo && tableInfo[0]) {
      const sql = tableInfo[0].sql;
      if (sql.includes('UNIQUE')) {
        console.log("⚠️ StudentCourses table has incorrect UNIQUE constraints. Migrating...");
        const [existingData] = await sequelize.query("SELECT * FROM StudentCourses;");
        await sequelize.query("DROP TABLE StudentCourses;");
        const createTableSql = "CREATE TABLE `StudentCourses` (`createdAt` DATETIME, `StudentId` INTEGER NOT NULL REFERENCES `Students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, `CourseId` INTEGER NOT NULL REFERENCES `Courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY (`StudentId`, `CourseId`));";
        await sequelize.query(createTableSql);
        for (const row of existingData) {
          await sequelize.query(
            "INSERT OR IGNORE INTO StudentCourses (StudentId, CourseId, createdAt) VALUES (?, ?, ?);",
            { replacements: [row.StudentId, row.CourseId, row.createdAt] }
          );
        }
        console.log("✅ StudentCourses table migrated successfully!");
      }
    }

    // Migrate missing columns on Students table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Students';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(Students);");
        const columns = results.map(r => r.name);
        if (!columns.includes('email')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN email TEXT;");
          console.log("Migrated: Added email column to Students table.");
        }
        if (!columns.includes('parent_email')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN parent_email TEXT;");
          console.log("Migrated: Added parent_email column to Students table.");
        }
        if (!columns.includes('parent_phone')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN parent_phone TEXT;");
          console.log("Migrated: Added parent_phone column to Students table.");
        }
        if (!columns.includes('status')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN status TEXT DEFAULT 'Active';");
          console.log("Migrated: Added status column to Students table.");
        }
        if (!columns.includes('grade_level')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN grade_level TEXT DEFAULT 'Primary';");
          console.log("Migrated: Added grade_level column to Students table.");
        }
        if (!columns.includes('date_of_birth')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN date_of_birth TEXT;");
          console.log("Migrated: Added date_of_birth column to Students table.");
        }
        if (!columns.includes('status_date')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN status_date TEXT;");
          console.log("Migrated: Added status_date column to Students table.");
        }
        if (!columns.includes('extra_info')) {
          await sequelize.query("ALTER TABLE Students ADD COLUMN extra_info TEXT;");
          console.log("Migrated: Added extra_info column to Students table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run Students table migrations:", migError);
    }

    // Migrate missing columns on Teachers table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Teachers';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(Teachers);");
        const columns = results.map(r => r.name);
        if (!columns.includes('email')) {
          await sequelize.query("ALTER TABLE Teachers ADD COLUMN email TEXT;");
          console.log("Migrated: Added email column to Teachers table.");
        }
        if (!columns.includes('specialty')) {
          await sequelize.query("ALTER TABLE Teachers ADD COLUMN specialty TEXT;");
          console.log("Migrated: Added specialty column to Teachers table.");
        }
        if (!columns.includes('status')) {
          await sequelize.query("ALTER TABLE Teachers ADD COLUMN status TEXT DEFAULT 'Active';");
          console.log("Migrated: Added status column to Teachers table.");
        }
        if (!columns.includes('absence_penalty_rate')) {
          await sequelize.query("ALTER TABLE Teachers ADD COLUMN absence_penalty_rate REAL DEFAULT 1000.0;");
          console.log("Migrated: Added absence_penalty_rate column to Teachers table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run Teachers table migrations:", migError);
    }

    // Migrate missing columns on Users table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Users';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(Users);");
        const columns = results.map(r => r.name);
        if (!columns.includes('avatar')) {
          await sequelize.query("ALTER TABLE Users ADD COLUMN avatar TEXT;");
          console.log("Migrated: Added avatar column to Users table.");
        }
        if (!columns.includes('permissions')) {
          await sequelize.query("ALTER TABLE Users ADD COLUMN permissions TEXT;");
          console.log("Migrated: Added permissions column to Users table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run Users table migrations:", migError);
    }

    // Migrate missing columns on AuditLogs table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLogs';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(AuditLogs);");
        const columns = results.map(r => r.name);
        if (!columns.includes('target_user_id')) {
          await sequelize.query("ALTER TABLE AuditLogs ADD COLUMN target_user_id INTEGER;");
          console.log("Migrated: Added target_user_id column to AuditLogs table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run AuditLogs table migrations:", migError);
    }

    // Migrate missing columns on Absences table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Absences';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(Absences);");
        const columns = results.map(r => r.name);
        if (!columns.includes('substitute_teacher_id')) {
          await sequelize.query("ALTER TABLE Absences ADD COLUMN substitute_teacher_id INTEGER;");
          console.log("Migrated: Added substitute_teacher_id column to Absences table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run Absences table migrations:", migError);
    }

    // Migrate missing columns on TeacherPayments table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='TeacherPayments';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(TeacherPayments);");
        const columns = results.map(r => r.name);
        if (!columns.includes('substitutions_count')) {
          await sequelize.query("ALTER TABLE TeacherPayments ADD COLUMN substitutions_count INTEGER DEFAULT 0;");
          console.log("Migrated: Added substitutions_count column to TeacherPayments table.");
        }
        if (!columns.includes('substitutions_credit')) {
          await sequelize.query("ALTER TABLE TeacherPayments ADD COLUMN substitutions_credit REAL DEFAULT 0.0;");
          console.log("Migrated: Added substitutions_credit column to TeacherPayments table.");
        }
        if (!columns.includes('absences_count')) {
          await sequelize.query("ALTER TABLE TeacherPayments ADD COLUMN absences_count INTEGER DEFAULT 0;");
          console.log("Migrated: Added absences_count column to TeacherPayments table.");
        }
        if (!columns.includes('absences_deduction')) {
          await sequelize.query("ALTER TABLE TeacherPayments ADD COLUMN absences_deduction REAL DEFAULT 0.0;");
          console.log("Migrated: Added absences_deduction column to TeacherPayments table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run TeacherPayments table migrations:", migError);
    }



    // Migrate missing columns on Courses table to prevent SQL query failures
    try {
      const [tableCheck] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Courses';");
      if (tableCheck.length > 0) {
        const [results] = await sequelize.query("PRAGMA table_info(Courses);");
        const columns = results.map(r => r.name);
        if (!columns.includes('has_exam')) {
          await sequelize.query("ALTER TABLE Courses ADD COLUMN has_exam INTEGER DEFAULT 0;");
          console.log("Migrated: Added has_exam column to Courses table.");
        }
        if (!columns.includes('payout_type')) {
          await sequelize.query("ALTER TABLE Courses ADD COLUMN payout_type TEXT DEFAULT 'Percentage';");
          console.log("Migrated: Added payout_type column to Courses table.");
        }
        if (!columns.includes('fixed_payout_amount')) {
          await sequelize.query("ALTER TABLE Courses ADD COLUMN fixed_payout_amount REAL DEFAULT 0.0;");
          console.log("Migrated: Added fixed_payout_amount column to Courses table.");
        }
      }
    } catch (migError) {
      console.error("Failed to run Courses table migrations:", migError);
    }


    await sequelize.sync();
    await sequelize.query('PRAGMA foreign_keys = ON;');
    console.log("✅ Database synced successfully!");
    
    // Check if initial admin user setup is needed (Prompt user to set custom username & password on first launch)
    const userCount = await User.count();
    if (userCount === 0) {
      console.log("🌱 No admin user found. Initial setup prompt active on login screen.");
    }

    // Seed default system settings if none exist
    const settingCount = await SystemSetting.count();
    if (settingCount === 0) {
      console.log("🌱 Seeding default system settings...");
      await SystemSetting.bulkCreate([
        { key: 'school_name', value: 'School Name' },
        { key: 'academic_year', value: '2026-2027' },
        { key: 'default_receptionist_permissions', value: 'dashboard,students,attendance' }
      ]);
    } else {
      // Safety check for individual missing settings
      const defaultPerms = await SystemSetting.findOne({ where: { key: 'default_receptionist_permissions' } });
      if (!defaultPerms) {
        await SystemSetting.create({ key: 'default_receptionist_permissions', value: 'dashboard,students,attendance' });
      }
    }



    await checkLicenseStatus();
  } catch (error) {
    console.error("❌ Failed to sync database:", error);
  }

  // ========================================================
  // 🔑 LICENSING IPC HANDLERS
  // ========================================================
  ipcMain.handle('check-license', async () => {
    return await checkLicenseStatus();
  });

  ipcMain.handle('activate-license', async (event, keyStr) => {
    return await activateLicense(keyStr);
  });

  ipcMain.handle('confirm-license-activation', async (event, { keyStr, wipeData }) => {
    return await confirmActivationAndWipe(keyStr, wipeData);
  });

  ipcMain.handle('get-global-notification', async () => {
    try {
      // 1. Fetch the targeted custom message saved locally in database
      const customMsgSetting = await SystemSetting.findOne({ where: { key: 'license_custom_message' } });
      const customMessage = customMsgSetting ? customMsgSetting.value : '';

      // 2. Fetch the global notification from your website
      const response = await fetch('https://ayoubyounsihocine.online/api/notifications', {
        headers: { 'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999' },
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        return {
          globalMessage: data.message || data.globalMessage || '',
          customMessage: customMessage
        };
      }
      return { globalMessage: '', customMessage: customMessage };
    } catch (e) {
      console.log("Failed to fetch global notifications:", e.message);
      // Fallback: return any saved custom message
      try {
        const customMsgSetting = await SystemSetting.findOne({ where: { key: 'license_custom_message' } });
        return { globalMessage: '', customMessage: customMsgSetting ? customMsgSetting.value : '' };
      } catch (err) {
        return { globalMessage: '', customMessage: '' };
      }
    }
  });

  // ========================================================
  // 📝 GRADES & EXAMINATIONS IPC HANDLERS
  // ========================================================
  ipcMain.handle('get-grades', async (event, studentId) => {
    try {
      const grades = await Grade.findAll({
        where: studentId ? { StudentId: studentId } : {},
        include: [
          { model: Course, attributes: ['id', 'title'] },
          { model: Student, attributes: ['id', 'full_name'] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return grades.map(g => g.toJSON());
    } catch (error) {
      console.error("Error fetching grades:", error);
      return [];
    }
  });

  ipcMain.handle('add-grade', async (event, gradeData) => {
    try {
      const { StudentId, CourseId, exam_name, score, max_score, coefficient, date, remarks } = gradeData;
      const newGrade = await Grade.create({
        StudentId,
        CourseId,
        exam_name,
        score,
        max_score: max_score || 20,
        coefficient: coefficient || 1,
        date,
        remarks
      });
      await AuditLog.create({
        action: 'ADD_GRADE',
        description: `Recorded grade ${score}/${max_score} for Student ID ${StudentId} in Course ID ${CourseId}.`
      });
      return newGrade.toJSON();
    } catch (error) {
      console.error("Error adding grade:", error);
      return { error: "Failed to add grade" };
    }
  });

  ipcMain.handle('delete-grade', async (event, id) => {
    try {
      const grade = await Grade.findByPk(id);
      if (!grade) return { error: "Grade not found" };
      const studentId = grade.StudentId;
      await grade.destroy();
      await AuditLog.create({
        action: 'DELETE_GRADE',
        description: `Deleted grade ID ${id} for Student ID ${studentId}.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting grade:", error);
      return { error: "Failed to delete grade" };
    }
  });

  // ========================================================
  ipcMain.handle('get-students', async () => {
    try {
      // Fetch all students from the database along with their enrolled courses, payments, and absences
      const students = await Student.findAll({
        include: [
          {
            model: Course,
            through: { attributes: ['createdAt'] },
            include: [{ model: Schedule }]
          },
          {
            model: Payment,
            include: [{ model: Course, attributes: ['id', 'title', 'price'] }]
          },
          {
            model: Absence
          }
        ]
      });
      return students.map(student => student.toJSON()); 
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  }); 

  ipcMain.handle('add-student', async (event, studentData) => {
    try {
      const newStudent = await Student.create(studentData);
      await AuditLog.create({
        action: 'ADD_STUDENT',
        description: `Registered new student '${newStudent.full_name}' with status '${newStudent.status}'.`
      });
      return newStudent.toJSON();
    } catch (error) {
      console.error("Error adding student:", error);
      return { error: error.message || "Failed to add student" };
    }
  });

  ipcMain.handle('update-student', async (event, { id, studentData }) => {
    try {
      const student = await Student.findByPk(id);
      if (!student) return { error: "Student not found" };
      const oldName = student.full_name;
      await student.update(studentData);
      await AuditLog.create({
        action: 'UPDATE_STUDENT',
        description: `Updated student details for '${oldName}' (now: '${student.full_name}').`
      });
      return student.toJSON();
    } catch (error) {
      console.error("Error updating student:", error);
      return { error: error.message || "Failed to update student" };
    }
  });

  ipcMain.handle('delete-student', async (event, id) => {
    try {
      const student = await Student.findByPk(id);
      if (!student) return { error: "Student not found" };
      
      // Safeguard: block deletion if student has payment records
      const paymentCount = await Payment.count({ where: { StudentId: id } });
      if (paymentCount > 0) {
        return { error: "Cannot delete student because they have registered payments. Please change their status to 'Dropped' or 'Graduated' instead to preserve financial records." };
      }
      
      // Cascade delete student absences and enrollments
      await Absence.destroy({ where: { StudentId: id } });
      await StudentCourses.destroy({ where: { StudentId: id } });
 
      const name = student.full_name;
      await student.destroy();
      await AuditLog.create({
        action: 'DELETE_STUDENT',
        description: `Deleted student profile for '${name}'. Cascade removed all associated enrollment and attendance records.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting student:", error);
      return { error: "Failed to delete student" };
    }
  });

  ipcMain.handle('bulk-import-students', async (event, studentsList) => {
    try {
      if (!Array.isArray(studentsList)) {
        return { error: "Invalid data format. Expected an array of students." };
      }
      
      let importedCount = 0;
      let skippedCount = 0;
      
      await sequelize.transaction(async (t) => {
        for (const s of studentsList) {
          if (!s.full_name || !s.full_name.trim()) {
            skippedCount++;
            continue;
          }
          
          const whereClause = {
            full_name: s.full_name.trim()
          };
          if (s.phone && s.phone.trim()) {
            whereClause.phone = s.phone.trim();
          } else if (s.parent_phone && s.parent_phone.trim()) {
            whereClause.parent_phone = s.parent_phone.trim();
          }
          
          const existing = await Student.findOne({ where: whereClause, transaction: t });
          if (existing) {
            skippedCount++;
            continue;
          }
          
          await Student.create({
            full_name: s.full_name.trim(),
            phone: s.phone ? s.phone.trim() : null,
            email: s.email ? s.email.trim() : null,
            parent_phone: s.parent_phone ? s.parent_phone.trim() : null,
            parent_email: s.parent_email ? s.parent_email.trim() : null,
            status: 'Active',
            grade_level: s.grade_level ? s.grade_level.trim() : 'Primary',
            date_of_birth: s.date_of_birth ? s.date_of_birth.trim() : null,
            extra_info: s.extra_info ? JSON.stringify(s.extra_info) : null
          }, { transaction: t });
          importedCount++;
        }
      });
      
      await AuditLog.create({
        action: 'BULK_IMPORT_STUDENTS',
        description: `Successfully imported ${importedCount} student profiles via CSV. Skipped ${skippedCount} duplicates/invalid rows.`
      });
      
      return { success: true, count: importedCount, skipped: skippedCount };
    } catch (error) {
      console.error("Error bulk importing students:", error);
      return { error: error.message || "Failed to bulk import students" };
    }
  });

  ipcMain.handle('bulk-import-teachers', async (event, teachersList) => {
    try {
      if (!Array.isArray(teachersList)) {
        return { error: "Invalid data format. Expected an array of teachers." };
      }
      
      let importedCount = 0;
      let skippedCount = 0;
      
      await sequelize.transaction(async (t) => {
        for (const teacher of teachersList) {
          if (!teacher.full_name || !teacher.full_name.trim()) {
            skippedCount++;
            continue;
          }
          
          const whereClause = {
            full_name: teacher.full_name.trim()
          };
          if (teacher.phone && teacher.phone.trim()) {
            whereClause.phone = teacher.phone.trim();
          }
          if (teacher.email && teacher.email.trim()) {
            whereClause.email = teacher.email.trim();
          }
          
          const existing = await Teacher.findOne({ where: whereClause, transaction: t });
          if (existing) {
            skippedCount++;
            continue;
          }
          
          await Teacher.create({
            full_name: teacher.full_name.trim(),
            phone: teacher.phone ? teacher.phone.trim() : null,
            email: teacher.email ? teacher.email.trim() : null,
            specialty: teacher.specialty ? teacher.specialty.trim() : 'General',
            status: 'Active',
            absence_penalty_rate: teacher.absence_penalty_rate ? parseFloat(teacher.absence_penalty_rate) : 1000.0
          }, { transaction: t });
          importedCount++;
        }
      });
      
      await AuditLog.create({
        action: 'BULK_IMPORT_TEACHERS',
        description: `Successfully imported ${importedCount} teacher profiles via CSV. Skipped ${skippedCount} duplicates/invalid rows.`
      });
      
      return { success: true, count: importedCount, skipped: skippedCount };
    } catch (error) {
      console.error("Error bulk importing teachers:", error);
      return { error: error.message || "Failed to import teachers." };
    }
  });

  ipcMain.handle('get-payments', async () => {
    if (!hasPermission('finances')) return [];
    try {
      const payments = await Payment.findAll({
        include: [
          {
            model: Student,
            attributes: ['full_name']
          },
          {
            model: Course,
            attributes: ['id', 'title', 'price']
          }
        ],
        order: [['date', 'DESC']]
      });
      return payments.map(p => p.toJSON());
    } catch (error) {
      console.error("Error fetching payments:", error);
      return [];
    }
  });

  ipcMain.handle('add-payment', async (event, paymentData) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      // Validate that the student actually exists before creating the payment
      const student = await Student.findByPk(paymentData.StudentId);
      if (!student) {
        return { error: `Student with ID ${paymentData.StudentId} not found. Payment was not recorded.` };
      }
      
      // Validate receipt number uniqueness
      if (paymentData.receipt_number) {
        const existingPayment = await Payment.findOne({ where: { receipt_number: paymentData.receipt_number } });
        if (existingPayment) {
          return { error: `Receipt number '${paymentData.receipt_number}' is already in use. Please generate a new receipt number.` };
        }
      }

      const newPayment = await Payment.create(paymentData);
      await AuditLog.create({
        action: 'RECORD_PAYMENT',
        description: `Recorded tuition payment of ${newPayment.amount.toFixed(2)} DA from student '${student.full_name}' (Receipt: ${newPayment.receipt_number}).`
      });
      return newPayment.toJSON();
    } catch (error) {
      console.error("Error adding payment:", error);
      return { error: "Failed to add payment" };
    }
  });

  ipcMain.handle('get-expenses', async () => {
    if (!hasPermission('finances')) return [];
    try {
      const expenses = await Expense.findAll({
        order: [['date', 'DESC']]
      });
      return expenses.map(e => e.toJSON());
    } catch (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }
  });

  ipcMain.handle('add-expense', async (event, expenseData) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const newExpense = await Expense.create(expenseData);
      await AuditLog.create({
        action: 'RECORD_EXPENSE',
        description: `Recorded operational expense of ${newExpense.amount.toFixed(2)} DA for '${newExpense.category}' (Desc: ${newExpense.description}).`
      });
      return newExpense.toJSON();
    } catch (error) {
      console.error("Error adding expense:", error);
      return { error: "Failed to add expense" };
    }
  });

  ipcMain.handle('delete-payment', async (event, id) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const payment = await Payment.findByPk(id);
      if (!payment) return { error: 'Payment not found' };
      const student = await Student.findByPk(payment.StudentId);
      const receipt = payment.receipt_number;
      await payment.destroy();
      await AuditLog.create({
        action: 'DELETE_PAYMENT',
        description: `Deleted payment record (Receipt: ${receipt}) for student '${student ? student.full_name : 'Unknown'}'.`
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting payment:', error);
      return { error: 'Failed to delete payment' };
    }
  });

  ipcMain.handle('update-payment', async (event, { id, paymentData }) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const payment = await Payment.findByPk(id);
      if (!payment) return { error: 'Payment not found' };

      // Validate receipt number uniqueness if it is changing
      if (paymentData.receipt_number && paymentData.receipt_number !== payment.receipt_number) {
        const existing = await Payment.findOne({ where: { receipt_number: paymentData.receipt_number } });
        if (existing) {
          return { error: `Receipt number '${paymentData.receipt_number}' is already in use. Please enter a unique receipt number.` };
        }
      }

      await payment.update(paymentData);
      const student = await Student.findByPk(payment.StudentId);
      await AuditLog.create({
        action: 'UPDATE_PAYMENT',
        description: `Updated payment (Receipt: ${payment.receipt_number}) — new amount ${payment.amount.toFixed(2)} DA for '${student ? student.full_name : 'Unknown'}'.`
      });
      return payment.toJSON();
    } catch (error) {
      console.error('Error updating payment:', error);
      return { error: 'Failed to update payment' };
    }
  });

  ipcMain.handle('delete-expense', async (event, id) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const expense = await Expense.findByPk(id);
      if (!expense) return { error: 'Expense not found' };
      const desc = expense.description;
      await expense.destroy();
      await AuditLog.create({
        action: 'DELETE_EXPENSE',
        description: `Deleted expense record '${desc}' (${expense.amount.toFixed(2)} DA).`
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting expense:', error);
      return { error: 'Failed to delete expense' };
    }
  });

  ipcMain.handle('update-expense', async (event, { id, expenseData }) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const expense = await Expense.findByPk(id);
      if (!expense) return { error: 'Expense not found' };
      await expense.update(expenseData);
      await AuditLog.create({
        action: 'UPDATE_EXPENSE',
        description: `Updated expense '${expense.description}' — new amount ${expense.amount.toFixed(2)} DA (${expense.category}).`
      });
      return expense.toJSON();
    } catch (error) {
      console.error('Error updating expense:', error);
      return { error: 'Failed to update expense' };
    }
  });

  ipcMain.handle('get-financial-summary', async () => {
    if (!hasPermission('finances')) {
      return { totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' };
    }
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const totalRevenue = Number(await Payment.sum('amount', {
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        }
      })) || 0;

      const totalExpenses = (Number(await Expense.sum('amount', {
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        }
      })) || 0) + (Number(await TeacherPayment.sum('amount', {
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        }
      })) || 0);

      return {
        totalRevenue,
        totalExpenses,
        netBalance: totalRevenue - totalExpenses,
        monthName: now.toLocaleString('en-US', { month: 'long' })
      };
    } catch (error) {
      console.error("Error calculating financial summary:", error);
      return { totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' };
    }
  });

  ipcMain.handle('get-courses', async () => {
    try {
      const courses = await Course.findAll({
        include: [
          {
            model: Teacher,
            attributes: ['id', 'full_name', 'specialty', 'createdAt']
          },
          {
            model: Student,
            where: { status: 'Active' },
            required: false,
            attributes: ['id', 'full_name', 'status'],
            through: { attributes: ['createdAt'] }
          },
          {
            model: Schedule
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      return courses.map(c => c.toJSON());
    } catch (error) {
      console.error("Error fetching courses with associations:", error);
      return [];
    }
  });

  ipcMain.handle('add-course', async (event, courseData) => {
    try {
      const newCourse = await Course.create(courseData);
      await AuditLog.create({
        action: 'ADD_COURSE',
        description: `Created new subject syllabus '${newCourse.title}' priced at ${newCourse.price.toFixed(2)} DA.`
      });
      return newCourse.toJSON();
    } catch (error) {
      console.error("Error adding course:", error);
      return { error: "Failed to add course" };
    }
  });

  ipcMain.handle('update-course', async (event, { id, courseData }) => {
    try {
      const course = await Course.findByPk(id);
      if (!course) return { error: "Course not found" };
      const oldTitle = course.title;
      await course.update(courseData);
      await AuditLog.create({
        action: 'UPDATE_COURSE',
        description: `Updated course details for '${oldTitle}' (now: '${course.title}').`
      });
      return course.toJSON();
    } catch (error) {
      console.error("Error updating course:", error);
      return { error: "Failed to update course" };
    }
  });

  ipcMain.handle('delete-course', async (event, id) => {
    try {
      const course = await Course.findByPk(id);
      if (!course) return { error: "Course not found" };
      
      // Safeguard: block deletion if course has payments or payouts
      const paymentCount = await Payment.count({ where: { CourseId: id } });
      const payoutCount = await TeacherPayment.count({ where: { CourseId: id } });
      if (paymentCount > 0 || payoutCount > 0) {
        return { error: "Cannot delete this course because it has registered student payments or instructor payouts. Please archive the course or dissociate its schedule instead to preserve financial records." };
      }
      
      // Cascade delete course schedules, absences, and enrollments
      await Schedule.destroy({ where: { CourseId: id } });
      await Absence.destroy({ where: { CourseId: id } });
      await StudentCourses.destroy({ where: { CourseId: id } });
 
      const title = course.title;
      await course.destroy();
      await AuditLog.create({
        action: 'DELETE_COURSE',
        description: `Deleted course syllabus '${title}'. Cascade removed all associated schedules, absences, and enrollments.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting course:", error);
      return { error: "Failed to delete course" };
    }
  });

  ipcMain.handle('get-teachers', async () => {
    try {
      const teachers = await Teacher.findAll({
        include: [
          {
            model: Course,
            attributes: ['id', 'title', 'price'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      return teachers.map(t => t.toJSON());
    } catch (error) {
      console.error("Error fetching teachers:", error);
      return [];
    }
  });

  ipcMain.handle('add-teacher', async (event, teacherData) => {
    try {
      const newTeacher = await Teacher.create(teacherData);
      await AuditLog.create({
        action: 'ADD_TEACHER',
        description: `Registered faculty instructor '${newTeacher.full_name}' for subject specialty '${newTeacher.specialty}'.`
      });
      return newTeacher.toJSON();
    } catch (error) {
      console.error("Error adding teacher:", error);
      return { error: error.message || "Failed to add teacher" };
    }
  });

  ipcMain.handle('update-teacher', async (event, { id, teacherData }) => {
    try {
      const teacher = await Teacher.findByPk(id);
      if (!teacher) return { error: "Teacher not found" };
      const oldName = teacher.full_name;
      await teacher.update(teacherData);
      await AuditLog.create({
        action: 'UPDATE_TEACHER',
        description: `Updated faculty details for instructor '${oldName}' (now: '${teacher.full_name}').`
      });
      return teacher.toJSON();
    } catch (error) {
      console.error("Error updating teacher:", error);
      return { error: error.message || "Failed to update teacher" };
    }
  });

  ipcMain.handle('get-teacher-payments', async () => {
    if (!hasPermission('finances')) return [];
    try {
      const payments = await TeacherPayment.findAll({
        include: [
          {
            model: Teacher,
            attributes: ['id', 'full_name', 'specialty']
          },
          {
            model: Course,
            attributes: ['id', 'title', 'price']
          }
        ],
        order: [['date', 'DESC']]
      });
      return payments.map(p => p.toJSON());
    } catch (error) {
      console.error("Error fetching teacher payments:", error);
      return [];
    }
  });

  ipcMain.handle('add-teacher-payment', async (event, paymentData) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const teacher = await Teacher.findByPk(paymentData.TeacherId);
      if (!teacher) {
        return { error: `Instructor not found.` };
      }
      
      // Validate receipt number uniqueness
      if (paymentData.receipt_number) {
        const existing = await TeacherPayment.findOne({ where: { receipt_number: paymentData.receipt_number } });
        if (existing) {
          return { error: `Receipt number '${paymentData.receipt_number}' is already in use.` };
        }
      }

      let courseTitle = '';
      if (paymentData.CourseId) {
        const course = await Course.findByPk(paymentData.CourseId);
        if (course) {
          courseTitle = ` for course '${course.title}'`;
        }
      }

      const newPayment = await TeacherPayment.create(paymentData);
      let subInfo = '';
      if (newPayment.substitutions_count > 0) {
        subInfo = ` (including ${newPayment.substitutions_count} substituted classes credited with ${newPayment.substitutions_credit.toFixed(2)} DA)`;
      }

      await AuditLog.create({
        action: 'RECORD_TEACHER_PAYMENT',
        description: `Disbursed monthly salary/payout of ${newPayment.amount.toFixed(2)} DA to instructor '${teacher.full_name}'${courseTitle} for term ${newPayment.month} ${newPayment.year} (Receipt: ${newPayment.receipt_number})${subInfo}.`
      });
      return newPayment.toJSON();
    } catch (error) {
      console.error("Error adding teacher payment:", error);
      return { error: "Failed to disburse payment" };
    }
  });

  ipcMain.handle('delete-teacher-payment', async (event, id) => {
    if (!hasPermission('finances')) return { error: "Access Denied: Financial permissions required." };
    try {
      const payment = await TeacherPayment.findByPk(id);
      if (!payment) return { error: 'Record not found' };
      const teacher = await Teacher.findByPk(payment.TeacherId);
      const receipt = payment.receipt_number;
      await payment.destroy();
      await AuditLog.create({
        action: 'DELETE_TEACHER_PAYMENT',
        description: `Deleted payout record (Receipt: ${receipt}) for instructor '${teacher ? teacher.full_name : 'Unknown'}'.`
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting teacher payment:', error);
      return { error: 'Failed to delete payment record' };
    }
  });

  ipcMain.handle('delete-teacher', async (event, id) => {
    try {
      const teacher = await Teacher.findByPk(id);
      if (!teacher) return { error: "Teacher not found" };
      
      // Safeguard: block deletion if teacher has payout records
      const payoutCount = await TeacherPayment.count({ where: { TeacherId: id } });
      if (payoutCount > 0) {
        return { error: "Cannot delete this teacher because they have registered payout records. Please mark them as 'Inactive' instead to preserve financial records." };
      }
      
      // Cascade delete teacher absences, and disassociate courses
      await Absence.destroy({ where: { TeacherId: id } });
      await Course.update({ TeacherId: null }, { where: { TeacherId: id } });
 
      const name = teacher.full_name;
      await teacher.destroy();
      await AuditLog.create({
        action: 'DELETE_TEACHER',
        description: `Deleted faculty profile for instructor '${name}'. Cascade removed all associated absences, and disassociated courses.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting teacher:", error);
      return { error: "Failed to delete teacher" };
    }
  });

  ipcMain.handle('enroll-student-in-course', async (event, { studentId, courseId, enrollmentDate }) => {
    try {
      const student = await Student.findByPk(studentId);
      const course = await Course.findByPk(courseId);
      if (!student || !course) {
        return { error: "Student or Course not found" };
      }
      
      const customDate = enrollmentDate ? new Date(enrollmentDate) : new Date();
      
      // Check if already enrolled
      const existing = await StudentCourses.findOne({ where: { StudentId: studentId, CourseId: courseId } });
      if (existing) {
        return { error: "Student is already enrolled in this course." };
      }
      
      await StudentCourses.create({
        StudentId: studentId,
        CourseId: courseId,
        createdAt: customDate
      });

      await AuditLog.create({
        action: 'ENROLL_STUDENT',
        description: `Enrolled student '${student.full_name}' in course subject '${course.title}'.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error enrolling student in course:", error);
      return { error: "Failed to enroll student" };
    }
  });

  ipcMain.handle('get-student-courses', async (event, studentId) => {
    try {
      const student = await Student.findByPk(studentId, {
        include: [{
          model: Course,
          include: [{
            model: Teacher,
            attributes: ['full_name']
          }]
        }]
      });
      if (!student) return [];
      return student.Courses.map(c => c.toJSON());
    } catch (error) {
      console.error("Error fetching student courses:", error);
      return [];
    }
  });

  ipcMain.handle('get-course-students', async (event, courseId) => {
    const debugLogPath = join(app.getPath('userData'), 'ipc_debug.log');
    try {
      fs.appendFileSync(debugLogPath, `[get-course-students] Called with courseId: ${courseId} (type: ${typeof courseId})\n`);
      const course = await Course.findByPk(courseId, {
        include: [{
          model: Student,
          where: { status: 'Active' },
          required: false,
          include: [
            {
              model: Payment,
              where: { CourseId: courseId },
              required: false
            },
            {
              model: Absence,
              where: { CourseId: courseId },
              required: false
            }
          ]
        }]
      });
      if (!course) {
        fs.appendFileSync(debugLogPath, `[get-course-students] Course not found for id: ${courseId}\n`);
        return [];
      }
      const studentsData = course.Students ? course.Students.map(s => s.toJSON()) : [];
      fs.appendFileSync(debugLogPath, `[get-course-students] Found ${studentsData.length} students\n`);
      return studentsData;
    } catch (error) {
      console.error("Error fetching course students:", error);
      try {
        fs.appendFileSync(debugLogPath, `[get-course-students] ERROR: ${error.stack || error.message || error}\n`);
      } catch (logErr) {
        console.error("Failed to write to ipc_debug.log:", logErr);
      }
      return [];
    }
  });
  ipcMain.handle('get-audit-logs', async (event, { limit = 200, offset = 0 } = {}) => {
    try {
      const { count, rows } = await AuditLog.findAndCountAll({
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [{ model: User, attributes: ['id', 'username', 'role', 'avatar'] }]
      });
      return {
        logs: rows.map(l => l.toJSON()),
        total: count,
        hasMore: offset + limit < count
      };
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return { logs: [], total: 0, hasMore: false };
    }
  });

  ipcMain.handle('get-db-path', async () => {
    try {
      return sequelize.options.storage || '';
    } catch (error) {
      console.error("Error fetching database path:", error);
      return '';
    }
  });

  // ==========================================
  // 📆 ACADEMIC SCHEDULING & REQUESTS IPC HANDLERS
  // ==========================================
  ipcMain.handle('get-schedules', async () => {
    try {
      const schedules = await Schedule.findAll({
        include: [
          {
            model: Course,
            include: [{ model: Teacher }]
          }
        ]
      });
      return schedules.map(s => s.toJSON());
    } catch (error) {
      console.error("Error fetching schedules:", error);
      return [];
    }
  });

  ipcMain.handle('add-schedule', async (event, scheduleData) => {
    try {
      const { day_of_week, time_slot, room, CourseId } = scheduleData;
      
      // Validate room availability (no double-booking in same room)
      const roomConflict = await Schedule.findOne({
        where: {
          day_of_week,
          time_slot,
          room
        }
      });
      if (roomConflict) {
        return { error: `Room '${room}' is already booked on ${day_of_week} at ${time_slot}. Please choose a different room, time, or day.` };
      }
      
      // Validate teacher availability (no double-booking for same teacher)
      const course = await Course.findByPk(CourseId);
      if (course && course.TeacherId) {
        const teacherConflict = await Schedule.findOne({
          include: [{
            model: Course,
            where: { TeacherId: course.TeacherId }
          }],
          where: {
            day_of_week,
            time_slot
          }
        });
        if (teacherConflict) {
          const conflictingCourse = await Course.findByPk(teacherConflict.CourseId);
          return { error: `Instructor ${course.Teacher?.full_name || 'on this course'} is already assigned to teach '${conflictingCourse?.title}' on ${day_of_week} at ${time_slot}. Please choose a different time or assign a different instructor.` };
        }
      }
      
      const newSchedule = await Schedule.create(scheduleData);
      const courseTitle = course ? course.title : 'Unknown';
      await AuditLog.create({
        action: 'ADD_SCHEDULE',
        description: `Scheduled course '${courseTitle}' in '${room}' on '${day_of_week}' at '${time_slot}'.`
      });
      const fullSchedule = await Schedule.findByPk(newSchedule.id, {
        include: [
          {
            model: Course,
            include: [{ model: Teacher }]
          }
        ]
      });
      return fullSchedule.toJSON();
    } catch (error) {
      console.error("Error adding schedule:", error);
      return { error: "Failed to add schedule" };
    }
  });

  ipcMain.handle('update-schedule', async (event, { id, scheduleData }) => {
    try {
      const schedule = await Schedule.findByPk(id);
      if (!schedule) return { error: "Schedule not found" };
      
      const { day_of_week, time_slot, room, CourseId } = scheduleData;
      
      // Validate room availability (no double-booking in same room) - exclude current schedule
      const roomConflict = await Schedule.findOne({
        where: {
          id: { [Op.ne]: id },
          day_of_week,
          time_slot,
          room
        }
      });
      if (roomConflict) {
        return { error: `Room '${room}' is already booked on ${day_of_week} at ${time_slot}. Please choose a different room, time, or day.` };
      }
      
      // Validate teacher availability (no double-booking for same teacher) - exclude current schedule
      const course = await Course.findByPk(CourseId);
      if (course && course.TeacherId) {
        const teacherConflict = await Schedule.findOne({
          where: {
            id: { [Op.ne]: id },
            day_of_week,
            time_slot
          },
          include: [{
            model: Course,
            where: { TeacherId: course.TeacherId }
          }]
        });
        if (teacherConflict) {
          const conflictingCourse = await Course.findByPk(teacherConflict.CourseId);
          return { error: `Instructor ${course.Teacher?.full_name || 'on this course'} is already assigned to teach '${conflictingCourse?.title}' on ${day_of_week} at ${time_slot}. Please choose a different time or assign a different instructor.` };
        }
      }
      
      await schedule.update(scheduleData);
      const courseTitle = course ? course.title : 'Unknown';
      await AuditLog.create({
        action: 'UPDATE_SCHEDULE',
        description: `Rescheduled course '${courseTitle}' to '${room}' on '${day_of_week}' at '${time_slot}'.`
      });
      const fullSchedule = await Schedule.findByPk(schedule.id, {
        include: [
          {
            model: Course,
            include: [{ model: Teacher }]
          }
        ]
      });
      return fullSchedule.toJSON();
    } catch (error) {
      console.error("Error updating schedule:", error);
      return { error: "Failed to update schedule" };
    }
  });

  ipcMain.handle('delete-schedule', async (event, id) => {
    try {
      const schedule = await Schedule.findByPk(id);
      if (!schedule) return { error: "Schedule not found" };
      const course = await Course.findByPk(schedule.CourseId);
      const title = course ? course.title : 'Unknown';
      await schedule.destroy();
      await AuditLog.create({
        action: 'DELETE_SCHEDULE',
        description: `Removed schedule for course '${title}' on '${schedule.day_of_week}' at '${schedule.time_slot}'.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting schedule:", error);
      return { error: "Failed to delete schedule" };
    }
  });

  ipcMain.handle('get-schedule-requests', async () => {
    try {
      const requests = await ScheduleRequest.findAll({
        order: [['createdAt', 'DESC']]
      });
      return requests.map(r => r.toJSON());
    } catch (error) {
      console.error("Error fetching schedule requests:", error);
      return [];
    }
  });

  ipcMain.handle('add-schedule-request', async (event, requestData) => {
    try {
      const newRequest = await ScheduleRequest.create(requestData);
      await AuditLog.create({
        action: 'CREATE_REQUEST',
        description: `Submitted new schedule request for '${newRequest.course_name}' by '${newRequest.requested_by}'.`
      });
      return newRequest.toJSON();
    } catch (error) {
      console.error("Error adding schedule request:", error);
      return { error: "Failed to submit schedule request" };
    }
  });

  ipcMain.handle('resolve-schedule-request', async (event, { id, decision }) => {
    try {
      const request = await ScheduleRequest.findByPk(id);
      if (!request) return { error: "Request not found" };
      await request.update({ status: decision });
      await AuditLog.create({
        action: 'RESOLVE_REQUEST',
        description: `Resolved schedule request for '${request.course_name}' as '${decision}'.`
      });
      return request.toJSON();
    } catch (error) {
      console.error("Error resolving schedule request:", error);
      return { error: "Failed to resolve schedule request" };
    }
  });

  ipcMain.handle('delete-schedule-request', async (event, id) => {
    try {
      const request = await ScheduleRequest.findByPk(id);
      if (!request) return { error: "Request not found" };
      await request.destroy();
      await AuditLog.create({
        action: 'DELETE_REQUEST',
        description: `Deleted schedule request for '${request.course_name}' requested by '${request.requested_by}'.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting schedule request:", error);
      return { error: "Failed to delete schedule request" };
    }
  });

  ipcMain.on('focus-app', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  ipcMain.handle('print-pdf', async (event, { html, filename, pageSize, landscape }) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false }
      });
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      // Short delay for styles to render
      await new Promise(resolve => setTimeout(resolve, 400));
      const isA5 = pageSize === 'A5';
      const isLandscape = landscape || isA5 || pageSize === 'Landscape';
      const pdfBuffer = await printWin.webContents.printToPDF({
        pageSize: (pageSize === 'Landscape' ? 'A4' : pageSize) || 'A4',
        landscape: !!isLandscape,
        printBackground: true,
        margins: {
          top: isA5 ? 0.25 : 0.5,
          bottom: isA5 ? 0.25 : 0.5,
          left: isA5 ? 0.25 : 0.5,
          right: isA5 ? 0.25 : 0.5
        }
      });
      printWin.close();
      const win = BrowserWindow.fromWebContents(event.sender);
      const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Save PDF Document',
        defaultPath: filename || 'document.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (win) win.focus();
      if (filePath) {
        fs.writeFileSync(filePath, pdfBuffer);
        await shell.openPath(filePath);
        return { success: true, path: filePath };
      }
      return { success: false, cancelled: true };
    } catch (error) {
      console.error('PDF generation error:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('print-web', async (event, { html, pageSize, landscape }) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false }
      });
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      // Short delay for styles to render
      await new Promise(resolve => setTimeout(resolve, 400));
      const isA5 = pageSize === 'A5';
      const isLandscape = landscape || isA5 || pageSize === 'Landscape';
      
      await new Promise((resolve, reject) => {
        printWin.webContents.print({
          silent: false,
          printBackground: true,
          pageSize: (pageSize === 'Landscape' ? 'A4' : pageSize) || 'A4',
          landscape: !!isLandscape
        }, (success, failureReason) => {
          printWin.close();
          if (success) {
            resolve({ success: true });
          } else {
            reject(new Error(failureReason || "User cancelled or print failed"));
          }
        });
      });
      return { success: true };
    } catch (error) {
      console.error('Direct print error:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('check-user-setup', async () => {
    try {
      const userCount = await User.count();
      if (userCount === 0) {
        return { needsSetup: true, isDefaultAdmin: false };
      }
      if (userCount === 1) {
        const singleUser = await User.findOne();
        if (singleUser && singleUser.username === 'admin' && verifyPassword('admin', singleUser.password_hash)) {
          return { needsSetup: false, isDefaultAdmin: true };
        }
      }
      return { needsSetup: false, isDefaultAdmin: false };
    } catch (error) {
      console.error("Error checking user setup:", error);
      return { needsSetup: false, isDefaultAdmin: false };
    }
  });

  ipcMain.handle('setup-initial-admin', async (event, { username, password }) => {
    try {
      if (!username || !username.trim() || !password || !password.trim()) {
        return { error: "Username and password are required." };
      }

      const userCount = await User.count();
      let adminUser = null;

      if (userCount === 0) {
        const hash = hashPassword(password);
        adminUser = await User.create({
          username: username.trim(),
          password_hash: hash,
          role: 'Admin',
          is_active: true
        });
      } else if (userCount === 1) {
        const singleUser = await User.findOne();
        if (singleUser && singleUser.username === 'admin' && verifyPassword('admin', singleUser.password_hash)) {
          const hash = hashPassword(password);
          await singleUser.update({
            username: username.trim(),
            password_hash: hash
          });
          adminUser = singleUser;
        } else {
          return { error: "An administrator account already exists. Please sign in." };
        }
      } else {
        return { error: "Initial setup has already been completed." };
      }

      currentSessionUser = {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        permissions: adminUser.permissions || ''
      };

      await AuditLog.create({
        action: 'INITIAL_ADMIN_SETUP',
        description: `Initial Administrator account configured with username '${adminUser.username}'.`
      });

      return {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        avatar: adminUser.avatar,
        permissions: adminUser.permissions || ''
      };
    } catch (error) {
      console.error("Error setting up initial admin:", error);
      return { error: error.message || "Failed to set up administrator account." };
    }
  });

  ipcMain.handle('login', async (event, { username, password }) => {
    try {
      const cleanUsername = (username || '').trim();
      const cleanPassword = password || '';

      if (!cleanUsername || !cleanPassword) {
        return { error: "Please provide both username and password." };
      }

      // 🔒 Check brute-force lockout status
      const attemptKey = cleanUsername.toLowerCase();
      const record = loginAttempts.get(attemptKey);
      const now = Date.now();

      if (record && record.lockUntil > now) {
        const remainingMinutes = Math.ceil((record.lockUntil - now) / 60000);
        return { 
          error: `Account is temporarily locked due to multiple failed login attempts. Please wait ${remainingMinutes} minute(s) before trying again.` 
        };
      }

      const user = await User.findOne({ where: { username: cleanUsername } });
      if (!user || !user.is_active) {
        // Record failed attempt
        const currentCount = (record && record.lockUntil <= now ? 0 : record?.count || 0) + 1;
        const lockUntil = currentCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_TIME_MS : 0;
        loginAttempts.set(attemptKey, { count: currentCount, lockUntil });
        return { error: "Invalid username or password." };
      }

      const isValid = verifyPassword(cleanPassword, user.password_hash);
      if (!isValid) {
        // Record failed attempt
        const currentCount = (record && record.lockUntil <= now ? 0 : record?.count || 0) + 1;
        const lockUntil = currentCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_TIME_MS : 0;
        loginAttempts.set(attemptKey, { count: currentCount, lockUntil });
        
        if (lockUntil > now) {
          return { error: "Too many failed attempts. Account temporarily locked for 5 minutes." };
        }
        return { error: "Invalid username or password." };
      }

      // Successful login -> Clear brute force tracking
      loginAttempts.delete(attemptKey);

      // Upgrade legacy SHA-256 hash transparently
      if (!user.password_hash.includes(':')) {
        const upgradedHash = hashPassword(cleanPassword);
        await user.update({ password_hash: upgradedHash });
      }

      currentSessionUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || ''
      };

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions || ''
      };
    } catch (error) {
      console.error("Login error:", error);
      return { error: "An authentication error occurred on the server." };
    }
  });

  ipcMain.handle('request-password-reset', async (event, { username }) => {
    try {
      const cleanUsername = (username || '').trim();
      let machineId = 'SCHOOL-ERP-SYS';
      
      // 1. Get raw hardware machine ID
      try {
        if (typeof getMachineHardwareId === 'function') {
          machineId = getMachineHardwareId();
        }
      } catch (e) {}

      // 2. Query activated license to align systemId with registered website license lock (schoolId or machineId)
      try {
        const licenseRes = await checkLicenseStatus();
        if (licenseRes && licenseRes.valid && licenseRes.payload) {
          // Extract matched schoolId or machineId from verified license key
          machineId = licenseRes.payload.machineId || licenseRes.payload.schoolId || machineId;
        }
      } catch (licenseErr) {
        console.log("Could not read activated license details for reset request:", licenseErr.message);
      }

      // Build secure ticket code
      const ticketCode = `RST-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      return {
        success: true,
        ticketCode,
        systemId: machineId,
        username: cleanUsername || 'School User',
        timestamp: new Date().toISOString(),
        instructions: "Please click the button to submit this request to the website app owner, or copy the ticket code to send manually."
      };
    } catch (error) {
      console.error("Reset request error:", error);
      return { error: "Failed to generate password reset request ticket." };
    }
  });

  ipcMain.handle('submit-password-reset-request', async (event, { systemId, username, ticketCode }) => {
    try {
      const payload = {
        systemId: systemId || 'SCHOOL-ERP-SYS',
        username: username || 'School User',
        timestamp: new Date().toISOString(),
        supportTicket: ticketCode
      };

      console.log("Transmitting password reset request with payload:", payload);

      let success = false;
      let lastError = '';

      // Try primary domain
      try {
        const res = await fetch('https://ayoubyounsihocine.online/api/v1/reset-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          success = true;
        } else {
          const text = await res.text();
          lastError = `Server returned status ${res.status}: ${text}`;
        }
      } catch (err) {
        lastError = err.message;
      }

      // Try proxy/alternative domain if primary failed
      if (!success) {
        try {
          const res = await fetch('https://ayoubyounsihocine.web.app/api/v1/reset-requests', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
          });
          if (res.ok) {
            success = true;
          } else {
            const text = await res.text();
            lastError = `Proxy returned status ${res.status}: ${text}`;
          }
        } catch (err) {
          lastError = `${lastError} | Proxy: ${err.message}`;
        }
      }

      if (success) {
        return { success: true };
      } else {
        return { error: lastError || "Failed to reach web portal servers." };
      }
    } catch (error) {
      console.error("Submit reset request error:", error);
      return { error: error.message || "Failed to submit request." };
    }
  });

  ipcMain.handle('check-reset-request-status', async (event, { ticketCode, requestedUsername }) => {
    try {
      if (!ticketCode) {
        return { error: "Missing ticket code." };
      }

      console.log(`Checking reset status for ticket ${ticketCode} for user ${requestedUsername}`);

      let data = null;
      let success = false;

      // Try primary
      try {
        const response = await fetch(`https://ayoubyounsihocine.online/api/v1/reset-requests/status?ticketCode=${ticketCode}`, {
          headers: { 'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999' },
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          data = await response.json();
          success = true;
        }
      } catch (err) {
        console.log("Primary status check failed:", err.message);
      }

      // Try fallback proxy
      if (!success) {
        try {
          const response = await fetch(`https://ayoubyounsihocine.web.app/api/v1/reset-requests/status?ticketCode=${ticketCode}`, {
            headers: { 'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999' },
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok) {
            data = await response.json();
            success = true;
          }
        } catch (err) {
          console.log("Proxy status check failed:", err.message);
        }
      }

      if (success && data && data.status === 'APPROVED' && data.tempUsername && data.tempPin) {
        // Save the generated temporary username and pin locally!
        const cleanUser = (requestedUsername || '').trim();
        
        // 1. Try to find the user case-insensitively
        let user = await User.findOne({
          where: sequelize.where(
            sequelize.fn('lower', sequelize.col('username')),
            cleanUser.toLowerCase()
          )
        });

        // 2. Fallback to the first user with 'admin' role if not found
        if (!user) {
          user = await User.findOne({
            where: sequelize.where(
              sequelize.fn('lower', sequelize.col('role')),
              'admin'
            )
          });
        }

        // 3. Last fallback: get the first user in the database (usually the primary owner/admin)
        if (!user) {
          user = await User.findOne({ order: [['id', 'ASC']] });
        }

        if (user) {
          const oldUsername = user.username;
          await user.update({
            username: data.tempUsername,
            password_hash: hashPassword(data.tempPin)
          });
          console.log(`Successfully updated local credentials for user (was ${oldUsername}) to temp username: ${data.tempUsername}`);
          return {
            approved: true,
            tempUsername: data.tempUsername,
            tempPin: data.tempPin
          };
        } else {
          return { error: "User not found in local database." };
        }
      }

      return { approved: false, status: data?.status || 'PENDING' };
    } catch (error) {
      console.error("Check status error:", error);
      return { error: error.message || "Failed to query reset request status." };
    }
  });

  ipcMain.handle('set-active-user', async (event, userPayload) => {
    if (userPayload) {
      currentSessionUser = {
        id: userPayload.id,
        username: userPayload.username,
        role: userPayload.role,
        permissions: userPayload.permissions || ''
      };
    } else {
      currentSessionUser = null;
    }
    return { success: true };
  });
 
  ipcMain.handle('update-user-profile', async (event, { id, username, newPassword, avatar, role, permissions }) => {
    try {
      const isSelf = currentSessionUser && currentSessionUser.id === id;
      if (!isSelf || role !== undefined || permissions !== undefined) {
        if (!hasPermission('settings')) {
          return { error: "Access Denied: Settings permissions required." };
        }
      }

      const user = await User.findByPk(id);
      if (!user) {
        return { error: "User not found" };
      }
      
      const updateData = {};
      if (username) {
        if (username !== user.username) {
          const existing = await User.findOne({ where: { username } });
          if (existing) {
            return { error: `Username '${username}' is already taken.` };
          }
          updateData.username = username;
        }
      }
      if (newPassword) {
        updateData.password_hash = hashPassword(newPassword);
      }
      if (avatar !== undefined) {
        updateData.avatar = avatar;
      }
      if (role !== undefined) {
        // Prevent removing the last admin's admin role
        if (user.role === 'Admin' && role !== 'Admin') {
          const adminCount = await User.count({ where: { role: 'Admin' } });
          if (adminCount <= 1) {
            return { error: "Cannot change the role of the only administrator." };
          }
        }
        updateData.role = role;
      }
      if (permissions !== undefined) {
        updateData.permissions = permissions;
      }

      await user.update(updateData);
      
      await AuditLog.create({
        action: 'UPDATE_PROFILE',
        description: `Updated profile details for user account '${user.username}'.`
      });

      // If we modified the current session user, update it
      if (isSelf) {
        currentSessionUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          permissions: user.permissions || ''
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          permissions: user.permissions || ''
        }
      };
    } catch (error) {
      console.error("Error updating user profile:", error);
      return { error: "Failed to update profile details." };
    }
  });

  ipcMain.handle('update-password', async (event, { username, oldPassword, newPassword }) => {
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return { error: "User not found" };
      }
      const isValid = verifyPassword(oldPassword, user.password_hash);
      if (!isValid) {
        return { error: "Incorrect old password." };
      }
      const newHash = hashPassword(newPassword);
      await user.update({ password_hash: newHash });
      await AuditLog.create({
        action: 'UPDATE_PASSWORD',
        description: `Updated password for user account '${username}'.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      return { error: "Failed to update password." };
    }
  });
 
  ipcMain.handle('get-users', async () => {
    if (!hasPermission('settings')) return [];
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'role', 'is_active', 'avatar', 'permissions', 'createdAt']
      });
      return users.map(u => u.toJSON());
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  });
 
  ipcMain.handle('add-user', async (event, userData) => {
    if (!hasPermission('settings')) return { error: "Access Denied: Settings permissions required." };
    try {
      const existing = await User.findOne({ where: { username: userData.username } });
      if (existing) {
        return { error: `Username '${userData.username}' is already taken.` };
      }
      const hash = hashPassword(userData.password);
      const newUser = await User.create({
        username: userData.username,
        password_hash: hash,
        role: userData.role || 'Receptionist',
        is_active: true,
        avatar: userData.avatar || null,
        permissions: userData.permissions || ''
      });
      await AuditLog.create({
        action: 'ADD_USER',
        description: `Created new user account '${newUser.username}' with role '${newUser.role}' and permissions: [${newUser.permissions}].`,
        target_user_id: newUser.id
      });
      return {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        avatar: newUser.avatar,
        permissions: newUser.permissions || ''
      };
    } catch (error) {
      console.error("Error adding user:", error);
      return { error: "Failed to add user account." };
    }
  });

  ipcMain.handle('update-user-permissions', async (event, { id, permissions }) => {
    if (!hasPermission('settings')) return { error: "Access Denied: Settings permissions required." };
    try {
      const user = await User.findByPk(id);
      if (!user) {
        return { error: "User not found" };
      }
      await user.update({ permissions });
      await AuditLog.create({
        action: 'UPDATE_USER_PERMISSIONS',
        description: `Updated permissions for user '${user.username}' to: [${permissions}].`,
        target_user_id: user.id
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating user permissions:", error);
      return { error: "Failed to update user permissions." };
    }
  });

  ipcMain.handle('delete-user', async (event, id) => {
    if (!hasPermission('settings')) return { error: "Access Denied: Settings permissions required." };
    try {
      const user = await User.findByPk(id);
      if (!user) return { error: "User not found" };
      const name = user.username;
      
      // Prevent deleting the last admin
      if (user.role === 'Admin') {
        const adminCount = await User.count({ where: { role: 'Admin' } });
        if (adminCount <= 1) {
          return { error: "Cannot delete the last admin account." };
        }
      }

      await user.destroy();
      await AuditLog.create({
        action: 'DELETE_USER',
        description: `Deleted user account '${name}'.`,
        target_user_id: id
      });
      return { success: true };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { error: "Failed to delete user." };
    }
  });

  ipcMain.handle('get-settings', async () => {
    try {
      const settings = await SystemSetting.findAll();
      const settingsObj = {};
      settings.forEach(s => {
        settingsObj[s.key] = s.value;
      });
      return settingsObj;
    } catch (error) {
      console.error("Error fetching settings:", error);
      return { school_name: 'School Name', academic_year: '2026-2027' };
    }
  });

  ipcMain.handle('save-settings', async (event, settingsObj) => {
    try {
      for (const [key, value] of Object.entries(settingsObj)) {
        await SystemSetting.upsert({ key, value });
      }
      await AuditLog.create({
        action: 'UPDATE_SETTINGS',
        description: `Updated system configurations (School: '${settingsObj.school_name || 'N/A'}', Academic Session: '${settingsObj.academic_year || 'N/A'}').`
      });
      return { success: true };
    } catch (error) {
      console.error("Error saving settings:", error);
      return { error: "Failed to save settings." };
    }
  });

  ipcMain.handle('unenroll-student-from-course', async (event, { studentId, courseId }) => {
    try {
      const student = await Student.findByPk(studentId);
      const course = await Course.findByPk(courseId);
      if (!student || !course) {
        return { error: "Student or Course not found" };
      }
      await student.removeCourse(course);
      await AuditLog.create({
        action: 'UNENROLL_STUDENT',
        description: `Unenrolled student '${student.full_name}' from course '${course.title}'.`
      });
      return { success: true };
    } catch (error) {
      console.error("Error unenrolling student:", error);
      return { error: "Failed to unenroll student" };
    }
  });

  ipcMain.handle('get-chart-data', async () => {
    if (!hasPermission('finances')) return null;
    try {
      const data = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const monthName = d.toLocaleString('en-US', { month: 'short' });
        
        const revenue = Number(await Payment.sum('amount', {
          where: {
            date: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          }
        })) || 0;
        
        const generalExpenses = Number(await Expense.sum('amount', {
          where: {
            date: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          }
        })) || 0;

        const teacherPayouts = Number(await TeacherPayment.sum('amount', {
          where: {
            date: {
              [Op.between]: [startOfMonth, endOfMonth]
            }
          }
        })) || 0;

        const expenses = generalExpenses + teacherPayouts;
        
        data.push({
          name: monthName,
          Revenue: revenue,
          Expenses: expenses
        });
      }
      
      return data;
    } catch (error) {
      console.error("Error generating chart data:", error);
      return [];
    }
  });

  // --- ABSENCE / ATTENDANCE HANDLERS ---
  ipcMain.handle('get-absences', async (event, filters = {}) => {
    try {
      const where = {};
      if (filters.type) where.type = filters.type;
      if (filters.StudentId) where.StudentId = filters.StudentId;
      if (filters.TeacherId) where.TeacherId = filters.TeacherId;
      if (filters.CourseId) where.CourseId = filters.CourseId;
      if (filters.status) where.status = filters.status;
      if (filters.substitute_teacher_id) where.substitute_teacher_id = filters.substitute_teacher_id;
      if (filters.date) {
        where.date = filters.date;
      } else if (filters.year && filters.month) {
        const formattedMonth = String(filters.month).padStart(2, '0');
        where.date = {
          [Op.like]: `${filters.year}-${formattedMonth}-%`
        };
      }

      const absences = await Absence.findAll({
        where,
        include: [
          { model: Student, attributes: ['id', 'full_name', 'phone'] },
          { model: Teacher, attributes: ['id', 'full_name', 'phone'] },
          { model: Course, attributes: ['id', 'title', 'price'] },
          { model: Teacher, as: 'SubstituteTeacher', attributes: ['id', 'full_name'] }
        ],
        order: [['date', 'DESC']]
      });
      return absences.map(a => a.toJSON());
    } catch (error) {
      console.error("Error fetching absences:", error);
      return [];
    }
  });

  ipcMain.handle('add-absence', async (event, absenceData) => {
    try {
      const { date, type, status, reason, CourseId, StudentId, TeacherId, substitute_teacher_id } = absenceData;
      if (!date || !type || !CourseId) {
        return { error: "Missing required fields (date, type, CourseId)." };
      }

      const existingQuery = { date, CourseId, type };
      if (type === 'Student') {
        if (!StudentId) return { error: "StudentId is required for student absences." };
        existingQuery.StudentId = StudentId;
      } else {
        if (!TeacherId) return { error: "TeacherId is required for instructor absences." };
        existingQuery.TeacherId = TeacherId;
      }

      const existing = await Absence.findOne({ where: existingQuery });
      if (existing) {
        return { error: `Absence record already exists for this date/course.` };
      }

      const newAbsence = await Absence.create(absenceData);
      
      let name = '';
      if (type === 'Student') {
        const student = await Student.findByPk(StudentId);
        name = student ? student.full_name : 'Unknown Student';
      } else {
        const teacher = await Teacher.findByPk(TeacherId);
        name = teacher ? teacher.full_name : 'Unknown Instructor';
      }
      const course = await Course.findByPk(CourseId);
      const courseTitle = course ? course.title : 'Unknown Course';

      let subInfo = '';
      if (substitute_teacher_id) {
        const subTeacher = await Teacher.findByPk(substitute_teacher_id);
        if (subTeacher) {
          subInfo = ` (Substituted by '${subTeacher.full_name}')`;
        }
      }

      await AuditLog.create({
        action: 'ADD_ABSENCE',
        description: `Recorded ${status.toLowerCase()} absence for ${type.toLowerCase()} '${name}' in course '${courseTitle}' on ${date}${subInfo}.`
      });

      return newAbsence.toJSON();
    } catch (error) {
      console.error("Error adding absence:", error);
      return { error: error.message || "Failed to record absence" };
    }
  });

  ipcMain.handle('update-absence', async (event, { id, absenceData }) => {
    try {
      const record = await Absence.findByPk(id);
      if (!record) {
        return { error: "Absence record not found." };
      }

      const oldStatus = record.status;
      await record.update(absenceData);

      let name = '';
      if (record.type === 'Student') {
        const student = await Student.findByPk(record.StudentId);
        name = student ? student.full_name : 'Unknown Student';
      } else {
        const teacher = await Teacher.findByPk(record.TeacherId);
        name = teacher ? teacher.full_name : 'Unknown Instructor';
      }
      const course = await Course.findByPk(record.CourseId);
      const courseTitle = course ? course.title : 'Unknown Course';

      let subInfo = '';
      if (record.substitute_teacher_id) {
        const subTeacher = await Teacher.findByPk(record.substitute_teacher_id);
        if (subTeacher) {
          subInfo = ` (Substituted by '${subTeacher.full_name}')`;
        }
      }

      await AuditLog.create({
        action: 'UPDATE_ABSENCE',
        description: `Updated absence status for ${record.type.toLowerCase()} '${name}' in course '${courseTitle}' on ${record.date} from '${oldStatus}' to '${record.status}'${subInfo}.`
      });

      return record.toJSON();
    } catch (error) {
      console.error("Error updating absence:", error);
      return { error: error.message || "Failed to update absence" };
    }
  });

  ipcMain.handle('delete-absence', async (event, id) => {
    try {
      const record = await Absence.findByPk(id);
      if (!record) {
        return { error: "Absence record not found." };
      }

      let name = '';
      if (record.type === 'Student') {
        const student = await Student.findByPk(record.StudentId);
        name = student ? student.full_name : 'Unknown Student';
      } else {
        const teacher = await Teacher.findByPk(record.TeacherId);
        name = teacher ? teacher.full_name : 'Unknown Instructor';
      }
      const course = await Course.findByPk(record.CourseId);
      const courseTitle = course ? course.title : 'Unknown Course';
      const date = record.date;

      await record.destroy();

      await AuditLog.create({
        action: 'DELETE_ABSENCE',
        description: `Removed absence record for ${record.type.toLowerCase()} '${name}' in course '${courseTitle}' on ${date}.`
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting absence:", error);
      return { error: error.message || "Failed to delete absence" };
    }
  });

  ipcMain.handle('export-data', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: 'Export Database Backup',
        defaultPath: `school_erp_backup_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Backup', extensions: ['json'] }
        ]
      });
      if (win) win.focus();

      if (canceled || !filePath) {
        return { cancelled: true };
      }

      const backup = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        users: await User.findAll({ raw: true }),
        students: await Student.findAll({ raw: true }),
        teachers: await Teacher.findAll({ raw: true }),
        courses: await Course.findAll({ raw: true }),
        payments: await Payment.findAll({ raw: true }),
        teacherPayments: await TeacherPayment.findAll({ raw: true }),
        expenses: await Expense.findAll({ raw: true }),
        auditLogs: await AuditLog.findAll({ raw: true }),
        schedules: await Schedule.findAll({ raw: true }),
        scheduleRequests: await ScheduleRequest.findAll({ raw: true }),
        systemSettings: await SystemSetting.findAll({ raw: true }),
        studentCourses: await StudentCourses.findAll({ raw: true }),
        absences: await Absence.findAll({ raw: true }),
        grades: await Grade.findAll({ raw: true }),
        emailTemplates: await EmailTemplate.findAll({ raw: true })
      };

      await fs.promises.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8');

      await AuditLog.create({
        action: 'EXPORT_DATA',
        description: 'Successfully exported full system database backup to JSON.'
      });

      return { success: true };
    } catch (error) {
      console.error('Error exporting data:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('import-data', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: 'Import Database Backup',
        filters: [
          { name: 'JSON Backup', extensions: ['json'] }
        ],
        properties: ['openFile']
      });
      if (win) win.focus();

      if (canceled || filePaths.length === 0) {
        return { cancelled: true };
      }

      const fileContent = await fs.promises.readFile(filePaths[0], 'utf-8');
      const backupData = JSON.parse(fileContent);

      if (!backupData || typeof backupData !== 'object' || !Array.isArray(backupData.students) || !Array.isArray(backupData.courses)) {
        return { error: 'Invalid backup file format' };
      }

      await sequelize.query('PRAGMA foreign_keys = OFF;');

      try {
        await sequelize.transaction(async (t) => {
          await User.destroy({ where: {}, transaction: t });
          await Student.destroy({ where: {}, transaction: t });
          await Teacher.destroy({ where: {}, transaction: t });
          await Course.destroy({ where: {}, transaction: t });
          await Payment.destroy({ where: {}, transaction: t });
          await TeacherPayment.destroy({ where: {}, transaction: t });
          await Expense.destroy({ where: {}, transaction: t });
          await AuditLog.destroy({ where: {}, transaction: t });
          await Schedule.destroy({ where: {}, transaction: t });
          await ScheduleRequest.destroy({ where: {}, transaction: t });
          await SystemSetting.destroy({ where: {}, transaction: t });
          await StudentCourses.destroy({ where: {}, transaction: t });
          await Absence.destroy({ where: {}, transaction: t });
          await Grade.destroy({ where: {}, transaction: t });
          await EmailTemplate.destroy({ where: {}, transaction: t });

          if (backupData.users && backupData.users.length > 0) {
            await User.bulkCreate(backupData.users, { transaction: t });
          }
          if (backupData.students && backupData.students.length > 0) {
            await Student.bulkCreate(backupData.students, { transaction: t });
          }
          if (backupData.teachers && backupData.teachers.length > 0) {
            await Teacher.bulkCreate(backupData.teachers, { transaction: t });
          }
          if (backupData.courses && backupData.courses.length > 0) {
            await Course.bulkCreate(backupData.courses, { transaction: t });
          }
          if (backupData.payments && backupData.payments.length > 0) {
            await Payment.bulkCreate(backupData.payments, { transaction: t });
          }
          if (backupData.teacherPayments && backupData.teacherPayments.length > 0) {
            await TeacherPayment.bulkCreate(backupData.teacherPayments, { transaction: t });
          }
          if (backupData.expenses && backupData.expenses.length > 0) {
            await Expense.bulkCreate(backupData.expenses, { transaction: t });
          }
          if (backupData.auditLogs && backupData.auditLogs.length > 0) {
            await AuditLog.bulkCreate(backupData.auditLogs, { transaction: t });
          }
          if (backupData.schedules && backupData.schedules.length > 0) {
            await Schedule.bulkCreate(backupData.schedules, { transaction: t });
          }
          if (backupData.scheduleRequests && backupData.scheduleRequests.length > 0) {
            await ScheduleRequest.bulkCreate(backupData.scheduleRequests, { transaction: t });
          }
          if (backupData.systemSettings && backupData.systemSettings.length > 0) {
            await SystemSetting.bulkCreate(backupData.systemSettings, { transaction: t });
          }
          if (backupData.studentCourses && backupData.studentCourses.length > 0) {
            await StudentCourses.bulkCreate(backupData.studentCourses, { transaction: t });
          }
          if (backupData.absences && backupData.absences.length > 0) {
            await Absence.bulkCreate(backupData.absences, { transaction: t });
          }
          if (backupData.grades && backupData.grades.length > 0) {
            await Grade.bulkCreate(backupData.grades, { transaction: t });
          }
          if (backupData.emailTemplates && backupData.emailTemplates.length > 0) {
            await EmailTemplate.bulkCreate(backupData.emailTemplates, { transaction: t });
          }



          const adminExists = await User.count({ where: { role: 'Admin' }, transaction: t });
          if (adminExists === 0) {
            const defaultHash = hashPassword('admin');
            await User.create({
              username: 'admin',
              password_hash: defaultHash,
              role: 'Admin',
              is_active: true
            }, { transaction: t });
          }

          await AuditLog.create({
            action: 'IMPORT_DATA',
            description: `Successfully restored database from backup file exported at ${backupData.exportedAt || 'unknown date'}.`
          }, { transaction: t });
        });
      } finally {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      }

      return { success: true };
    } catch (error) {
      console.error('Error importing data:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('wipe-database', async () => {
    try {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
      try {
        await Payment.destroy({ where: {}, force: true });
        await TeacherPayment.destroy({ where: {}, force: true });
        await Expense.destroy({ where: {}, force: true });
        await Absence.destroy({ where: {}, force: true });
        await AuditLog.destroy({ where: {}, force: true });
        await Schedule.destroy({ where: {}, force: true });
        await ScheduleRequest.destroy({ where: {}, force: true });
        await StudentCourses.destroy({ where: {}, force: true });
        await Course.destroy({ where: {}, force: true });
        await Student.destroy({ where: {}, force: true });
        await Teacher.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
        await SystemSetting.destroy({ where: {}, force: true });

        // Re-seed default admin user (admin / admin)
        const defaultHash = hashPassword('admin');
        await User.create({
          username: 'admin',
          password_hash: defaultHash,
          role: 'Admin',
          is_active: true
        });

        // Re-seed default settings
        await SystemSetting.bulkCreate([
          { key: 'school_name', value: 'School Name' },
          { key: 'academic_year', value: '2026-2027' }
        ]);
      } finally {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      }
      return { success: true };
    } catch (error) {
      console.error("Failed to wipe database:", error);
      return { error: error.message || "Failed to wipe database" };
    }
  });

  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // --- Email System IPC Handlers ---
  ipcMain.handle('test-smtp', async (event, config) => {
    return await testSMTPConnection(config);
  });

  ipcMain.handle('send-email', async (event, mailParams) => {
    return await sendEmail(mailParams);
  });

  ipcMain.handle('send-bulk-emails', async (event, bulkParams) => {
    const res = await sendBulkEmails(bulkParams);
    if (res && res.success) {
      try {
        await AuditLog.create({
          action: 'SEND_BULK_EMAIL',
          description: `Sent bulk email broadcast to ${res.successCount}/${res.total} recipients. Subject: "${bulkParams.subject}"`
        });
      } catch (err) {
        console.error('Failed to log bulk email audit log:', err);
      }
    }
    return res;
  });

  // Dialog to select a file attachment from the main process
  ipcMain.handle('select-attachment-file', async () => {
    const windows = BrowserWindow.getAllWindows();
    const result = await dialog.showOpenDialog(windows[0], {
      properties: ['openFile'],
      title: 'Select Attachment File'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const pathParts = filePath.split(/[/\\]/);
    const filename = pathParts[pathParts.length - 1];

    return {
      filename,
      path: filePath
    };
  });

  ipcMain.handle('get-templates', async () => {
    try {
      const templates = await EmailTemplate.findAll();
      return templates.map(t => t.toJSON());
    } catch (error) {
      console.error('Failed to get templates:', error);
      return [];
    }
  });

  ipcMain.handle('save-template', async (event, { id, name, subject, body }) => {
    try {
      if (id) {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          const template = await EmailTemplate.findByPk(numericId);
          if (template) {
            await template.update({ name, subject, body });
            return { success: true, template: template.toJSON() };
          }
        }
      }
      // Check for name duplicates to avoid raw SQLite constraint crashes
      const existing = await EmailTemplate.findOne({ where: { name } });
      if (existing) {
        return { success: false, error: 'A template with this name already exists. Please choose a different name.' };
      }
      const newTemplate = await EmailTemplate.create({ name, subject, body });
      return { success: true, template: newTemplate.toJSON() };
    } catch (error) {
      console.error('Failed to save template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-template', async (event, id) => {
    try {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) return { success: false, error: 'Invalid template ID' };
      const template = await EmailTemplate.findByPk(numericId);
      if (template) {
        await template.destroy();
        return { success: true };
      }
      return { success: false, error: 'Template not found' };
    } catch (error) {
      console.error('Failed to delete template:', error);
      return { success: false, error: error.message };
    }
  });

  // Helper to send messages to the renderer process
  function sendToRenderer(channel, ...args) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && windows[0].webContents) {
      windows[0].webContents.send(channel, ...args);
    }
  }

  // --- Auto-Updater Setup ---
  function initAutoUpdater() {
    // Disable auto-downloading so the user must click "Download" in the UI
    autoUpdater.autoDownload = false;

    // Log updater messages for diagnostic purposes
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      sendToRenderer('checking-for-update');
    });
    
    autoUpdater.on('update-available', (info) => {
      console.log('Update available. Version:', info.version);
      sendToRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('No update available.');
      sendToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Error in auto-updater:', err);
      sendToRenderer('update-error', err.message || String(err));
    });

    autoUpdater.on('download-progress', (progressObj) => {
      sendToRenderer('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded. Version:', info.version);
      sendToRenderer('update-downloaded', info);
    });

    // IPC listeners to trigger updater actions from React frontend
    ipcMain.on('trigger-update-check', () => {
      if (!is.dev) {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
          console.error('Error checking for updates:', err);
          sendToRenderer('update-error', err.message);
        });
      } else {
        console.log('Skipped real update check in development mode.');
      }
    });

    ipcMain.on('start-update-download', () => {
      console.log('Starting update download...');
      autoUpdater.downloadUpdate().catch(err => {
        console.error('Error downloading update:', err);
        sendToRenderer('update-error', err.message);
      });
    });

    ipcMain.on('install-update-now', () => {
      console.log('Installing update and restarting...');
      autoUpdater.quitAndInstall();
    });

    // Check for updates automatically in production on startup
    if (!is.dev) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(e => console.log('Auto-check error:', e));
      }, 5000); // Wait 5 seconds after startup to not block database sync
    }
  }

  // Initialize auto-updater
  initAutoUpdater();

  createWindow()


  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Uncaught exception tracking for production diagnostics
process.on('uncaughtException', (err) => {
  try {
    const logFile = join(app.getPath('userData'), 'production_debug.log');
    fs.appendFileSync(logFile, `[MAIN UNCAUGHT] ${err.stack || err}\n`, 'utf8');
  } catch(e) {}
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    const logFile = join(app.getPath('userData'), 'production_debug.log');
    fs.appendFileSync(logFile, `[MAIN UNHANDLED REJECTION] Reason: ${reason?.stack || reason}\n`, 'utf8');
  } catch(e) {}
});