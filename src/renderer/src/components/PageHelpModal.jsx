import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BookOpen, CheckCircle2, Sparkles, AlertCircle, HelpCircle } from 'lucide-react'
import { useLanguage } from '../i18n'

const pageGuides = {
  dashboard: {
    titleEN: 'Dashboard & Workspace Overview',
    titleAR: 'لوحة التحكم والمؤشرات العامة',
    subtitleEN: 'Central command center providing real-time school analytics, financial health, and system alerts.',
    subtitleAR: 'مركز القيادة الرئيسي الذي يعرض إحصائيات المدرسة، الحالة المالية، والتنبيهات المباشرة.',
    overviewEN: 'The Dashboard gives school directors and administrators an immediate 360-degree view of enrollment trends, monthly cashflow, outstanding tuition receivables, and active system alerts.',
    overviewAR: 'توفر لوحة التحكم لمدير المدرسة ورؤساء الأقسام رؤية شاملة ومباشرة لاتجاهات التسجيل، التدفقات المالية الشهرية، المستحقات المتبقية لدى الطلاب، والتنبيهات الهامة.',
    stepsEN: [
      {
        title: 'Monitor Key Metrics',
        desc: 'Review total registered active students, monthly collected revenue, operational expenses, net financial balance, and overall outstanding receivables at a glance.'
      },
      {
        title: 'Act on Smart Alerts',
        desc: 'Check alert cards highlighted in red or amber. Red cards flag students with severe payment delays (>30 days), while amber cards alert you when a course reaches 80%+ of its total hours.'
      },
      {
        title: 'Analyze Monthly Trends',
        desc: 'Use the interactive financial chart to compare month-by-month revenue versus expenses.'
      },
      {
        title: 'Review Distribution & Attendance',
        desc: 'Inspect student course enrollment distribution and recent weekly attendance activity.'
      },
      {
        title: 'Refresh Data Anytime',
        desc: 'Click the "Refresh" button at the top right to sync the dashboard with the latest database records.'
      }
    ],
    stepsAR: [
      {
        title: 'متابعة المؤشرات الرئيسية',
        desc: 'مراجعة إجمالي الطلاب النشطين، مداخيل الشهر، المصاريف التشغيلية، الصافي المالي، والمستحقات المتبقية بلمحة واحدة.'
      },
      {
        title: 'التعامل مع التنبيهات الذكية',
        desc: 'متابعة بطاقات التنبيه الملونة. البطاقات الحمراء تمثل تأخيرات في سداد الرسوم (أكثر من 30 يوماً)، والبطاقات الصفراء تنبهك عندما تقترب الدورة من الانتهاء (تجاوز 80% من الساعات).'
      },
      {
        title: 'تحليل الاتجاهات الشهرية',
        desc: 'مقارنة المداخيل والمصاريف شهراً بشهر من خلال الرسم البياني التفاعلي.'
      },
      {
        title: 'مراجعة توزيع الطلاب والغيابات',
        desc: 'الاطلاع على كيفية توزيع الطلاب حسب المواد ومتابعة نسبة الغياب الأسبوعي.'
      },
      {
        title: 'تحديث البيانات المباشر',
        desc: 'انقر على زر "تحديث" في الأعلى لجلب أحدث المستجدات المسجلة في النظام.'
      }
    ]
  },
  students: {
    titleEN: 'Student Directory & Profiles Guide',
    titleAR: 'دليل إدارة ملفات الطلاب والتسجيل',
    subtitleEN: 'Manage student registrations, course enrollments, school ID cards, report cards, and CSV imports.',
    subtitleAR: 'إدارة تسجيل الطلاب، التسجيل في المواد، بطاقات الطالب، كشوف النقاط، والاستيراد الجماعي.',
    overviewEN: 'This page serves as the core student database. Here you can register new students, enroll them into courses, generate official barcode ID cards, view report cards, and manage status (Active, Dropped, Graduated).',
    overviewAR: 'تعتبر هذه الصفحة القاعدة الأساسية لبيانات الطلاب. يمكنك من خلالها تسجيل طلاب جديد، تسجيلهم في المواد، طباعة البطاقات المدرسية مع الـ QR Code، استخراج كشوف النقاط، وتغيير حالة الطالب.',
    stepsEN: [
      {
        title: 'Registering a New Student',
        desc: 'Click "+ Register Student", enter Full Name, Student Phone, Parent Phone/Email, Grade Level, and Date of Birth, then click "Register Student".'
      },
      {
        title: 'Enrolling Students in Courses',
        desc: 'Find the student in the table, click the "Enroll" / "Courses" button on their row, select the target course and starting date, then confirm.'
      },
      {
        title: 'Printing Official Student ID Cards',
        desc: 'Click the Card icon next to a student to preview and print a compact barcode/QR-coded Student ID Card.'
      },
      {
        title: 'Generating Report Cards',
        desc: 'Click the Grade icon on any student row to view exam scores, weighted average (/20), and print an official Report Card.'
      },
      {
        title: 'Bulk CSV Importing & Exporting',
        desc: 'Click "Import CSV" to upload spreadsheet rosters, map header columns, and import students in bulk. Click "Export CSV" to download backup files.'
      }
    ],
    stepsAR: [
      {
        title: 'تسجيل طالب جديد',
        desc: 'انقر على "+ تسجيل طالب"، أدخل الاسم الكامل، رقم هاتف الطالب، هاتف ولي الأمر، الطور الدراسي، وتاريخ الميلاد، ثم اضغط حفظ.'
      },
      {
        title: 'تسجيل الطالب في المواد والدورات',
        desc: 'ابحث عن الطالب في القائمة، انقر على زر "المواد / التسجيل"، اختر المادة وتاريخ البداية، ثم أكد عملية التسجيل.'
      },
      {
        title: 'طباعة البطاقات المدرسية للطلاب',
        desc: 'انقر على أيقونة "البطاقة" بجانب اسم الطالب لمعاينة وطباعة بطاقة مدرسية رسمية مزودة بكود QR.'
      },
      {
        title: 'إصدار كشف النقاط المدرسي',
        desc: 'انقر على أيقونة "كشف النقاط" لعرض علامات الامتحانات، إحساب المعدل العام (على 20)، وطباعة الكشف.'
      },
      {
        title: 'الاستيراد والتصدير الجماعي (CSV)',
        desc: 'انقر على "استيراد CSV" لرفع قائمة طلاب من ملف إكسل، أو "تصدير CSV" لتحميل نسخة إكسل كاملة.'
      }
    ]
  },
  teachers: {
    titleEN: 'Faculty & Teacher Management Guide',
    titleAR: 'دليل إدارة المدرسين وهيئة التدريس',
    subtitleEN: 'Manage instructor profiles, subject specialties, absence penalty rates, and course assignments.',
    subtitleAR: 'إدارة بيانات الأساتذة، التخصصات، نسبة خصم الغياب، والدورات المسندة لكل أستاذ.',
    overviewEN: 'The Faculty module handles all teacher records. You can store contact details, specify their teaching specialty, configure default absence penalty deduction rates, and review active subject assignments.',
    overviewAR: 'قسم الأساتذة يتيح لك تنظيم هيئة التدريس بكامل تفاصيلها. يمكنك إضافة بيانات الاتصال، التخصص، تحديد اقتطاع غياب الأستاذ لكل حصة، ومعاينة المواد المسندة.',
    stepsEN: [
      {
        title: 'Adding a Teacher',
        desc: 'Click "+ Add Teacher", provide Full Name, Phone, Email, Specialty (e.g. Mathematics, Physics, English), and Absence Penalty Rate (DA).'
      },
      {
        title: 'Setting Absence Penalty Rate',
        desc: 'Specify the DA deduction per unexcused absence. When an absence is recorded for this teacher, payouts automatically calculate penalty deductions.'
      },
      {
        title: 'Assigning Teachers to Courses',
        desc: 'When creating or editing courses in the Courses tab, select this teacher to link them automatically.'
      },
      {
        title: 'Bulk Import Teachers',
        desc: 'Use the "Import CSV" button on top to quickly import faculty lists from an Excel file.'
      }
    ],
    stepsAR: [
      {
        title: 'إضافة أستاذ جديد',
        desc: 'اضغط على "+ إضافة أستاذ"، أدخل الاسم الكامل، رقم الهاتف، البريد الإلكتروني، التخصص (مثل: رياضيات، فيزياء)، وغرامة الغياب (د.ج).'
      },
      {
        title: 'تحديد معدل اقتطاع الغياب',
        desc: 'حدد قيمة الاقتطاع بالدينار لكل حصة يغيبها الأستاذ بدون عذر. سيتم خصم هذا المبلغ تلقائياً عند صب الراتب.'
      },
      {
        title: 'ربط الأساتذة بالمواد',
        desc: 'عند إنشاء أو تعديل المواد في قسم "المواد والجدول"، قم باختيار الأستاذ المسند له المادة.'
      },
      {
        title: 'استيراد قائمة الأساتذة',
        desc: 'يمكنك استخدام زر "استيراد CSV" لرفع قائمة أساتذة مباشرة من ملف إكسل.'
      }
    ]
  },
  courses: {
    titleEN: 'Courses, Pricing & Timetable Guide',
    titleAR: 'دليل المواد والدورات والجدول الأسبوعي',
    subtitleEN: 'Configure academic subjects, monthly tuition rates, timetable schedules, and instructor payout models.',
    subtitleAR: 'إدارة المواد، أسعار الاشتراكات الشهرية، الجدول الأسبوعي للقاعات، وطريقة دفع مستحقات الأساتذة.',
    overviewEN: 'This section controls your curriculum syllabus, pricing, classroom room bookings, and instructor compensation structures (Percentage or Fixed Payouts).',
    overviewAR: 'يهتم هذا القسم بتنظيم المواد الدراسية، أسعار الدورات، حجز القاعات الزماني والمكاني، وتحديد نموذج مستحقات الأستاذ (نسبة مئوية أو مبلغ ثابت).',
    stepsEN: [
      {
        title: 'Creating a New Course',
        desc: 'Click "+ Add Course", enter Subject Title, Monthly Price (DA), Total Planned Hours, Assigned Instructor, and Payout Structure (Percentage vs Fixed).'
      },
      {
        title: 'Enabling Course Examinations',
        desc: 'Check the "Has Exam" box to allow teachers and admins to record examination scores for students enrolled in this course.'
      },
      {
        title: 'Managing Timetable & Room Bookings',
        desc: 'Switch to the "Weekly Timetable" tab to schedule day-of-week, time slot (e.g. 08:00 - 10:00), and Room number to avoid room conflicts.'
      },
      {
        title: 'Processing Schedule Requests',
        desc: 'Review and approve or reject room change or rescheduling requests submitted by staff in the Schedule Requests panel.'
      }
    ],
    stepsAR: [
      {
        title: 'إنشاء مادة / دورة جديدة',
        desc: 'انقر على "+ إضافة مادة"، أدخل اسم المادة، السعر الشهري (د.ج)، الحجم الساعي، الأستاذ المسند، ونوع المستحقات (نسبة مئوية أو مبلغ ثابت).'
      },
      {
        title: 'تفعيل الامتحانات للمادة',
        desc: 'قم بتفعيل خيار "تحتوي على امتحان" لتمكين تسجيل علامات الامتحانات وكشوف النقاط للطلاب المسجلين فيها.'
      },
      {
        title: 'إدارة الجدول الأسبوعي والقاعات',
        desc: 'انتقل إلى تبويب "الجدول الأسبوعي" لتوزيع المواد على الأيام، التوقيت (مثل: 08:00 - 10:00)، ورقم القاعة لتفادي التداخل.'
      },
      {
        title: 'معالجة طلبات التعديل',
        desc: 'مراجعة وقبول أو رفض طلبات تغيير التوقيت والقاعات من لوحة الطلبات.'
      }
    ]
  },
  attendance: {
    titleEN: 'Daily Attendance & Absence Tracking Guide',
    titleAR: 'دليل تسجيل الحضور والغياب اليومي',
    subtitleEN: 'Record daily student and teacher attendance, track substitute teachers, and view historical logs.',
    subtitleAR: 'تسجيل الحضور والغياب اليومي للطلاب والأساتذة، تحديد أساتذة الاستخلاف، ومراجعة السجلات.',
    overviewEN: 'Maintain accurate daily attendance records for both students and teachers. Absence entries update individual student financial obligations and teacher payout calculations automatically.',
    overviewAR: 'تسجيل الحضور والغياب اليومي بدقة للطلاب والأساتذة. تؤثر سجلات الغياب تلقائياً على المستحقات المالية للطلاب وحساب رواتب الأساتذة.',
    stepsEN: [
      {
        title: 'Taking Student Attendance',
        desc: 'Select the Date, Grade Level, and Course. Mark students as Present (green), Unexcused Absent (red), or Excused (blue) with an optional reason.'
      },
      {
        title: 'Taking Teacher Attendance',
        desc: 'Select Date and Teacher. If absent, choose an optional substitute teacher who covered the class to award them substitution credits.'
      },
      {
        title: 'Automatic Financial Synchronization',
        desc: 'Unexcused student absences highlight overdue balance items, while teacher absences automatically calculate penalty deductions on payout day.'
      },
      {
        title: 'Filter & Search History',
        desc: 'Use the filter bar to search attendance records by student name, course, date range, or absence status.'
      }
    ],
    stepsAR: [
      {
        title: 'تسجيل غياب وحضور الطلاب',
        desc: 'اختر التاريخ، الطور الدراسي، والمادة. حدد حالة كل طالب: حاضر (أخضر)، غائب بدون عذر (أحمر)، أو غائب بعذر (أزرق) مع ذكر السبب.'
      },
      {
        title: 'تسجيل غياب وحضور الأساتذة',
        desc: 'اختر التاريخ والأستاذ. في حالة الغياب، يمكنك تحديد أستاذ مستخلف أدى الحصة ليتم احتساب الساعات الإضافية له.'
      },
      {
        title: 'الربط المالي التلقائي',
        desc: 'غياب الطالب يؤخذ بعين الاعتبار في مستحقاته، وغياب الأستاذ يقتطع تلقائياً من راتبه في نهاية الشهر.'
      },
      {
        title: 'التصفية والبحث في السجلات',
        desc: 'استخدم شريط الفلترة للبحث في سجلات الحضور حسب اسم الطالب، المادة، الفاصل الزمني، أو نوع الغياب.'
      }
    ]
  },
  finances: {
    titleEN: 'Financial Ledger & Billing Guide',
    titleAR: 'دليل الحسابات، التحصيل والمصاريف',
    subtitleEN: 'Process student tuition payments, calculate teacher payouts, manage expenses, and print dual receipts.',
    subtitleAR: 'استخلاص واجبات الطلاب، صب رواتب الأساتذة، تسجيل المصاريف العامة، وطباعة الفواتير المزدوجة.',
    overviewEN: 'The Accounting hub tracks all cash inflow and outflow. It generates automated receipt numbers, tracks unpaid student months, calculates instructor earnings (minus penalties), and records operating expenses.',
    overviewAR: 'المركز المالي الشامل لمتابعة المداخيل والمصاريف. يولد أرقام فواتير تسلسلية تلقائياً، يحسب الأشهر غير المدفوعة للطلاب، يحسب رواتب الأساتذة، ويسجل جميع المصاريف التشغيلية.',
    stepsEN: [
      {
        title: 'Collecting Student Tuition Payments',
        desc: 'Click "+ Record Payment", select Student and Course. The system auto-detects overdue months and suggests exact due amounts. Click Save to log payment.'
      },
      {
        title: 'Printing Official Receipts',
        desc: 'Click the Printer icon next to any recorded payment to print an official double-invoice receipt (School Copy + Parent Copy).'
      },
      {
        title: 'Processing Teacher Salary Payouts',
        desc: 'Click "+ Teacher Payout", select Instructor and Month/Year. The system automatically computes base tuition share, subtracts absence penalties, and adds substitution credits.'
      },
      {
        title: 'Logging School Operating Expenses',
        desc: 'Click "+ Record Expense" to log rent, electricity, maintenance, or supplies with category and description.'
      },
      {
        title: 'Financial Summary Reports',
        desc: 'View real-time totals for Total Revenue, Total Expenses, and Net Operating Balance for the current month.'
      }
    ],
    stepsAR: [
      {
        title: 'تحصيل واجبات الطلاب الشهرية',
        desc: 'انقر على "+ تسديد دفعة"، اختر الطالب والمادة. يكتشف النظام تلقائياً الأشهر المستحقة ويعرض المبلغ المطلوبة. انقر حفظ للتأكيد.'
      },
      {
        title: 'طباعة فواتير السداد الرسمية',
        desc: 'انقر على أيقونة الطابعة بجانب أي دفعة لطباعة فاتورة رسمية مزدوجة (نسخة المدرسة + نسخة ولي الأمر).'
      },
      {
        title: 'حساب وصب رواتب الأساتذة',
        desc: 'انقر على "+ مستحقات الأستاذ"، اختر الأستاذ والشهر. يحسب النظام حصة الأستاذ، يخصم اقتطاعات الغياب، ويضيف ساعات الاستخلاف تلقائياً.'
      },
      {
        title: 'تسجيل المصاريف التشغيلية',
        desc: 'انقر على "+ تسجيل مصاريف" لتسجيل الكراء، الكهرباء، التجهيزات، أو الصيانة مع تحديد الفئة والبيان.'
      },
      {
        title: 'التقارير المالية المباشرة',
        desc: 'معاينة إجمالي المداخيل، إجمالي المصاريف، والصافي المالي للشهر الحالي في أعلى الصفحة.'
      }
    ]
  },
  communication: {
    titleEN: 'Email Broadcasts & Communication Guide',
    titleAR: 'دليل المراسلات والبريد الجماعي',
    subtitleEN: 'Send email announcements, payment reminders, and exam notifications to students, parents, or staff.',
    subtitleAR: 'إرسال التنبيهات، تذكيرات السداد، والرسائل الجماعية للطلاب، أولياء الأمور، والأساتذة.',
    overviewEN: 'Broadcast custom emails or predefined template messages to specific groups (e.g. Debtor students only, Teachers, or specific grade levels) with optional attachments.',
    overviewAR: 'إرسال رسائل بريدية مخصصة أو باستخدام قوالب جاهزة لمجموعات محددة (مثل: الطلاب المتأخرين في السداد، الأساتذة، أو طور دراسي معين) مع إمكانية إرفاق ملفات.',
    stepsEN: [
      {
        title: 'Target Audience Selection',
        desc: 'Choose recipients: All Active Students, Debtor/Unpaid Students Only, Teachers, or Specific Grade Level.'
      },
      {
        title: 'Using Saved Templates',
        desc: 'Select a saved template (e.g., Payment Reminder, Holiday Notice) to instantly autofill subject and message text.'
      },
      {
        title: 'Attaching Files & Testing',
        desc: 'Attach PDF documents or images if needed, and verify SMTP email server connection before launching broadcasts.'
      },
      {
        title: 'Managing Communication Templates',
        desc: 'Create, edit, or delete reusable email templates under the Templates tab.'
      }
    ],
    stepsAR: [
      {
        title: 'تحديد فئة المستلمين',
        desc: 'اختر المستهدفين: جميع الطلاب النشطين، الطلاب المتأخرين في السداد فقط، الأساتذة، أو طور دراسي محدد.'
      },
      {
        title: 'استخدام القوالب الجاهزة',
        desc: 'اختر قالباً محميلاً مسبقاً (مثل: تذكير بسداد الرسوم، إشعار عطلة) لملء الموضوع والنص بنقرة واحدة.'
      },
      {
        title: 'إرفاق الملفات واختبار الاتصال',
        desc: 'يمكنك إرفاق ملفات PDF أو صور، واختبار سيرفر البريد (SMTP) قبل إطلاق المراسلة الجماعية.'
      },
      {
        title: 'إدارة قوالب المراسلات',
        desc: 'إنشاء، تعديل، أو حذف قوالب البريد الإلكتروني القابلة لإعادة الاستخدام في تبويب القوالب.'
      }
    ]
  },
  settings: {
    titleEN: 'System Settings & Security Guide',
    titleAR: 'دليل إعدادات النظام والأمان',
    subtitleEN: 'Configure school details, user permissions, database backups, and license key status.',
    subtitleAR: 'ضبط بيانات المدرسة، صلاحيات المستخدمين، النسخ الاحتياطي، وحالة تفعيل الترخيص.',
    overviewEN: 'Central control room for school metadata branding, staff account creation with granular module access controls, security settings, SQL database backups, and licensing.',
    overviewAR: 'غرفة التحكم المركزية لضبط اسم وهويّة المدرسة، إنشاء حسابات الموظفين وتحديد صلاحياتهم الدقيقة، النسخ الاحتياطي للبيانات، وتنشيط الترخيص.',
    stepsEN: [
      {
        title: 'School Profile Branding',
        desc: 'Set official School Name, Phone, Address, Email, and upload School Logo. These details automatically populate printed invoices and report cards.'
      },
      {
        title: 'User Accounts & Granular Permissions',
        desc: 'Add receptionist or staff accounts, set custom passwords, and toggle module-level access permissions (View, Edit, Delete for each tab).'
      },
      {
        title: 'Security & Profile Password Change',
        desc: 'Update your admin login password securely with interactive show/hide password visibility toggles.'
      },
      {
        title: 'Database Backup & System Wipe',
        desc: 'Export complete database backup files (.json) for safekeeping or restore previous backups when migrating computers.'
      },
      {
        title: 'License & System Status',
        desc: 'Review your license key expiration date, machine hardware ID, and enter renewal key codes.'
      }
    ],
    stepsAR: [
      {
        title: 'بيانات وشعار المدرسة',
        desc: 'قم بضبط اسم المدرسة الرسمي، الهاتف، العنوان، والبريد، ورفع الشعار. تظهر هذه البيانات تلقائياً في جميع الفواتير وكشوف النقاط المطبوعة.'
      },
      {
        title: 'حسابات الموظفين والصلاحيات الدقيقة',
        desc: 'إضافة حسابات للمستقبلين أو الموظفين، تحديد كلمات المرور، وتفعيل/تعطيل صلاحيات الوصول لكل قسم (عرض، إضافة، حذف).'
      },
      {
        title: 'الأمان وتغيير كلمة المرور',
        desc: 'تحديث كلمة مرور الحساب الخاص بك بأمان مع تفعيل زر إظهار/إخفاء كلمة المرور.'
      },
      {
        title: 'النسخ الاحتياطي واسترجاع البيانات',
        desc: 'تصدير نسخة احتياطية شاملة لقاعدة البيانات (.json) للحفظ، أو استرجاع نسخة عند تغيير الجهاز.'
      },
      {
        title: 'تنشيط الترخيص ومعلومات النظام',
        desc: 'مراجعة تاريخ صلاحية الترخيص، المعرف الفريد للجهاز (UUID)، وإدخال مفاتيح التجديد.'
      }
    ]
  }
}

