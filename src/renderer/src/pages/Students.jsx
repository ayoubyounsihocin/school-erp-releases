import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Users, UserPlus, Phone, AlertCircle, RefreshCw, Search, X, Check, ArrowRight, BookOpen, Plus, Edit, Trash2, Printer, FileText, CreditCard, Award, Upload, Download, Mail } from 'lucide-react'
import { useLanguage } from '../i18n'
import { ipcService } from '../services/ipcService'
import CustomDatePicker from '../components/CustomDatePicker'
import { 
  getStudentCourseAttendanceStats as getStudentCourseAttendanceStatsHelper, 
  getCoursePaymentsBalance as getCoursePaymentsBalanceHelper,
  translateMonth as translateMonthHelper,
  toLocalYYYYMMDD
} from '../utils/billing'
import { STUDENT_PRINT_STYLES, CERTIFICATE_PRINT_STYLES } from '../utils/printStyles'
import QRCode from 'qrcode'
import AdvancedTable from '../components/AdvancedTable'
import SkeletonLoader from '../components/SkeletonLoader'
import { exportToExcel } from '../utils/excelExport'

const CustomCheckbox = ({ checked, onChange, disabled }) => {
  return (
    <div 
      onClick={() => {
        if (!disabled && onChange) onChange(!checked);
      }}
      className={`h-4 w-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked 
          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/10' 
          : 'border-slate-750 bg-slate-950/40 hover:border-slate-655'
      }`}
    >
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </div>
  );
};

