import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n'
import AdvancedTable from '../components/AdvancedTable'
import PageHelpModal from '../components/PageHelpModal'
import { DollarSign,ArrowUpRight,ArrowDownRight,Plus,RefreshCw,AlertCircle,Receipt,Tag,FileText,User,CreditCard,Search,X,Edit,Trash2,Printer,Download,Mail,Check } from 'lucide-react'
import { ipcService } from '../services/ipcService'
import { 
  getPeriodStartDateStr as getPeriodStartDateStrHelper,
  getPeriodEndDateStr as getPeriodEndDateStrHelper,
  getPeriodString as getPeriodStringHelper,
  getStudentCourseAttendanceStats as getStudentCourseAttendanceStatsHelper, 
  getCoursePaymentsBalance as getCoursePaymentsBalanceHelper,
  translateMonth as translateMonthHelper 
} from '../utils/billing'
import { RECEIPT_PRINT_STYLES, TEACHER_PAYOUT_PRINT_STYLES } from '../utils/printStyles'

export default function Finances() {
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

  const translateMonth = (mName) => {
    return translateMonthHelper(mName, t);
  };

  const exportToCSV = (filename, headers, rows) => {
    const escapeCell = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map(row => row.map(escapeCell).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPaymentsCSV = () => {
    const headers = [
      t('finances.receiptNoLabelShort') || "Receipt Number",
      t('students.fullNameCol') || "Student Name",
      t('students.courseCol') || "Course",
      t('finances.amountCol') || "Amount (DA)",
      t('finances.dateCol') || "Date",
      language === 'ar' ? 'الشهر' : "Month",
      language === 'ar' ? 'السنة' : "Year",
      t('finances.paymentMethodLabel') || "Payment Method"
    ];
    const rows = filteredPayments.map(p => [
      p.receipt_number,
      p.Student?.full_name || 'N/A',
      p.Course?.title || 'General / Unassigned',
      p.amount.toFixed(2),
      new Date(p.date).toLocaleDateString(),
      p.month || 'N/A',
      p.year ? String(p.year) : 'N/A',
      p.payment_method
    ]);
    exportToCSV('payments_report.csv', headers, rows);
  };

  const handleExportExpensesCSV = () => {
    const headers = [
      t('finances.categoryCol') || "Category",
      t('finances.descriptionCol') || "Description",
      t('finances.amountCol') || "Amount (DA)",
      t('finances.dateCol') || "Date"
    ];
    const rows = filteredExpenses.map(e => [
      translateCategory(e.category),
      e.description,
      e.amount.toFixed(2),
      new Date(e.date).toLocaleDateString()
    ]);
    exportToCSV('expenses_report.csv', headers, rows);
  };

  const handleExportPayoutsCSV = () => {
    const headers = [
      t('finances.receiptNoLabelShort') || "Receipt Number",
      t('teachers.instructorNameCol') || "Instructor Name",
      t('students.courseCol') || "Course",
      t('finances.amountCol') || "Amount Paid (DA)",
      t('finances.dateCol') || "Date",
      language === 'ar' ? 'الشهر' : "Month",
      language === 'ar' ? 'السنة' : "Year",
      t('customFeatures.coefficient') || "Payout %",
      language === 'ar' ? 'الغيابات' : "Absences",
      language === 'ar' ? 'خصم الغياب' : "Deduction",
      language === 'ar' ? 'الحصص المعوضة' : "Substitutions",
      language === 'ar' ? 'مستحق التعويض' : "Credit",
      t('finances.paymentMethodLabel') || "Payment Method"
    ];
    const rows = teacherPayments.map(tp => [
      tp.receipt_number,
      tp.Teacher?.full_name || 'N/A',
      tp.Course?.title || 'General / Unassigned',
      tp.amount.toFixed(2),
      new Date(tp.date).toLocaleDateString(),
      tp.month || 'N/A',
      tp.year ? String(tp.year) : 'N/A',
      tp.payoutPercentage ? `${tp.payoutPercentage}%` : '50%',
      tp.absences_count ? String(tp.absences_count) : '0',
      tp.absences_deduction ? tp.absences_deduction.toFixed(2) : '0.00',
      tp.substitutions_count ? String(tp.substitutions_count) : '0',
      tp.substitutions_credit ? tp.substitutions_credit.toFixed(2) : '0.00',
      tp.payment_method
    ]);
    exportToCSV('instructor_payouts_report.csv', headers, rows);
  };

  const translateMethod = (method) => {
    if (!method) return '';
    switch (method.toLowerCase()) {
      case 'cash': return t('finances.paymentMethodCash') || 'Cash';
      case 'card': return t('finances.paymentMethodCard') || 'Card';
      case 'bank transfer': return t('finances.paymentMethodBank') || 'Bank Transfer';
      case 'check': return t('finances.paymentMethodCheck') || 'Check';
      default: return method;
    }
  }

  const translateCategory = (cat) => {
    if (!cat) return '';
    const key = `finances.${cat.toLowerCase()}`;
    const result = t(key);
    return result === key ? cat : result;
  }
  const [activeTab, setActiveTab] = useState('payments') // 'payments' | 'expenses'

  // Correct active tab based on permissions
  useEffect(() => {
    const canPayments = hasPermission('finances:payment') || hasPermission('finances:view');
    const canExpenses = hasPermission('finances:write') || hasPermission('finances:view');
    const canUnpaid = hasPermission('finances:view');
    const canPayouts = hasPermission('finances:payout') || hasPermission('finances:view');

    if (activeTab === 'payments' && !canPayments) {
      if (canExpenses) setActiveTab('expenses');
      else if (canUnpaid) setActiveTab('unpaid');
      else if (canPayouts) setActiveTab('instructor-payments');
    } else if (activeTab === 'expenses' && !canExpenses) {
      if (canPayments) setActiveTab('payments');
      else if (canUnpaid) setActiveTab('unpaid');
      else if (canPayouts) setActiveTab('instructor-payments');
    } else if (activeTab === 'unpaid' && !canUnpaid) {
      if (canPayments) setActiveTab('payments');
      else if (canExpenses) setActiveTab('expenses');
      else if (canPayouts) setActiveTab('instructor-payments');
    } else if (activeTab === 'instructor-payments' && !canPayouts) {
      if (canPayments) setActiveTab('payments');
      else if (canExpenses) setActiveTab('expenses');
      else if (canUnpaid) setActiveTab('unpaid');
    }
  }, [activeTab]);
  const [students, setStudents] = useState([])
  const [allAbsences, setAllAbsences] = useState([])
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState({ totalRevenue: 0, totalExpenses: 0, netBalance: 0, monthName: '' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [unpaidSearch, setUnpaidSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [activePrintPayment, setActivePrintPayment] = useState(null)
  const [schoolName, setSchoolName] = useState('School Name')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolWebsite, setSchoolWebsite] = useState('')
  const [schoolBankDetails, setSchoolBankDetails] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')

  // Modals States
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [isRecordExpenseModalOpen, setIsRecordExpenseModalOpen] = useState(false)

  // Payments Filter States
  const [paySearchTerm, setPaySearchTerm] = useState('')
  const [payMethodFilter, setPayMethodFilter] = useState('All')
  const [payDateFilter, setPayDateFilter] = useState('All')

  // Expenses Filter States
  const [expSearchTerm, setExpSearchTerm] = useState('')
  const [expCategoryFilter, setExpCategoryFilter] = useState('All')
  const [expDateFilter, setExpDateFilter] = useState('All')

  const getPeriodStartDateStr = (startStr, index) => {
    return getPeriodStartDateStrHelper(startStr, index);
  };

  const getPeriodEndDateStr = (startStr, index) => {
    return getPeriodEndDateStrHelper(startStr, index);
  };

  const getPeriodString = (startStr, index, lang) => {
    return getPeriodStringHelper(startStr, index, lang, t);
  };

  const parsePeriodDates = (periodStr, year) => {
    if (!periodStr) return null;
    const parts = periodStr.split(' - ');
    if (parts.length === 2) {
      const parsePart = (part) => {
        const tokens = part.split(' ');
        if (tokens.length === 2) {
          const day = parseInt(tokens[0]);
          const monthAbbr = tokens[1].toLowerCase().substring(0, 3);
          const months = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          const monthIndex = months[monthAbbr] !== undefined ? months[monthAbbr] : 0;
          return new Date(year, monthIndex, day);
        }
        return null;
      };
      return {
        startDate: parsePart(parts[0]),
        endDate: parsePart(parts[1])
      };
    }
    return null;
  };

  const getStandardMonthName = (monthStr) => {
    if (!monthStr) return 'January';
    const lower = monthStr.toLowerCase();
    
    if (lower.includes('jan') || lower.includes('يناير') || lower.includes('جانفي')) return 'January';
    if (lower.includes('feb') || lower.includes('فبراير') || lower.includes('فيفري')) return 'February';
    if (lower.includes('mar') || lower.includes('مارس')) return 'March';
    if (lower.includes('apr') || lower.includes('أبريل') || lower.includes('افريل') || lower.includes('أفريل')) return 'April';
    if (lower.includes('may') || lower.includes('مايو') || lower.includes('ماي')) return 'May';
    if (lower.includes('jun') || lower.includes('يونيو') || lower.includes('جوان')) return 'June';
    if (lower.includes('jul') || lower.includes('يوليو') || lower.includes('جويلية')) return 'July';
    if (lower.includes('aug') || lower.includes('أغسطس') || lower.includes('أوت')) return 'August';
    if (lower.includes('sep') || lower.includes('سبتمبر')) return 'September';
    if (lower.includes('oct') || lower.includes('أكتوبر')) return 'October';
    if (lower.includes('nov') || lower.includes('نوفمبر')) return 'November';
    if (lower.includes('dec') || lower.includes('ديسمبر')) return 'December';
    
    return monthStr;
  };

  const parseTermEndDate = (termStr, yearVal) => {
    if (!termStr) return new Date();
    if (termStr.includes('-')) {
      const parts = termStr.split(' - ');
      if (parts.length === 2) {
        const dateStr = parts[1];
        const year = termStr.match(/\d{4}/) ? parseInt(termStr.match(/\d{4}/)[0]) : (yearVal || new Date().getFullYear());
        
        let monthIndex = 0;
        const lower = dateStr.toLowerCase();
        if (lower.includes('jan') || lower.includes('يناير') || lower.includes('جانفي')) monthIndex = 0;
        else if (lower.includes('feb') || lower.includes('فبراير') || lower.includes('فيفري')) monthIndex = 1;
        else if (lower.includes('mar') || lower.includes('مارس')) monthIndex = 2;
        else if (lower.includes('apr') || lower.includes('أبريل') || lower.includes('افريل') || lower.includes('أفريل')) monthIndex = 3;
        else if (lower.includes('may') || lower.includes('مايو') || lower.includes('ماي')) monthIndex = 4;
        else if (lower.includes('jun') || lower.includes('يونيو') || lower.includes('جوان')) monthIndex = 5;
        else if (lower.includes('jul') || lower.includes('يوليو') || lower.includes('جويلية')) monthIndex = 6;
        else if (lower.includes('aug') || lower.includes('أغسطس') || lower.includes('أوت')) monthIndex = 7;
        else if (lower.includes('sep') || lower.includes('سبتمبر')) monthIndex = 8;
        else if (lower.includes('oct') || lower.includes('أكتوبر')) monthIndex = 9;
        else if (lower.includes('nov') || lower.includes('نوفمبر')) monthIndex = 10;
        else if (lower.includes('dec') || lower.includes('ديسمبر')) monthIndex = 11;
        
        const dayMatch = dateStr.match(/\d+/);
        const day = dayMatch ? parseInt(dayMatch[0]) : 1;
        
        return new Date(year, monthIndex, day);
      }
    }
    
    const year = termStr.match(/\d{4}/) ? parseInt(termStr.match(/\d{4}/)[0]) : (yearVal || new Date().getFullYear());
    const lower = termStr.toLowerCase();
    let monthIndex = 0;
    if (lower.includes('jan') || lower.includes('يناير') || lower.includes('جانفي')) monthIndex = 0;
    else if (lower.includes('feb') || lower.includes('فبراير') || lower.includes('فيفري')) monthIndex = 1;
    else if (lower.includes('mar') || lower.includes('مارس')) monthIndex = 2;
    else if (lower.includes('apr') || lower.includes('أبريل') || lower.includes('افريل') || lower.includes('أفريل')) monthIndex = 3;
    else if (lower.includes('may') || lower.includes('مايو') || lower.includes('ماي')) monthIndex = 4;
    else if (lower.includes('jun') || lower.includes('يونيو') || lower.includes('جوان')) monthIndex = 5;
    else if (lower.includes('jul') || lower.includes('يوليو') || lower.includes('جويلية')) monthIndex = 6;
    else if (lower.includes('aug') || lower.includes('أغسطس') || lower.includes('أوت')) monthIndex = 7;
    else if (lower.includes('sep') || lower.includes('سبتمبر')) monthIndex = 8;
    else if (lower.includes('oct') || lower.includes('أكتوبر')) monthIndex = 9;
    else if (lower.includes('nov') || lower.includes('نوفمبر')) monthIndex = 10;
    else if (lower.includes('dec') || lower.includes('ديسمبر')) monthIndex = 11;
    
    return new Date(year, monthIndex + 1, 0);
  };

  const isMonthMatching = (paymentMonth, selectedMonth, selectedYear) => {
    if (!paymentMonth || !selectedMonth) return false;
    
    if (paymentMonth === selectedMonth) return true;
    if (paymentMonth.toLowerCase() === selectedMonth.toLowerCase()) return true;
    
    const standardMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (standardMonths.includes(selectedMonth)) {
      const periodDates = parsePeriodDates(paymentMonth, parseInt(selectedYear || new Date().getFullYear()));
      if (periodDates && periodDates.startDate) {
        const startMonthName = periodDates.startDate.toLocaleString('en-US', { month: 'long' });
        return startMonthName.toLowerCase() === selectedMonth.toLowerCase();
      }
    }
    
    if (standardMonths.includes(paymentMonth)) {
      const periodDates = parsePeriodDates(selectedMonth, parseInt(selectedYear || new Date().getFullYear()));
      if (periodDates && periodDates.startDate) {
        const startMonthName = periodDates.startDate.toLocaleString('en-US', { month: 'long' });
        return startMonthName.toLowerCase() === paymentMonth.toLowerCase();
      }
    }
    
    return false;
  };

  const getStudentCourseAttendanceStats = (student, courseId) => {
    return getStudentCourseAttendanceStatsHelper(student, courseId, allAbsences, language, t);
  };

  const getCoursePaymentsBalance = (student, courseId) => {
    return getCoursePaymentsBalanceHelper(student, courseId, allAbsences, language, t);
  };

  const getSelectedStudentBalance = () => {
    if (!paymentForm.StudentId) return null;
    const student = students.find(s => s.id === parseInt(paymentForm.StudentId));
    if (!student) return null;
    
    if (paymentForm.CourseId) {
      const courseId = parseInt(paymentForm.CourseId);
      const balanceInfo = getCoursePaymentsBalance(student, courseId);
      return { ...balanceInfo, name: student.full_name };
    }
    
    const balanceInfo = getCoursePaymentsBalance(student, null);
    return { ...balanceInfo, name: student.full_name };
  }

  // Form States
  const [paymentForm, setPaymentForm] = useState({
    StudentId: '',
    CourseId: '',
    amount: '',
    receipt_number: '',
    payment_method: 'Cash',
    month: '',
    year: ''
  })
  const [paymentErrors, setPaymentErrors] = useState({})

  const [expenseForm, setExpenseForm] = useState({
    category: 'Rent',
    amount: '',
    description: ''
  })
  const [expenseErrors, setExpenseErrors] = useState({})

  // Teacher Payments States
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([])
  const [teacherPayments, setTeacherPayments] = useState([])
  const [isRecordTeacherPaymentModalOpen, setIsRecordTeacherPaymentModalOpen] = useState(false)
  const [activePrintTeacherPayment, setActivePrintTeacherPayment] = useState(null)
  const [teacherPaymentForm, setTeacherPaymentForm] = useState({
    TeacherId: '',
    CourseId: '',
    amount: '',
    month: '',
    year: '',
    payment_method: 'Cash',
    receipt_number: '',
    payoutPercentage: '50',
    absence_penalty: '1000',
    absences_count: 0,
    absences_deduction: 0,
    substitutions_count: 0,
    substitutions_credit: 0
  })
  const [teacherPaymentErrors, setTeacherPaymentErrors] = useState({})
  const [instructorSubTab, setInstructorSubTab] = useState('all') // 'all' | 'pending'

  // Calculate pending payouts (instructors that haven't been paid for a cycle)
  const pendingPayouts = React.useMemo(() => {
    const grouped = {};
    
    // 1. Group active periods from student payments
    payments.forEach(p => {
      if (p.CourseId && p.month && p.year) {
        const course = courses.find(c => String(c.id) === String(p.CourseId));
        const teacherId = course?.TeacherId;
        if (teacherId) {
          const isFixed = course.payout_type === 'Fixed';
          const calMonth = isFixed ? getStandardMonthName(p.month) : p.month;
          const key = `${p.CourseId}-${calMonth}-${p.year}`;
          
          if (!grouped[key]) {
            const teacherObj = teachers.find(t => String(t.id) === String(teacherId));
            grouped[key] = {
              courseId: p.CourseId,
              courseTitle: course.title,
              teacherId: teacherId,
              teacherName: teacherObj?.full_name || 'Instructor',
              payout_type: course.payout_type || 'Percentage',
              fixed_payout_amount: course.fixed_payout_amount || 0.0,
              defaultPayoutRate: course.default_payout_rate !== undefined ? course.default_payout_rate : 50,
              month: calMonth,
              year: p.year,
              studentPaymentsSum: 0
            };
          }
          grouped[key].studentPaymentsSum += (p.amount || 0);
        }
      }
    });

    // 2. Add current month/year for all assigned courses (for month-end static payouts)
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();
    courses.forEach(course => {
      const teacherId = course.TeacherId;
      if (teacherId) {
        // Only include courses that have at least one active student enrolled
        const hasStudents = (students || []).some(s => 
          s.status === 'Active' && 
          (s.Courses || []).some(c => String(c.id) === String(course.id))
        );
        if (!hasStudents) return;

        const isFixed = course.payout_type === 'Fixed';
        const calMonth = isFixed ? getStandardMonthName(currentMonth) : currentMonth;
        const key = `${course.id}-${calMonth}-${currentYear}`;
        
        if (!grouped[key]) {
          const teacherObj = teachers.find(t => String(t.id) === String(teacherId));
          grouped[key] = {
            courseId: course.id,
            courseTitle: course.title,
            teacherId: teacherId,
            teacherName: teacherObj?.full_name || 'Instructor',
            payout_type: course.payout_type || 'Percentage',
            fixed_payout_amount: course.fixed_payout_amount || 0.0,
            defaultPayoutRate: course.default_payout_rate !== undefined ? course.default_payout_rate : 50,
            month: calMonth,
            year: currentYear,
            studentPaymentsSum: 0
          };
        }
      }
    });

    const list = [];
    Object.keys(grouped).forEach(key => {
      const cycle = grouped[key];
      const deservedGross = cycle.payout_type === 'Fixed'
        ? cycle.fixed_payout_amount
        : (cycle.studentPaymentsSum * cycle.defaultPayoutRate) / 100;
        
      const alreadyPaid = teacherPayments
        .filter(tp => 
          String(tp.TeacherId) === String(cycle.teacherId) &&
          String(tp.CourseId) === String(cycle.courseId) &&
          isMonthMatching(tp.month, cycle.month, cycle.year) &&
          String(tp.year) === String(cycle.year)
        )
        .reduce((sum, tp) => sum + (tp.amount || 0), 0);

      const remaining = deservedGross - alreadyPaid;
      if (remaining > 0.1) {
        if (cycle.payout_type === 'Fixed' || cycle.studentPaymentsSum > 0) {
          cycle.calculatedPayout = remaining;
          list.push(cycle);
        }
      }
    });
    return list;
  }, [payments, courses, teachers, teacherPayments]);

  const hasUnpaidStudents = React.useMemo(() => {
    return (students || []).some(student => 
      (student.Courses || []).some(course => {
        const balanceInfo = getCoursePaymentsBalance(student, course.id);
        return balanceInfo.balance > 0 && !balanceInfo.frozen;
      })
    );
  }, [students, payments, allAbsences]);

  // Load students, transactions, and summary
  const loadFinancialData = async () => {
    setLoading(true)
    try {
      // Fetch all data in parallel
      const [studentsData, paymentsData, expensesData, summaryData, settings, teachersData, teacherPaymentsData, coursesData, absencesData] = await Promise.all([
        ipcService.getStudents(),
        ipcService.getPayments(),
        ipcService.getExpenses(),
        ipcService.getFinancialSummary(),
        ipcService.getSettings(),
        ipcService.getTeachers(),
        ipcService.getTeacherPayments(),
        ipcService.getCourses(),
        ipcService.getAbsences({})
      ])
      
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setPayments(Array.isArray(paymentsData) ? paymentsData : [])
      setExpenses(Array.isArray(expensesData) ? expensesData : [])
      setSummary(summaryData)
      setTeachers(Array.isArray(teachersData) ? teachersData : [])
      setTeacherPayments(Array.isArray(teacherPaymentsData) ? teacherPaymentsData : [])
      setCourses(Array.isArray(coursesData) ? coursesData : [])
      setAllAbsences(Array.isArray(absencesData) ? absencesData : [])
      if (settings) {
        if (settings.school_name) setSchoolName(settings.school_name)
        if (settings.school_address) setSchoolAddress(settings.school_address)
        if (settings.school_phone) setSchoolPhone(settings.school_phone)
        if (settings.school_email) setSchoolEmail(settings.school_email)
        if (settings.school_website) setSchoolWebsite(settings.school_website)
        if (settings.school_bank_details) setSchoolBankDetails(settings.school_bank_details)
        if (settings.school_logo) setSchoolLogo(settings.school_logo)
      }
    } catch (err) {
      console.error("Error loading financial reports:", err)
      setStudents([])
      setPayments([])
      setExpenses([])
      setTeachers([])
      setTeacherPayments([])
      setCourses([])
      setAllAbsences([])
    } finally {
      // Delay slightly for smooth transitions
      setTimeout(() => {
        setLoading(false)
      }, 300)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [])

  // Auto-calculate instructor payout amount when selection changes (with unexcused absences deduction and substitution credits)
  useEffect(() => {
    let active = true;
    
    const calculatePayout = async () => {
      if (!isRecordTeacherPaymentModalOpen) return;
      
      const { TeacherId, CourseId, month, year, payoutPercentage, absence_penalty } = teacherPaymentForm;
      
      if (CourseId && month && year && TeacherId) {
        // 1. Base Payout Calculation
        const selectedCourseObj = courses.find(c => String(c.id) === String(CourseId));
        let basePayout = 0;
        if (selectedCourseObj?.payout_type === 'Fixed') {
          basePayout = parseFloat(selectedCourseObj.fixed_payout_amount || 0.0);
        } else {
          const total = payments
            .filter(p => 
              String(p.CourseId) === String(CourseId) && 
              isMonthMatching(p.month, month, year) && 
              String(p.year) === String(year)
            )
            .reduce((sum, p) => sum + (p.amount || 0), 0);
            
          const percentage = parseFloat(payoutPercentage || 50);
          basePayout = (total * percentage) / 100;
        }
        
        const alreadyPaid = teacherPayments
          .filter(tp => 
            String(tp.TeacherId) === String(TeacherId) &&
            String(tp.CourseId) === String(CourseId) &&
            isMonthMatching(tp.month, month, year) &&
            String(tp.year) === String(year)
          )
          .reduce((sum, tp) => sum + (tp.amount || 0), 0);
          
        basePayout = Math.max(0, basePayout - alreadyPaid);

        // Helper date ranges
        const periodDates = parsePeriodDates(month, parseInt(year));
        const monthNameToNum = {
          'January': '01', 'February': '02', 'March': '03', 'April': '04',
          'May': '05', 'June': '06', 'July': '07', 'August': '08',
          'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        
        // 2. Fetch Absences
        let absencesCount = 0;
        let deduction = 0;
        
        try {
          let list = await ipcService.getAbsences({
            TeacherId: parseInt(TeacherId),
            CourseId: parseInt(CourseId),
            status: 'Unexcused'
          });
          if (periodDates && periodDates.startDate && periodDates.endDate) {
            list = list.filter(a => {
              const aDate = new Date(a.date);
              return aDate >= periodDates.startDate && aDate < periodDates.endDate;
            });
          } else {
            const stdMonth = getStandardMonthName(month);
            const numMonth = monthNameToNum[stdMonth] || stdMonth;
            const prefix = `${year}-${String(numMonth).padStart(2, '0')}`;
            list = list.filter(a => a.date.startsWith(prefix));
          }

          absencesCount = list.length;
          const penalty = parseFloat(absence_penalty || 1000);
          deduction = absencesCount * penalty;
        } catch (err) {
          console.error("Failed to fetch absences for payout calculation:", err);
        }

        // 3. Fetch Substitutions
        let substitutionsCount = 0;
        let substitutionsCredit = 0;
        try {
          let subList = await ipcService.getAbsences({
            substitute_teacher_id: parseInt(TeacherId),
            CourseId: parseInt(CourseId)
          });
          if (periodDates && periodDates.startDate && periodDates.endDate) {
            subList = subList.filter(a => {
              const aDate = new Date(a.date);
              return aDate >= periodDates.startDate && aDate < periodDates.endDate;
            });
          } else {
            const stdMonth = getStandardMonthName(month);
            const numMonth = monthNameToNum[stdMonth] || stdMonth;
            const prefix = `${year}-${String(numMonth).padStart(2, '0')}`;
            subList = subList.filter(a => a.date.startsWith(prefix));
          }

          substitutionsCount = subList.length;
          const penalty = parseFloat(absence_penalty || 1000);
          substitutionsCredit = substitutionsCount * penalty; // credit the same amount
        } catch (err) {
          console.error("Failed to fetch substitutions for payout calculation:", err);
        }
        
        if (!active) return;
        
        const finalAmount = Math.max(0, basePayout - deduction + substitutionsCredit);
        
        setTeacherPaymentForm(prev => {
          if (
            prev.amount === (finalAmount > 0 ? finalAmount.toFixed(2) : '') &&
            prev.absences_count === absencesCount &&
            prev.absences_deduction === deduction &&
            prev.substitutions_count === substitutionsCount &&
            prev.substitutions_credit === substitutionsCredit
          ) {
            return prev;
          }
          return {
            ...prev,
            amount: finalAmount > 0 ? finalAmount.toFixed(2) : '',
            absences_count: absencesCount,
            absences_deduction: deduction,
            substitutions_count: substitutionsCount,
            substitutions_credit: substitutionsCredit
          };
        });
      } else {
        if (!active) return;
        setTeacherPaymentForm(prev => {
          if (
            prev.amount === '' && 
            prev.absences_count === 0 && 
            prev.absences_deduction === 0 &&
            prev.substitutions_count === 0 &&
            prev.substitutions_credit === 0
          ) {
            return prev;
          }
          return {
            ...prev,
            amount: '',
            absences_count: 0,
            absences_deduction: 0,
            substitutions_count: 0,
            substitutions_credit: 0
          };
        });
      }
    };
    
    calculatePayout();
    
    return () => {
      active = false;
    };
  }, [
    teacherPaymentForm.TeacherId,
    teacherPaymentForm.CourseId,
    teacherPaymentForm.month,
    teacherPaymentForm.year,
    teacherPaymentForm.absence_penalty,
    teacherPaymentForm.payoutPercentage,
    payments,
    isRecordTeacherPaymentModalOpen
  ]);

  // Helper to auto-generate receipt numbers
  const generateReceiptNumber = () => {
    const today = new Date();
    const yyyymmdd = today.getFullYear() + 
                     String(today.getMonth() + 1).padStart(2, '0') + 
                     String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    setPaymentForm(prev => ({
      ...prev,
      receipt_number: `RCPT-${yyyymmdd}-${rand}`
    }))
    if (paymentErrors.receipt_number) {
      setPaymentErrors(prev => ({ ...prev, receipt_number: '' }))
    }
  }

  // Payment form changes
  const [studentsWithDues, setStudentsWithDues] = useState([]) // added for balance references

  const handleSendPaymentReminder = async (item) => {
    const parentEmail = item.student.parent_email
    if (!parentEmail) {
      alert(language === 'ar' ? 'البريد الإلكتروني لولي الأمر غير مسجل لهذا الطالب. يرجى إضافته في شاشة الطلاب أولاً.' : 'Parent email is not registered for this student. Please set it in Students page.')
      return
    }

    const confirmSend = await confirm(
      language === 'ar' 
        ? `هل تريد إرسال تذكير بالدفع لولي أمر الطالب ${item.student.full_name} بقيمة ${item.balance} DA؟` 
        : `Do you want to send a payment reminder to ${item.student.full_name}'s parent for ${item.balance} DA?`
    )
    if (!confirmSend) return

    try {
      const subject = language === 'ar' ? 'تذكير بالواجبات المالية المستحقة' : 'Tuition Fee Payment Reminder'
      const body = language === 'ar' 
        ? `عزيزي ولي الأمر،\n\nنود تذكيركم بأن هناك مستحقات مالية متأخرة لمادة {course_title} الخاصة بالطالب {student_name}.\n\nالمبلغ المستحق: {payment_amount} DA.\n\nيرجى تسوية المبلغ في أقرب وقت.\nنشكر تعاونكم.\nإدارة المدرسة.`
        : `Dear Parent,\n\nThis is a friendly reminder that tuition fees are outstanding for the course {course_title} enrolled by {student_name}.\n\nOutstanding Balance: {payment_amount} DA.\n\nPlease clear the balance as soon as possible.\n\nThank you for your cooperation.\nSchool Administration.`
      
      const res = await ipcService.sendEmail({
        to: parentEmail,
        subject,
        body,
        placeholders: {
          student_name: item.student.full_name,
          course_title: item.course.title,
          payment_amount: item.balance.toString()
        }
      })

      if (res && res.success) {
        alert(language === 'ar' ? 'تم إرسال تذكير الدفع بنجاح!' : 'Payment reminder email sent successfully!')
      } else {
        alert(language === 'ar' ? `فشل في إرسال الإيميل: ${res.error}` : `Failed to send email: ${res.error}`)
      }
    } catch (err) {
      console.error(err)
      alert(language === 'ar' ? 'حدث خطأ أثناء عملية إرسال التذكير.' : 'Error occurred while sending payment reminder.')
    }
  }

  // Helper to generate teacher receipt numbers
  const generateTeacherReceiptNumber = () => {
    const today = new Date();
    const yyyymmdd = today.getFullYear() + 
                     String(today.getMonth() + 1).padStart(2, '0') + 
                     String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    setTeacherPaymentForm(prev => ({
      ...prev,
      receipt_number: `TCH-RCPT-${yyyymmdd}-${rand}`
    }))
    if (teacherPaymentErrors.receipt_number) {
      setTeacherPaymentErrors(prev => ({ ...prev, receipt_number: '' }))
    }
  }

  // Payment form changes
  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target
    setPaymentForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'StudentId' && value) {
        const student = students.find(s => s.id === parseInt(value));
        if (student && student.Courses && student.Courses.length === 1) {
          updated.CourseId = student.Courses[0].id.toString();
          
          // Auto select first unpaid month/year
          const balanceInfo = getCoursePaymentsBalance(student, student.Courses[0].id);
          if (balanceInfo && balanceInfo.unpaidMonths && balanceInfo.unpaidMonths.length > 0) {
            updated.month = balanceInfo.unpaidMonths[0].month;
            updated.year = balanceInfo.unpaidMonths[0].year.toString();
            updated.amount = balanceInfo.unpaidMonths[0].due.toString();
          } else {
            updated.month = '';
            updated.year = '';
            updated.amount = '';
          }
        } else {
          updated.CourseId = '';
          updated.month = '';
          updated.year = '';
          updated.amount = '';
        }
      } else if (name === 'CourseId' && value) {
        const student = students.find(s => s.id === parseInt(prev.StudentId));
        if (student) {
          const balanceInfo = getCoursePaymentsBalance(student, parseInt(value));
          if (balanceInfo && balanceInfo.unpaidMonths && balanceInfo.unpaidMonths.length > 0) {
            updated.month = balanceInfo.unpaidMonths[0].month;
            updated.year = balanceInfo.unpaidMonths[0].year.toString();
            updated.amount = balanceInfo.unpaidMonths[0].due.toString();
          } else {
            updated.month = '';
            updated.year = '';
            updated.amount = '';
          }
        }
      } else if (name === 'amount') {
        const student = students.find(s => s.id === parseInt(prev.StudentId));
        if (student && prev.CourseId) {
          const balanceInfo = getCoursePaymentsBalance(student, parseInt(prev.CourseId));
          const editAmount = selectedPayment ? parseFloat(selectedPayment.amount) : 0;
          const maxAllowed = balanceInfo.balance + editAmount;
          
          if (parseFloat(value) > maxAllowed) {
            updated.amount = maxAllowed.toString();
          } else if (parseFloat(value) < 0) {
            updated.amount = '0';
          }
        }
      }
      return updated;
    })
    if (paymentErrors[name]) {
      setPaymentErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Expense form changes
  const handleExpenseInputChange = (e) => {
    const { name, value } = e.target
    setExpenseForm(prev => ({
      ...prev,
      [name]: value
    }))
    if (expenseErrors[name]) {
      setExpenseErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Validate Payment
  const validatePayment = () => {
    const errors = {}
    if (!paymentForm.StudentId) {
      errors.StudentId = t('finances.validationStudentRequired')
    }
    if (!paymentForm.CourseId) {
      errors.CourseId = t('finances.validationCourseRequired')
    }
    if (paymentForm.CourseId) {
      if (!paymentForm.month) {
        errors.month = t('finances.validationMonthRequired')
      }
      if (!paymentForm.year) {
        errors.year = t('finances.validationYearRequired')
      }
    }
    const amountVal = parseFloat(paymentForm.amount)
    if (!paymentForm.amount || amountVal <= 0) {
      errors.amount = t('finances.validationAmountRequired')
    } else {
      const balanceInfo = getSelectedStudentBalance()
      if (balanceInfo) {
        // If editing, the current payment amount is already in the database and thus included in totalPaid.
        // So the actual outstanding balance before this payment was (balanceInfo.balance + selectedPayment.amount).
        const editAmount = selectedPayment ? parseFloat(selectedPayment.amount) : 0
        const maxAllowed = balanceInfo.balance + editAmount
        if (amountVal > maxAllowed) {
          errors.amount = `Amount exceeds outstanding balance of ${maxAllowed.toFixed(2)} DA`
        }
      }
    }
    if (!paymentForm.receipt_number.trim()) {
      errors.receipt_number = t('finances.validationReceiptRequired')
    }
    setPaymentErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Validate Expense
  const validateExpense = () => {
    const errors = {}
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      errors.amount = 'Please enter a valid positive amount'
    }
    if (!expenseForm.description.trim()) {
      errors.description = t('finances.validationDescriptionRequired')
    }
    setExpenseErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Payment Submit
  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    if (!validatePayment()) return

    setActionLoading(true)
    try {
      const payload = {
          amount: parseFloat(paymentForm.amount),
          receipt_number: paymentForm.receipt_number,
          payment_method: paymentForm.payment_method,
          StudentId: parseInt(paymentForm.StudentId),
          CourseId: parseInt(paymentForm.CourseId),
          month: paymentForm.month || null,
          year: paymentForm.year ? parseInt(paymentForm.year) : null
        }

        let res;
        if (selectedPayment) {
          res = await ipcService.updatePayment(selectedPayment.id, payload)
        } else {
          res = await ipcService.addPayment(payload)
        }

        if (res && res.error) {
          alert(res.error)
          setActionLoading(false)
          return
        }

        // Reset Form
        setPaymentForm({
          StudentId: '',
          CourseId: '',
          amount: '',
          receipt_number: '',
          payment_method: 'Cash',
          month: '',
          year: ''
        })
        setSelectedPayment(null)

        // Refresh Lists & Summaries
        await loadFinancialData()
        setIsRecordPaymentModalOpen(false)
    } catch (err) {
      console.error("Failed to save payment:", err)
      alert("Failed to submit payment transaction.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Expense Submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    if (!validateExpense()) return

    setActionLoading(true)
    try {
      const payload = {
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description
        }

        let res;
        if (selectedExpense) {
          res = await ipcService.updateExpense(selectedExpense.id, payload)
        } else {
          res = await ipcService.addExpense(payload)
        }

        if (res && res.error) {
          alert(res.error)
          setActionLoading(false)
          return
        }

        // Reset Form
        setExpenseForm({
          category: 'Rent',
          amount: '',
          description: ''
        })
        setSelectedExpense(null)

        // Refresh Lists & Summaries
        await loadFinancialData()
        setIsRecordExpenseModalOpen(false)
    } catch (err) {
      console.error("Failed to save expense:", err)
      alert("Failed to submit expense transaction.")
    } finally {
      setActionLoading(false)
    }
  }

  // Payment Edit/Delete Handlers
  const handleEditPayment = (payment) => {
    setSelectedPayment(payment)
    setPaymentForm({
      StudentId: payment.StudentId.toString(),
      CourseId: payment.CourseId ? payment.CourseId.toString() : '',
      amount: payment.amount.toString(),
      receipt_number: payment.receipt_number,
      payment_method: payment.payment_method,
      month: payment.month || '',
      year: payment.year ? payment.year.toString() : ''
    })
    setPaymentErrors({})
    setIsRecordPaymentModalOpen(true)
  }

  const handleDeletePayment = async (id) => {
    if (!(await window.confirm("Are you sure you want to permanently delete this tuition payment? This action cannot be undone."))) return;
    setActionLoading(true)
    try {
      const res = await ipcService.deletePayment(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        await loadFinancialData()
      }
    } catch (err) {
      console.error("Failed to delete payment:", err)
    } finally {
      setActionLoading(false)
    }
  }

  // Expense Edit/Delete Handlers
  const handleEditExpense = (expense) => {
    setSelectedExpense(expense)
    setExpenseForm({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description
    })
    setExpenseErrors({})
    setIsRecordExpenseModalOpen(true)
  }

  const handleDeleteExpense = async (id) => {
    if (!(await window.confirm(t('common.confirmDelete') || "Delete this record?"))) return;
    setActionLoading(true)
    try {
      const res = await ipcService.deleteExpense(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        await loadFinancialData()
      }
    } catch (err) {
      console.error("Failed to delete expense:", err)
    } finally {
      setActionLoading(false)
    }
  }

  // Teacher Payout Form Submit Handler
  const handleTeacherPaymentSubmit = async (e) => {
    e.preventDefault()
    
    // Validate
    const errors = {}
    if (!teacherPaymentForm.TeacherId) errors.TeacherId = 'Please select an instructor.'
    if (!teacherPaymentForm.CourseId) errors.CourseId = 'Please select a course.'
    if (!teacherPaymentForm.month) errors.month = 'Please select a month.'
    if (!teacherPaymentForm.year) errors.year = 'Please select a year.'
    if (!teacherPaymentForm.amount || parseFloat(teacherPaymentForm.amount) <= 0) errors.amount = 'Please enter a valid payout amount.'
    if (!teacherPaymentForm.receipt_number) errors.receipt_number = 'Receipt number is required.'
    
    if (Object.keys(errors).length > 0) {
      setTeacherPaymentErrors(errors)
      return
    }

    const payload = {
      TeacherId: parseInt(teacherPaymentForm.TeacherId),
      CourseId: parseInt(teacherPaymentForm.CourseId),
      amount: parseFloat(teacherPaymentForm.amount),
      month: teacherPaymentForm.month,
      year: parseInt(teacherPaymentForm.year),
      payment_method: teacherPaymentForm.payment_method,
      receipt_number: teacherPaymentForm.receipt_number,
      absences_count: parseInt(teacherPaymentForm.absences_count || 0),
      absences_deduction: parseFloat(teacherPaymentForm.absences_deduction || 0),
      substitutions_count: parseInt(teacherPaymentForm.substitutions_count || 0),
      substitutions_credit: parseFloat(teacherPaymentForm.substitutions_credit || 0)
    }
    
    setActionLoading(true)
    try {
      const res = await ipcService.addTeacherPayment(payload)
      if (res && res.error) {
        alert(res.error)
        setActionLoading(false)
        return
      }
      
      // Reset form
      setTeacherPaymentForm({
        TeacherId: '',
        CourseId: '',
        amount: '',
        month: new Date().toLocaleString('en-US', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        payment_method: 'Cash',
        receipt_number: '',
        payoutPercentage: '50',
        absence_penalty: '1000',
        absences_count: 0,
        absences_deduction: 0
      })
      setTeacherPaymentErrors({})
      setIsRecordTeacherPaymentModalOpen(false)
      
      // Refresh financial data
      await loadFinancialData()
    } catch (err) {
      console.error("Failed to add instructor payment:", err)
      alert("Failed to record instructor payment.")
    } finally {
      setActionLoading(false)
    }
  }

  // Pre-fill form from pending unpaid cycle list
  const handlePayInstructorFromPending = (cycle) => {
    const calculated = cycle.calculatedPayout !== undefined 
      ? cycle.calculatedPayout 
      : (cycle.payout_type === 'Fixed' ? cycle.fixed_payout_amount : (cycle.studentPaymentsSum * cycle.defaultPayoutRate) / 100);
    const today = new Date();
    const yyyymmdd = today.getFullYear() + 
                     String(today.getMonth() + 1).padStart(2, '0') + 
                     String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const receiptNum = `RCPT-${yyyymmdd}-${rand}`;

    const teacherObj = teachers.find(t => String(t.id) === String(cycle.teacherId));
    const penaltyRate = teacherObj?.absence_penalty_rate !== undefined ? teacherObj.absence_penalty_rate : 1000;

    setTeacherPaymentForm({
      TeacherId: cycle.teacherId.toString(),
      CourseId: cycle.courseId.toString(),
      amount: calculated.toFixed(2),
      month: cycle.month,
      year: cycle.year.toString(),
      payment_method: 'Cash',
      receipt_number: receiptNum,
      payoutPercentage: cycle.defaultPayoutRate.toString(),
      absence_penalty: penaltyRate.toString(),
      absences_count: 0,
      absences_deduction: 0
    });
    setTeacherPaymentErrors({});
    setIsRecordTeacherPaymentModalOpen(true);
  };

  // Teacher Payout Delete Handler
  const handleDeleteTeacherPayment = async (id) => {
    if (!(await window.confirm("Are you sure you want to permanently delete this instructor payment? This action cannot be undone."))) return;
    setActionLoading(true);
    try {
      const res = await ipcService.deleteTeacherPayment(id);
      if (res && res.error) {
        alert(res.error);
      } else {
        await loadFinancialData();
      }
    } catch (err) {
      console.error("Failed to delete teacher payment:", err);
    } finally {
      setActionLoading(false);
    }
  }

  // {t('finances.printReceiptTooltip')} Handler
  const handlePrintPayment = (payment) => {
    setActivePrintPayment(payment)
  }

  const handleDownloadReceiptPDF = async (payment, action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert("PDF export is only available in the desktop application.");
      return;
    }
    
    setActionLoading(true);
    try {
      const studentObj = students.find(s => s.id === payment.StudentId);
      const selectedCourse = payment.Course || studentObj?.Courses?.find(c => String(c.id) === String(payment.CourseId)) || null;
      
      let totalTuition, totalPaid, balance;
      if (selectedCourse && studentObj) {
        const balanceInfo = getCoursePaymentsBalance(studentObj, selectedCourse.id);
        totalTuition = balanceInfo.totalTuition;
        totalPaid = balanceInfo.totalPaid;
        balance = balanceInfo.balance;
      } else {
        totalTuition = payment.amount;
        totalPaid = payment.amount;
        balance = 0;
      }

      const isAr = language === 'ar';
      const textAlignLeft = isAr ? 'right' : 'left';
      const textAlignRight = isAr ? 'left' : 'right';

      const coursesRows = selectedCourse 
        ? `
            <tr style="border-bottom: none;">
              <td style="padding: 5px 0; color: #000000; font-weight: 700; font-size: 8px; text-align: ${textAlignLeft};">
                ${selectedCourse.title} (Tuition Fee${payment.month && payment.year ? ` - ${payment.month} ${payment.year}` : ''})
              </td>
              <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000;">${(selectedCourse.price || 0).toFixed(2)} DA</td>
              <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000; font-weight: 700;">${(selectedCourse.price || 0).toFixed(2)} DA</td>
            </tr>
          `
        : `
            <tr style="border-bottom: none;">
              <td style="padding: 5px 0; color: #000000; font-weight: 700; font-size: 8px; text-align: ${textAlignLeft};">
                Tuition Fee Payment (General / Unassigned${payment.month && payment.year ? ` - ${payment.month} ${payment.year}` : ''})
              </td>
              <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000;">${(payment.amount || 0).toFixed(2)} DA</td>
              <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000; font-weight: 700;">${(payment.amount || 0).toFixed(2)} DA</td>
            </tr>
          `;
          
      const logoHtml = schoolLogo 
        ? `<div style="display: flex; align-items: center; gap: 8px; justify-content: ${isAr ? 'flex-end' : 'flex-start'};">
            <img src="${schoolLogo}" style="max-height: 30px; max-width: 90px; object-fit: contain;" />
            <span style="font-size: 9px; font-weight: 900; color: #000000; line-height: 1.1; display: block;">${schoolName}</span>
           </div>`
        : `<div style="display: flex; align-items: center; gap: 6px; justify-content: ${isAr ? 'flex-end' : 'flex-start'};">
            <svg style="width: 18px; height: 18px; fill: #000000; display: block;" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div style="display: flex; flex-direction: column; text-align: ${textAlignLeft}; font-family: 'Inter', sans-serif;">
              <span style="font-size: 9px; font-weight: 900; color: #000000; line-height: 1.1; display: block;">${schoolName}</span>
            </div>
          </div>`;
          
      const getSingleInvoiceHtml = (copyTitle) => `
        <div class="invoice-top">
          <table class="header-table">
            <tr>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignLeft};">
                ${logoHtml}
              </td>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignRight};">
                <div class="copy-badge" style="margin-bottom: 4px; display: inline-block;">${copyTitle}</div>
                <div style="font-size: 6.5px; color: #000000; font-weight: 550; line-height: 1.3; font-family: 'Inter', sans-serif;">
                  ${schoolAddress ? `<div>${schoolAddress}</div>` : ''}
                  ${schoolPhone ? `<div>${t('settings.schoolPhoneLabel')}: ${schoolPhone}</div>` : ''}
                  ${schoolEmail ? `<div>${t('settings.schoolEmailLabel')}: ${schoolEmail}</div>` : ''}
                  ${schoolWebsite ? `<div>${schoolWebsite}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
          <div class="divider-line"></div>
          <h1 class="invoice-title" style="text-align: ${textAlignLeft};">${t('students.invoiceTitle')}</h1>
          <table class="details-table">
            <tr>
              <td style="width: 55%; vertical-align: top; text-align: ${textAlignLeft}; border-${isAr ? 'left' : 'right'}: 1px solid #e2e8f0; padding-${isAr ? 'left' : 'right'}: 10px;">
                <span style="font-size: 7px; color: #000000; font-weight: bold; text-transform: uppercase; tracking-wider block mb-1">${isAr ? 'فاتورة إلى:' : 'Invoice To:'}</span>
                <div style="font-size: 10px; font-weight: 900; color: #000000; margin-bottom: 2px; font-family: 'Inter', sans-serif;">${studentObj?.full_name || 'N/A'}</div>
                <div style="font-size: 8px; color: #475569; mt-1">
                  ${studentObj?.phone ? `<div>${isAr ? 'الهاتف:' : 'Phone:'} ${studentObj.phone}</div>` : ''}
                  ${studentObj?.parent_phone ? `<div>${isAr ? 'هاتف الولي:' : 'Parent Phone:'} ${studentObj.parent_phone}</div>` : ''}
                </div>
              </td>
              <td style="width: 45%; vertical-align: top; text-align: ${textAlignRight};">
                <table style="width: 100%; border-collapse: collapse; font-size: 8px; color: #475569; line-height: 1.4; margin-left: auto;">
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; width: 50%; font-family: 'Inter', sans-serif;">${isAr ? 'رقم الوصل:' : 'Invoice No:'}</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; font-family: monospace; font-size: 8.5px; color: #000000; font-weight: 700; width: 50%;">${payment.receipt_number}</td>
                  </tr>
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; font-family: 'Inter', sans-serif;">${isAr ? 'تاريخ الدفع:' : 'Issue Date:'}</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; color: #000000; font-weight: 700; font-family: 'Inter', sans-serif;">${new Date(payment.date).toLocaleDateString(isAr ? 'ar-DZ' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; font-family: 'Inter', sans-serif;">${isAr ? 'طريقة الدفع:' : 'Payment Method:'}</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; color: #000000; font-weight: 700; text-transform: uppercase; font-family: 'Inter', sans-serif;">
                      ${payment.payment_method === 'Cash' || !payment.payment_method ? (isAr ? 'نقداً' : 'Cash') :
                        payment.payment_method === 'Card' ? (isAr ? 'بطاقة بنكية' : 'Card') :
                        payment.payment_method === 'Bank Transfer' ? (isAr ? 'تحويل بنكي' : 'Bank Transfer') :
                        payment.payment_method === 'Check' ? (isAr ? 'شيك' : 'Check') : payment.payment_method}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table class="items-table" style="direction: ${isAr ? 'rtl' : 'ltr'};">
            <thead>
              <tr style="border-top: 1px solid #000000; border-bottom: 1px solid #000000;">
                <th style="padding: 4px 0; text-align: ${textAlignLeft}; width: 64%;">${isAr ? 'الوصف' : 'Description'}</th>
                <th style="padding: 4px 0; text-align: ${textAlignRight}; width: 18%;">${isAr ? 'القيمة' : 'Rate'}</th>
                <th style="padding: 4px 0; text-align: ${textAlignRight}; width: 18%;">${isAr ? 'المبلغ الصافي' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              ${coursesRows}
            </tbody>
          </table>
          <div class="totals-container" style="text-align: ${textAlignRight};">
            <table class="totals-table" style="float: ${textAlignRight}; margin-${isAr ? 'right' : 'left'}: auto; margin-${isAr ? 'left' : 'right'}: 0;">
              ${selectedCourse ? `
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px;">${isAr ? 'المجموع الفرعي (سعر المادة)' : 'Subtotal (Course Price)'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700;">${totalTuition.toFixed(2)} DA</td>
                </tr>
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px;">${isAr ? 'إجمالي المدفوع للمادة' : 'Total Paid for Course'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700; color: #16a34a;">${totalPaid.toFixed(2)} DA</td>
                </tr>
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px;">${isAr ? 'الرصيد المتبقي للمادة' : 'Balance Outstanding'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">${balance.toFixed(2)} DA</td>
                </tr>
              ` : ''}
              <tr style="font-weight: 800; color: #000000; border-top: 1px solid #e2e8f0;">
                <td style="text-align: ${textAlignLeft}; padding: 6px 0; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px;">${isAr ? 'المبلغ المدفوع (هذا الوصل)' : 'Amount Paid (This Receipt)'}</td>
                <td style="text-align: ${textAlignRight}; padding: 6px 0; font-family: monospace; font-size: 14px; font-weight: 900; color: #000000;">${payment.amount.toFixed(2)} DA</td>
              </tr>
              <tr style="border-bottom: 1px solid #000000;"><td colspan="2" style="padding: 0;"></td></tr>
            </table>
          </div>
        </div>
        <div class="invoice-bottom">
          <table class="footer-table">
            <tr>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignLeft};">
              </td>
              <td style="width: 50%; vertical-align: bottom; text-align: ${textAlignRight};">
                <div style="display: inline-block; text-align: ${textAlignLeft}; margin-bottom: 2px;">
                  <div style="width: 100px; border-bottom: 1px solid #000000; margin-bottom: 4px;"></div>
                  <div style="font-size: 7px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">${isAr ? 'توقيع الإدارة / المسؤول' : 'Authorized Signature'}</div>
                </div>
              </td>
            </tr>
          </table>
          <div class="terms-section" style="text-align: ${textAlignLeft};">
            <div style="font-size: 6.5px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${isAr ? 'الشروط والأحكام:' : 'Terms & Conditions:'}</div>
            <div style="font-size: 6px; color: #94a3b8; line-height: 1.2; font-family: 'Inter', sans-serif;">
              ${isAr ? 'يعتبر هذا المستند وصلاً رسمياً لدفع الرسوم الدراسية ورسوم التسجيل. تخضع جميع المدفوعات لسياسة التسجيل والاسترداد الخاصة بالمركز. التسجيل في المواد غير قابل للتحويل.' : 'This document serves as an official receipt of payment for tuition and enrollment fees. All payments are subject to the center\'s registration and refund policy. Enrollment in courses is non-transferable.'}
            </div>
          </div>
        </div>
      `;
      
      const html = `
<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>Receipt - ${payment.receipt_number}</title>
  <style>
    ${RECEIPT_PRINT_STYLES}
    body {
      direction: ${isAr ? 'rtl' : 'ltr'};
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="invoice-half">
      ${getSingleInvoiceHtml(isAr ? 'نسخة الزبون / Client Copy' : 'Client Copy')}
    </div>
    <div class="middle-divider">
      <span class="scissors-icon">✂️</span>
    </div>
    <div class="invoice-half">
      ${getSingleInvoiceHtml(language === 'ar' ? 'نسخة الإدارة / Office Copy' : 'Office Copy')}
    </div>
  </div>
</body>
</html>
      `;
      
      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5');
        if (res && res.success) {
          alert("Sent to printer successfully!");
        }
      } else {
        const filename = `Receipt_${payment.receipt_number}.pdf`;
        const res = await ipcService.printPdf(html, filename, 'A5');
        if (res && res.success) {
          alert("Receipt PDF generated and saved successfully!");
        }
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadTeacherPayoutPDF = async (payment, action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert("PDF export is only available in the desktop application.");
      return;
    }
    
    setActionLoading(true);
    try {
      const teacherObj = teachers.find(t => String(t.id) === String(payment.TeacherId));
      const courseObj = payment.Course || courses.find(c => String(c.id) === String(payment.CourseId)) || null;
      const courseTitleSuffix = courseObj ? ` - Course: ${courseObj.title}` : '';
      
      const isAr = language === 'ar';
      const textAlignLeft = isAr ? 'right' : 'left';
      const textAlignRight = isAr ? 'left' : 'right';

      let coursesRows = `
        <tr style="border-bottom: none;">
          <td style="padding: 5px 0; color: #000000; font-weight: 700; font-size: 8px; text-align: ${textAlignLeft};">
            Monthly Instructor Salary/Payout (${payment.month} ${payment.year})${courseTitleSuffix}
          </td>
          <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000;">
            ${payment.payoutPercentage || '50'}%
          </td>
          <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; color: #000000; font-weight: 700;">
            ${(payment.amount + (payment.absences_deduction || 0) - (payment.substitutions_credit || 0)).toFixed(2)} DA
          </td>
        </tr>
      `;

      if (payment.absences_count > 0) {
        coursesRows += `
          <tr style="border-bottom: none; color: #dc2626;">
            <td style="padding: 5px 0; font-weight: 700; font-size: 8px; text-align: ${textAlignLeft};">
              ${isAr
                ? `خصم الغياب غير المبرر (${payment.absences_count} غياب)`
                : `Unexcused Absences Deduction (${payment.absences_count} absences)`}
            </td>
            <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px;">—</td>
            <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; font-weight: 700;">
              -${payment.absences_deduction.toFixed(2)} DA
            </td>
          </tr>
        `;
      }

      if (payment.substitutions_count > 0) {
        coursesRows += `
          <tr style="border-bottom: none; color: #10b981;">
            <td style="padding: 5px 0; font-weight: 700; font-size: 8px; text-align: ${textAlignLeft};">
              ${isAr
                ? `إضافة حصص تعويضية (${payment.substitutions_count} حصة)`
                : `Substituted Sessions Credit (${payment.substitutions_count} sessions)`}
            </td>
            <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px;">—</td>
            <td style="padding: 5px 0; text-align: ${textAlignRight}; font-size: 8px; font-weight: 700;">
              +${(payment.substitutions_credit || 0).toFixed(2)} DA
            </td>
          </tr>
        `;
      }

      const logoHtml = schoolLogo 
        ? `<div style="display: flex; align-items: center; gap: 8px; justify-content: ${isAr ? 'flex-end' : 'flex-start'};">
            <img src="${schoolLogo}" style="max-height: 30px; max-width: 90px; object-fit: contain;" />
            <span style="font-size: 9px; font-weight: 900; color: #000000; line-height: 1.1; display: block;">${schoolName}</span>
           </div>`
        : `<div style="display: flex; align-items: center; gap: 6px; justify-content: ${isAr ? 'flex-end' : 'flex-start'};">
            <svg style="width: 18px; height: 18px; fill: #000000; display: block;" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div style="display: flex; flex-direction: column; text-align: ${textAlignLeft}; font-family: 'Inter', sans-serif;">
              <span style="font-size: 9px; font-weight: 900; color: #000000; line-height: 1.1; display: block;">${schoolName}</span>
            </div>
          </div>`;
          
      const getSingleInvoiceHtml = (copyTitle) => `
        <div class="invoice-top">
          <table class="header-table">
            <tr>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignLeft};">
                ${logoHtml}
              </td>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignRight};">
                <div class="copy-badge" style="margin-bottom: 4px; display: inline-block;">${copyTitle}</div>
                <div style="font-size: 6.5px; color: #000000; font-weight: 550; line-height: 1.3; font-family: 'Inter', sans-serif;">
                  ${schoolAddress ? `<div>${schoolAddress}</div>` : ''}
                  ${schoolPhone ? `<div>${t('settings.schoolPhoneLabel')}: ${schoolPhone}</div>` : ''}
                  ${schoolEmail ? `<div>${t('settings.schoolEmailLabel')}: ${schoolEmail}</div>` : ''}
                  ${schoolWebsite ? `<div>${schoolWebsite}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
          <div class="divider-line"></div>
          <h1 class="invoice-title" style="text-align: ${textAlignLeft};">${t('finances.disbursementVoucherTitle')}</h1>
          <table class="details-table">
            <tr>
              <td style="width: 55%; vertical-align: top; text-align: ${textAlignLeft}; border-${isAr ? 'left' : 'right'}: 1px solid #e2e8f0; padding-${isAr ? 'left' : 'right'}: 10px;">
                <span style="font-size: 7px; color: #000000; font-weight: bold; text-transform: uppercase; tracking-wider block mb-1">${isAr ? 'دفع إلى الأستاذ:' : 'Paid To Instructor:'}</span>
                <div style="font-size: 10px; font-weight: 900; color: #000000; margin-bottom: 2px; font-family: 'Inter', sans-serif;">${teacherObj?.full_name || 'N/A'}</div>
                <div style="font-size: 8px; color: #475569; mt-1">
                  ${teacherObj?.phone ? `<div>${isAr ? 'الهاتف:' : 'Phone:'} ${teacherObj.phone}</div>` : ''}
                  ${teacherObj?.specialty ? `<div>${isAr ? 'التخصص:' : 'Specialty:'} ${teacherObj.specialty}</div>` : ''}
                </div>
              </td>
              <td style="width: 45%; vertical-align: top; text-align: ${textAlignRight};">
                <table style="width: 100%; border-collapse: collapse; font-size: 8px; color: #475569; line-height: 1.4; margin-left: auto;">
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; width: 50%; font-family: 'Inter', sans-serif;">${t('finances.receiptNoLabelShort')}:</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; font-family: monospace; font-size: 8.5px; color: #000000; font-weight: 700; width: 50%;">${payment.receipt_number}</td>
                  </tr>
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; font-family: 'Inter', sans-serif;">${isAr ? 'تاريخ الصرف:' : 'Disbursed Date:'}</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; color: #000000; font-weight: 700; font-family: 'Inter', sans-serif;">${new Date(payment.date).toLocaleDateString(isAr ? 'ar-DZ' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0; color: #000000; font-weight: 800; font-family: 'Inter', sans-serif;">${isAr ? 'طريقة الصرف:' : 'Payment Method:'}</td>
                    <td style="text-align: ${textAlignRight}; padding: 1px 0 1px 5px; color: #000000; font-weight: 700; text-transform: uppercase; font-family: 'Inter', sans-serif;">
                      ${payment.payment_method === 'Cash' || !payment.payment_method ? (isAr ? 'نقداً' : 'Cash') :
                        payment.payment_method === 'Card' ? (isAr ? 'بطاقة بنكية' : 'Card') :
                        payment.payment_method === 'Bank Transfer' ? (isAr ? 'تحويل بنكي' : 'Bank Transfer') :
                        payment.payment_method === 'Check' ? (isAr ? 'شيك' : 'Check') : payment.payment_method}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table class="items-table" style="direction: ${isAr ? 'rtl' : 'ltr'};">
            <thead>
              <tr style="border-top: 1px solid #000000; border-bottom: 1px solid #000000;">
                <th style="padding: 4px 0; text-align: ${textAlignLeft}; width: 64%;">${isAr ? 'الوصف' : 'Description'}</th>
                <th style="padding: 4px 0; text-align: ${textAlignRight}; width: 18%;">${isAr ? 'النسبة' : 'Rate'}</th>
                <th style="padding: 4px 0; text-align: ${textAlignRight}; width: 18%;">${isAr ? 'المبلغ الصافي' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              ${coursesRows}
            </tbody>
          </table>
          <div class="totals-container" style="text-align: ${textAlignRight};">
            <table class="totals-table" style="float: ${textAlignRight}; margin-${isAr ? 'right' : 'left'}: auto; margin-${isAr ? 'left' : 'right'}: 0;">
              ${payment.absences_count > 0 || payment.substitutions_count > 0 ? `
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px;">${isAr ? 'المستحق الإجمالي' : 'Gross Payout'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700;">${(payment.amount + (payment.absences_deduction || 0) - (payment.substitutions_credit || 0)).toFixed(2)} DA</td>
                </tr>
              ` : ''}
              ${payment.absences_count > 0 ? `
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px; color: #dc2626;">${isAr ? 'خصم الغيابات' : 'Absences Deduction'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700; color: #dc2626;">-${payment.absences_deduction.toFixed(2)} DA</td>
                </tr>
              ` : ''}
              ${payment.substitutions_count > 0 ? `
                <tr>
                  <td style="text-align: ${textAlignLeft}; padding: 2px 0; font-size: 7px; color: #10b981;">${isAr ? 'تعويض الحصص' : 'Substitutions Credit'}</td>
                  <td style="text-align: ${textAlignRight}; padding: 2px 0; font-family: monospace; font-size: 8.5px; font-weight: 700; color: #10b981;">+${payment.substitutions_credit.toFixed(2)} DA</td>
                </tr>
              ` : ''}
              <tr style="font-weight: 800; color: #000000; border-top: 1px solid #e2e8f0;">
                <td style="text-align: ${textAlignLeft}; padding: 6px 0; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px;">${isAr ? 'المبلغ المصروف (الصافي)' : 'Amount Disbursed (Net)'}</td>
                <td style="text-align: ${textAlignRight}; padding: 6px 0; font-family: monospace; font-size: 14px; font-weight: 900; color: #000000;">${payment.amount.toFixed(2)} DA</td>
              </tr>
              <tr style="border-bottom: 1px solid #000000;"><td colspan="2" style="padding: 0;"></td></tr>
            </table>
          </div>
        </div>
        <div class="invoice-bottom">
          <table class="footer-table">
            <tr>
              <td style="width: 50%; vertical-align: top; text-align: ${textAlignLeft};">
              </td>
              <td style="width: 50%; vertical-align: bottom; text-align: ${textAlignRight};">
                <div style="display: inline-block; text-align: ${textAlignLeft}; margin-bottom: 2px;">
                  <div style="width: 100px; border-bottom: 1px solid #000000; margin-bottom: 4px;"></div>
                  <div style="font-size: 7px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">${isAr ? 'توقيع الإدارة / المسؤول' : 'Authorized Signature'}</div>
                </div>
              </td>
            </tr>
          </table>
          <div class="terms-section" style="text-align: ${textAlignLeft};">
            <div style="font-size: 6.5px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${isAr ? 'شروط وملاحظات:' : 'Terms & Notes:'}</div>
            <div style="font-size: 6px; color: #94a3b8; line-height: 1.2; font-family: 'Inter', sans-serif;">
              ${isAr ? 'يؤكد هذا السند دفع أتعاب/راتب الأستاذ للشهر المحدد. يقر الأستاذ باستلام المبلغ الكامل المذكور أعلاه.' : 'This voucher confirms payment of instructor fees/salary for the specified month. The instructor acknowledges receipt of the full payment described above.'}
            </div>
          </div>
        </div>
      `;
      
      const html = `
<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>Salary Voucher - ${payment.receipt_number}</title>
  <style>
    ${TEACHER_PAYOUT_PRINT_STYLES}
    body {
      direction: ${language === 'ar' ? 'rtl' : 'ltr'};
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="invoice-half">
      ${getSingleInvoiceHtml(language === 'ar' ? 'نسخة الأستاذ / Instructor Copy' : 'Instructor Copy')}
    </div>
    <div class="middle-divider">
      <span class="scissors-icon">✂️</span>
    </div>
    <div class="invoice-half">
      ${getSingleInvoiceHtml(language === 'ar' ? 'نسخة الإدارة / Office Copy' : 'Office Copy')}
    </div>
  </div>
</body>
</html>
      `;
      
      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5');
        if (res && res.success) {
          alert("Sent to printer successfully!");
        }
      } else {
        const filename = `Salary_Voucher_${payment.receipt_number}.pdf`;
        const res = await ipcService.printPdf(html, filename, 'A5');
        if (res && res.success) {
          alert("Salary voucher generated and saved successfully!");
        }
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF.");
    } finally {
      setActionLoading(false);
    }
  }

  // Format Date Helper
  const formatTxDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const todayPayments = payments.filter(p => {
    if (!p.date) return false;
    const pDate = new Date(p.date);
    const today = new Date();
    return pDate.getFullYear() === today.getFullYear() &&
           pDate.getMonth() === today.getMonth() &&
           pDate.getDate() === today.getDate();
  });
  const todayCashTotal = todayPayments
    .filter(p => p.payment_method === 'Cash')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const todayTotalAllMethods = todayPayments
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Client-side local filtering for payments
  const filteredPayments = payments.filter(pay => {
    const studentName = pay.Student?.full_name || '';
    const receiptNum = pay.receipt_number || '';
    const matchesSearch = studentName.toLowerCase().includes(paySearchTerm.toLowerCase()) ||
                          receiptNum.toLowerCase().includes(paySearchTerm.toLowerCase());
                          
    const matchesMethod = payMethodFilter === 'All' || pay.payment_method === payMethodFilter;
    
    let matchesDate = true;
    if (payDateFilter !== 'All') {
      const txDate = new Date(pay.date);
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (payDateFilter === 'ThisMonth') {
        matchesDate = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      } else if (payDateFilter === 'LastMonth') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        matchesDate = txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear;
      } else if (payDateFilter === 'ThisYear') {
        matchesDate = txDate.getFullYear() === currentYear;
      }
    }
    
    return matchesSearch && matchesMethod && matchesDate;
  })

  // Client-side local filtering for expenses
  const filteredExpenses = expenses.filter(exp => {
    const desc = exp.description || '';
    const matchesSearch = desc.toLowerCase().includes(expSearchTerm.toLowerCase());
    
    const matchesCategory = expCategoryFilter === 'All' || exp.category === expCategoryFilter;
    
    let matchesDate = true;
    if (expDateFilter !== 'All') {
      const txDate = new Date(exp.date);
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (expDateFilter === 'ThisMonth') {
        matchesDate = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      } else if (expDateFilter === 'LastMonth') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        matchesDate = txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear;
      } else if (expDateFilter === 'ThisYear') {
        matchesDate = txDate.getFullYear() === currentYear;
      }
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  })

    const paymentsColumns = React.useMemo(() => [
    {
      accessorKey: 'receipt_number',
      header: t('finances.receiptNoCol'),
      cell: ({ getValue }) => <span className="font-mono text-[10px] text-slate-500 tracking-wider whitespace-nowrap">{getValue()}</span>,
      size: 180
    },
    {
      accessorKey: 'Student',
      header: t('finances.studentCol'),
      cell: ({ row }) => {
        const studentName = row.original.Student?.full_name || `Student ID: ${row.original.StudentId}`;
        return (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-200 truncate">{studentName}</span>
          </div>
        );
      },
      size: 220
    },
    {
      accessorKey: 'Course',
      header: t('finances.courseCol'),
      cell: ({ row }) => {
        const courseName = row.original.Course?.title;
        return courseName ? (
          <span className="text-slate-300 font-semibold truncate block">{courseName}</span>
        ) : (
          <span className="text-slate-555 italic block">General</span>
        );
      },
      size: 180
    },
    {
      accessorKey: 'payment_method',
      header: t('finances.methodCol'),
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-blue-500/10 border border-blue-500/20 text-blue-400">
          {translateMethod(getValue() || 'Cash')}
        </span>
      ),
      size: 110
    },
    {
      accessorKey: 'amount',
      header: t('finances.amountCol'),
      cell: ({ getValue }) => (
        <span className="font-bold text-emerald-400 font-mono whitespace-nowrap">
          ${getValue().toFixed(2)}
        </span>
      ),
      size: 120
    },
    {
      accessorKey: 'date',
      header: t('finances.dateCol'),
      cell: ({ getValue }) => (
        <span className="text-slate-555 whitespace-nowrap">
          {formatTxDate(getValue())}
        </span>
      ),
      size: 130
    },
    {
      id: 'actions',
      header: () => <div className={`${language === 'ar' ? 'text-left' : 'text-right'} no-print`}>{t('finances.actionsCol')}</div>,
      cell: ({ row }) => {
        const pay = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 no-print">
            <button
              type="button"
              onClick={() => handlePrintPayment(pay)}
              className="p-1 hover:bg-slate-800 text-blue-400 hover:text-blue-300 rounded cursor-pointer transition-colors inline-block"
              title={t('finances.printReceiptTooltip')}
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            {hasPermission('finances:payment') && (
              <button
                type="button"
                onClick={() => handleEditPayment(pay)}
                className="p-1 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded cursor-pointer transition-colors inline-block"
                title={t('finances.editPaymentTooltip')}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {hasPermission('finances:delete') && (
              <button
                type="button"
                onClick={() => handleDeletePayment(pay.id)}
                className="p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-455 rounded cursor-pointer transition-colors inline-block"
                title={t('finances.deletePaymentTooltip')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
      size: 120
    }
  ], [language, t, hasPermission]);

  const expensesColumns = React.useMemo(() => [
    {
      accessorKey: 'category',
      header: t('finances.categoryCol'),
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-rose-500/10 border border-rose-500/20 text-rose-400">
          {translateCategory(getValue())}
        </span>
      ),
      size: 140
    },
    {
      accessorKey: 'description',
      header: t('finances.descriptionCol'),
      cell: ({ getValue }) => (
        <span className="text-slate-200 max-w-xs truncate block">
          {getValue()}
        </span>
      ),
      size: 320
    },
    {
      accessorKey: 'amount',
      header: t('finances.amountCol'),
      cell: ({ getValue }) => (
        <span className="font-bold text-rose-400 font-mono whitespace-nowrap">
          ${getValue().toFixed(2)}
        </span>
      ),
      size: 120
    },
    {
      accessorKey: 'date',
      header: t('finances.dateCol'),
      cell: ({ getValue }) => (
        <span className="text-slate-550 whitespace-nowrap">
          {formatTxDate(getValue())}
        </span>
      ),
      size: 130
    },
    {
      id: 'actions',
      header: () => <div className={`${language === 'ar' ? 'text-left' : 'text-right'} no-print`}>{t('finances.actionsCol')}</div>,
      cell: ({ row }) => {
        const exp = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 no-print">
            {hasPermission('finances:write') && (
              <button
                type="button"
                onClick={() => handleEditExpense(exp)}
                className="p-1 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded cursor-pointer transition-colors inline-block"
                title={t('finances.editExpenseTooltip')}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {hasPermission('finances:delete') && (
              <button
                type="button"
                onClick={() => handleDeleteExpense(exp.id)}
                className="p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-455 rounded cursor-pointer transition-colors inline-block"
                title={t('finances.deleteExpenseTooltip')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
      size: 110
    }
  ], [language, t, hasPermission]);

  const unpaidColumns = React.useMemo(() => [
    {
      accessorKey: 'student.full_name',
      header: t('finances.studentCol'),
      cell: ({ row }) => (
        <span className="font-semibold text-slate-200 truncate block">
          {row.original.student?.full_name}
        </span>
      ),
      size: 220
    },
    {
      accessorKey: 'course.title',
      header: t('finances.courseCol'),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="space-y-0.5">
            <p className="text-slate-300 font-semibold truncate">{item.course?.title}</p>
            {item.unpaidMonths && item.unpaidMonths.length > 0 && (
              <p className="text-[9.5px] text-rose-400 font-semibold mt-0.5 animate-pulse truncate">
                {t('finances.pending')}: {item.unpaidMonths.map(m => `${translateMonth(m.month)} ${m.year}`).join(', ')}
              </p>
            )}
          </div>
        );
      },
      size: 260
    },
    {
      accessorKey: 'totalTuition',
      header: t('finances.tuitionPrice'),
      cell: ({ getValue }) => (
        <span className="font-mono font-semibold text-slate-400 whitespace-nowrap">
          {getValue().toFixed(2)} DA
        </span>
      ),
      size: 140
    },
    {
      accessorKey: 'totalPaid',
      header: t('finances.amountCol'),
      cell: ({ getValue }) => (
        <span className="font-mono font-semibold text-emerald-440 whitespace-nowrap">
          {getValue().toFixed(2)} DA
        </span>
      ),
      size: 140
    },
    {
      accessorKey: 'balance',
      header: t('finances.outstandingDue'),
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-455 font-mono whitespace-nowrap">
          {getValue().toFixed(2)} DA
        </span>
      ),
      size: 140
    },
    {
      id: 'actions',
      header: () => <div className={`${language === 'ar' ? 'text-left' : 'text-right'} no-print`}>{t('finances.action')}</div>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 no-print">
            <button
              onClick={() => {
                setSelectedPayment(null)
                const today = new Date();
                const yyyymmdd = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
                const rand = Math.floor(1000 + Math.random() * 9000);
                setPaymentForm({
                  StudentId: item.student.id.toString(),
                  CourseId: item.course.id.toString(),
                  amount: item.unpaidMonths && item.unpaidMonths.length > 0 ? item.unpaidMonths[0].due.toString() : item.balance.toString(),
                  receipt_number: `RCPT-${yyyymmdd}-${rand}`,
                  payment_method: 'Cash',
                  month: item.unpaidMonths && item.unpaidMonths.length > 0 ? item.unpaidMonths[0].month : '',
                  year: item.unpaidMonths && item.unpaidMonths.length > 0 ? item.unpaidMonths[0].year.toString() : ''
                });
                setPaymentErrors({});
                setActiveTab('payments');
                setIsRecordPaymentModalOpen(true);
              }}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('finances.recordPayment')}
            </button>

            <button
              onClick={() => handleSendPaymentReminder(item)}
              title={language === 'ar' ? 'إرسال تذكير بالدفع لولي الأمر' : 'Send payment reminder email to parent'}
              className="p-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
            >
              <Mail className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
      size: 180
    }
  ], [language, t]);

  const pendingPayoutsColumns = React.useMemo(() => [
    {
      accessorKey: 'teacherName',
      header: t('finances.teacherCol'),
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-200 truncate block">{getValue()}</span>
      ),
      size: 180
    },
    {
      accessorKey: 'courseTitle',
      header: t('courses.courseTitleLabel'),
      cell: ({ getValue }) => (
        <span className="text-slate-300 truncate block">{getValue()}</span>
      ),
      size: 180
    },
    {
      accessorKey: 'month',
      header: language === 'ar' ? 'الدورة الشهرية' : 'Monthly Term',
      cell: ({ row }) => (
        <span className="text-slate-400 font-semibold whitespace-nowrap">
          {translateMonth(row.original.month)} {row.original.year}
        </span>
      ),
      size: 130
    },
    {
      accessorKey: 'studentPaymentsSum',
      header: language === 'ar' ? 'الرسوم المحصلة' : 'Tuition Collected',
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-slate-400 whitespace-nowrap">
          {getValue().toFixed(2)} DA
        </span>
      ),
      size: 150
    },
    {
      accessorKey: 'defaultPayoutRate',
      header: language === 'ar' ? 'نسبة المستحقات (%)' : 'Payout Cut (%)',
      cell: ({ row }) => (
        <span className="font-bold text-blue-400 font-mono whitespace-nowrap">
          {row.original.payout_type === 'Fixed'
            ? (language === 'ar' ? 'ثابت (شهري)' : 'Fixed (Monthly)')
            : `${row.original.defaultPayoutRate}%`
          }
        </span>
      ),
      size: 140
    },
    {
      id: 'calculatedPayout',
      header: language === 'ar' ? 'الراتب المحتسب' : 'Calculated Payout',
      cell: ({ row }) => {
        const cycle = row.original;
        const estimated = cycle.calculatedPayout !== undefined 
          ? cycle.calculatedPayout 
          : (cycle.payout_type === 'Fixed' ? cycle.fixed_payout_amount : (cycle.studentPaymentsSum * cycle.defaultPayoutRate) / 100);
        return (
          <span className="font-mono font-extrabold text-emerald-400 whitespace-nowrap">
            {estimated.toFixed(2)} DA
          </span>
        );
      },
      size: 150
    },
    {
      id: 'daysLeft',
      header: language === 'ar' ? 'الأيام المتبقية' : 'Days Left',
      cell: ({ row }) => {
        const cycle = row.original;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const courseObj = courses.find(c => String(c.id) === String(cycle.courseId));
        
        let targetDate = null;
        if (cycle.month && cycle.month.includes('-')) {
          targetDate = parseTermEndDate(cycle.month, cycle.year);
        } else if (courseObj && courseObj.createdAt) {
          const start = new Date(courseObj.createdAt);
          start.setHours(0, 0, 0, 0);
          const timeElapsed = today.getTime() - start.getTime();
          const elapsedDays = Math.max(0, Math.floor(timeElapsed / (1000 * 60 * 60 * 24)));
          const cycleIndex = Math.floor(elapsedDays / 30);
          
          targetDate = new Date(start);
          targetDate.setDate(start.getDate() + (cycleIndex + 1) * 30);
        } else {
          targetDate = parseTermEndDate(cycle.month, cycle.year);
        }
        
        targetDate.setHours(0, 0, 0, 0);
        const timeDiff = targetDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        let badgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm";
        let displayText = language === 'ar' ? `${daysLeft} يوم` : `${daysLeft} days`;
        
        if (daysLeft <= 0) {
          badgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm";
          displayText = language === 'ar' ? 'جاهز للدفع' : 'Ready';
        } else if (daysLeft <= 5) {
          badgeClass = "bg-rose-500/10 text-rose-455 border border-rose-500/25 shadow-sm";
        } else if (daysLeft <= 15) {
          badgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm";
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${badgeClass}`}>
            {displayText}
          </span>
        );
      },
      size: 130
    },
    {
      id: 'actions',
      header: () => <div className={`${language === 'ar' ? 'text-left' : 'text-right'} no-print`}>{t('common.actions')}</div>,
      cell: ({ row }) => {
        const cycle = row.original;
        return (
          <div className="flex items-center justify-end no-print">
            <button
              onClick={() => handlePayInstructorFromPending(cycle)}
              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-600 text-emerald-450 hover:text-white rounded-xl text-[10px] font-semibold transition-all cursor-pointer shadow-sm hover:shadow-emerald-500/10 whitespace-nowrap"
            >
              {language === 'ar' ? 'دفع' : 'Pay'}
            </button>
          </div>
        );
      },
      size: 100
    }
  ], [language, t, courses]);

  const recordedPayoutsColumns = React.useMemo(() => [
    {
      accessorKey: 'receipt_number',
      header: t('finances.receiptNoCol'),
      cell: ({ getValue }) => (
        <span className="font-mono text-[10px] text-slate-500 tracking-wider whitespace-nowrap">
          {getValue()}
        </span>
      ),
      size: 160
    },
    {
      accessorKey: 'Teacher',
      header: t('finances.teacherCol'),
      cell: ({ row }) => (
        <span className="font-semibold text-slate-200 truncate block">
          {row.original.Teacher?.full_name || `Instructor ID: ${row.original.TeacherId}`}
        </span>
      ),
      size: 180
    },
    {
      accessorKey: 'Course',
      header: t('finances.courseCol'),
      cell: ({ row }) => (
        <span className="text-slate-300 truncate block">
          {row.original.Course?.title || (language === 'ar' ? 'عام / غير محدد' : 'General / Unassigned')}
        </span>
      ),
      size: 180
    },
    {
      id: 'term',
      header: language === 'ar' ? 'الدورة الشهرية' : 'Monthly Term',
      cell: ({ row }) => (
        <span className="text-slate-300 font-semibold whitespace-nowrap">
          {translateMonth(row.original.month)} {row.original.year}
        </span>
      ),
      size: 130
    },
    {
      accessorKey: 'payment_method',
      header: t('finances.methodCol'),
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-blue-500/10 border border-blue-500/20 text-blue-400">
          {getValue() || 'Cash'}
        </span>
      ),
      size: 110
    },
    {
      accessorKey: 'amount',
      header: language === 'ar' ? 'المبلغ المصروف' : 'Amount Paid',
      cell: ({ getValue }) => (
        <span className="font-bold text-emerald-455 font-mono whitespace-nowrap">
          {getValue().toFixed(2)} DA
        </span>
      ),
      size: 130
    },
    {
      accessorKey: 'date',
      header: t('finances.dateCol'),
      cell: ({ getValue }) => (
        <span className="text-slate-555 whitespace-nowrap">
          {formatTxDate(getValue())}
        </span>
      ),
      size: 130
    },
    {
      id: 'actions',
      header: () => <div className={`${language === 'ar' ? 'text-left' : 'text-right'} no-print`}>{t('common.actions')}</div>,
      cell: ({ row }) => {
        const pay = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 no-print">
            <button
              type="button"
              onClick={() => setActivePrintTeacherPayment(pay)}
              className="p-1 hover:bg-slate-800 text-blue-400 hover:text-blue-300 rounded cursor-pointer transition-colors inline-block"
              title={t('finances.printSalaryTooltip')}
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            {hasPermission('finances:delete') && (
              <button
                type="button"
                onClick={() => handleDeleteTeacherPayment(pay.id)}
                className="p-1 hover:bg-slate-800 text-rose-500 hover:text-rose-455 rounded cursor-pointer transition-colors inline-block"
                title={t('finances.deleteSalaryTooltip') || 'Delete Payout'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
      size: 100
    }
  ], [language, t, hasPermission]);


  return (
    <div className="no-print">
      <div className="space-y-8 animate-fade-in-up">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">{t('finances.title')}</h1>
            <PageHelpModal pageKey="finances" />
          </div>
          <p className="text-xs text-slate-400">{t('finances.subtitle')}</p>
        </div>
        <button onClick={loadFinancialData} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer shrink-0" >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'تحديث السجل' : 'Reload Ledger'}
        </button>
      </div>

      {/* IPC API Offline Warning */}
      {!window.api && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Electron IPC API is offline. Make sure the application is running inside Electron context to record financial transactions.</span>
        </div>
      )}

      {/* Summary Cards Grid */}
      {hasPermission('finances:view') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{t('dashboard.revenueSeries')} ({summary.monthName ? translateMonth(summary.monthName) : (language === 'ar' ? 'الشهر الحالي' : 'Current Month')})</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-100">{summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">{language === 'ar' ? 'إجمالي الرسوم المستلمة' : 'Total Tuition Received'}</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{t('dashboard.expensesSeries')} ({summary.monthName ? translateMonth(summary.monthName) : (language === 'ar' ? 'الشهر الحالي' : 'Current Month')})</span>
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ArrowDownRight className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-100">{summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">{language === 'ar' ? 'المصاريف التشغيلية' : 'Operational Spendings'}</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{language === 'ar' ? 'صافي الميزانية الشهرية' : 'Net Monthly Balance'}</span>
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-100">{summary.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">{language === 'ar' ? 'الرصيد النقدي الحالي' : 'Current Ledger Cash'}</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800/60 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{language === 'ar' ? 'المقبوضات النقدية لليوم' : 'Daily Cash Received'}</span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-slate-100">{todayCashTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</h3>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">
                {language === 'ar' ? `نقدًا اليوم (المجموع: ${todayTotalAllMethods.toFixed(2)} د.ج)` : `Cash Today (Total: ${todayTotalAllMethods.toFixed(2)} DA)`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Workspace */}
      <div className="space-y-6">
        {/* Tab triggers */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            id="tab-trigger-payments"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer border ${
              activeTab === 'payments'
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Receipt className="h-4 w-4" />
            {t('finances.tabPayments')}
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer border ${
              activeTab === 'expenses'
                ? 'bg-rose-600/10 border-rose-500/20 text-rose-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Tag className="h-4 w-4" />
            {t('finances.tabExpenses')}
          </button>
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer border ${
              activeTab === 'unpaid'
                ? 'bg-purple-600/10 border-purple-500/20 text-purple-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            {language === 'ar' ? 'أرصدة معلقة' : 'Unpaid Balances'}
            {hasUnpaidStudents && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 border border-slate-900"></span>
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('instructor-payments')}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer border ${
              activeTab === 'instructor-payments'
                ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <User className="h-4 w-4" />
            {t('finances.tabPayouts')}
            {pendingPayouts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 border border-slate-900"></span>
              </span>
            )}
          </button>
        </div>

        {/* Tab workspaces */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* ==================== PAYMENTS WORKSPACE ==================== */}
          {activeTab === 'payments' && (
            <div className="lg:col-span-3 w-full">
              {/* Payments Table */}
              <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden ">
                <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">{language === 'ar' ? 'سجل تسويات رسوم الطلاب' : 'Tuition Payment Ledger'}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportPaymentsCSV}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={language === 'ar' ? 'تصدير كملف CSV' : 'Export to CSV'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                    {hasPermission('finances:payment') && (
                      <button
                        id="record-payment-btn"
                        onClick={() => {
                          setSelectedPayment(null)
                          setPaymentForm({
                            StudentId: '',
                            CourseId: '',
                            amount: '',
                            receipt_number: '',
                            payment_method: 'Cash'
                          })
                          setPaymentErrors({})
                          setIsRecordPaymentModalOpen(true)
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        {t('finances.recordPayment')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters control bar */}
                {payments.length > 0 && (
                  <div className="p-4 bg-slate-955/40 border-b border-slate-805/60 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[150px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-550" />
                      <input
                        type="text"
                        placeholder={t('finances.searchStudentPlaceholder')}
                        value={paySearchTerm}
                        onChange={(e) => setPaySearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 placeholder-slate-550 focus:outline-none focus:border-blue-500/40"
                      />
                    </div>
                    <select
                      value={payMethodFilter}
                      onChange={(e) => setPayMethodFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="All">{language === 'ar' ? 'جميع طرق الدفع' : 'All Methods'}</option>
                      <option value="Cash">{t('finances.paymentMethodCash')}</option>
                      <option value="Card">{t('finances.paymentMethodCard')}</option>
                      <option value="Transfer">{t('finances.paymentMethodBank')}</option>
                    </select>
                    <select
                      value={payDateFilter}
                      onChange={(e) => setPayDateFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-955 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="All">{language === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
                      <option value="ThisMonth">{t('finances.thisMonth')}</option>
                      <option value="LastMonth">{t('finances.lastMonth')}</option>
                      <option value="ThisYear">{t('finances.thisYear')}</option>
                    </select>
                    <span className="text-[10px] text-slate-555 font-medium ml-auto">
                      {filteredPayments.length} of {payments.length}
                    </span>
                  </div>
                )}

                {loading ? (
                  /* Table Skeleton */
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                    <Receipt className="h-8 w-8 text-slate-600" />
                    <p className="text-xs">No tuition payments have been recorded yet. Click "Record Payment" above to add one.</p>
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">No matching payments</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      No payments match your filter criteria.
                    </p>
                    <button
                      onClick={() => {
                        setPaySearchTerm('');
                        setPayMethodFilter('All');
                        setPayDateFilter('All');
                      }}
                      className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="">
                    <AdvancedTable 
                      data={filteredPayments}
                      columns={paymentsColumns}
                      enablePagination={true}
                      defaultPageSize={10}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== EXPENSES WORKSPACE ==================== */}
          {activeTab === 'expenses' && (
            <div className="lg:col-span-3 w-full">
              {/* Expenses Table */}
              <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">{t('finances.expenseLedger')}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExpensesCSV}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={language === 'ar' ? 'تصدير كملف CSV' : 'Export to CSV'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                    {hasPermission('finances:write') && (
                      <button
                        onClick={() => {
                          setSelectedExpense(null)
                          setExpenseForm({
                            category: 'Rent',
                            amount: '',
                            description: ''
                          })
                          setExpenseErrors({})
                          setIsRecordExpenseModalOpen(true)
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        {t('finances.recordExpenseBtn')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters control bar */}
                {expenses.length > 0 && (
                  <div className="p-4 bg-slate-955/40 border-b border-slate-805/60 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[150px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-550" />
                      <input
                        type="text"
                        placeholder={t('finances.searchExpensePlaceholder')}
                        value={expSearchTerm}
                        onChange={(e) => setExpSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-955 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 placeholder-slate-555 focus:outline-none focus:border-blue-500/40"
                      />
                    </div>
                    <select
                      value={expCategoryFilter}
                      onChange={(e) => setExpCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="All">{t('finances.allCategories')}</option>
                      <option value="Rent">{t('finances.rent')}</option>
                      <option value="Utilities">{t('finances.utilities')}</option>
                      <option value="Salaries">{t('finances.salaries')}</option>
                      <option value="Other">{t('finances.other')}</option>
                    </select>
                    <select
                      value={expDateFilter}
                      onChange={(e) => setExpDateFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                    >
                      <option value="All">{t('finances.allTime')}</option>
                      <option value="ThisMonth">{t('finances.thisMonth')}</option>
                      <option value="LastMonth">{t('finances.lastMonth')}</option>
                      <option value="ThisYear">{t('finances.thisYear')}</option>
                    </select>
                    <span className="text-[10px] text-slate-555 font-medium ml-auto">
                      {filteredExpenses.length} of {expenses.length}
                    </span>
                  </div>
                )}

                {loading ? (
                  /* Table Skeleton */
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                    <FileText className="h-8 w-8 text-slate-600" />
                    <p className="text-xs">No debit expenses have been recorded yet. Click "Record Expense" above to add one.</p>
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">No matching expenses</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      No expenses match your filter criteria.
                    </p>
                    <button
                      onClick={() => {
                        setExpSearchTerm('');
                        setExpCategoryFilter('All');
                        setExpDateFilter('All');
                      }}
                      className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="">
                    <AdvancedTable 
                      data={filteredExpenses}
                      columns={expensesColumns}
                      enablePagination={true}
                      defaultPageSize={10}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== UNPAID BALANCES WORKSPACE ==================== */}
          {activeTab === 'unpaid' && (
            <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{t('finances.tuitionReceivablesDirectory')}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t('finances.tuitionReceivablesSubtitle')}</p>
                </div>
                <div className="w-full sm:max-w-xs">
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'البحث باسم الطالب...' : 'Filter by student name...'}
                    value={unpaidSearch}
                    onChange={(e) => setUnpaidSearch(e.target.value)}
                    className="w-full px-3.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/40"
                  />
                </div>
              </div>

              {loading ? (
                <div className="p-8 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (() => {
                const unpaidCoursesList = [];
                students.forEach(student => {
                  (student.Courses || []).forEach(course => {
                    const balanceInfo = getCoursePaymentsBalance(student, course.id);
                    if (balanceInfo.balance > 0) {
                      unpaidCoursesList.push({
                        student,
                        course,
                        totalTuition: balanceInfo.totalTuition,
                        totalPaid: balanceInfo.totalPaid,
                        balance: balanceInfo.balance,
                        unpaidMonths: balanceInfo.unpaidMonths
                      });
                    }
                  });
                });

                const filteredUnpaid = unpaidCoursesList.filter(item => {
                  const sSearch = item.student.full_name.toLowerCase();
                  const cSearch = item.course.title.toLowerCase();
                  const term = unpaidSearch.toLowerCase();
                  return sSearch.includes(term) || cSearch.includes(term);
                });

                if (filteredUnpaid.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                      <AlertCircle className="h-8 w-8 text-slate-600 animate-pulse" />
                      <p className="text-xs">{language === 'ar' ? 'لم يتم العثور على أي أرصدة غير مدفوعة. كل الحسابات مسواة!' : 'No outstanding balances found. All accounts are settled!'}</p>
                    </div>
                  );
                }

                return (
                  <div className="">
                    <AdvancedTable 
                      data={filteredUnpaid}
                      columns={unpaidColumns}
                      enablePagination={true}
                      defaultPageSize={10}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* ==================== INSTRUCTOR PAYMENTS WORKSPACE ==================== */}
          {activeTab === 'instructor-payments' && (
            <div className="lg:col-span-3 w-full">
              {/* Instructor Payments Table */}
              <div className="w-full bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-955/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">{language === 'ar' ? 'سجل مستحقات الأساتذة' : 'Instructor Payouts Ledger'}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? 'متابعة صرف مستحقات ورواتب الأساتذة' : 'Track faculty salary disbursements and cycle dues'}</p>
                    </div>
                    {/* Sub-tab selection */}
                    <div className="flex bg-slate-955 p-1 rounded-xl border border-slate-850 self-start sm:self-auto">
                      <button
                        onClick={() => setInstructorSubTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                          instructorSubTab === 'all'
                            ? 'subtab-active'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {language === 'ar' ? 'جميع المدفوعات' : 'All Payouts'}
                      </button>
                      <button
                        onClick={() => setInstructorSubTab('pending')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                          instructorSubTab === 'pending'
                            ? 'subtab-active'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {language === 'ar' ? 'الدورات المعلقة' : 'Pending Cycles'}
                        {pendingPayouts.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-rose-505 text-white text-[9px] rounded-full font-bold animate-pulse">
                            {pendingPayouts.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportPayoutsCSV}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={language === 'ar' ? 'تصدير كملف CSV' : 'Export to CSV'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                    {hasPermission('finances:payout') && (
                      <button
                        onClick={() => {
                          setTeacherPaymentForm({
                            TeacherId: '',
                            CourseId: '',
                            amount: '',
                            month: new Date().toLocaleString('en-US', { month: 'long' }),
                            year: new Date().getFullYear().toString(),
                            payment_method: 'Cash',
                            receipt_number: '',
                            payoutPercentage: '50'
                          })
                          setTeacherPaymentErrors({})
                          setIsRecordTeacherPaymentModalOpen(true)
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:from-emerald-500 hover:to-teal-550 text-white rounded-xl text-xs font-semibold tracking-wide shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        {t('finances.payInstructor')}
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  /* Table Skeleton */
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : instructorSubTab === 'pending' ? (
                  /* PENDING PAYOUTS TABLE */
                  pendingPayouts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                      <User className="h-8 w-8 text-slate-655" />
                      <p className="text-xs">{language === 'ar' ? 'لا توجد مستحقات معلقة حالياً! تم دفع رواتب جميع الأساتذة بالكامل.' : 'No pending payouts detected! All instructors have been fully paid for their tutoring sessions.'}</p>
                    </div>
                  ) : (
                    <div className="">
                      <AdvancedTable 
                        data={pendingPayouts}
                        columns={pendingPayoutsColumns}
                        enablePagination={true}
                        defaultPageSize={10}
                      />
                    </div>
                  )
                ) : teacherPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                    <User className="h-8 w-8 text-slate-600" />
                    <p className="text-xs">{language === 'ar' ? 'لم يتم تسجيل أي مستحقات مصروفة للأساتذة بعد.' : 'No instructor payouts have been recorded yet. Click "Pay Instructor" above to disburse.'}</p>
                  </div>
                ) : (
                  /* RECORDED PAYOUTS TABLE */
                  <div className="">
                    <AdvancedTable 
                      data={teacherPayments}
                      columns={recordedPayoutsColumns}
                      enablePagination={true}
                      defaultPageSize={10}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Record Payment Modal */}
      {isRecordPaymentModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in finance-fullwidth-backdrop" 
            onClick={() => {
              setIsRecordPaymentModalOpen(false)
              setSelectedPayment(null)
            }}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down finance-fullwidth-modal">
            <form 
              onSubmit={handlePaymentSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <CreditCard className="h-4.5 w-4.5 text-blue-500" />
                  {selectedPayment ? t('finances.modalPaymentEdit') : t('finances.modalPaymentAdd')}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordPaymentModalOpen(false)
                    setSelectedPayment(null)
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  
                  {/* Student selector */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.selectStudentLabel')}</label>
                    <select
                      name="StudentId"
                      value={paymentForm.StudentId}
                      onChange={handlePaymentInputChange}
                      className={`px-3.5 py-2 bg-slate-950 border rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer ${
                        paymentErrors.StudentId ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    >
                      <option value="">{language === 'ar' ? '-- اختر طالباً --' : '-- Choose Student --'}</option>
                      {students.map(std => (
                        <option key={std.id} value={std.id.toString()}>{std.full_name}</option>
                      ))}
                    </select>
                    {paymentErrors.StudentId && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {paymentErrors.StudentId}
                      </span>
                    )}
                  </div>

                  {/* Course selector */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.selectCourseLabel')}</label>
                    <select
                      name="CourseId"
                      value={paymentForm.CourseId}
                      onChange={handlePaymentInputChange}
                      disabled={!paymentForm.StudentId}
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        paymentErrors.CourseId ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    >
                      <option value="">-- Choose Course --</option>
                      {(() => {
                        const student = students.find(s => s.id === parseInt(paymentForm.StudentId));
                        return student?.Courses?.map(c => (
                          <option key={c.id} value={c.id.toString()}>{c.title}</option>
                        )) || [];
                      })()}
                    </select>
                    {paymentErrors.CourseId && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {paymentErrors.CourseId}
                      </span>
                    )}
                  </div>

                  {/* Billing Period Selector */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">
                      {language === 'ar' ? 'فترة الفوترة' : 'Billing Period'}
                    </label>
                    {(() => {
                      const student = students.find(s => s.id === parseInt(paymentForm.StudentId));
                      if (!student || !paymentForm.CourseId) {
                        return (
                          <select disabled className="w-full px-3.5 py-2 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-450 cursor-not-allowed opacity-50">
                            <option>{language === 'ar' ? '-- اختر الدورة التدريبية أولاً --' : '-- Choose Course First --'}</option>
                          </select>
                        );
                      }
                      const balanceInfo = getCoursePaymentsBalance(student, parseInt(paymentForm.CourseId));
                      const options = [];
                      if (balanceInfo && balanceInfo.studyStartDate) {
                        const numOptions = Math.max(6, (balanceInfo.totalMonths || 0) + 2);
                        for (let i = 0; i < numOptions; i++) {
                          const pStart = getPeriodStartDateStr(balanceInfo.studyStartDate, i);
                          const pLabel = getPeriodString(balanceInfo.studyStartDate, i, language);
                          const pLabelEn = getPeriodString(balanceInfo.studyStartDate, i, 'en');
                          const pYear = new Date(pStart).getFullYear();
                          options.push({
                            value: pLabelEn,
                            label: pLabel,
                            year: pYear
                          });
                        }
                      }
                      const hasSelectedOption = options.some(opt => opt.value === paymentForm.month);
                      if (paymentForm.month && !hasSelectedOption) {
                        options.unshift({
                          value: paymentForm.month,
                          label: translateMonth(paymentForm.month),
                          year: paymentForm.year
                        });
                      }
                      return (
                        <select
                          name="billing_period"
                          value={`${paymentForm.month}|${paymentForm.year}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setPaymentForm(prev => ({ ...prev, month: '', year: null }));
                              return;
                            }
                            const [m, y] = val.split('|');
                            setPaymentForm(prev => ({ ...prev, month: m, year: y ? parseInt(y) : null }));
                          }}
                          className="w-full px-3.5 py-2 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
                        >
                          <option value="">
                            {language === 'ar' ? '-- اختر فترة الفوترة --' : '-- Choose Billing Period --'}
                          </option>
                          {options.map((opt, idx) => (
                            <option key={idx} value={`${opt.value}|${opt.year}`}>
                              {opt.label} ({opt.year})
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                    {paymentErrors.month && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold animate-pulse">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {paymentErrors.month}
                      </span>
                    )}
                  </div>

                  {/* Course balance Breakdown Card (Full Width) */}
                  <div className="col-span-3">
                    {(() => {
                      if (!paymentForm.StudentId) return null;
                      const student = students.find(s => s.id === parseInt(paymentForm.StudentId));
                      if (!student) return null;

                      if (paymentForm.CourseId) {
                        const courseId = parseInt(paymentForm.CourseId);
                        const balanceInfo = getCoursePaymentsBalance(student, courseId);
                        const editAmount = selectedPayment ? parseFloat(selectedPayment.amount) : 0;
                        const displayPaid = selectedPayment ? Math.max(0, balanceInfo.totalPaid - editAmount) : balanceInfo.totalPaid;
                        const displayBalance = selectedPayment ? balanceInfo.balance + editAmount : balanceInfo.balance;
                        
                        const stats = getStudentCourseAttendanceStats(student, courseId);
                        
                        // Live calculation based on input amount
                        const currentInput = parseFloat(paymentForm.amount) || 0;
                        const liveBalance = Math.max(0, displayBalance - currentInput);
                        const livePaid = displayPaid + currentInput;
                        
                        let liveRemainingSessions = stats?.remaining || 0;
                        let livePaidSessions = stats?.paid || 0;
                        
                        if (stats) {
                          const monthlyPrice = student.Courses?.find(c => c.id === courseId)?.price || 0;
                          const schedulesPerWeek = student.Courses?.find(c => c.id === courseId)?.Schedules?.length || 2;
                          const sessionsPerMonth = schedulesPerWeek * 4;
                          livePaidSessions = monthlyPrice > 0 ? Math.floor((livePaid / monthlyPrice) * sessionsPerMonth) : 0;
                          liveRemainingSessions = livePaidSessions - stats.attended;
                        }

                        return (
                          <div className="space-y-1.5 p-3 bg-slate-955/60 border border-slate-850 rounded-xl text-xs animate-fade-in text-left">
                            <div className="flex justify-between items-center text-slate-400">
                              <span>{language === 'ar' ? 'سعر المادة:' : 'Course Price:'}</span>
                              <span className="font-mono text-slate-200 font-semibold">{balanceInfo.totalTuition.toFixed(2)} DA</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                              <span>{language === 'ar' ? 'المدفوع سابقاً:' : 'Previously Paid'}:</span>
                              <span className="font-mono text-slate-300 font-semibold">{displayPaid.toFixed(2)} DA</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                              <span className="text-emerald-500/80">{language === 'ar' ? 'إجمالي المدفوع (مباشر):' : 'Total Paid (Live):'}</span>
                              <span className="font-mono text-emerald-455 font-bold">{livePaid.toFixed(2)} DA</span>
                            </div>
                            {stats && (
                              <div className="flex justify-between items-center text-slate-400">
                                <span className="text-blue-400/80">{language === 'ar' ? 'الحصص المتبقية (مباشر):' : 'Remaining Paid Sessions (Live):'}</span>
                                <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] transition-colors ${
                                  liveRemainingSessions <= 1
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : liveRemainingSessions <= 3
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  {liveRemainingSessions} {language === 'ar' ? 'حصص متبقية' : 'sessions left'} ({stats.attended} / {livePaidSessions} {language === 'ar' ? 'مستهلكة' : 'consumed'})
                                </span>
                              </div>
                            )}
                            <div className="border-t border-slate-800/85 my-1"></div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-350">{language === 'ar' ? 'الرصيد المتبقي (مباشر):' : 'Remaining Balance (Live):'}</span>
                              <span className={`font-mono font-bold transition-colors ${liveBalance > 0 ? 'text-rose-455' : 'text-emerald-450'}`}>
                                {liveBalance.toFixed(2)} DA
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-2.5 p-3.5 bg-slate-955/60 border border-slate-850 rounded-xl text-xs animate-fade-in">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Course Balances Breakdown</p>
                            <div className="space-y-2">
                              {(student.Courses || []).map(c => {
                                const balanceInfo = getCoursePaymentsBalance(student, c.id);
                                return (
                                  <div key={c.id} className="border-b border-slate-800/30 pb-2 last:border-b-0 last:pb-0">
                                    <div className="flex justify-between items-center text-slate-200 font-semibold">
                                      <span className="truncate max-w-[210px]">{c.title}</span>
                                      <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                        balanceInfo.balance > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                      }`}>
                                        {balanceInfo.balance > 0 ? `Due: ${balanceInfo.balance.toFixed(2)} DA` : 'Settled'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                      <span>Tuition: <strong className="font-mono text-slate-400">{balanceInfo.totalTuition.toFixed(2)} DA</strong></span>
                                      <span>Paid: <strong className="font-mono text-emerald-500">{balanceInfo.totalPaid.toFixed(2)} DA</strong></span>
                                    </div>
                                  </div>
                                );
                              })}
                              {(!student.Courses || student.Courses.length === 0) && (
                                <p className="text-[10px] text-slate-550 italic">No courses currently enrolled.</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* Amount */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'المبلغ (د.ج)' : 'Amount (DA)'}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        name="amount"
                        value={paymentForm.amount}
                        onChange={handlePaymentInputChange}
                        disabled={!paymentForm.CourseId}
                        placeholder={
                          !paymentForm.CourseId 
                            ? (language === 'ar' ? 'اختر مادة أولاً' : 'Select a course first') 
                            : (language === 'ar' ? 'مثال: 500' : 'e.g. 500')
                        }
                        className={`flex-1 px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 placeholder-slate-650 focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          paymentErrors.amount ? 'border-rose-500/50' : 'border-slate-800/80'
                        }`}
                      />
                      {(() => {
                        const balanceInfo = getSelectedStudentBalance();
                        if (balanceInfo) {
                          const editAmount = selectedPayment ? parseFloat(selectedPayment.amount) : 0;
                          const maxAllowed = balanceInfo.balance + editAmount;
                          if (maxAllowed > 0) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentForm(prev => ({
                                    ...prev,
                                    amount: maxAllowed.toString()
                                  }));
                                  if (paymentErrors.amount) {
                                      setPaymentErrors(prev => ({ ...prev, amount: '' }));
                                  }
                                }}
                                className="px-3.5 py-2 bg-slate-850 hover:bg-slate-805 border border-slate-700/60 rounded-xl text-[10px] font-bold text-blue-400 transition-colors cursor-pointer shrink-0"
                              >
                                {language === 'ar' ? 'دفع كامل' : 'Pay Full'}
                              </button>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                    {paymentErrors.amount && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {paymentErrors.amount}
                      </span>
                    )}
                  </div>

                  {/* Receipt Number */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'رقم الإيصال' : 'Receipt Number'}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="receipt_number"
                        value={paymentForm.receipt_number}
                        onChange={handlePaymentInputChange}
                        placeholder={language === 'ar' ? 'مثال: RCPT-12345' : 'e.g. RCPT-12345'}
                        className={`flex-1 px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-350 placeholder-slate-605 focus:outline-none focus:border-blue-500/40 transition-colors ${
                          paymentErrors.receipt_number ? 'border-rose-500/50' : 'border-slate-800/80'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={generateReceiptNumber}
                        className="px-3 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs text-slate-305 font-semibold transition-colors cursor-pointer"
                      >
                        {language === 'ar' ? 'توليد' : 'Gen'}
                      </button>
                    </div>
                    {paymentErrors.receipt_number && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {paymentErrors.receipt_number}
                      </span>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.paymentMethodLabel')}</label>
                    <select
                      name="payment_method"
                      value={paymentForm.payment_method}
                      onChange={handlePaymentInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
                    >
                      <option value="Cash">{t('finances.paymentMethodCash')}</option>
                      <option value="Card">{t('finances.paymentMethodCard')}</option>
                      <option value="Transfer">{t('finances.paymentMethodBank')}</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordPaymentModalOpen(false)
                    setSelectedPayment(null)
                  }}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:from-emerald-500 hover:to-teal-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : (selectedPayment ? (language === 'ar' ? 'تحديث الدفعة' : 'Update Details') : t('finances.receivePaymentBtn'))}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Record Expense Modal */}
      {isRecordExpenseModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in finance-fullwidth-backdrop" 
            onClick={() => {
              setIsRecordExpenseModalOpen(false)
              setSelectedExpense(null)
            }}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down finance-fullwidth-modal">
            <form 
              onSubmit={handleExpenseSubmit} 
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Tag className="h-4.5 w-4.5 text-rose-500" />
                  {selectedExpense ? t('finances.modalExpenseEdit') : t('finances.modalExpenseAdd')}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordExpenseModalOpen(false)
                    setSelectedExpense(null)
                  }}
                  className="text-slate-400 hover:text-slate-205 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  
                  {/* Category */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.expenseCategoryLabel')}</label>
                    <select
                      name="category"
                      value={expenseForm.category}
                      onChange={handleExpenseInputChange}
                      className="px-3.5 py-2 bg-slate-955 border border-slate-800/85 rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
                    >
                      <option value="Rent">{t('finances.rent')}</option>
                      <option value="Utilities">{t('finances.utilities')}</option>
                      <option value="Salaries">{t('finances.salaries')}</option>
                      <option value="Other">{t('finances.other')}</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.expenseAmountLabel')}</label>
                    <input
                      type="number"
                      name="amount"
                      value={expenseForm.amount}
                      onChange={handleExpenseInputChange}
                      placeholder="e.g. 1500"
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors ${
                        expenseErrors.amount ? 'border-rose-505/50' : 'border-slate-800/80'
                      }`}
                    />
                    {expenseErrors.amount && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {expenseErrors.amount}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.expenseDescriptionLabel')}</label>
                    <textarea
                      name="description"
                      value={expenseForm.description}
                      onChange={handleExpenseInputChange}
                      placeholder={t('finances.expenseDescriptionPlaceholder')}
                      rows="3"
                      className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 placeholder-slate-655 focus:outline-none focus:border-blue-500/40 transition-colors resize-none ${
                        expenseErrors.description ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    />
                    {expenseErrors.description && (
                      <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {expenseErrors.description}
                      </span>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordExpenseModalOpen(false)
                    setSelectedExpense(null)
                  }}
                  className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-205 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:from-rose-500 hover:to-red-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : (selectedExpense ? (language === 'ar' ? 'تحديث المصاريف' : 'Update Details') : t('finances.recordExpenseBtn'))}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
      </div>
      </div>
    </div>

    {/* ==================== PRINT PREVIEW MODAL (WHITE PAPER TEMPLATE) ==================== */}
    {activePrintPayment && (
      (() => {
        const studentObj = students.find(s => s.id === activePrintPayment.StudentId);
        const selectedCourse = activePrintPayment.Course || studentObj?.Courses?.find(c => String(c.id) === String(activePrintPayment.CourseId)) || null;
        
        // Calculate totals for this course specifically using our distribution helper
        let totalTuition, totalPaid, balance;
        if (selectedCourse && studentObj) {
          const balanceInfo = getCoursePaymentsBalance(studentObj, selectedCourse.id);
          totalTuition = balanceInfo.totalTuition;
          totalPaid = balanceInfo.totalPaid;
          balance = balanceInfo.balance;
        } else {
          totalTuition = activePrintPayment.amount;
          totalPaid = activePrintPayment.amount;
          balance = 0;
        }

        const coursesRows = selectedCourse 
          ? (
              <tr className="border-b border-transparent">
                <td className="py-1.5 text-left font-bold text-black text-[9px]">
                  {selectedCourse.title} (Tuition Fee{activePrintPayment.month && activePrintPayment.year ? ` - ${activePrintPayment.month} ${activePrintPayment.year}` : ''})
                </td>
                <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1.5 font-medium text-black text-[9px]`}>{(selectedCourse.price || 0).toFixed(2)} DA</td>
                <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1.5 font-bold text-black text-[9px]`}>{(selectedCourse.price || 0).toFixed(2)} DA</td>
              </tr>
            )
          : (
              <tr className="border-b border-transparent">
                <td className="py-1.5 text-left font-bold text-black text-[9px]">
                  Tuition Fee Payment (General / Unassigned{activePrintPayment.month && activePrintPayment.year ? ` - ${activePrintPayment.month} ${activePrintPayment.year}` : ''})
                </td>
                <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1.5 font-medium text-black text-[9px]`}>{activePrintPayment.amount.toFixed(2)} DA</td>
                <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1.5 font-bold text-black text-[9px]`}>{activePrintPayment.amount.toFixed(2)} DA</td>
              </tr>
            );

        const renderSingleInvoicePreview = (copyTitle) => (
          <div className="flex flex-col justify-between h-full text-[7.5px] leading-relaxed">
            <div>
              {/* Header info */}
              <div className="flex justify-between items-start mb-1">
                <div className="text-left">
                  {schoolLogo ? (
                    <img src={schoolLogo} alt="School Logo" className="max-h-5 max-w-[80px] object-contain mb-0.5" />
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <svg className="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-[8px] text-black leading-none">{schoolName.split(' ')[0]?.toUpperCase() || 'BRIGHT'}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right text-[6.5px] text-black font-semibold space-y-0.5 flex flex-col items-end">
                  <div className="inline-block border border-slate-200 bg-slate-50 text-slate-500 text-[5.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded mb-1">{copyTitle}</div>
                  {schoolPhone && <div>Phone: {schoolPhone}</div>}
                </div>
              </div>

              {/* Thick line */}
              <div className="border-b-[1.5px] border-black mb-1.5 w-full"></div>

              {/* Invoice title */}
              <h1 className="text-[10px] font-black text-black leading-none tracking-tight mb-1.5 text-left uppercase">{t('finances.paymentReceiptTitle') || 'PAYMENT RECEIPT'}</h1>

              {/* Billing details row */}
              <table className="w-full border border-slate-200 rounded bg-slate-50/55 text-[7px] mb-2 leading-tight">
                <tbody>
                  <tr>
                    <td className="p-1 border-r border-slate-200 w-[60%]">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">Invoice To:</span>
                      <p className="text-[8.5px] font-black text-black leading-none">{studentObj?.full_name || 'N/A'}</p>
                      <div className="text-[6.5px] text-slate-500 mt-0.5">
                        {studentObj?.phone && <div>Phone: {studentObj.phone}</div>}
                      </div>
                    </td>
                    <td className="p-1 w-[40%] text-right">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">Invoice No:</span>
                      <p className="text-[7.5px] font-bold text-black leading-none font-mono">{activePrintPayment.receipt_number}</p>
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5 mt-1">Issue Date:</span>
                      <p className="text-[7.5px] font-bold text-black leading-none">{new Date(activePrintPayment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Table */}
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse mb-2`}>
                <thead>
                  <tr className="border-t border-b border-black">
                    <th className="py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[64%]">Description</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[18%]`}>Rate</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[18%]`}>Amount</th>
                  </tr>
                </thead>
                <tbody className="text-black">
                  {coursesRows}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-2">
                <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full text-[7px] text-slate-500 leading-relaxed`}>
                  <tbody>
                    {selectedCourse ? (
                      <>
                        <tr>
                          <td className="py-0.5 text-left font-medium text-slate-650">Subtotal (Course Price)</td>
                          <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 font-mono font-bold text-black`}>{totalTuition.toFixed(2)} DA</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-left font-medium text-slate-655">Total Paid for Course</td>
                          <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 font-mono font-bold text-emerald-600`}>{totalPaid.toFixed(2)} DA</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 pb-1 text-left font-medium text-slate-655">Balance Outstanding</td>
                          <td className={`py-0.5 pb-1 text-right font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{balance.toFixed(2)} DA</td>
                        </tr>
                      </>
                    ) : null}
                    <tr className="text-black font-bold border-t border-b border-black">
                      <td className="py-1 text-left uppercase text-[6.5px] font-black tracking-wider">Amount Paid (This Receipt)</td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-mono text-[11px] font-black`}>{activePrintPayment.amount.toFixed(2)} DA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              {/* Footer columns: Signature block only */}
              <div className="flex justify-between items-end pt-1">
                <div className="w-[30px] h-[30px] border border-dashed border-slate-350 rounded-full flex items-center justify-center text-[4.5px] font-bold text-slate-350 tracking-wide">
                  STAMP
                </div>
                <div className="text-right w-[40%]">
                  <div className="inline-block text-left">
                    <div className="w-16 border-b border-black mb-0.5"></div>
                    <span className="text-[6.5px] text-black uppercase font-black tracking-wider block font-bold">Authorized Signature</span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="border-t border-slate-100 mt-1 pt-1 text-left">
                <p className="text-[5.5px] text-slate-450 leading-normal">
                  <strong>Terms & Conditions:</strong> This document serves as an official receipt of payment for tuition and enrollment fees.
                </p>
              </div>
            </div>
          </div>
        );

        return (
          <>
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
              onClick={() => setActivePrintPayment(null)}
            />
            {/* Full Workspace Panel */}
            <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Receipt Print Preview</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? 'نسخة مزدوجة جاهزة للطباعة والقص (A5)' : 'Dual-Copy Layout ready for printing & cutting (A5)'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadReceiptPDF(activePrintPayment, 'print')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadReceiptPDF(activePrintPayment, 'download')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Download PDF
                  </button>
                  <button
                    onClick={() => setActivePrintPayment(null)}
                    className="text-slate-400 hover:text-slate-202 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Container for Preview */}
              <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[75vh]">
                {/* White A5 Landscape mock preview container */}
                <div className="bg-white text-black p-4 rounded-xl border border-slate-200 shadow-inner w-full max-w-4xl aspect-[1.414/1] mx-auto font-sans leading-relaxed select-text relative overflow-hidden">
                  <div className="flex h-full w-full justify-between">
                    {/* Left Half: Client Copy */}
                    <div className="w-[47%] h-full">
                      {renderSingleInvoicePreview(language === 'ar' ? 'نسخة الزبون / Client Copy' : 'Client Copy')}
                    </div>
                    
                    {/* Divider */}
                    <div className="w-[6%] h-full flex flex-col justify-center items-center relative">
                      <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-slate-300"></div>
                      <span className="bg-white px-1 z-10 text-[9px] text-slate-400 select-none">✂️</span>
                    </div>

                    {/* Right Half: Office Copy */}
                    <div className="w-[47%] h-full">
                      {renderSingleInvoicePreview(language === 'ar' ? 'نسخة الإدارة / Office Copy' : 'Office Copy')}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </>
        );
      })()
    )}

    {/* Record Teacher Payment Modal */}
    {isRecordTeacherPaymentModalOpen && (
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 z-40 bg-black/40 animate-fade-in no-print" 
          onClick={() => {
            setIsRecordTeacherPaymentModalOpen(false)
          }}
        />
        {/* Full Workspace Panel */}
        <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down">
          <form 
            onSubmit={handleTeacherPaymentSubmit} 
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-emerald-500" />
                {language === 'ar' ? 'صرف مستحقات الأساتذة' : 'Pay Instructor / Faculty'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsRecordTeacherPaymentModalOpen(false)
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                
                {/* Teacher selector */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'اختر الأستاذ' : 'Select Instructor'}</label>
                  <select
                    name="TeacherId"
                    value={teacherPaymentForm.TeacherId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const teacherObj = teachers.find(t => String(t.id) === String(val));
                      const penaltyRate = teacherObj?.absence_penalty_rate !== undefined ? teacherObj.absence_penalty_rate : 1000;
                      setTeacherPaymentForm(prev => ({ 
                        ...prev, 
                        TeacherId: val, 
                        CourseId: '', 
                        absence_penalty: penaltyRate.toString() 
                      }));
                      if (teacherPaymentErrors.TeacherId) setTeacherPaymentErrors(prev => ({ ...prev, TeacherId: '' }));
                    }}
                    className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer ${
                      teacherPaymentErrors.TeacherId ? 'border-rose-500/50' : 'border-slate-800/80'
                    }`}
                  >
                    <option value="">{language === 'ar' ? '-- اختر أستاذاً --' : '-- Choose Instructor --'}</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id.toString()}>{t.full_name} ({t.specialty || (language === 'ar' ? 'عام' : 'General')})</option>
                    ))}
                  </select>
                  {teacherPaymentErrors.TeacherId && (
                    <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold animate-pulse">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.TeacherId}
                    </span>
                  )}
                </div>

                {/* Course selector */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'اختر المادة' : 'Select Course'}</label>
                  <select
                    name="CourseId"
                    value={teacherPaymentForm.CourseId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedCourseObj = courses.find(c => String(c.id) === String(val));
                      const defaultPercentage = selectedCourseObj?.default_payout_rate !== undefined ? selectedCourseObj.default_payout_rate : 50;
                      setTeacherPaymentForm(prev => ({ 
                        ...prev, 
                        CourseId: val,
                        payoutPercentage: defaultPercentage.toString()
                      }));
                      if (teacherPaymentErrors.CourseId) setTeacherPaymentErrors(prev => ({ ...prev, CourseId: '' }));
                    }}
                    disabled={!teacherPaymentForm.TeacherId}
                    className={`px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      teacherPaymentErrors.CourseId ? 'border-rose-500/50' : 'border-slate-800/80'
                    }`}
                  >
                    <option value="">{language === 'ar' ? '-- اختر المادة --' : '-- Choose Course --'}</option>
                    {teacherPaymentForm.TeacherId && courses
                      .filter(c => String(c.TeacherId) === String(teacherPaymentForm.TeacherId))
                      .map(c => (
                        <option key={c.id} value={c.id.toString()}>{c.title}</option>
                      ))
                    }
                  </select>
                  {teacherPaymentErrors.CourseId && (
                    <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.CourseId}
                    </span>
                  )}
                  {teacherPaymentForm.TeacherId && courses.filter(c => String(c.TeacherId) === String(teacherPaymentForm.TeacherId)).length === 0 && (
                    <span className="text-[10px] text-slate-455 italic mt-0.5">
                      {language === 'ar' ? 'هذا الأستاذ غير مسند لأي مواد حالياً.' : 'This instructor is not currently assigned to any courses.'}
                    </span>
                  )}
                </div>

                {/* Month Selector */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'للشهر' : 'For Month'}</label>
                  {(() => {
                    const coursePayments = payments.filter(p => String(p.CourseId) === String(teacherPaymentForm.CourseId));
                    const uniqueRelativeMonths = [...new Set(coursePayments.map(p => p.month).filter(Boolean))]
                      .filter(m => !['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].includes(m));

                    return (
                      <select
                        name="month"
                        value={teacherPaymentForm.month}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTeacherPaymentForm(prev => ({ ...prev, month: val }));
                          if (teacherPaymentErrors.month) setTeacherPaymentErrors(prev => ({ ...prev, month: '' }));
                        }}
                        disabled={!teacherPaymentForm.CourseId}
                        className="px-3.5 py-2 bg-slate-955 border border-slate-805 rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">{language === 'ar' ? '-- اختر الشهر --' : '-- Choose Month --'}</option>
                        
                        {uniqueRelativeMonths.length > 0 && (
                          <optgroup label={language === 'ar' ? 'فترات الطلاب النشطة' : 'Active Student Periods'}>
                            {uniqueRelativeMonths.map(m => (
                              <option key={m} value={m}>{translateMonth(m)}</option>
                            ))}
                          </optgroup>
                        )}
                        
                        <optgroup label={language === 'ar' ? 'الشهور الميلادية القياسية' : 'Standard Calendar Months'}>
                          <option value="January">{t('finances.jan')}</option>
                          <option value="February">{t('finances.feb')}</option>
                          <option value="March">{t('finances.mar')}</option>
                          <option value="April">{t('finances.apr')}</option>
                          <option value="May">{t('finances.may')}</option>
                          <option value="June">{t('finances.jun')}</option>
                          <option value="July">{t('finances.jul')}</option>
                          <option value="August">{t('finances.aug')}</option>
                          <option value="September">{t('finances.sep')}</option>
                          <option value="October">{t('finances.oct')}</option>
                          <option value="November">{t('finances.nov')}</option>
                          <option value="December">{t('finances.dec')}</option>
                        </optgroup>
                      </select>
                    );
                  })()}
                  {teacherPaymentErrors.month && (
                    <span className="text-[10px] text-rose-455 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.month}
                    </span>
                  )}
                </div>

                {/* Year Selector */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'للسنة' : 'For Year'}</label>
                  <select
                    name="year"
                    value={teacherPaymentForm.year}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTeacherPaymentForm(prev => ({ ...prev, year: val }));
                      if (teacherPaymentErrors.year) setTeacherPaymentErrors(prev => ({ ...prev, year: '' }));
                    }}
                    disabled={!teacherPaymentForm.CourseId}
                    className="px-3.5 py-2 bg-slate-955 border border-slate-805 rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{language === 'ar' ? '-- اختر السنة --' : '-- Choose Year --'}</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                  {teacherPaymentErrors.year && (
                    <span className="text-[10px] text-rose-450 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.year}
                    </span>
                  )}
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'المبلغ المصروف (د.ج)' : 'Disbursed Payout Amount (DA)'}</label>
                  <input
                    type="number"
                    name="amount"
                    value={teacherPaymentForm.amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTeacherPaymentForm(prev => ({ ...prev, amount: val }));
                      if (teacherPaymentErrors.amount) setTeacherPaymentErrors(prev => ({ ...prev, amount: '' }));
                    }}
                    placeholder={language === 'ar' ? 'مثال: 25000' : 'e.g. 25000'}
                    className={`px-3.5 py-2 bg-slate-955 border border-slate-805 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 transition-colors ${
                      teacherPaymentErrors.amount ? 'border-rose-500/50' : 'border-slate-800/80'
                    }`}
                  />
                  {teacherPaymentErrors.amount && (
                    <span className="text-[10px] text-rose-405 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.amount}
                    </span>
                  )}
                </div>

                {/* Receipt Number */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'رقم الإيصال / الإثبات' : 'Receipt Number'}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="receipt_number"
                      value={teacherPaymentForm.receipt_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTeacherPaymentForm(prev => ({ ...prev, receipt_number: val }));
                        if (teacherPaymentErrors.receipt_number) setTeacherPaymentErrors(prev => ({ ...prev, receipt_number: '' }));
                      }}
                      placeholder={language === 'ar' ? 'مثال: TCH-RCPT-12345' : 'e.g. TCH-RCPT-12345'}
                      className={`flex-1 px-3.5 py-2 bg-slate-955 border rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors ${
                        teacherPaymentErrors.receipt_number ? 'border-rose-500/50' : 'border-slate-800/80'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={generateTeacherReceiptNumber}
                      className="px-3 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs text-slate-305 font-semibold transition-colors cursor-pointer"
                    >
                      {language === 'ar' ? 'توليد' : 'Gen'}
                    </button>
                  </div>
                  {teacherPaymentErrors.receipt_number && (
                    <span className="text-[10px] text-rose-405 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {teacherPaymentErrors.receipt_number}
                    </span>
                  )}
                </div>

                {/* Payment Method */}
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">{t('finances.payoutMethodLabel')}</label>
                  <select
                    name="payment_method"
                    value={teacherPaymentForm.payment_method}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTeacherPaymentForm(prev => ({ ...prev, payment_method: val }));
                    }}
                    className="px-3.5 py-2 bg-slate-955 border border-slate-805/85 rounded-xl text-xs text-slate-355 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
                  >
                    <option value="Cash">{t('finances.paymentMethodCash')}</option>
                    <option value="Card">{t('finances.paymentMethodCard')}</option>
                    <option value="Transfer">{t('finances.paymentMethodBank')}</option>
                  </select>
                </div>

              </div>

              {/* Payout Calculator Card */}
              {teacherPaymentForm.CourseId && teacherPaymentForm.month && teacherPaymentForm.year && (
                (() => {
                  const total = payments
                    .filter(p => 
                      String(p.CourseId) === String(teacherPaymentForm.CourseId) && 
                      isMonthMatching(p.month, teacherPaymentForm.month, teacherPaymentForm.year) && 
                      String(p.year) === String(teacherPaymentForm.year)
                    )
                    .reduce((sum, p) => sum + (p.amount || 0), 0);
                    
                  return (
                    (() => {
                      const selectedCourse = courses.find(c => String(c.id) === String(teacherPaymentForm.CourseId));
                      const isFixed = selectedCourse?.payout_type === 'Fixed';
                      const fixedAmount = parseFloat(selectedCourse?.fixed_payout_amount || 0.0);

                      const alreadyPaid = teacherPayments
                        .filter(tp => 
                          String(tp.TeacherId) === String(teacherPaymentForm.TeacherId) &&
                          String(tp.CourseId) === String(teacherPaymentForm.CourseId) &&
                          isMonthMatching(tp.month, teacherPaymentForm.month, teacherPaymentForm.year) &&
                          String(tp.year) === String(teacherPaymentForm.year)
                        )
                        .reduce((sum, tp) => sum + (tp.amount || 0), 0);

                      const initialGross = isFixed ? fixedAmount : ((total * parseFloat(teacherPaymentForm.payoutPercentage || 50)) / 100);
                      const remainingGross = Math.max(0, initialGross - alreadyPaid);

                      return (
                        <div className="p-3 bg-slate-955 border border-slate-850 rounded-xl space-y-2 text-left">
                          
                          {isFixed ? (
                            <>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">{language === 'ar' ? 'نوع الدفع:' : 'Payout Type:'}</span>
                                <span className="font-bold text-blue-400">{language === 'ar' ? 'راتب شهري ثابت' : 'Fixed Monthly Salary'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">{language === 'ar' ? 'الراتب الثابت للمادة:' : 'Fixed Course Salary:'}</span>
                                <span className="font-bold text-slate-200 font-mono">{fixedAmount.toFixed(2)} DA</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Total Collected:</span>
                                <span className="font-bold font-mono text-slate-200">{total.toFixed(2)} DA</span>
                              </div>
                              
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-xs">
                                  <label className="text-slate-400">Payout Percentage (%):</label>
                                  <span className="font-bold text-blue-400">{teacherPaymentForm.payoutPercentage || 50}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={teacherPaymentForm.payoutPercentage || 50}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTeacherPaymentForm(prev => ({
                                        ...prev,
                                        payoutPercentage: val
                                      }));
                                    }}
                                    className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={teacherPaymentForm.payoutPercentage || 50}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTeacherPaymentForm(prev => ({
                                        ...prev,
                                        payoutPercentage: val
                                      }));
                                    }}
                                    className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-805 rounded text-center text-xs text-slate-300"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/40">
                            <span className="text-slate-400">Gross Deserved Payout:</span>
                            <span className="font-bold text-slate-200 font-mono">
                              {initialGross.toFixed(2)} DA
                            </span>
                          </div>

                          {alreadyPaid > 0 && (
                            <div className="flex justify-between items-center text-xs text-rose-400">
                              <span>{language === 'ar' ? 'المبالغ المصروفة سابقاً للمادة:' : 'Already Disbursed Payout:'}</span>
                              <span className="font-bold font-mono">-{alreadyPaid.toFixed(2)} DA</span>
                            </div>
                          )}

                          {alreadyPaid > 0 && (
                            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/40 font-semibold">
                              <span className="text-slate-400">Remaining Gross Payout:</span>
                              <span className="text-slate-200 font-mono">{remainingGross.toFixed(2)} DA</span>
                            </div>
                          )}

                          {/* Absence Penalty rate configuration */}
                          <div className="flex flex-col gap-1 mt-2 border-t border-slate-800/40 pt-2">
                            <label className="text-[10px] text-slate-450 uppercase font-semibold">
                              {t('attendance.absencePenaltyLabel') || 'Absence Deduction Penalty (DA)'}
                            </label>
                            <input
                              type="number"
                              value={teacherPaymentForm.absence_penalty}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeacherPaymentForm(prev => ({
                                  ...prev,
                                  absence_penalty: val
                                }));
                              }}
                              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 w-full"
                            />
                          </div>

                          {teacherPaymentForm.absences_count > 0 && (
                            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex flex-col gap-0.5 mt-2">
                              <span className="font-semibold flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                {t('attendance.absencesDetected') || 'Absences detected'}: {teacherPaymentForm.absences_count}
                              </span>
                              <span className="text-[10px] text-rose-400">
                                {t('attendance.payoutDeductionNotice', { count: teacherPaymentForm.absences_count, deduction: teacherPaymentForm.absences_deduction.toFixed(2) }) || `(${teacherPaymentForm.absences_count} unexcused absences, deducting ${teacherPaymentForm.absences_deduction.toFixed(2)} DA)`}
                              </span>
                            </div>
                          )}

                          {teacherPaymentForm.substitutions_count > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs flex flex-col gap-0.5 mt-2">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                {language === 'ar' ? 'حصص تعويضية تم تدريسها' : 'Substituted Sessions taught'}: {teacherPaymentForm.substitutions_count}
                              </span>
                              <span className="text-[10px] text-emerald-400">
                                {language === 'ar'
                                  ? `(تم التعويض عن ${teacherPaymentForm.substitutions_count} حصص، إضافة +${teacherPaymentForm.substitutions_credit.toFixed(2)} د.ج)`
                                  : `(${teacherPaymentForm.substitutions_count} substitutions, adding +${teacherPaymentForm.substitutions_credit.toFixed(2)} DA)`}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-800/40 mt-2">
                            <span className="text-slate-400 font-bold">{language === 'ar' ? 'المستحقات الصافية المحتسبة' : 'Net Calculated Payout'}:</span>
                            <span className="font-extrabold text-emerald-450 font-mono text-sm">
                              {Math.max(0, 
                                remainingGross
                                - (teacherPaymentForm.absences_deduction || 0) 
                                + (teacherPaymentForm.substitutions_credit || 0)
                              ).toFixed(2)} DA
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setIsRecordTeacherPaymentModalOpen(false)
                }}
                className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-202 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 bg-emerald-600 hover:from-emerald-500 hover:to-teal-555 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : (language === 'ar' ? 'صرف المستحقات' : 'Disburse Salary')}
              </button>
            </div>
          </form>
        </div>
      </>
    )}

    {/* ==================== INSTRUCTOR PAYOUT PRINT PREVIEW ==================== */}
    {activePrintTeacherPayment && (
      (() => {
        const teacherObj = teachers.find(t => String(t.id) === String(activePrintTeacherPayment.TeacherId));
        const courseObj = activePrintTeacherPayment.Course || courses.find(c => String(c.id) === String(activePrintTeacherPayment.CourseId)) || null;
        const courseTitleSuffix = courseObj ? ` - Course: ${courseObj.title}` : '';
        
        const renderSingleTeacherPayoutPreview = (copyTitle) => (
          <div className="flex flex-col justify-between h-full text-[7.5px] leading-relaxed text-black">
            <div>
              {/* Header info */}
              <div className="flex justify-between items-start mb-1">
                <div className="text-left">
                  {schoolLogo ? (
                    <img src={schoolLogo} alt="School Logo" className="max-h-5 max-w-[80px] object-contain mb-0.5" />
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <svg className="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-[8px] text-black leading-none">{schoolName.split(' ')[0]?.toUpperCase() || 'BRIGHT'}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right text-[6.5px] text-black font-semibold space-y-0.5 flex flex-col items-end">
                  <div className="inline-block border border-slate-200 bg-slate-50 text-slate-500 text-[5.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded mb-1">{copyTitle}</div>
                  {schoolPhone && <div>Phone: {schoolPhone}</div>}
                </div>
              </div>

              {/* Thick line */}
              <div className="border-b-[1.5px] border-black mb-1.5 w-full"></div>

              {/* Title */}
              <h1 className="text-[10px] font-black text-black leading-none tracking-tight mb-1.5 text-left uppercase">SALARY DISBURSEMENT VOUCHER</h1>

              {/* Billing details row */}
              <table className="w-full border border-slate-200 rounded bg-slate-50/55 text-[7px] mb-2 leading-tight">
                <tbody>
                  <tr>
                    <td className="p-1 border-r border-slate-200 w-[60%]">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">Paid To Instructor:</span>
                      <p className="text-[8.5px] font-black text-black leading-none">{teacherObj?.full_name || 'N/A'}</p>
                      <div className="text-[6.5px] text-slate-500 mt-0.5">
                        {teacherObj?.phone && <div>Phone: {teacherObj.phone}</div>}
                      </div>
                    </td>
                    <td className="p-1 w-[40%] text-right">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">Receipt No:</span>
                      <p className="text-[7.5px] font-bold text-black leading-none font-mono">{activePrintTeacherPayment.receipt_number}</p>
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5 mt-1">Disbursed Date:</span>
                      <p className="text-[7.5px] font-bold text-black leading-none">{new Date(activePrintTeacherPayment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Table */}
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse mb-2`}>
                <thead>
                  <tr className="border-t border-b border-black">
                    <th className="py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[64%]">Description</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[18%]`}>Rate</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[18%]`}>Amount</th>
                  </tr>
                </thead>
                <tbody className="text-black">
                  <tr className="border-b border-transparent">
                    <td className="py-1 text-left font-bold text-black text-[7.5px]">
                      Monthly Instructor Salary/Payout ({activePrintTeacherPayment.month} {activePrintTeacherPayment.year}){courseTitleSuffix}
                    </td>
                    <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-medium text-black text-[7.5px]`}>
                      {activePrintTeacherPayment.payoutPercentage || '50'}%
                    </td>
                    <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-bold text-black text-[7.5px]`}>
                      {(activePrintTeacherPayment.amount + (activePrintTeacherPayment.absences_deduction || 0)).toFixed(2)} DA
                    </td>
                  </tr>
                  {activePrintTeacherPayment.absences_count > 0 && (
                    <tr className="border-b border-transparent text-rose-600">
                      <td className="py-1 text-left font-semibold text-[7.5px]">
                        {language === 'ar'
                          ? `خصم الغياب غير المبرر (${activePrintTeacherPayment.absences_count} غياب)`
                          : `Unexcused Absences Deduction (${activePrintTeacherPayment.absences_count} absences)`}
                      </td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-medium text-[7.5px]`}>—</td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-bold text-[7.5px]`}>
                        -{activePrintTeacherPayment.absences_deduction.toFixed(2)} DA
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-2">
                <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full text-[7px] text-slate-500 leading-relaxed`}>
                  <tbody>
                    {activePrintTeacherPayment.absences_count > 0 && (
                      <>
                        <tr>
                          <td className="py-0.5 text-left font-medium text-slate-655">Gross Salary Payout</td>
                          <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 font-mono font-bold text-black`}>
                            {(activePrintTeacherPayment.amount + activePrintTeacherPayment.absences_deduction).toFixed(2)} DA
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-left font-medium text-rose-600">Absences Deduction</td>
                          <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 font-mono font-bold text-rose-600`}>
                            -{activePrintTeacherPayment.absences_deduction.toFixed(2)} DA
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="text-black font-bold border-t border-b border-black">
                      <td className="py-1 text-left uppercase text-[6.5px] font-black tracking-wider">Amount Disbursed (Net)</td>
                      <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-mono text-[11px] font-black`}>{activePrintTeacherPayment.amount.toFixed(2)} DA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              {/* Signature block */}
              <div className="flex justify-between items-end pt-1">
                <div className="w-[30px] h-[30px] border border-dashed border-slate-350 rounded-full flex items-center justify-center text-[4.5px] font-bold text-slate-350 tracking-wide">
                  STAMP
                </div>
                <div className="text-right w-[40%]">
                  <div className="inline-block text-left">
                    <div className="w-16 border-b border-black mb-0.5"></div>
                    <span className="text-[6.5px] text-black uppercase font-black tracking-wider block font-bold">Authorized Signature</span>
                  </div>
                </div>
              </div>

              {/* Terms and Notes */}
              <div className="border-t border-slate-100 mt-1 pt-1 text-left">
                <p className="text-[5.5px] text-slate-450 leading-normal">
                  <strong>Terms & Notes:</strong> This voucher confirms payment of instructor fees/salary. Instructor acknowledges receipt.
                </p>
              </div>
            </div>
          </div>
        );

        return (
          <>
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
              onClick={() => setActivePrintTeacherPayment(null)}
            />
            {/* Full Workspace Panel */}
            <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 border-b border-slate-800/80 flex flex-col shadow-2xl overflow-hidden animate-slide-in-down">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Instructor Salary Receipt Preview</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? 'نسخة مزدوجة جاهزة للطباعة والقص (A5)' : 'Dual-Copy Layout ready for printing & cutting (A5)'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadTeacherPayoutPDF(activePrintTeacherPayment, 'print')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTeacherPayoutPDF(activePrintTeacherPayment, 'download')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Download PDF
                  </button>
                  <button
                    onClick={() => setActivePrintTeacherPayment(null)}
                    className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Container for Preview */}
              <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[75vh]">
                {/* White A5 Landscape mock preview container */}
                <div className="bg-white text-black p-4 rounded-xl border border-slate-200 shadow-inner w-full max-w-4xl aspect-[1.414/1] mx-auto font-sans leading-relaxed select-text relative overflow-hidden">
                  <div className="flex h-full w-full justify-between">
                    {/* Left Half: Instructor Copy */}
                    <div className="w-[47%] h-full">
                      {renderSingleTeacherPayoutPreview(language === 'ar' ? 'نسخة الأستاذ / Instructor Copy' : 'Instructor Copy')}
                    </div>
                    
                    {/* Divider */}
                    <div className="w-[6%] h-full flex flex-col justify-center items-center relative">
                      <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-slate-300"></div>
                      <span className="bg-white px-1 z-10 text-[9px] text-slate-400 select-none">✂️</span>
                    </div>

                    {/* Right Half: Office Copy */}
                    <div className="w-[47%] h-full">
                      {renderSingleTeacherPayoutPreview(language === 'ar' ? 'نسخة الإدارة / Office Copy' : 'Office Copy')}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </>
        );
      })()
    )}
    </div>
  )
}