export default function PageHelpModal({ pageKey }) {
  const { language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const isAr = language === 'ar'

  const guide = pageGuides[pageKey] || pageGuides.dashboard

  return (
    <>
      {/* High-visibility Stylized (!) Help Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-7 w-7 bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/60 rounded-xl text-blue-400 hover:text-blue-300 flex items-center justify-center transition-all cursor-pointer shadow-md shadow-blue-500/5 group shrink-0"
        title={isAr ? 'دليل استخدام هذه الصفحة' : 'Page Guide & Instructions'}
      >
        <span className="font-extrabold text-xs tracking-tighter group-hover:scale-110 transition-transform">!</span>
      </button>

      {/* Modal Popup via Portal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print" dir={isAr ? 'rtl' : 'ltr'}>
          <div 
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-955/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    {isAr ? guide.titleAR : guide.titleEN}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isAr ? guide.subtitleAR : guide.subtitleEN}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-start">
              
              {/* Overview Box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {isAr ? guide.overviewAR : guide.overviewEN}
                </p>
              </div>

              {/* Step-by-Step Instructions */}
              <div>
                <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {isAr ? 'خطوات وكيفية الاستخدام:' : 'How-To Instructions & Feature Guide:'}
                </h3>
                
                <div className="space-y-3">
                  {(isAr ? guide.stepsAR : guide.stepsEN).map((step, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-955/70 border border-slate-850 rounded-2xl flex items-start gap-3 hover:border-slate-800 transition-colors">
                      <div className="h-6 w-6 rounded-xl bg-slate-800 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">{step.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-medium">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-955/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
                <span>{isAr ? 'نظام إدارة المدارس التعليمي' : 'School ERP Interactive Assistant'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-550 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md shadow-blue-500/10 transition-all"
              >
                {isAr ? 'فهمت، إغلاق' : 'Got it, Close'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
