import { DataTypes } from 'sequelize';
import sequelize from './connection.js';

// 1. Users (Admin, Receptionist)
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'Receptionist' }, // 'Admin' or 'Receptionist'
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatar: { type: DataTypes.TEXT, allowNull: true }, // Base64 encoded avatar image
  permissions: { type: DataTypes.TEXT, allowNull: true } // Comma-separated list of allowed sections/modules, e.g. "dashboard,students"
});

// 2. Students
const Student = sequelize.define('Student', {
  full_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  parent_phone: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'Active' }, // Active, Dropped, Graduated
  grade_level: { type: DataTypes.STRING, defaultValue: 'Primary' }, // Primary, Middle, High, University, Adult
  date_of_birth: { type: DataTypes.STRING, allowNull: true },
  status_date: { type: DataTypes.STRING, allowNull: true },
  extra_info: { type: DataTypes.TEXT, allowNull: true },
}, {
  hooks: {
    beforeCreate: (student) => {
      if (student.status !== 'Active') {
        student.status_date = new Date().toISOString().split('T')[0];
      } else {
        student.status_date = null;
      }
    },
    beforeUpdate: (student) => {
      if (student.changed('status')) {
        if (student.status === 'Active') {
          student.status_date = null;
        } else {
          student.status_date = new Date().toISOString().split('T')[0];
        }
      }
    }
  }
});

// 2.5 Teachers
const Teacher = sequelize.define('Teacher', {
  full_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  specialty: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'Active' }, // Active, Inactive
  absence_penalty_rate: { type: DataTypes.FLOAT, defaultValue: 1000.0 }
});


// 3. Courses
const Course = sequelize.define('Course', {
  title: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  total_hours: { type: DataTypes.INTEGER },
  default_payout_rate: { type: DataTypes.INTEGER, defaultValue: 50 },
  has_exam: { type: DataTypes.BOOLEAN, defaultValue: false },
  payout_type: { type: DataTypes.STRING, defaultValue: 'Percentage' }, // 'Percentage' or 'Fixed'
  fixed_payout_amount: { type: DataTypes.FLOAT, defaultValue: 0.0 }
});