export default function Students() {
  const { language, t, dir, isRTL } = useLanguage()
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
  const [students, setStudents] = useState([])
  const [allAbsences, setAllAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [rowSelection, setRowSelection] = useState({})
  
  const navigate = useNavigate()
  const location = useLocation()

  const [activePrintStudent, setActivePrintStudent] = useState(null)
  const [activePrintCertificateStudent, setActivePrintCertificateStudent] = useState(null)
  const [schoolName, setSchoolName] = useState('School Name')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolWebsite, setSchoolWebsite] = useState('')
  const [schoolLogo, setSchoolLogo] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    full_name: '',
    phone: '',
    email: '',
    parent_phone: '',
    parent_email: '',
    grade_level: '',
    date_of_birth: ''
  })
  const [selectedExtraFields, setSelectedExtraFields] = useState([])
  const [importing, setImporting] = useState(false)

  // Filter States
  const [allCourses, setAllCourses] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [courseFilter, setCourseFilter] = useState('All')
  const [balanceFilter, setBalanceFilter] = useState('All')

  // Loyal/NoCourse Helpers
  const isLoyalStudent = (student) => {
    const coursesCount = student.Courses ? student.Courses.length : 0;
    if (coursesCount < 2) return false;
    if (!student.createdAt) return false;
    
    const createdDate = new Date(student.createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return createdDate <= oneYearAgo;
  };

  const isNoCourse15Days = (student) => {
    const coursesCount = student.Courses ? student.Courses.length : 0;
    if (coursesCount > 0) return false;
    if (!student.createdAt) return false;

    const createdDate = new Date(student.createdAt);
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    return createdDate <= fifteenDaysAgo;
  };

  const isBirthdayToday = (dobString) => {
    if (!dobString) return false;
    try {
      const today = new Date();
      const todayStr = today.toISOString().substring(5, 10); // "MM-DD"
      const cleanDob = dobString.trim();
      if (cleanDob.length >= 10) {
        return cleanDob.substring(5, 10) === todayStr;
      } else if (cleanDob.length === 5) {
        return cleanDob === todayStr;
      }
      const dob = new Date(dobString);
      if (!isNaN(dob.getTime())) {
        return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // CSV RFC-4180 Compliant Parser with auto delimiter detection
  const parseCSVText = (text) => {
    // Detect delimiter: comma (,) vs semicolon (;) based on frequency in first row
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

  const handleCsvFileUpload = (e) => {
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
      // Normalize row lengths by padding short rows or truncating long rows to match header count
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
      
      // Auto mapping logic
      const mapping = {
        full_name: '',
        phone: '',
        email: '',
        parent_phone: '',
        parent_email: '',
        grade_level: '',
        date_of_birth: ''
      };
      
      headers.forEach(h => {
        const clean = h.toLowerCase().replace(/[\s_-]/g, '');
        if (['fullname', 'name', 'nom', 'nomcomplet', 'الاسم', 'الاسمكامل', 'الاسمالكامل'].includes(clean)) {
          mapping.full_name = h;
        }
        if (['phone', 'phone_number', 'phonenumber', 'tel', 'telephone', 'mobile', 'الهاتف', 'رقمالهاتف'].includes(clean)) {
          mapping.phone = h;
        }
        if (['email', 'studentemail', 'mail', 'emailaddress', 'البريد', 'البريدالإلكتروني', 'إيميل'].includes(clean)) {
          mapping.email = h;
        }
        if (['parentphone', 'parentmobile', 'guardianphone', 'parent', 'هاتفالولي', 'رقمالولي', 'الولي'].includes(clean)) {
          mapping.parent_phone = h;
        }
        if (['parentemail', 'parentmail', 'guardianemail', 'بريدالولي', 'إيميلالولي'].includes(clean)) {
          mapping.parent_email = h;
        }
        if (['grade', 'level', 'gradelevel', 'class', 'classe', 'المستوى', 'الصف'].includes(clean)) {
          mapping.grade_level = h;
        }
        if (['dob', 'birth', 'dateofbirth', 'birthdate', 'naissance', 'datenaissance', 'تاريخالميلاد', 'الميلاد'].includes(clean)) {
          mapping.date_of_birth = h;
        }
      });
      
      setColumnMapping(mapping);
      
      // Initialize selected extra fields: select all unmapped columns by default
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
      const parentPhoneIdx = columnMapping.parent_phone ? csvHeaders.indexOf(columnMapping.parent_phone) : -1;
      const parentEmailIdx = columnMapping.parent_email ? csvHeaders.indexOf(columnMapping.parent_email) : -1;
      const gradeIdx = columnMapping.grade_level ? csvHeaders.indexOf(columnMapping.grade_level) : -1;
      const dobIdx = columnMapping.date_of_birth ? csvHeaders.indexOf(columnMapping.date_of_birth) : -1;
      
      const mappedStudents = csvRows.map(row => {
        const studentObj = {
          full_name: row[nameIdx]?.trim() || '',
          phone: phoneIdx !== -1 ? row[phoneIdx]?.trim() : '',
          email: emailIdx !== -1 ? row[emailIdx]?.trim() : '',
          parent_phone: parentPhoneIdx !== -1 ? row[parentPhoneIdx]?.trim() : '',
          parent_email: parentEmailIdx !== -1 ? row[parentEmailIdx]?.trim() : '',
          grade_level: gradeIdx !== -1 ? row[gradeIdx]?.trim() : 'Primary',
          date_of_birth: dobIdx !== -1 ? row[dobIdx]?.trim() : '',
          extra_info: {}
        };
        
        selectedExtraFields.forEach(field => {
          const idx = csvHeaders.indexOf(field);
          if (idx !== -1 && row[idx]) {
            studentObj.extra_info[field] = row[idx].trim();
          }
        });
        
        return studentObj;
      }).filter(s => s.full_name);
      
      const res = await ipcService.bulkImportStudents(mappedStudents);
      if (res && res.error) {
        alert(t('students.importFailed') + ": " + res.error);
      } else {
        const count = res.count || 0;
        const skipped = res.skipped || 0;
        let msg = t('students.importSuccess').replace('{count}', count);
        if (skipped > 0) {
          msg += ` (${t('students.importSkipped').replace('{count}', skipped)})`;
        }
        alert(msg);
        setIsImportModalOpen(false);
        setCsvHeaders([]);
        setCsvRows([]);
        await loadStudents();
      }
    } catch (err) {
      console.error(err);
      alert(t('students.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      language === 'ar' ? 'الاسم الكامل' : 'Full Name',
      language === 'ar' ? 'الهاتف' : 'Phone',
      language === 'ar' ? 'البريد الإلكتروني' : 'Email',
      language === 'ar' ? 'هاتف ولي الأمر' : 'Parent Phone',
      language === 'ar' ? 'بريد ولي الأمر' : 'Parent Email',
      language === 'ar' ? 'المستوى الدراسي' : 'Grade Level',
      language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth',
      language === 'ar' ? 'الحالة' : 'Status'
    ]

    const rows = students.map(s => [
      `"${(s.full_name || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '')}"`,
      `"${(s.email || '')}"`,
      `"${(s.parent_phone || '')}"`,
      `"${(s.parent_email || '')}"`,
      `"${(s.grade_level || 'Primary')}"`,
      `"${(s.date_of_birth || '')}"`,
      `"${(s.status || 'Active')}"`
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Students_Export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  };

  // Grades Modal States
  const [isGradesModalOpen, setIsGradesModalOpen] = useState(false)
  const [selectedGradesStudent, setSelectedGradesStudent] = useState(null)
  const [studentGrades, setStudentGrades] = useState([])
  const [gradeForm, setGradeForm] = useState({
    CourseId: '',
    exam_name: '',
    score: '',
    max_score: '20',
    coefficient: '1',
    remarks: ''
  })
  const [gradesLoading, setGradesLoading] = useState(false)

  // Student Card Modal States
  const [isStudentCardModalOpen, setIsStudentCardModalOpen] = useState(false)
  const [selectedStudentCardStudent, setSelectedStudentCardStudent] = useState(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

  const loadStudentGrades = async (studentId) => {
    setGradesLoading(true)
    try {
      const data = await ipcService.getGrades(studentId)
      setStudentGrades(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load student grades:", err)
    } finally {
      setGradesLoading(false)
    }
  }

  const handleOpenGradesModal = (student) => {
    setSelectedGradesStudent(student)
    setIsGradesModalOpen(true)
    loadStudentGrades(student.id)
    setGradeForm({
      CourseId: '',
      exam_name: '',
      score: '',
      max_score: '20',
      coefficient: '1',
      remarks: ''
    })
  }

  const handleAddGradeSubmit = async (e) => {
    e.preventDefault()
    if (!gradeForm.CourseId || !gradeForm.exam_name.trim() || !gradeForm.score) {
      alert("Please fill all required fields");
      return;
    }
    try {
      const payload = {
        StudentId: selectedGradesStudent.id,
        CourseId: parseInt(gradeForm.CourseId),
        exam_name: gradeForm.exam_name,
        score: parseFloat(gradeForm.score),
        max_score: parseFloat(gradeForm.max_score || 20),
        coefficient: parseFloat(gradeForm.coefficient || 1),
        remarks: gradeForm.remarks,
        date: toLocalYYYYMMDD(new Date())
      };
      const res = await ipcService.addGrade(payload);
      if (res && res.error) {
        alert(res.error);
      } else {
        setGradeForm({
          CourseId: '',
          exam_name: '',
          score: '',
          max_score: '20',
          coefficient: '1',
          remarks: ''
        });
        await loadStudentGrades(selectedGradesStudent.id);
      }
    } catch (err) {
      console.error("Failed to save grade:", err);
    }
  }

  const handleDeleteGrade = async (id) => {
    if (!(await confirm(t('common.confirmDelete') || "Delete this record?"))) return;
    try {
      const res = await ipcService.deleteGrade(id);
      if (res && res.error) {
        alert(res.error);
      } else {
        await loadStudentGrades(selectedGradesStudent.id);
      }
    } catch (err) {
      console.error("Failed to delete grade:", err);
    }
  }

  const handleOpenStudentCardModal = (student) => {
    setSelectedStudentCardStudent(student)
    setIsStudentCardModalOpen(true)
    setQrCodeDataUrl('')
  }

  useEffect(() => {
    if (selectedStudentCardStudent) {
      QRCode.toDataURL(`ST-${selectedStudentCardStudent.id}`, { margin: 1, scale: 4 })
        .then(url => {
          setQrCodeDataUrl(url)
        })
        .catch(err => {
          console.error("Failed to generate QR Code:", err)
        })
    }
  }, [selectedStudentCardStudent])

  const handlePrintReportCard = async (student) => {
    if (!window.api || !window.api.printWeb) {
      alert(t('layout.ipcOffline') || "Print feature is only available in the desktop application.");
      return;
    }
    let totalPoints = 0;
    let totalCoeffs = 0;
    studentGrades.forEach(g => {
      const normalizedScore = (g.score / g.max_score) * 20;
      totalPoints += normalizedScore * g.coefficient;
      totalCoeffs += g.coefficient;
    });
    const average = totalCoeffs > 0 ? (totalPoints / totalCoeffs).toFixed(2) : '—';
    const isAr = language === 'ar';
    const textAlignLeft = isAr ? 'right' : 'left';
    const textAlignRight = isAr ? 'left' : 'right';
    const rowsHtml = studentGrades.map(g => `
      <tr>
        <td style="text-align: ${textAlignLeft}; font-weight: bold; border: 1px solid #aaa; padding: 6px;">\${g.Course?.title || 'Course'}</td>
        <td style="text-align: ${textAlignLeft}; border: 1px solid #aaa; padding: 6px;">\${g.exam_name}</td>
        <td style="text-align: center; font-family: monospace; border: 1px solid #aaa; padding: 6px;">\${g.score} / \${g.max_score}</td>
        <td style="text-align: center; font-family: monospace; border: 1px solid #aaa; padding: 6px;">\${g.coefficient}</td>
        <td style="text-align: ${textAlignLeft}; border: 1px solid #aaa; padding: 6px;">\${g.remarks || ''}</td>
      </tr>
    `).join('');
    const html = `
<!DOCTYPE html>
<html dir="\${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>Report Card - \${student.full_name}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 20px;
      font-size: 11px;
      color: #333;
      direction: \${isAr ? 'rtl' : 'ltr'};
    }
    .header { width: 100%; margin-bottom: 20px; }
    .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px; }
    .details-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
    .details-table td { padding: 4px; vertical-align: top; }
    .main-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .main-table th, .main-table td { border: 1px solid #aaa; padding: 6px; }
    .main-table th { background-color: #f2f2f2; }
    .summary { float: \${textAlignRight}; width: 200px; border: 2px solid #000; padding: 8px; text-align: center; margin-bottom: 20px; }
    .footer { clear: both; margin-top: 50px; width: 100%; }
    .signature { width: 48%; float: \${textAlignLeft}; text-align: center; }
    .stamp { width: 48%; float: \${textAlignRight}; text-align: center; }
  </style>
</head>
<body>
  <table class="header">
    <tr>
      <td style="text-align: \${textAlignLeft}; width: 50%;">
        <strong>\${schoolName}</strong><br/>
        \${schoolPhone ? \`Phone: \${schoolPhone}<br/>\` : ''}
        \${schoolEmail ? \`Email: \${schoolEmail}\` : ''}
      </td>
      <td style="text-align: \${textAlignRight}; width: 50%;">
        <strong>\${t('students.billingYearLabel')}:</strong> \${academicYear}<br/>
        <strong>Date:</strong> \${new Date().toLocaleDateString()}
      </td>
    </tr>
  </table>
  <div class="title">\${isAr ? 'كشف النقاط المدرسي' : 'Student Report Card'}</div>
  <table class="details-table">
    <tr>
      <td style="width: 50%;">
        <strong>\${isAr ? 'اسم الطالب: ' : 'Student Name: '}</strong> \${student.full_name}<br/>
        <strong>\${isAr ? 'رقم المعرف: ' : 'Student ID: '}</strong> ST-\${student.id}
      </td>
      <td style="width: 50%; text-align: \${textAlignRight};">
        <strong>\${isAr ? 'الطور / المستوى الدراسي: ' : 'Grade Level: '}</strong> \${student.grade_level || 'Primary'}<br/>
        \${student.date_of_birth ? \`<strong>\${isAr ? 'تاريخ الميلاد: ' : 'Date of Birth: '}</strong> \${student.date_of_birth}\` : ''}
      </td>
    </tr>
  </table>
  <table class="main-table">
    <thead>
      <tr>
        <th style="text-align: \${textAlignLeft};">\${t('students.courseCol')}</th>
        <th style="text-align: \${textAlignLeft};">\${isAr ? 'الامتحان' : 'Examination'}</th>
        <th style="text-align: center; width: 15%;">\${isAr ? 'العلامة /20' : 'Grade /20'}</th>
        <th style="text-align: center; width: 10%;">\${t('customFeatures.coefficient')}</th>
        <th style="text-align: \${textAlignLeft}; width: 25%;">\${isAr ? 'ملاحظات' : 'Remarks'}</th>
      </tr>
    </thead>
    <tbody>
      \${rowsHtml || \`<tr><td colspan="5" style="text-align: center; font-style: italic;">\${t('customFeatures.noGrades')}</td></tr>\`}
    </tbody>
  </table>
  \${totalCoeffs > 0 ? \`
  <div class="summary">
    <strong>\${isAr ? 'المعدل العام (على 20):' : 'General Average (/20):'}</strong><br/>
    <span style="font-size: 16px; font-weight: bold;">\${average} / 20.00</span>
  </div>
  \` : ''}
  <div class="footer">
    <div class="stamp">
      <p>\${t('students.authorizedSignature')}</p>
      <div style="height: 60px;"></div>
    </div>
    <div class="signature">
      <p>\${isAr ? 'توقيع الأستاذ / الإدارة' : 'Instructor / Principal Signature'}</p>
      <div style="height: 60px;"></div>
    </div>
  </div>
</body>
</html>
    `;
    await ipcService.printWeb(html, 'A5', true);
  }

  const handlePrintStudentCard = async (student) => {
    if (!window.api || !window.api.printWeb) {
      alert(t('layout.ipcOffline') || "Print feature is only available in the desktop application.");
      return;
    }
    const isAr = language === 'ar';
    const html = `
<!DOCTYPE html>
<html dir="\${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>Student ID Card - \${student.full_name}</title>
  <style>
    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .card { width: 325px; height: 204px; border: 1px solid #cbd5e1; border-radius: 12px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 12px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
    .card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; }
    .school-name { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #3b82f6; }
    .card-title { font-size: 8px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
    .card-body { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex: 1; }
    .avatar-placeholder { width: 55px; height: 55px; border-radius: 8px; background-color: #334155; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); }
    .student-info { flex: 1; font-size: 9px; }
    .student-name { font-size: 12px; font-weight: bold; margin: 0 0 4px 0; color: #fff; }
    .qr-container { width: 60px; height: 60px; background-color: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 2px; border: 1px solid #cbd5e1; }
    .qr-image { width: 100%; height: 100%; object-fit: contain; }
    .card-footer { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="school-name">\${schoolName}</div>
      <div class="card-title">\${isAr ? 'بطاقة مدرسية' : 'STUDENT CARD'}</div>
    </div>
    <div class="card-body">
      <div class="avatar-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div class="student-info">
        <div class="student-name">\${student.full_name}</div>
        <div><strong>ID:</strong> ST-\${student.id}</div>
        <div style="margin-top: 2px;"><strong>Level:</strong> \${student.grade_level || 'Primary'}</div>
        \${student.phone ? \`<div style="margin-top: 2px;"><strong>Phone:</strong> \${student.phone}</div>\` : ''}
      </div>
      <div class="qr-container">
        <img class="qr-image" src="\${qrCodeDataUrl}" />
      </div>
    </div>
    <div class="card-footer">
      <div>ACADEMIC YEAR: \${academicYear}</div>
      <div>VALID ID CARD</div>
    </div>
  </div>
</body>
</html>
    `;
    await ipcService.printWeb(html, 'A5', true);
  }

  // Enrollment Modal States
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [availableCourses, setAvailableCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollActionLoading, setEnrollActionLoading] = useState(false)
  const [enrollmentDate, setEnrollmentDate] = useState(toLocalYYYYMMDD(new Date()))

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    parent_phone: '',
    parent_email: '',
    status: 'Active',
    grade_level: 'Primary',
    date_of_birth: ''
  })
  
  // Validation Errors
  const [formErrors, setFormErrors] = useState({})

  const getStudentCourseAttendanceStats = (student, courseId) => {
    return getStudentCourseAttendanceStatsHelper(student, courseId, allAbsences, language, t);
  };

  const getCoursePaymentsBalance = (student, courseId) => {
    return getCoursePaymentsBalanceHelper(student, courseId, allAbsences, language, t);
  };

  const translateMonth = (mName) => {
    return translateMonthHelper(mName, t);
  };

  // Calculate financials helper
  const calculateFinancials = (student) => {
    return getCoursePaymentsBalance(student, null);
  }

  // Generate the inner invoice HTML content (reusable for both copies)
  const getInvoiceCopyHtml = (student, copyTitle, isAr, textAlignLeft, textAlignRight, logoHtml, coursesRowsHtml, balance, academicYear) => {
    return `
      <div class="invoice-half">
        <div>
          <!-- Copy Badge -->
          <div class="copy-badge">${copyTitle}</div>

          <!-- Header Section -->
          <table class="header-table">
            <tr>
              <td style="width: 55%; vertical-align: top; text-align: ${textAlignLeft};">
                ${logoHtml}
              </td>
              <td style="width: 45%; vertical-align: top; text-align: ${textAlignRight};" class="header-info">
                ${schoolPhone ? `<div>${t('settings.schoolPhoneLabel')}: ${schoolPhone}</div>` : ''}
                ${schoolEmail ? `<div>${t('settings.schoolEmailLabel')}: ${schoolEmail}</div>` : ''}
              </td>
            </tr>
          </table>

          <!-- Thick Divider Line -->
          <div class="divider-line"></div>

          <!-- Title -->
          <h1 class="invoice-title" style="text-align: ${textAlignLeft};">${t('students.invoiceTitle')}</h1>

          <!-- Profile Details Grid -->
          <table class="details-table">
            <tr>
              <td class="details-td" style="width: 60%; text-align: ${textAlignLeft}; border-${isAr ? 'left' : 'right'}: 1px solid #e2e8f0;">
                <div class="details-label">${t('students.studentDetailsTitle')}:</div>
                <div class="details-value">${student.full_name}</div>
                <div class="details-subtext">
                  <div>${t('students.idLabel')}: ST-${student.id}</div>
                  ${student.phone ? `<div>${t('teachers.phoneLabel')}: ${student.phone}</div>` : ''}
                  ${student.parent_phone ? `<div>${t('students.parentPlaceholder') || 'Parent Phone'}: ${student.parent_phone}</div>` : ''}
                </div>
              </td>
              <td class="details-td" style="width: 40%; text-align: ${textAlignRight};">
                <div class="details-label">${t('students.billingYearLabel')}:</div>
                <div class="details-value" style="font-size: 8px;">${academicYear}</div>
                <div class="details-label" style="margin-top: 4px;">${t('common.status')}:</div>
                <div class="details-value" style="color: #16a34a; text-transform: uppercase; font-size: 7.5px;">
                  ${t('common.' + student.status.toLowerCase()) || student.status}
                </div>
              </td>
            </tr>
          </table>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: ${textAlignLeft};">${t('students.courseCol')}</th>
                <th style="text-align: ${textAlignRight}; width: 22%;">${t('students.tuitionCol')}</th>
                <th style="text-align: ${textAlignRight}; width: 22%;">${t('finances.amountCol')}</th>
                <th style="text-align: ${textAlignRight}; width: 22%;">${t('finances.statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              ${coursesRowsHtml || `<tr><td colspan="4" style="padding: 10px 0; text-align: center; color: #94a3b8; font-style: italic;">${t('students.noEnrolledCourses')}</td></tr>`}
            </tbody>
          </table>

          <!-- Totals Section -->
          <table class="totals-table">
            <tr class="total-due-row">
              <td style="text-align: ${textAlignLeft}; padding: 4px 6px; font-size: 7.5px; font-weight: 800; text-transform: uppercase;">${t('students.totalOwedLabel')}</td>
              <td style="text-align: ${textAlignRight}; padding: 4px 6px;" class="total-amount" style="color: ${balance > 0 ? '#b91c1c' : '#16a34a'};">
                ${balance.toFixed(2)} ${t('common.da')}
              </td>
            </tr>
          </table>
        </div>

        <div>
          <!-- Footer Info & Signature -->
          <div class="footer-section">
            <div class="stamp-box">
              ${isAr ? 'ختم المدرسة' : 'School Stamp'}
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div class="signature-title">${t('students.authorizedSignature')}</div>
            </div>
          </div>

          <!-- Terms and Conditions -->
          <div class="terms-text" style="text-align: ${textAlignLeft};">
            <strong>${t('students.termsTitle')}:</strong> ${t('students.termsText')}
          </div>
        </div>
      </div>
    `;
  };

  const handleDownloadStudentPDF = async (student, action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert(t('layout.ipcOffline') || "PDF/Print feature is only available in the desktop application.");
      return;
    }

    setPdfLoading(true);
    try {
      const { totalTuition, totalPaid, balance } = calculateFinancials(student);
      const isAr = language === 'ar';
      const textAlignLeft = isAr ? 'right' : 'left';
      const textAlignRight = isAr ? 'left' : 'right';

      const coursesRowsHtml = (student.Courses || []).map((c) => {
        const balanceInfo = getCoursePaymentsBalance(student, c.id);
        const pendingHtml = balanceInfo.balance > 0 
          ? `<div style="font-size: 6.5px; color: #b91c1c; font-weight: bold; margin-top: 1px;">
              ${t('students.outstandingBalanceLabel')}: ${balanceInfo.unpaidMonths.map(um => `${um.monthLabel || translateMonth(um.month)} ${um.year}`).join(', ')}
             </div>` 
          : '';
        return `
          <tr>
            <td style="text-align: ${textAlignLeft}; font-weight: 700; font-size: 8px; line-height: 1.1;">
              ${c.title}
              <div style="font-size: 6.5px; color: #475569; font-weight: normal; margin-top: 1px;">
                ${t('courses.instructorLabel')}: ${c.Teacher?.full_name || t('courses.noInstructor')}
              </div>
              ${pendingHtml}
            </td>
            <td style="text-align: ${textAlignRight}; font-size: 7.5px; font-family: monospace;">${balanceInfo.totalTuition.toFixed(2)} DA</td>
            <td style="text-align: ${textAlignRight}; font-size: 7.5px; color: #16a34a; font-family: monospace;">${balanceInfo.totalPaid.toFixed(2)} DA</td>
            <td style="text-align: ${textAlignRight}; font-size: 7.5px; color: ${balanceInfo.balance > 0 ? '#b91c1c' : '#16a34a'}; font-family: monospace; font-weight: 700;">${balanceInfo.balance.toFixed(2)} DA</td>
          </tr>
        `;
      }).join('');

      const logoHtml = schoolLogo 
        ? `<div class="school-title-group">
            <img src="${schoolLogo}" style="max-height: 22px; max-width: 80px; object-fit: contain;" />
            <div class="school-name">${schoolName}</div>
           </div>`
        : `<div class="school-title-group">
            <svg style="width: 14px; height: 14px; fill: #0f172a; display: block;" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div style="text-align: ${isAr ? 'right' : 'left'};">
              <div class="school-name">${schoolName}</div>
            </div>
          </div>`;

      // Get Left Copy (Student Copy) and Right Copy (School Copy)
      const leftCopyHtml = getInvoiceCopyHtml(student, isAr ? 'نسخة الطالب / Student Copy' : 'Student Copy', isAr, textAlignLeft, textAlignRight, logoHtml, coursesRowsHtml, balance, academicYear);
      const rightCopyHtml = getInvoiceCopyHtml(student, isAr ? 'نسخة الإدارة / Office Copy' : 'Office Copy', isAr, textAlignLeft, textAlignRight, logoHtml, coursesRowsHtml, balance, academicYear);

      const html = `
<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>${t('students.printPreviewTitle')} - ${student.full_name}</title>
  <style>
    ${STUDENT_PRINT_STYLES}
    body {
      direction: ${isAr ? 'rtl' : 'ltr'};
    }
  </style>
</head>
<body>
  <div class="page-container" style="direction: ${isAr ? 'rtl' : 'ltr'};">
    ${leftCopyHtml}
    
    <!-- Cut line divider -->
    <div class="middle-divider">
      <span class="scissors-icon">✂️</span>
    </div>

    ${rightCopyHtml}
  </div>
</body>
</html>
      `;

      const filename = `Billing_Statement_${student.full_name.replace(/\s+/g, '_')}.pdf`;
      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5');
        if (res && res.success) {
          alert(t('students.receiptPrintConfirm') || "Student billing statement printed successfully!");
        }
      } else {
        const res = await ipcService.printPdf(html, filename, 'A5');
        if (res && res.success) {
          alert(t('settings.successSettingsSaved') || "Student billing statement PDF generated successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to process Student Summary document:", err);
      alert("Failed to process Student Summary document.");
    } finally {
      setPdfLoading(false);
    }
  }

  // Generate and Download Certificate PDF
  const handleDownloadCertificatePDF = async (student, action = 'download') => {
    if (!window.api || !window.api.printPdf) {
      alert(t('layout.ipcOffline') || "PDF/Print feature is only available in the desktop application.");
      return;
    }

    setPdfLoading(true);
    try {
      const isAr = language === 'ar';
      const textAlignLeft = isAr ? 'right' : 'left';
      const textAlignRight = isAr ? 'left' : 'right';

      const logoHtml = schoolLogo 
        ? `<div class="school-logo" style="text-align: ${textAlignLeft};">
            <img src="${schoolLogo}" />
            <div class="school-name" style="margin-top: 2px;">${schoolName}</div>
           </div>`
        : `<div class="school-logo" style="text-align: ${textAlignLeft};">
            <div class="school-name">${schoolName}</div>
           </div>`;

      const formattedDate = new Date().toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-US', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      const html = `
<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>Certificate - ${student.full_name}</title>
  <style>
    ${CERTIFICATE_PRINT_STYLES}
  </style>
</head>
<body>
  <div class="page-container">
    <div class="certificate-border">
      <!-- Corners -->
      <div class="certificate-corner-decor decor-tl"></div>
      <div class="certificate-corner-decor decor-tr"></div>
      <div class="certificate-corner-decor decor-bl"></div>
      <div class="certificate-corner-decor decor-br"></div>

      <!-- Header -->
      <table class="header-table" style="width: 100%;">
        <tr>
          <td style="width: 50%; vertical-align: top; text-align: ${textAlignLeft};">
            ${logoHtml}
          </td>
          <td style="width: 50%; vertical-align: top; text-align: ${textAlignRight};" class="header-info">
            <div style="font-weight: 800; color: #1e3a8a; font-size: 8px;">${t('students.billingYearLabel')}: ${academicYear}</div>
            ${schoolPhone ? `<div style="margin-top: 1px;">${t('settings.schoolPhoneLabel')}: ${schoolPhone}</div>` : ''}
            ${schoolEmail ? `<div style="margin-top: 1px;">${t('settings.schoolEmailLabel')}: ${schoolEmail}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Title -->
      <div class="certificate-title-box">
        <h1 class="certificate-title-ar">شهادة تسجيل مدرسية</h1>
        <h2 class="certificate-title-en">School Enrollment Certificate</h2>
      </div>

      <!-- Body -->
      <div class="certificate-body">
        ${isAr 
          ? `تشهد إدارة مدرسة <strong>${schoolName}</strong> بأن الطالب(ة): 
             <div class="student-highlight" style="font-family: 'Noto Kufi Arabic', sans-serif;">${student.full_name}</div> 
             <br/>المولود(ة) بتاريخ: <strong style="color: #0f172a;">${student.date_of_birth || '—'}</strong>، مسجل(ة) بصفة منتظمة في مؤسستنا للموسم الدراسي الحالي بصف الدراسي: <strong style="color: #0f172a;">${t('students.gradeLevel' + student.grade_level) || student.grade_level}</strong>، ويتابع الدروس في المواد التالية:`
          : `The administration of <strong>${schoolName}</strong> hereby certifies that the student: 
             <div class="student-highlight" style="font-family: 'Inter', sans-serif;">${student.full_name}</div> 
             <br/>born on <strong style="color: #0f172a;">${student.date_of_birth || '—'}</strong>, is officially registered in our institution for the current academic session in grade: <strong style="color: #0f172a;">${student.grade_level}</strong>, attending the following courses:`
        }
        <div class="course-badge-list">
          ${(student.Courses || []).map(c => `<span class="course-badge">${c.title}</span>`).join('') || `<span class="course-badge">${t('students.noEnrolledCourses')}</span>`}
        </div>
      </div>

      <!-- Footer -->
      <div class="certificate-footer">
        <div class="date-info">
          <div>${isAr ? 'حرر بـ:' : 'Issued on:'} ${formattedDate}</div>
          <div style="margin-top: 1px; font-family: monospace; font-size: 7px;">Ref: ST-00${student.id}/${new Date().getFullYear()}</div>
        </div>
        <div class="stamp-seal">
          ${isAr ? 'ختم المدرسة' : 'School Seal'}
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-title">${isAr ? 'إمضاء المدير' : 'School Director'}</div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
      `;

      const filename = `Enrollment_Certificate_${student.full_name.replace(/\s+/g, '_')}.pdf`;
      if (action === 'print') {
        const res = await ipcService.printWeb(html, 'A5');
        if (res && res.success) {
          alert(language === 'ar' ? "تمت طباعة شهادة التسجيل بنجاح!" : "Enrollment certificate printed successfully!");
        }
      } else {
        const res = await ipcService.printPdf(html, filename, 'A5');
        if (res && res.success) {
          alert(language === 'ar' ? "تم حفظ شهادة التسجيل كملف PDF بنجاح!" : "Enrollment certificate PDF generated successfully!");
        }
      }
    } catch (err) {
      console.error("Failed to process Certificate document:", err);
      alert("Failed to process Certificate document.");
    }
  }

  // Load students from database
  const loadStudents = async () => {
    setLoading(true)
    try {
      const data = await ipcService.getStudents()
      setStudents(Array.isArray(data) ? data : [])
      const absencesData = await ipcService.getAbsences({})
      setAllAbsences(Array.isArray(absencesData) ? absencesData : [])
    } catch (err) {
      console.error("Failed to load students/absences from SQLite:", err)
      setStudents([])
      setAllAbsences([])
    } finally {
      // Delay slightly for animation smoothness
      setTimeout(() => {
        setLoading(false)
      }, 450)
    }
  }

  // Load on mount
  useEffect(() => {
    const loadInitialData = async () => {
      await loadStudents()
      try {
        const coursesData = await ipcService.getCourses()
        setAllCourses(coursesData)
        const settings = await ipcService.getSettings()
        if (settings.school_name) setSchoolName(settings.school_name)
        if (settings.school_address) setSchoolAddress(settings.school_address)
        if (settings.school_phone) setSchoolPhone(settings.school_phone)
        if (settings.school_email) setSchoolEmail(settings.school_email)
        if (settings.school_website) setSchoolWebsite(settings.school_website)
        if (settings.school_logo) setSchoolLogo(settings.school_logo)
        if (settings.academic_year) setAcademicYear(settings.academic_year)
      } catch (err) {
        console.error("Failed to load courses/settings for filters:", err)
      }
    }
    loadInitialData()
  }, [])

  // Selected Student via command palette routing listener
  useEffect(() => {
    if (location.state && location.state.selectedStudentId && students.length > 0) {
      const student = students.find(s => s.id === location.state.selectedStudentId);
      if (student) {
        setSearchTerm(student.full_name);
        // Clear state so it doesn't filter again next time they come back to the tab
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, students, navigate, location.pathname]);

  // Local client search filtering
  const filteredStudents = students.filter(student => {
    // Search Term Match
    const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.phone && student.phone.includes(searchTerm)) ||
      (student.parent_phone && student.parent_phone.includes(searchTerm));

    // Status Match
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Loyal' ? isLoyalStudent(student) :
       statusFilter === 'NoCourse15Days' ? isNoCourse15Days(student) :
       student.status === statusFilter);

    // Course Match
    const matchesCourse = courseFilter === 'All' || 
      (student.Courses || []).some(c => c.id.toString() === courseFilter);

    // Balance Match
    let matchesBalance = true;
    if (balanceFilter !== 'All') {
      const { balance } = calculateFinancials(student);
      if (balanceFilter === 'Unpaid') {
        matchesBalance = balance > 0;
      } else if (balanceFilter === 'Settled') {
        matchesBalance = balance <= 0;
      }
    }

    return matchesSearch && matchesStatus && matchesCourse && matchesBalance;
  })

  // Status style mapping helper
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
      case 'Dropped':
        return 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
      case 'Graduated':
        return 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
      default:
        return 'bg-slate-500/10 border-slate-500/25 text-slate-700 dark:text-slate-400'
    }
  }

  const handleExportStudentsExcel = () => {
    const formatted = filteredStudents.map(s => {
      const financials = calculateFinancials(s);
      return {
        'Full Name': s.full_name,
        'Grade Level': s.grade_level,
        'Phone Number': s.phone,
        'Email Address': s.email || 'N/A',
        'Parent Phone': s.parent_phone || 'N/A',
        'Parent Email': s.parent_email || 'N/A',
        'Status': s.status,
        'Outstanding Balance (DA)': financials.balance,
        'Registration Date': new Date(s.createdAt).toLocaleDateString()
      };
    });
    exportToExcel(formatted, 'Students Directory', 'Students_Directory.xlsx');
  };

  const handleBulkEmail = () => {
    const selectedIndexes = Object.keys(rowSelection).map(k => parseInt(k, 10));
    const selectedStudents = selectedIndexes.map(idx => filteredStudents[idx]).filter(Boolean);
    const emails = selectedStudents.map(s => s.parent_email || s.email).filter(Boolean);
    sessionStorage.setItem('bulk_email_recipients', JSON.stringify(emails));
    navigate('/communication');
  };

  const columns = React.useMemo(() => [
    {
      accessorKey: 'full_name',
      header: t('students.fullNameCol'),
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase shrink-0 animate-fade-in">
              {student.full_name ? student.full_name.charAt(0) : 'S'}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-100 truncate max-w-[180px]">{student.full_name}</span>
                {isLoyalStudent(student) && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold text-amber-400 cursor-help" title={t('customFeatures.loyalBadge')}>
                    ❤️ {t('customFeatures.loyalBadge')}
                  </span>
                )}
                {isNoCourse15Days(student) && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold text-rose-400 cursor-help" title={t('customFeatures.noCourse15Days')}>
                    ⚠️ {t('customFeatures.noCourse15Days')}
                  </span>
                )}
                {isBirthdayToday(student.date_of_birth) && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-500/15 border border-pink-500/20 text-[8px] font-bold text-pink-400 cursor-help" title={language === 'ar' ? 'عيد ميلاد اليوم! 🎂' : 'Today is their Birthday! 🎂'}>
                    🎂 {language === 'ar' ? 'عيد ميلاد اليوم' : 'Birthday Today'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="px-1.5 py-0.2 bg-slate-950 border border-slate-850 text-[9px] text-slate-400 rounded-md font-semibold tracking-wider">
                  {student.grade_level || 'Primary'}
                </span>
              </div>
            </div>
          </div>
        );
      },
      size: 220
    },
    {
      accessorKey: 'phone',
      header: t('students.phoneCol'),
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex flex-col gap-0.5 text-[10px] font-medium font-mono text-slate-350 text-start">
            <div className="flex items-center gap-1">
              <span>{student.phone || 'N/A'}</span>
            </div>
            {student.email && (
              <div className="text-[9px] text-slate-500 max-w-[145px] truncate" title={student.email}>
                {student.email}
              </div>
            )}
          </div>
        );
      },
      size: 140
    },
    {
      id: 'courses',
      header: t('students.coursesCol'),
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex flex-col gap-1.5 max-w-xs text-start">
            {student.Courses && student.Courses.length > 0 ? (
              (() => {
                const c = student.Courses[0];
                const stats = getStudentCourseAttendanceStats(student, c.id);
                return (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-[9px] text-slate-300 font-semibold">
                        {c.title}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        stats.remaining <= 1
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400 shadow-sm animate-pulse'
                          : stats.remaining <= 3
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-400'
                      }`}>
                        {stats.attended}/{stats.paid}
                      </span>
                    </div>
                    {student.Courses.length > 1 && (
                      <button
                        onClick={() => handleManageEnrollments(student)}
                        className="text-[9px] text-purple-400 hover:text-purple-300 font-semibold block cursor-pointer"
                      >
                        +{student.Courses.length - 1} {language === 'ar' ? 'أخرى' : 'more'}
                      </button>
                    )}
                  </div>
                );
              })()
            ) : (
              <span className="text-[10px] text-slate-650 italic">-</span>
            )}
          </div>
        );
      },
      size: 150
    },
    {
      id: 'balance',
      header: t('students.balanceCol'),
      cell: info => {
        const student = info.row.original;
        return (
          <div className="text-start">
            {student.Courses && student.Courses.length > 0 ? (
              (() => {
                const c = student.Courses[0];
                const balanceInfo = getCoursePaymentsBalance(student, c.id);
                return (
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono border ${
                    balanceInfo.balance <= 0 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {balanceInfo.balance > 0 ? `${balanceInfo.balance.toFixed(2)} DA` : t('students.balanceSettled')}
                  </span>
                );
              })()
            ) : (
              <span className="text-[10px] text-slate-650 italic">-</span>
            )}
          </div>
        );
      },
      size: 130
    },
    {
      accessorKey: 'status',
      header: t('students.statusCol'),
      cell: info => {
        const status = info.getValue();
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${getStatusBadgeStyle(status)}`}>
            <span className="h-1 w-1 rounded-full bg-current"></span>
            {status === 'Active' ? t('common.active') : status === 'Dropped' ? (language === 'ar' ? 'منقطع' : 'Dropped') : (language === 'ar' ? 'متخرج' : 'Graduated')}
          </span>
        );
      },
      size: 110
    },
    {
      id: 'actions',
      header: t('students.actionsCol'),
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
            {/* BookOpen: Enroll */}
            <button
              onClick={() => handleManageEnrollments(student)}
              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-purple-400 hover:border-purple-500/30 rounded-lg transition-all cursor-pointer"
              title={t('students.enrollmentBtn')}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
            
            {/* Award: Grades */}
            <button
              type="button"
              onClick={() => handleOpenGradesModal(student)}
              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 rounded-lg transition-all cursor-pointer"
              title={t('customFeatures.gradesBtn')}
            >
              <Award className="h-3.5 w-3.5" />
            </button>

            {/* CreditCard: Student Card */}
            <button
              type="button"
              onClick={() => handleOpenStudentCardModal(student)}
              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 rounded-lg transition-all cursor-pointer"
              title={t('customFeatures.studentCardBtn')}
            >
              <CreditCard className="h-3.5 w-3.5" />
            </button>

            {/* Printer: Invoice Summary */}
            <button
              type="button"
              onClick={() => setActivePrintStudent(student)}
              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-500/30 rounded-lg transition-all cursor-pointer"
              title={t('students.printSummaryTooltip')}
            >
              <Printer className="h-3.5 w-3.5" />
            </button>

            {/* FileText: Registration Certificate */}
            <button
              type="button"
              onClick={() => setActivePrintCertificateStudent(student)}
              className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 rounded-lg transition-all cursor-pointer"
              title={language === 'ar' ? 'طباعة شهادة تسجيل' : 'Print Enrollment Certificate'}
            >
              <FileText className="h-3.5 w-3.5" />
            </button>

            {/* Edit */}
            {hasPermission('students:write') && (
              <button
                onClick={() => handleOpenEditModal(student)}
                className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 rounded-lg transition-all cursor-pointer"
                title={t('students.editStudentTooltip')}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Delete */}
            {hasPermission('students:delete') && (
              <button
                onClick={() => handleDeleteStudent(student.id, student.full_name)}
                className="p-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 rounded-lg transition-all cursor-pointer"
                title={t('students.deleteStudentTooltip')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
      size: 240
    }
  ], [language, rowSelection]);

  // Input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
    // Clear validation error when user types
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Validate inputs
  const validateForm = () => {
    const errors = {}
    if (!formData.full_name.trim()) {
      errors.full_name = t('students.validationNameRequired')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Open {t('students.addStudent')} Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false)
    setSelectedStudent(null)
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      parent_phone: '',
      parent_email: '',
      status: 'Active',
      grade_level: 'Primary',
      date_of_birth: ''
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open Edit Student Modal
  const handleOpenEditModal = (student) => {
    setIsEditMode(true)
    setSelectedStudent(student)
    setFormData({
      full_name: student.full_name || '',
      phone: student.phone || '',
      email: student.email || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
      status: student.status || 'Active',
      grade_level: student.grade_level || 'Primary',
      date_of_birth: student.date_of_birth || ''
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Save/Update student records
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      let res;
      if (isEditMode && selectedStudent) {
        res = await ipcService.updateStudent(selectedStudent.id, formData)
      } else {
        res = await ipcService.addStudent(formData)
      }

      if (res && res.error) {
        alert(res.error || (isEditMode ? "Failed to update student" : "Failed to add student"));
        return;
      }
      
      // Reset form fields
      setFormData({
        full_name: '',
        phone: '',
        email: '',
        parent_phone: '',
        parent_email: '',
        status: 'Active',
        grade_level: 'Primary',
        date_of_birth: ''
      })
      
      // Close modal
      setIsModalOpen(false)
      
      // Auto refresh table list
      await loadStudents()
    } catch (err) {
      console.error("Failed to save student:", err)
      alert(err.message || "Failed to save student record");
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete student handler
  const handleDeleteStudent = async (id, name) => {
    const confirmed = await window.confirm(t('common.confirmDelete') || "Are you sure you want to delete this student?")
    if (!confirmed) return

    setIsSubmitting(true)
    try {
      const res = await ipcService.deleteStudent(id)
      if (res && res.error) {
        alert(res.error)
      } else {
        setIsModalOpen(false)
        await loadStudents()
      }
    } catch (err) {
      console.error("Failed to delete student:", err)
      alert("Failed to delete student record.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch student courses & all catalog courses for enrollment manager
  const handleManageEnrollments = async (student) => {
    setSelectedStudent(student)
    setIsEnrollModalOpen(true)
    setEnrollLoading(true)
    setEnrollmentDate(toLocalYYYYMMDD(new Date()))
    try {
      const [studentCourses, allCourses] = await Promise.all([
        ipcService.getStudentCourses(student.id),
        ipcService.getCourses()
      ])
      setEnrolledCourses(studentCourses)
      setAvailableCourses(allCourses)
    } catch (err) {
      console.error("Failed to load student enrollment catalogs:", err)
    } finally {
      setEnrollLoading(false)
    }
  }

  // Submit course enrollment
  const handleEnrollStudent = async (e) => {
    e.preventDefault()
    if (!selectedCourseId) return

    setEnrollActionLoading(true)
    try {
      const courseIdInt = parseInt(selectedCourseId)
      const alreadyEnrolled = enrolledCourses.some(c => c.id === courseIdInt)
      if (alreadyEnrolled) {
        alert(language === 'ar' ? 'الطالب مسجل بالفعل في هذا المقرر الدراسي!' : 'Student is already enrolled in this course!')
        setEnrollActionLoading(false)
        return
      }
      const res = await ipcService.enrollStudentInCourse(selectedStudent.id, courseIdInt, enrollmentDate)
      if (res && res.error) {
        alert(res.error)
      } else {
        setSelectedCourseId('')
        
        // Refresh enrolled courses list
        const updated = await ipcService.getStudentCourses(selectedStudent.id)
        setEnrolledCourses(updated)
      }
    } catch (err) {
      console.error("Course enrollment transaction failed:", err)
      alert("Failed to enroll student in course.")
    } finally {
      setEnrollActionLoading(false)
    }
  }

  // Unenroll student from course
  const handleUnenrollStudent = async (courseId, courseTitle) => {
    if (!(await window.confirm(`Are you sure you want to unenroll ${selectedStudent.full_name} from "${courseTitle}"?`))) return;
    
    setEnrollActionLoading(true)
    try {
      const res = await ipcService.unenrollStudentFromCourse(selectedStudent.id, courseId)
      if (res && res.error) {
        alert(res.error)
      } else {
        // Refresh enrolled courses list
        const updated = await ipcService.getStudentCourses(selectedStudent.id)
        setEnrolledCourses(updated)
        // Refresh students list on main page to reflect the new balances/courses
        await loadStudents()
      }
    } catch (err) {
      console.error("Failed to unenroll student:", err)
      alert("Failed to unenroll student from course.")
    } finally {
      setEnrollActionLoading(false)
    }
  }



  if (!hasPermission('students:view')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6 bg-slate-950/20 border border-slate-900/60 rounded-3xl backdrop-blur-sm animate-scale-up">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-lg font-bold text-white mb-2">
          {language === 'ar' ? 'تم رفض الوصول' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-400 max-w-sm">
          {language === 'ar' 
            ? 'ليست لديك الصلاحيات الكافية لعرض صفحة الطلاب. يرجى مراجعة مسؤول النظام للحصول على الصلاحية اللازمة.' 
            : 'You do not have sufficient permissions to view the Students registry. Please contact your system administrator.'}
        </p>
      </div>
    )
  }

  return (
    <div className="no-print">
      <div className="space-y-8 animate-fade-in-up">
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('students.title')}</h1>
          <p className="text-xs text-slate-400">{t('students.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStudents}
            disabled={loading}
            className="p-2.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/60 disabled:opacity-50 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title={t('students.refreshTooltip')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {hasPermission('students:write') && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-350 border border-slate-800 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer shrink-0"
              >
                <Upload className="h-4 w-4" />
                {t('students.importCSV')}
              </button>
              <button
                onClick={handleExportStudentsExcel}
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-350 border border-slate-800 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer shrink-0"
              >
                <Download className="h-4 w-4" />
                {language === 'ar' ? 'تصدير كـ Excel' : 'Export Excel'}
              </button>
              <button
                id="add-student-btn"
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide hover:transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                {t('students.addStudent')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* IPC API Offline Warning */}
      {!window.api && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{t('layout.ipcOffline')}</span>
        </div>
      )}

      {/* Filters & Count bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-4xl">
          {/* Text Search */}
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('students.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* Course Filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer"
          >
            <option value="All">{t('common.all')} {t('sidebar.courses')}</option>
            {allCourses.map(c => (
              <option key={c.id} value={c.id.toString()}>{c.title}</option>
            ))}
          </select>

          {/* Balance Filter */}
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer"
          >
            <option value="All">{t('students.balanceAll')}</option>
            <option value="Unpaid">{t('students.balanceOwes')}</option>
            <option value="Settled">{t('students.balanceSettled')}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500/45 cursor-pointer"
          >
            <option value="All">{t('common.all')} {t('students.statusCol')}</option>
            <option value="Active">{t('common.active')}</option>
            <option value="Dropped">{language === 'ar' ? 'منقطع' : 'Dropped'}</option>
            <option value="Graduated">{language === 'ar' ? 'متخرج' : 'Graduated'}</option>
            <option value="Loyal">{t('customFeatures.loyalBadge')}</option>
            <option value="NoCourse15Days">{t('customFeatures.noCourse15Days')}</option>
          </select>
        </div>

        <div className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider shrink-0 lg:mr-2 flex items-center gap-3">
          <span>{t('students.recordsCount', { filtered: filteredStudents.length, total: students.length })}</span>
          
          {Object.keys(rowSelection).length > 0 && (
            <div className="flex items-center gap-2.5 border-l border-slate-800/80 pl-3 animate-fade-in">
              <span className="text-[9.5px] text-blue-400 font-bold normal-case">
                {Object.keys(rowSelection).length} {language === 'ar' ? 'محدد' : 'selected'}
              </span>
              <button
                onClick={handleBulkEmail}
                className="p-1 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 rounded-lg transition-all cursor-pointer"
                title={language === 'ar' ? 'إرسال بريد جماعي' : 'Send Bulk Email'}
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setRowSelection({})}
                className="p-1 bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition-all cursor-pointer"
                title={language === 'ar' ? 'إلغاء التحديد' : 'Clear Selection'}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-l border-slate-800/80 pl-3">
            <CustomCheckbox
              checked={filteredStudents.length > 0 && filteredStudents.every((_, idx) => !!rowSelection[idx.toString()])}
              onChange={(val) => {
                if (!val) {
                  setRowSelection({});
                } else {
                  const nextSel = {};
                  filteredStudents.forEach((_, idx) => {
                    nextSel[idx.toString()] = true;
                  });
                  setRowSelection(nextSel);
                }
              }}
            />
            <span className="text-[9px] text-slate-400 select-none normal-case">
              {language === 'ar' ? 'تحديد الكل' : 'Select All'}
            </span>
          </div>
        </div>
      </div>

      {/* Table Canvas */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
        {loading ? (
          <SkeletonLoader type="table" rows={6} cols={6} />
        ) : students.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="p-3 bg-slate-800/40 rounded-full border border-slate-700/40 text-slate-500 mb-4 animate-pulse">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">{t('students.noStudentsRegistered')}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {t('students.emptyDirectoryDesc')}
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          /* No Search Results */
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 animate-fade-in">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('students.noMatchingRecords')}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {t('students.noMatchingDesc')}
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              {t('students.clearFilter') || 'Clear Filter'}
            </button>
          </div>
        ) : (
          <AdvancedTable 
            data={filteredStudents}
            columns={columns}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            enablePagination={true}
            defaultPageSize={10}
            onRowClick={(row) => row.toggleSelected()}
          />
        )}
      </div>
    </div>

      {/* Import CSV Modal */}
      {isImportModalOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" 
            onClick={() => {
              if (!importing) {
                setIsImportModalOpen(false);
                setCsvHeaders([]);
                setCsvRows([]);
              }
            }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('students.importCSV')}</h3>
                  <p className="text-[10px] text-slate-500">{t('students.subtitle')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvHeaders([]);
                  setCsvRows([]);
                }}
                disabled={importing}
                className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Step 1: Upload */}
              {csvRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-850 hover:border-blue-500/30 rounded-2xl p-10 bg-slate-955/20 transition-all text-center">
                  <Upload className="h-10 w-10 text-slate-500 mb-4 animate-pulse" />
                  <h4 className="text-xs font-semibold text-slate-300 mb-1">{t('students.selectFile')}</h4>
                  <p className="text-[10px] text-slate-500 mb-4 leading-relaxed max-w-sm">
                    {language === 'ar' 
                      ? 'قم برفع ملف طلاب بصيغة CSV. تأكد من أن السطر الأول يحتوي على عناوين الأعمدة.' 
                      : 'Please upload a CSV file containing your student roster. The first row must define column headers.'}
                  </p>
                  <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg shadow-blue-500/10">
                    {language === 'ar' ? 'اختر ملف' : 'Choose File'}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Column Mapper Column */}
                  <div className="lg:col-span-7 bg-slate-955/25 border border-slate-850 rounded-2xl p-5 space-y-5">
                    <h4 className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-2 flex items-center justify-between">
                      <span>{t('students.mapColumns')}</span>
                      <span className="text-[9px] text-emerald-400 font-mono">
                        {language === 'ar' ? `تم تحميل ${csvRows.length} صف` : `Loaded ${csvRows.length} rows`}
                      </span>
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Full Name Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-450 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{t('students.fullNameCol')} <span className="text-rose-500">*</span></span>
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
                          <span>{t('students.phoneCol')}</span>
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

                      {/* Student Email Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{language === 'ar' ? 'البريد الإلكتروني للطالب' : 'Student Email'}</span>
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

                      {/* Parent Phone Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{language === 'ar' ? 'هاتف الولي' : 'Parent Phone'}</span>
                          {columnMapping.parent_phone && (
                            <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                          )}
                        </label>
                        <select
                          value={columnMapping.parent_phone}
                          onChange={(e) => setColumnMapping({ ...columnMapping, parent_phone: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                        >
                          <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Parent Email Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{language === 'ar' ? 'بريد الولي الإلكتروني' : 'Parent Email'}</span>
                          {columnMapping.parent_email && (
                            <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                          )}
                        </label>
                        <select
                          value={columnMapping.parent_email}
                          onChange={(e) => setColumnMapping({ ...columnMapping, parent_email: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                        >
                          <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Grade Level Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{language === 'ar' ? 'المستوى الدراسي' : 'Grade Level'}</span>
                          {columnMapping.grade_level && (
                            <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                          )}
                        </label>
                        <select
                          value={columnMapping.grade_level}
                          onChange={(e) => setColumnMapping({ ...columnMapping, grade_level: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 cursor-pointer"
                        >
                          <option value="">-- {language === 'ar' ? 'تجاهل هذا الحقل' : 'Skip Field'} --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date of Birth Mapping */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] text-slate-455 uppercase font-bold tracking-wider flex items-center justify-between">
                          <span>{language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</span>
                          {columnMapping.date_of_birth && (
                            <span className="text-[8px] text-emerald-500 font-mono lowercase">auto-matched</span>
                          )}
                        </label>
                        <select
                          value={columnMapping.date_of_birth}
                          onChange={(e) => setColumnMapping({ ...columnMapping, date_of_birth: e.target.value })}
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

                  {/* Extra Fields & Preview Panel */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Extra Fields Picker */}
                    <div className="bg-slate-955/25 border border-slate-850 rounded-2xl p-5 space-y-3.5">
                      <h4 className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-2">
                        {t('students.extraFields')}
                      </h4>
                      <p className="text-[9.5px] text-slate-500 leading-normal">
                        {language === 'ar' 
                          ? 'اختر الأعمدة الإضافية التي ترغب بحفظها كمعلومات إضافية في ملف الطالب:' 
                          : 'Select custom columns from your file that you want to preserve as student details:'}
                      </p>
                      
                      <div className="max-h-[150px] overflow-y-auto space-y-2.5 pr-2">
                        {csvHeaders
                          .filter(h => !Object.values(columnMapping).includes(h))
                          .map(field => (
                            <label key={field} className="flex items-center gap-2 text-xs text-slate-350 cursor-pointer hover:text-white transition-colors">
                              <CustomCheckbox
                                checked={selectedExtraFields.includes(field)}
                                onChange={(val) => {
                                  if (val) {
                                    setSelectedExtraFields([...selectedExtraFields, field]);
                                  } else {
                                    setSelectedExtraFields(selectedExtraFields.filter(f => f !== field));
                                  }
                                }}
                              />
                              <span className="font-mono text-[10.5px]">{field}</span>
                            </label>
                          ))}
                        {csvHeaders.filter(h => !Object.values(columnMapping).includes(h)).length === 0 && (
                          <div className="text-[10px] text-slate-600 italic py-2 text-center">
                            {language === 'ar' ? 'لا توجد أعمدة إضافية متوفرة' : 'No extra columns available'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Mapped Preview */}
                    <div className="bg-slate-955/25 border border-slate-850 rounded-2xl p-5 space-y-3.5">
                      <h4 className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-2">
                        {t('students.importPreview')}
                      </h4>
                      <div className="space-y-3 text-[10.5px]">
                        <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
                          <span className="text-slate-500">{t('students.fullNameCol')}:</span>
                          <span className="font-medium text-slate-300 max-w-[150px] truncate">
                            {columnMapping.full_name ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.full_name)] : '---'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
                          <span className="text-slate-500">{t('students.phoneCol')}:</span>
                          <span className="font-medium text-slate-300">
                            {columnMapping.phone ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.phone)] : '---'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
                          <span className="text-slate-500">{language === 'ar' ? 'هاتف الولي' : 'Parent Phone'}:</span>
                          <span className="font-medium text-slate-300">
                            {columnMapping.parent_phone ? csvRows[0]?.[csvHeaders.indexOf(columnMapping.parent_phone)] : '---'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 pt-1">
                          <span className="text-slate-500">{t('students.additionalInfo')}:</span>
                          <span className="font-mono text-[9px] text-blue-400 bg-slate-900/60 p-2 rounded-lg border border-slate-850 block max-h-[80px] overflow-y-auto">
                            {selectedExtraFields.length > 0 
                              ? JSON.stringify(
                                  selectedExtraFields.reduce((acc, field) => {
                                    const idx = csvHeaders.indexOf(field);
                                    if (idx !== -1) acc[field] = csvRows[0]?.[idx] || '';
                                    return acc;
                                  }, {}),
                                  null, 
                                  2
                                )
                              : '{}'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between no-print">
              <div>
                {csvRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCsvHeaders([]);
                      setCsvRows([]);
                    }}
                    disabled={importing}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {language === 'ar' ? 'إعادة رفع ملف آخر' : 'Upload Another File'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setCsvHeaders([]);
                    setCsvRows([]);
                  }}
                  disabled={importing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                {csvRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleImportExecute}
                    disabled={importing || !columnMapping.full_name}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg shadow-blue-500/10"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        {language === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {language === 'ar' ? `استيراد ${csvRows.length} طالب` : `Import ${csvRows.length} Students`}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => {
              setIsModalOpen(false)
              setFormErrors({})
            }}
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
                {isEditMode ? (
                  <>
                    <Edit className="h-4.5 w-4.5 text-blue-500" />
                    {t('students.modalEditTitle')}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4.5 w-4.5 text-blue-500" />
                    {t('students.modalAddTitle')}
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setFormErrors({})
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                
                {/* Name Field */}
                <div className="sm:col-span-2 md:col-span-1 flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.fullNameLabel')}</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder={t('students.fullNamePlaceholder')}
                    className={`px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
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

                {/* Student Phone Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.phoneCol')}</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder={t('students.phonePlaceholder')}
                    className={`px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
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

                {/* Student Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'البريد الإلكتروني للطالب' : 'Student Email'}</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. student@example.com"
                    className="px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors border-slate-800/80"
                  />
                </div>

                {/* Parent Phone Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.parentPlaceholder') || t('students.parentPhoneLabel') || 'Parent Phone'}</label>
                  <input
                    type="text"
                    name="parent_phone"
                    value={formData.parent_phone}
                    onChange={handleInputChange}
                    placeholder={t('students.parentPhonePlaceholder') || 'e.g. 0555654321'}
                    className={`px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors ${
                      formErrors.parent_phone ? 'border-rose-500/50' : 'border-slate-800/80'
                    }`}
                  />
                  {formErrors.parent_phone && (
                    <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {formErrors.parent_phone}
                    </span>
                  )}
                </div>

                {/* Parent Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{language === 'ar' ? 'البريد الإلكتروني لولي الأمر' : 'Parent Email'}</label>
                  <input
                    type="email"
                    name="parent_email"
                    value={formData.parent_email}
                    onChange={handleInputChange}
                    placeholder="e.g. parent@example.com"
                    className="px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors border-slate-800/80"
                  />
                </div>

                {/* Grade Level Dropdown Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.gradeLevelLabel') || 'Academic Grade Level'}</label>
                  <select
                    name="grade_level"
                    value={formData.grade_level || 'Primary'}
                    onChange={handleInputChange}
                    className="px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <option value="Primary">{language === 'ar' ? 'ابتدائي' : 'Primary (Elementary)'}</option>
                    <option value="Middle">{language === 'ar' ? 'متوسط' : 'Middle School'}</option>
                    <option value="High">{language === 'ar' ? 'ثانوي' : 'High School'}</option>
                    <option value="University">{language === 'ar' ? 'جامعي' : 'University'}</option>
                    <option value="Adult">{language === 'ar' ? 'كبار / مهني' : 'Adult / Professional'}</option>
                  </select>
                </div>

                {/* Date of Birth Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.dobLabel') || 'Date of Birth'}</label>
                  <CustomDatePicker
                    name="date_of_birth"
                    value={formData.date_of_birth || ''}
                    onChange={handleInputChange}
                    language={language}
                    t={t}
                    placeholder={t('students.dobLabel') || 'Date of Birth'}
                  />
                </div>

                {/* Status Dropdown Field */}
                <div className="sm:col-span-2 md:col-span-1 flex flex-col gap-1.5">
                  <label className="text-[9.5px] text-slate-400 uppercase font-semibold">{t('students.statusLabel')}</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="px-3 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <option value="Active">{t('common.active')}</option>
                    <option value="Dropped">{language === 'ar' ? 'منقطع' : 'Dropped'}</option>
                    <option value="Graduated">{language === 'ar' ? 'متخرج' : 'Graduated'}</option>
                  </select>
                </div>

                {/* Tuition Statement (Only visible in Edit Mode) */}
                {isEditMode && selectedStudent && (
                  <div className="sm:col-span-2 md:col-span-3 p-3 bg-slate-955/45 rounded-xl border border-slate-800/80 space-y-2">
                    <h4 className="text-[9.5px] text-slate-500 uppercase font-semibold tracking-wider px-0.5">{t('students.tuitionStatement')}</h4>
                    {(() => {
                      const { totalTuition, totalPaid, balance } = calculateFinancials(selectedStudent);
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                          <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/40">
                            <p className="text-[8.5px] text-slate-500 uppercase font-semibold">{language === 'ar' ? 'إجمالي التكلفة' : 'Total Cost'}</p>
                            <p className="font-mono font-bold text-slate-200 mt-0.5">{totalTuition.toFixed(2)} DA</p>
                          </div>
                          <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/40">
                            <p className="text-[8.5px] text-slate-500 uppercase font-semibold">{language === 'ar' ? 'إجمالي المسدد' : 'Total Paid'}</p>
                            <p className="font-mono font-bold text-emerald-450 mt-0.5">{totalPaid.toFixed(2)} DA</p>
                          </div>
                          <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/40">
                            <p className="text-[8.5px] text-slate-500 uppercase font-semibold">{language === 'ar' ? 'المبلغ المتبقي' : 'Balance Due'}</p>
                            <p className={`font-mono font-bold mt-0.5 ${balance > 0 ? 'text-rose-455 font-extrabold' : 'text-emerald-450'}`}>
                              {balance.toFixed(2)} DA
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Dynamic Extra Info (Only visible in Edit Mode) */}
                {isEditMode && selectedStudent && selectedStudent.extra_info && (() => {
                  try {
                    const parsed = JSON.parse(selectedStudent.extra_info);
                    const keys = Object.keys(parsed);
                    if (keys.length === 0) return null;
                    return (
                      <div className="sm:col-span-2 md:col-span-3 p-3 bg-slate-955/45 rounded-xl border border-slate-800/80 space-y-2 animate-fade-in">
                        <h4 className="text-[9.5px] text-slate-500 uppercase font-semibold tracking-wider px-0.5">
                          {t('students.additionalInfo')}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {keys.map(key => (
                            <div key={key} className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/40">
                              <p className="text-[8.5px] text-slate-500 font-bold truncate" title={key}>{key}</p>
                              <p className="font-medium text-slate-200 text-[11px] mt-0.5 truncate" title={parsed[key]}>{parsed[key]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800/60 shrink-0 gap-3 bg-slate-900/50">
              <div>
                {isEditMode && selectedStudent && (
                  <div className="flex gap-1.5">
                    {hasPermission('students:delete') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(selectedStudent.id, selectedStudent.full_name)}
                        className="px-3 py-1.5 bg-rose-600/10 border border-rose-500/20 text-rose-455 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1 hover:shadow-lg"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('common.delete')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setActivePrintStudent(selectedStudent);
                      }}
                      className="px-3 py-1.5 bg-slate-955 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Printer className="h-3 w-3" />
                      {t('common.print')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setFormErrors({})
                  }}
                  className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {isSubmitting ? t('common.saving') : isEditMode ? t('students.saveBtn') : t('students.registerBtn')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </>
    )}

      {/* Enrollments Management Modal */}
      {isEnrollModalOpen && selectedStudent && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
            onClick={() => {
              setIsEnrollModalOpen(false)
              setSelectedStudent(null)
              setEnrolledCourses([])
              setSelectedCourseId('')
            }}
          />
          {/* Full Workspace Panel */}
          <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  {t('students.enrollmentModalTitle', { name: '' }).replace(': ', '')}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('students.enrollmentModalTitle', { name: selectedStudent.full_name })}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEnrollModalOpen(false)
                  setSelectedStudent(null)
                  setEnrolledCourses([])
                  setSelectedCourseId('')
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[65vh]">
              
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                {/* Left Side: Form to Enroll in a New Course (2 columns) */}
                <div className="lg:col-span-2">
                  <form onSubmit={handleEnrollStudent} className="flex flex-col gap-3.5 p-4 bg-slate-955/45 rounded-xl border border-slate-800">
                <h4 className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider px-0.5">{language === 'ar' ? 'تسجيل في مادة جديدة' : 'Enroll in a New Course'}</h4>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] text-slate-500 uppercase font-semibold px-0.5">{t('students.enrollmentSelectLabel')}</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                    >
                      <option value="">-- {t('students.enrollmentSelectPlaceholder')} --</option>
                      {availableCourses
                        .filter(c => !enrolledCourses.some(ec => ec.id === c.id)) // filter out already enrolled
                        .map(course => (
                          <option key={course.id} value={course.id.toString()}>{course.title} ({course.price.toFixed(2)} DA)</option>
                        ))
                      }
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] text-slate-500 uppercase font-semibold px-0.5">{language === 'ar' ? 'تاريخ التسجيل' : 'Enrollment Date'}</label>
                    <CustomDatePicker
                      value={enrollmentDate}
                      onChange={(e) => setEnrollmentDate(e.target.value)}
                      language={language}
                      t={t}
                      placeholder={language === 'ar' ? 'تاريخ التسجيل' : 'Enrollment Date'}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={enrollActionLoading || !selectedCourseId}
                    className="px-4 py-1.5 bg-blue-600 hover:from-blue-500 hover:to-indigo-555 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-lg shadow-blue-500/10"
                  >
                    {enrollActionLoading ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {t('students.enrollStudentBtn')}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Side: Current Course Registrations (3 columns) */}
            <div className="lg:col-span-3 space-y-3">
                <h4 className="text-[9.5px] text-slate-400 uppercase font-semibold tracking-wider px-1">{t('students.enrolledTitle')}</h4>
                
                {enrollLoading ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                    <span>{t('common.loading')}</span>
                  </div>
                ) : enrolledCourses.length === 0 ? (
                  <div className="py-10 bg-slate-950/20 border border-slate-850 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
                    <BookOpen className="h-7 w-7 text-slate-650" />
                    <p className="text-[11px]">{t('students.noEnrolledCourses')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {enrolledCourses.map((course) => {
                      const stats = getStudentCourseAttendanceStats(selectedStudent, course.id);
                      const currentYearMonth = new Date().toISOString().substring(0, 7);
                      const currentMonthRegistry = stats.registry.filter(r => r.date.startsWith(currentYearMonth));

                      const hasOnlyOneSessionLeft = stats.remaining <= 1;

                      return (
                        <div 
                          key={course.id} 
                          className={`p-3.5 rounded-xl border transition-all space-y-3 animate-fade-in ${
                            hasOnlyOneSessionLeft 
                              ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/35 shadow-md shadow-rose-950/5'
                              : 'bg-slate-955/35 border-slate-800/80 hover:border-slate-705/85'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-200 truncate">{course.title}</p>
                              <p className="text-[9.5px] text-slate-500 truncate mt-0.5">
                                {t('courses.instructorLabel')}: <span className="text-slate-400 font-medium">{course.Teacher?.full_name || t('courses.noInstructor')}</span>
                              </p>
                              <div className="text-[9px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>
                                  {language === 'ar' ? 'تاريخ البدء: ' : 'Start Date: '}
                                  <span className="text-slate-350 font-mono font-medium">
                                    {stats.studyStartDate ? new Date(stats.studyStartDate).toLocaleDateString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                </span>
                                <span>
                                  {language === 'ar' ? 'نهاية الاشتراك: ' : 'Subscription End: '}
                                  <span className="text-blue-400 font-mono font-bold">
                                    {stats.subscriptionEndDate ? new Date(stats.subscriptionEndDate).toLocaleDateString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-[10px] font-bold text-blue-400 font-mono bg-blue-500/5 px-2 py-0.5 rounded-md border border-blue-500/15">{course.price.toFixed(2)} DA</span>
                              <button
                                type="button"
                                onClick={() => handleUnenrollStudent(course.id, course.title)}
                                disabled={enrollActionLoading}
                                className="p-1 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-455 rounded-md transition-all cursor-pointer shrink-0"
                                title={t('students.unenrollTooltip')}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Session details and registry dots */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/40">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-mono text-slate-400">
                                {language === 'ar' ? 'الحصص: ' : 'Sessions: '}<strong className="text-slate-200">{stats.attended} / {stats.paid}</strong>
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold font-mono border ${
                                stats.remaining <= 1
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-445 animate-pulse'
                                  : stats.remaining <= 3
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                              }`}>
                                {language === 'ar' ? `متبقي: ${stats.remaining}` : `Rem: ${stats.remaining}`}
                              </span>
                              {stats.carryover > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold text-amber-400">
                                  +{stats.carryover} {language === 'ar' ? 'تعويض' : 'carryover'}
                                </span>
                              )}
                            </div>

                            {/* Dots */}
                            <div className="flex items-center gap-1">
                              {currentMonthRegistry.length > 0 ? (
                                currentMonthRegistry.map((reg, rIdx) => (
                                  <span
                                    key={rIdx}
                                    title={`${reg.date}: ${reg.status}`}
                                    className={`h-2 w-2 rounded-full inline-block border ${
                                      reg.status === 'Present'
                                        ? 'bg-emerald-500 border-emerald-400/50 shadow-sm shadow-emerald-500/30'
                                        : reg.status === 'Excused'
                                        ? 'bg-amber-500 border-amber-400/50 shadow-sm shadow-amber-500/30'
                                        : 'bg-rose-500 border-rose-400/50 shadow-sm shadow-rose-500/30'
                                    }`}
                                  />
                                ))
                              ) : (
                                <span className="text-[8px] text-slate-655 italic">
                                  {language === 'ar' ? 'لا حصص هذا الشهر' : 'No logs this month'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-800/60 shrink-0 bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setIsEnrollModalOpen(false)
                  setSelectedStudent(null)
                  setEnrolledCourses([])
                  setSelectedCourseId('')
                }}
                className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            
          </div>
        </>
      )}

      {/* ==================== STUDENT SUMMARY PRINT PREVIEW ==================== */}
      {activePrintStudent && (
      (() => {
        const { totalTuition, totalPaid, balance } = calculateFinancials(activePrintStudent);
        const coursesRows = activePrintStudent.Courses && activePrintStudent.Courses.length > 0 
          ? activePrintStudent.Courses.map(c => {
              const balanceInfo = getCoursePaymentsBalance(activePrintStudent, c.id);
              return (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-1 text-left font-bold text-black text-[7.5px] leading-tight">
                    {c.title}
                    <div className="text-[6.5px] text-slate-500 font-normal mt-0.5">
                      Instructor: {c.Teacher?.full_name || 'Unassigned'}
                    </div>
                  </td>
                  <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-mono text-black text-[7px]`}>{balanceInfo.totalTuition.toFixed(2)}</td>
                  <td className={`${language === 'ar' ? 'text-left' : 'text-right'} py-1 font-mono text-emerald-600 text-[7px]`}>{balanceInfo.totalPaid.toFixed(2)}</td>
                  <td className={`py-1 text-right font-mono font-bold text-[7px] ${balanceInfo.balance > 0 ? 'text-rose-650' : 'text-emerald-600'}`}>{balanceInfo.balance.toFixed(2)}</td>
                </tr>
              );
            })
          : (
              <tr className="border-b border-transparent">
                <td colSpan="4" className="py-4 text-center text-slate-400 italic text-[7px]">No courses currently enrolled.</td>
              </tr>
            );

        const renderSingleCopy = (copyTitle) => (
          <div className="w-[47%] h-full flex flex-col justify-between text-left">
            <div>
              {/* Copy Badge */}
              <div className="inline-block border border-slate-250 bg-slate-50 text-slate-500 text-[5.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded mb-1">{copyTitle}</div>
              
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
                      <span className="font-black text-[8px] text-black tracking-tight uppercase leading-none">{schoolName.split(' ')[0] || 'BRIGHT'}</span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[6.5px] text-black font-semibold space-y-0.5 mt-0.5">
                  {schoolPhone && <div>Phone: {schoolPhone}</div>}
                </div>
              </div>

              {/* Thick line */}
              <div className="border-b-[1.5px] border-black mb-1.5 w-full"></div>

              {/* Title */}
              <h1 className="text-[10px] font-black text-black leading-none tracking-tight mb-1.5 text-left uppercase">{t('students.invoiceTitle')}</h1>

              {/* Billing details row */}
              <table className="w-full border border-slate-200 rounded bg-slate-50/55 text-[7px] mb-2 leading-tight">
                <tbody>
                  <tr>
                    <td className="p-1 border-r border-slate-200 w-[60%]">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">{t('students.studentDetailsTitle')}:</span>
                      <p className="text-[8px] font-black text-black leading-none">{activePrintStudent.full_name}</p>
                      <div className="text-[6.5px] text-slate-500 mt-0.5">
                        ID: ST-{activePrintStudent.id}
                      </div>
                    </td>
                    <td className="p-1 w-[40%] text-right">
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">{t('students.billingYearLabel')}:</span>
                      <p className="text-[7.5px] font-bold text-black leading-none">{academicYear}</p>
                      <span className="text-[5.5px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5 mt-1">{t('common.status')}:</span>
                      <p className="text-[7.5px] font-bold text-emerald-600 leading-none uppercase">{activePrintStudent.status}</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Table */}
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full border-collapse mb-2`}>
                <thead>
                  <tr className="border-t border-b border-black">
                    <th className="py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider">{t('students.courseCol')}</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[22%]`}>Tuition</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[22%]`}>Paid</th>
                    <th className={`${language === 'ar' ? 'text-left' : 'text-right'} py-0.5 text-[6.5px] font-black text-black uppercase tracking-wider w-[22%]`}>Due</th>
                  </tr>
                </thead>
                <tbody className="text-black">
                  {coursesRows}
                </tbody>
              </table>

              {/* Totals */}
              <table className={`${language === 'ar' ? 'text-right' : 'text-left'} w-full text-[7px] text-slate-500 leading-relaxed`}>
                <tbody>
                  <tr className="text-black font-bold border-t border-b border-black">
                    <td className="py-1 text-left uppercase text-[6.5px] font-black tracking-wider">{t('students.totalOwedLabel')}</td>
                    <td className={`py-1 text-right font-mono text-[11px] font-black ${balance > 0 ? 'text-rose-650' : 'text-black'}`}>{balance.toFixed(2)} DA</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              {/* Footer columns: Payment Info and Signature */}
              <div className="flex justify-between items-end pt-1">
                <div className="w-[35px] h-[35px] border border-dashed border-slate-300 rounded-full flex items-center justify-center text-[5px] font-bold text-slate-350 tracking-wide">
                  STAMP
                </div>
                <div className="text-right w-[40%]">
                  <div className="inline-block text-left">
                    <div className="w-16 border-b border-black mb-0.5"></div>
                    <span className="text-[6px] text-black uppercase font-black tracking-wider">{t('students.authorizedSignature')}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="border-t border-slate-100 mt-1 pt-1 text-left">
                <p className="text-[5.5px] text-slate-450 leading-tight">
                  <strong>{t('students.termsTitle')}:</strong> {t('students.termsText')}
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
              onClick={() => setActivePrintStudent(null)}
            />
            {/* Full Workspace Panel */}
            <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{t('students.printPreviewTitle')}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? 'نسخة مزدوجة جاهزة للطباعة والقص (A5)' : 'Dual-Copy Layout ready for printing & cutting (A5)'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadStudentPDF(activePrintStudent, 'print')}
                    disabled={pdfLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 transition-all hover:shadow-emerald-500/20"
                  >
                    {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadStudentPDF(activePrintStudent, 'download')}
                    disabled={pdfLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 transition-all hover:shadow-blue-500/20"
                  >
                    {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    {t('common.downloadPdf')}
                  </button>
                  <button
                    onClick={() => setActivePrintStudent(null)}
                    className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Container for Preview */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[70vh]">
                {/* White A5 Landscape mock preview container */}
                <div className="bg-white text-black p-4 rounded-xl border border-slate-200 shadow-inner w-full max-w-4xl aspect-[1.414/1] mx-auto font-sans leading-relaxed select-text relative overflow-hidden">
                  <div className="flex h-full w-full justify-between">
                    {renderSingleCopy(language === 'ar' ? 'نسخة الطالب / Student Copy' : 'Student Copy')}

                    {/* Divider */}
                    <div className="w-[6%] h-full flex flex-col justify-center items-center relative">
                      <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-slate-300"></div>
                      <span className="bg-white px-1 z-10 text-[9px] text-slate-400 select-none">✂️</span>
                    </div>

                    {renderSingleCopy(language === 'ar' ? 'نسخة الإدارة / Office Copy' : 'Office Copy')}
                  </div>
                </div>
              </div>

            </div>
          </>
        );
      })()
    )}

    {/* ==================== STUDENT ENROLLMENT CERTIFICATE PRINT PREVIEW ==================== */}
    {activePrintCertificateStudent && (
      (() => {
        const formattedDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });

        return (
          <>
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
              onClick={() => setActivePrintCertificateStudent(null)}
            />
            {/* Full Workspace Panel */}
            <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{language === 'ar' ? 'معاينة شهادة التسجيل' : 'Enrollment Certificate Preview'}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{language === 'ar' ? 'مستند رسمي كامل الصفحة (A5)' : 'Full-page official document (A5)'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificatePDF(activePrintCertificateStudent, 'print')}
                    disabled={pdfLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 transition-all hover:shadow-emerald-500/20"
                  >
                    {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificatePDF(activePrintCertificateStudent, 'download')}
                    disabled={pdfLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-550 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 transition-all hover:shadow-blue-500/20"
                  >
                    {pdfLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    {t('common.downloadPdf')}
                  </button>
                  <button
                    onClick={() => setActivePrintCertificateStudent(null)}
                    className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Container for Preview */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-h-[70vh]">
                {/* White A5 Landscape Certificate Mock */}
                <div className="bg-[#fafaf9] text-slate-800 p-6 rounded-xl border-4 border-double border-blue-900 shadow-xl w-full max-w-2xl aspect-[1.414/1] mx-auto font-sans select-text relative overflow-hidden">
                  
                  {/* Corners */}
                  <div className="absolute top-2.5 left-2.5 w-4.5 h-4.5 border-t-2 border-l-2 border-amber-750"></div>
                  <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 border-t-2 border-r-2 border-amber-750"></div>
                  <div className="absolute bottom-2.5 left-2.5 w-4.5 h-4.5 border-b-2 border-l-2 border-amber-750"></div>
                  <div className="absolute bottom-2.5 right-2.5 w-4.5 h-4.5 border-b-2 border-r-2 border-amber-750"></div>

                  <div className="flex flex-col h-full justify-between py-2 px-4">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="School Logo" className="max-h-7 max-w-[100px] object-contain mb-0.5" />
                        ) : (
                          <span className="font-black text-[10px] text-blue-900 tracking-wide uppercase">{schoolName}</span>
                        )}
                      </div>
                      <div className="text-right text-[7.5px] text-slate-500 font-semibold leading-tight">
                        <div className="text-blue-900 font-bold">{t('students.billingYearLabel')}: {academicYear}</div>
                        {schoolPhone && <div className="mt-0.5">Tel: {schoolPhone}</div>}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="text-center my-2">
                      <h1 className="text-[17px] font-extrabold text-blue-900 tracking-wide leading-none m-0">شهادة تسجيل مدرسية</h1>
                      <h2 className="text-[9.5px] font-bold text-amber-700 tracking-widest uppercase mt-1">School Enrollment Certificate</h2>
                    </div>

                    {/* Body */}
                    <div className="text-center text-[10px] leading-relaxed text-slate-600 px-6 my-2">
                      {language === 'ar' ? (
                        <>
                          تشهد إدارة مدرسة <strong className="text-blue-900">{schoolName}</strong> بأن الطالب(ة): 
                          <div className="text-[13px] font-black text-slate-900 border-b border-slate-300 px-4 py-0.5 inline-block my-1 mx-2">{activePrintCertificateStudent.full_name}</div> 
                          المولود(ة) بتاريخ: <strong className="text-slate-900">{activePrintCertificateStudent.date_of_birth || '—'}</strong>، مسجل(ة) بصفة منتظمة في مؤسستنا للموسم الدراسي الحالي بصف الدراسي: <strong className="text-slate-900">{t('students.gradeLevel' + activePrintCertificateStudent.grade_level) || activePrintCertificateStudent.grade_level}</strong>، ويتابع الدروس في المواد التالية:
                        </>
                      ) : (
                        <>
                          The administration of <strong className="text-blue-900">{schoolName}</strong> hereby certifies that the student: 
                          <div className="text-[12px] font-black text-slate-900 border-b border-slate-300 px-4 py-0.5 inline-block my-1 mx-2">{activePrintCertificateStudent.full_name}</div> 
                          born on <strong className="text-slate-900">{activePrintCertificateStudent.date_of_birth || '—'}</strong>, is officially registered in our institution for the current academic session in grade: <strong className="text-slate-900">{activePrintCertificateStudent.grade_level}</strong>, attending the following courses:
                        </>
                      )}

                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {(activePrintCertificateStudent.Courses || []).map((c) => (
                          <span key={c.id} className="text-[8px] font-bold bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded shadow-sm">
                            {c.title}
                          </span>
                        )) || <span className="text-[8px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded">{t('students.noEnrolledCourses')}</span>}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-end mt-2">
                      <div className="text-left text-[8px] text-slate-500 leading-tight">
                        <div>{language === 'ar' ? 'حرر بـ:' : 'Issued on:'} {formattedDate}</div>
                        <div className="font-mono text-[7.5px] mt-0.5">Ref: ST-00{activePrintCertificateStudent.id}/{new Date().getFullYear()}</div>
                      </div>
                      
                      <div className="w-10 h-10 border border-dashed border-amber-600 rounded-full flex items-center justify-center text-[5.5px] font-bold text-amber-700 tracking-wider transform -rotate-12 select-none">
                        SEAL
                      </div>

                      <div className="text-center">
                        <div className="w-20 border-b border-blue-900 mb-1 mx-auto"></div>
                        <span className="text-[7.5px] text-blue-900 font-bold uppercase tracking-wider">{language === 'ar' ? 'إمضاء المدير' : 'School Director'}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </>
        );
      })()
    )}
    {/* ==================== GRADES & EXAMINATIONS MODAL ==================== */}
    {isGradesModalOpen && selectedGradesStudent && (
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
          onClick={() => setIsGradesModalOpen(false)}
        />
        {/* Full Workspace Panel */}
        <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down text-left rtl:text-right">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-emerald-400" />
                {t('customFeatures.gradesModalTitle', { name: selectedGradesStudent.full_name })}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'ar' ? 'إدخال ومراجعة علامات الطالب' : 'Manage student examination scores & report card'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintReportCard(selectedGradesStudent)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                {t('customFeatures.printReportCard')}
              </button>
              <button
                onClick={() => setIsGradesModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[60vh] space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Form to Add Grade */}
              <div className="p-4 bg-slate-955/45 border border-slate-800 rounded-xl space-y-4 h-fit">
                <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  {language === 'ar' ? 'إدخال علامة جديدة' : 'Add Examination Score'}
                </h4>
                
                <form onSubmit={handleAddGradeSubmit} className="space-y-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">{t('students.courseCol')}</label>
                    <select
                      value={gradeForm.CourseId}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, CourseId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 cursor-pointer transition-colors"
                      required
                    >
                      <option value="">-- {language === 'ar' ? 'اختر المادة' : 'Select subject'} --</option>
                      {(selectedGradesStudent.Courses || [])
                        .filter(c => c.has_exam)
                        .map(c => (
                          <option key={c.id} value={c.id.toString()}>{c.title}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">{t('customFeatures.examName')}</label>
                    <input
                      type="text"
                      value={gradeForm.exam_name}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, exam_name: e.target.value }))}
                      placeholder={language === 'ar' ? 'مثال: الفرض الأول، امتحان الفصل' : 'e.g. First Term Exam'}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">{t('customFeatures.score')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={parseFloat(gradeForm.max_score || 20)}
                          value={gradeForm.score}
                          onChange={(e) => setGradeForm(prev => ({ ...prev, score: e.target.value }))}
                          placeholder="15.5"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors font-mono"
                          required
                        />
                        <span className="text-xs text-slate-550">/</span>
                        <input
                          type="number"
                          value={gradeForm.max_score}
                          onChange={(e) => setGradeForm(prev => ({ ...prev, max_score: e.target.value }))}
                          className="w-16 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-center"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-1">
                      <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">{t('customFeatures.coefficient')}</label>
                      <input
                        type="number"
                        min="1"
                        value={gradeForm.coefficient}
                        onChange={(e) => setGradeForm(prev => ({ ...prev, coefficient: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-705 transition-colors font-mono text-center"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-slate-500 uppercase font-semibold px-0.5">{language === 'ar' ? 'ملاحظات' : 'Remarks'}</label>
                    <input
                      type="text"
                      value={gradeForm.remarks}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder={language === 'ar' ? 'مثال: ممتاز، عمل جيد' : 'e.g. Excellent work'}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 hover:border-slate-750 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('customFeatures.addGrade')}
                  </button>
                </form>
              </div>

              {/* Right Column: Grades Table */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  {language === 'ar' ? 'سجل علامات الطالب الحالي' : 'Recorded Grades Registry'}
                </h4>
                
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-955/35">
                  <table className="w-full border-collapse text-left rtl:text-right">
                    <thead>
                      <tr className="bg-slate-955 border-b border-slate-800/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        <th className="px-4 py-3">{t('students.courseCol')}</th>
                        <th className="px-4 py-3">{t('customFeatures.examName')}</th>
                        <th className="px-4 py-3 text-center">{t('customFeatures.score')}</th>
                        <th className="px-4 py-3 text-center">{t('customFeatures.coefficient')}</th>
                        <th className="px-4 py-3">{language === 'ar' ? 'ملاحظات' : 'Remarks'}</th>
                        <th className="px-4 py-3 text-right rtl:text-left">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-xs text-slate-300">
                      {gradesLoading ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500 animate-pulse">
                            {t('common.loading')}
                          </td>
                        </tr>
                      ) : studentGrades.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-550 italic">
                            {t('customFeatures.noGrades')}
                          </td>
                        </tr>
                      ) : (
                        studentGrades.map(grade => (
                          <tr key={grade.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-200">{grade.Course?.title || 'Unknown'}</td>
                            <td className="px-4 py-3">{grade.exam_name}</td>
                            <td className="px-4 py-3 text-center font-mono text-slate-200">{grade.score} / {grade.max_score}</td>
                            <td className="px-4 py-3 text-center font-mono">{grade.coefficient}</td>
                            <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate" title={grade.remarks}>{grade.remarks || '—'}</td>
                            <td className="px-4 py-3 text-right rtl:text-left">
                              <button
                                onClick={() => handleDeleteGrade(grade.id)}
                                className="p-1 text-rose-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end px-6 py-4 border-t border-slate-800/60 bg-slate-900/50 shrink-0">
            <button
              type="button"
              onClick={() => setIsGradesModalOpen(false)}
              className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </>
    )}

    {/* ==================== STUDENT ID CARD PREVIEW MODAL ==================== */}
    {isStudentCardModalOpen && selectedStudentCardStudent && (
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 z-40 bg-black/40 animate-fade-in" 
          onClick={() => setIsStudentCardModalOpen(false)}
        />
        {/* Full Workspace Panel */}
        <div className="fixed top-0 left-0 right-0 z-50 w-full h-fit bg-slate-900 flex flex-col shadow-2xl no-print border-b border-slate-800/80 animate-slide-in-down text-left rtl:text-right">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 no-print shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">{t('customFeatures.studentCardTitle')}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'ar' ? 'معاينة وطباعة بطاقة الهوية الذكية للطالب' : 'Preview and print CR80 student identity badge'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintStudentCard(selectedStudentCardStudent)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-550 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/10 transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                {t('customFeatures.printCard')}
              </button>
              <button
                onClick={() => setIsStudentCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-6 py-8 max-h-[70vh] flex items-center justify-center bg-slate-955/10">
            
            {/* ID Card Box Mockup */}
            <div className="w-[325px] h-[204px] border border-slate-800 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white p-4 flex flex-col justify-between shadow-2xl relative select-none font-sans overflow-hidden border-slate-800/80">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 truncate max-w-[170px]">{schoolName}</span>
                <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'بطاقة طالب' : 'STUDENT CARD'}</span>
              </div>

              {/* Body */}
              <div className="flex items-center gap-3.5 flex-1 py-2">
                
                {/* Photo/Avatar box */}
                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-slate-600" />
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0 text-left rtl:text-right text-[8.5px] space-y-1 leading-tight">
                  <p className="text-[11.5px] font-bold text-white truncate">{selectedStudentCardStudent.full_name}</p>
                  <p className="text-slate-400"><strong>ID:</strong> <span className="font-mono">ST-{selectedStudentCardStudent.id}</span></p>
                  <p className="text-slate-400"><strong>Level:</strong> {selectedStudentCardStudent.grade_level || 'Primary'}</p>
                  {selectedStudentCardStudent.phone && (
                    <p className="text-slate-400"><strong>Phone:</strong> <span className="font-mono">{selectedStudentCardStudent.phone}</span></p>
                  )}
                </div>

                {/* QR Code Container */}
                <div className="w-14 h-14 bg-white rounded-xl p-1.5 flex items-center justify-center border border-slate-800 shrink-0 shadow-md">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} className="w-full h-full object-contain" alt="Student QR Code" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-dashed border-slate-400 rounded-full animate-spin"></div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-slate-800/60 pt-1.5 flex justify-between items-center text-[7.5px] text-slate-550">
                <span className="font-medium font-sans">ACADEMIC YEAR: {academicYear}</span>
                <span className="font-bold text-blue-400/80 uppercase">VERIFIED ID</span>
              </div>

            </div>

          </div>

          {/* Modal Footer */}
          <div className="flex justify-end px-6 py-4 border-t border-slate-800/60 bg-slate-900/50 shrink-0">
            <button
              type="button"
              onClick={() => setIsStudentCardModalOpen(false)}
              className="px-4 py-1.5 bg-slate-955 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </>
    )}

    </div>
  )
}