// 4. Payments (Financial Tracking)
const Payment = sequelize.define('Payment', {
  amount: { type: DataTypes.FLOAT, allowNull: false },
  payment_method: { type: DataTypes.STRING, defaultValue: 'Cash' },
  receipt_number: { type: DataTypes.STRING, unique: true },
  month: { type: DataTypes.STRING, allowNull: true },
  year: { type: DataTypes.INTEGER, allowNull: true },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// 4.5 Teacher Payouts (Salaries / Payouts)
const TeacherPayment = sequelize.define('TeacherPayment', {
  amount: { type: DataTypes.FLOAT, allowNull: false },
  payment_method: { type: DataTypes.STRING, defaultValue: 'Cash' },
  receipt_number: { type: DataTypes.STRING, unique: true },
  month: { type: DataTypes.STRING, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  absences_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  absences_deduction: { type: DataTypes.FLOAT, defaultValue: 0 },
  substitutions_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  substitutions_credit: { type: DataTypes.FLOAT, defaultValue: 0 }
});

// 5. Expenses (Rent, Bills, Salaries)
const Expense = sequelize.define('Expense', {
  category: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.STRING },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// 6. Audit Log (Crucial for Admin: Tracks who did what)
const AuditLog = sequelize.define('AuditLog', {
  action: { type: DataTypes.STRING, allowNull: false }, // e.g., 'CREATED_PAYMENT'
  description: { type: DataTypes.STRING, allowNull: false },
  target_user_id: { type: DataTypes.INTEGER, allowNull: true } // ID of the user whom the action was performed on
});

// 7. Schedule
const Schedule = sequelize.define('Schedule', {
  day_of_week: { type: DataTypes.STRING, allowNull: false }, // 'Monday', 'Tuesday', etc.
  time_slot: { type: DataTypes.STRING, allowNull: false }, // '08:00', '10:00', '12:00', '14:00', '16:00'
  room: { type: DataTypes.STRING, allowNull: false } // 'Room 102', 'Lab A', 'Studio B', 'Workshop 2', 'Main Hall'
});

// 8. Schedule Requests
const ScheduleRequest = sequelize.define('ScheduleRequest', {
  type: { type: DataTypes.STRING, allowNull: false }, // 'Rescheduling', 'Teacher Swap', 'Room Booking'
  course_name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  requested_by: { type: DataTypes.STRING, allowNull: false },
  time_elapsed: { type: DataTypes.STRING, defaultValue: 'Just now' },
  status: { type: DataTypes.STRING, defaultValue: 'Pending' } // 'Pending', 'Approved', 'Rejected'
});

// --- DEFINE RELATIONSHIPS ---
// A user can process many payments, a payment is processed by one user
User.hasMany(Payment, { foreignKey: 'receiver_user_id' });
Payment.belongsTo(User, { foreignKey: 'receiver_user_id' });

// A student has many payments
Student.hasMany(Payment);
Payment.belongsTo(Student);

// A course has many payments
Course.hasMany(Payment);
Payment.belongsTo(Course);

// Define StudentCourses junction table explicitly to allow custom columns/createdAt updates
const StudentCourses = sequelize.define('StudentCourses', {
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false // Don't auto-generate updatedAt
});

// A course has many students (and vice versa) - Many-to-Many
Student.belongsToMany(Course, { 
  through: StudentCourses,
  timestamps: false
});
Course.belongsToMany(Student, { 
  through: StudentCourses,
  timestamps: false
});

// A teacher can teach many courses
Teacher.hasMany(Course, { foreignKey: 'TeacherId' });
Course.belongsTo(Teacher, { foreignKey: 'TeacherId' });

// A teacher can receive many payouts
Teacher.hasMany(TeacherPayment);
TeacherPayment.belongsTo(Teacher);

// A course can have many teacher payments (optional, for course-specific instructor payouts)
Course.hasMany(TeacherPayment, { foreignKey: { name: 'CourseId', allowNull: true } });
TeacherPayment.belongsTo(Course, { foreignKey: { name: 'CourseId', allowNull: true } });

// Audit logs are linked to the user who performed the action
User.hasMany(AuditLog);
AuditLog.belongsTo(User);

// A course has many schedules
Course.hasMany(Schedule, { onDelete: 'CASCADE' });
Schedule.belongsTo(Course);

// 8.5 Absence (Attendance tracking)
const Absence = sequelize.define('Absence', {
  date: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
  type: { type: DataTypes.STRING, allowNull: false }, // 'Student' or 'Teacher'
  status: { type: DataTypes.STRING, defaultValue: 'Unexcused' }, // 'Unexcused' or 'Excused'
  reason: { type: DataTypes.STRING, allowNull: true }, // e.g. 'Sick', 'No notice', etc.
  substitute_teacher_id: { type: DataTypes.INTEGER, allowNull: true }
});

// Absences relationships
Student.hasMany(Absence, { onDelete: 'CASCADE' });
Absence.belongsTo(Student);

Teacher.hasMany(Absence, { onDelete: 'CASCADE' });
Absence.belongsTo(Teacher);

Course.hasMany(Absence, { onDelete: 'CASCADE' });
Absence.belongsTo(Course);

Absence.belongsTo(Teacher, { as: 'SubstituteTeacher', foreignKey: 'substitute_teacher_id' });

// 9. System Settings (School Name, Academic Session)
const SystemSetting = sequelize.define('SystemSetting', {
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  value: { type: DataTypes.TEXT }
});

// 10. Grades (For student examination results)
const Grade = sequelize.define('Grade', {
  exam_name: { type: DataTypes.STRING, allowNull: false }, // e.g. "First Term Exam", "Final Exam"
  score: { type: DataTypes.FLOAT, allowNull: false }, // Out of 20 or custom max
  max_score: { type: DataTypes.FLOAT, defaultValue: 20 },
  coefficient: { type: DataTypes.FLOAT, defaultValue: 1.0 },
  date: { type: DataTypes.STRING, allowNull: true },
  remarks: { type: DataTypes.STRING, allowNull: true }
});

// Grades relationships
Student.hasMany(Grade, { onDelete: 'CASCADE' });
Grade.belongsTo(Student);

Course.hasMany(Grade, { onDelete: 'CASCADE' });
Grade.belongsTo(Course);

// Export everything
export { sequelize, User, Student, Teacher, Course, Payment, Expense, AuditLog, Schedule, ScheduleRequest, SystemSetting, TeacherPayment, StudentCourses, Absence, Grade };
