export const toLocalYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getPeriodStartDateStr = (startStr, index) => {
  if (!startStr) return '';
  const start = new Date(startStr);
  start.setDate(start.getDate() + index * 30);
  return toLocalYYYYMMDD(start);
};

export const getPeriodEndDateStr = (startStr, index) => {
  if (!startStr) return '';
  const start = new Date(startStr);
  start.setDate(start.getDate() + (index + 1) * 30);
  return toLocalYYYYMMDD(start);
};

export const getPeriodString = (startStr, index, language, t) => {
  const pStart = getPeriodStartDateStr(startStr, index);
  const pEnd = getPeriodEndDateStr(startStr, index);
  if (!pStart || !pEnd) return '';
  
  const startDate = new Date(pStart);
  const endDate = new Date(pEnd);
  
  const formatDate = (date) => {
    const day = date.getDate();
    const mNameEn = date.toLocaleString('en-US', { month: 'short' });
    const clean = mNameEn.toLowerCase().substring(0, 3);
    const key = `finances.${clean}`;
    const result = t(key);
    const mName = (language === 'ar' && result !== key) ? result : mNameEn;
    return `${day} ${mName}`;
  };
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const translateMonth = (mName, t) => {
  if (!mName) return '';
  
  // Check if it's a date range like "14 May - 14 Jun"
  if (mName.includes('-')) {
    const parts = mName.split(' - ');
    if (parts.length === 2) {
      const translatePart = (part) => {
        const tokens = part.split(' ');
        return tokens.map(token => {
          const clean = token.toLowerCase().substring(0, 3);
          const key = `finances.${clean}`;
          const result = t(key);
          return result === key ? token : result;
        }).join(' ');
      };
      return `${translatePart(parts[0])} - ${translatePart(parts[1])}`;
    }
  }

  const clean = mName.toLowerCase().substring(0, 3);
  const key = `finances.${clean}`;
  const result = t(key);
  return result === key ? mName : result;
};

export const getStudentCourseAttendanceStats = (student, courseId, allAbsences = [], language = 'en', t) => {
  const courseObj = student.Courses?.find(c => String(c.id) === String(courseId));
  
  // 1. Get student earliest class date or enrollment date
  const studentCourseAbsences = (student.Absences || []).filter(a => String(a.CourseId) === String(courseId));
  let studyStartDate = '';
  if (studentCourseAbsences.length > 0) {
    const sorted = [...studentCourseAbsences].sort((a, b) => a.date.localeCompare(b.date));
    studyStartDate = sorted[0].date;
  } else {
    const enrollmentDateStr = courseObj?.StudentCourses?.createdAt || student.createdAt || '';
    studyStartDate = enrollmentDateStr ? toLocalYYYYMMDD(enrollmentDateStr) : toLocalYYYYMMDD(new Date());
  }

  // 2. Filter student's absences/attendances for this course
  const courseAbsences = allAbsences.filter(a => String(a.CourseId) === String(courseId));
  const uniqueDatesForCourse = [...new Set(courseAbsences.map(a => a.date))]
    .filter(d => d >= studyStartDate)
    .sort();

  let attended = 0;
  let excused = 0;
  let unexcused = 0;
  const attendanceRegistry = [];

  uniqueDatesForCourse.forEach(d => {
    // Check if instructor was absent on this date
    const teacherAbsence = courseAbsences.find(a => a.date === d && a.TeacherId !== null);
    if (teacherAbsence && teacherAbsence.status !== 'Present') {
      // Instructor was absent, class does not count as attended/billed for the student!
      return;
    }

    const record = studentCourseAbsences.find(a => a.date === d);
    if (record) {
      if (record.status === 'Present') {
        attended++;
        attendanceRegistry.push({ date: d, status: 'Present' });
      } else if (record.status === 'Excused') {
        excused++;
        attendanceRegistry.push({ date: d, status: 'Excused' });
      } else if (record.status === 'Unexcused') {
        unexcused++;
        attendanceRegistry.push({ date: d, status: 'Unexcused' });
      }
    } else {
      // Legacy fallback
      attended++;
      attendanceRegistry.push({ date: d, status: 'Present' });
    }
  });

  const coursePayments = (student.Payments || []).filter(p => String(p.CourseId) === String(courseId));
  const totalPaid = coursePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const monthlyPrice = courseObj ? (courseObj.price || 0) : 0;
  const schedulesPerWeek = courseObj?.Schedules?.length || 2;
  const sessionsPerMonth = schedulesPerWeek * 4;
  const paidSessions = monthlyPrice > 0 ? Math.floor((totalPaid / monthlyPrice) * sessionsPerMonth) : 0;

  const remaining = paidSessions - attended;
  const carryover = excused + unexcused;

  // Current period index and label
  const todayStr = (student.status === 'Dropped' || student.status === 'Graduated') && student.status_date
    ? student.status_date
    : toLocalYYYYMMDD(new Date());
  const start = new Date(studyStartDate);
  const end = new Date(todayStr);
  
  const daysDiff = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  const elapsedCycles = Math.max(1, Math.floor(daysDiff / 30) + 1);
  const currentPeriodIndex = Math.max(0, elapsedCycles - 1);
  const currentPeriodLabel = getPeriodString(studyStartDate, currentPeriodIndex, language, t);
  
  // Subscription End Date (calculated as studyStartDate + stats.paid months)
  const paidMonthsCount = monthlyPrice > 0 ? Math.floor(totalPaid / monthlyPrice) : 0;
  const subscriptionEndDate = getPeriodEndDateStr(studyStartDate, Math.max(0, paidMonthsCount - 1));

  return {
    paid: paidSessions,
    attended,
    excused,
    unexcused,
    remaining,
    carryover,
    registry: attendanceRegistry,
    totalPaid,
    studyStartDate,
    currentPeriodLabel,
    subscriptionEndDate
  };
};

export const getCoursePaymentsBalance = (student, courseId, allAbsences = [], language = 'en', t) => {
  if (!student) return { totalTuition: 0, totalPaid: 0, balance: 0, unpaidMonths: [], frozen: false };
  
  if (!courseId) {
    let totalTuition = 0;
    let totalPaid = 0;
    let balance = 0;
    const unpaidMonths = [];
    (student.Courses || []).forEach(c => {
      const info = getCoursePaymentsBalance(student, c.id, allAbsences, language, t);
      totalTuition += info.totalTuition;
      totalPaid += info.totalPaid;
      balance += info.balance;
      unpaidMonths.push(...info.unpaidMonths.map(um => ({ ...um, courseTitle: c.title })));
    });
    return { totalTuition, totalPaid, balance, unpaidMonths, frozen: student.status === 'Dropped' || student.status === 'Graduated' };
  }

  const course = student.Courses?.find(c => String(c.id) === String(courseId));
  if (!course) return { totalTuition: 0, totalPaid: 0, balance: 0, unpaidMonths: [], frozen: false };

  const stats = getStudentCourseAttendanceStats(student, courseId, allAbsences, language, t);
  const coursePayments = (student.Payments || []).filter(p => String(p.CourseId) === String(course.id));
  const totalPaid = stats.totalPaid;
  
  const schedulesPerWeek = course?.Schedules?.length || 2;
  const sessionsPerMonth = schedulesPerWeek * 4;
  
  // Calculate cycles due based on strict 30-day periods elapsed or attendance
  const studentCourseAbsences = (student.Absences || []).filter(a => String(a.CourseId) === String(courseId));
  let studyStartDate = stats.studyStartDate;
  let monthsDue = 0;

  const endDateStr = (student.status === 'Dropped' || student.status === 'Graduated') && student.status_date
    ? student.status_date
    : toLocalYYYYMMDD(new Date());

  if (studentCourseAbsences.length > 0) {
    const start = new Date(studyStartDate);
    const end = new Date(endDateStr);
    const daysDiff = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedCycles = Math.max(1, Math.floor(daysDiff / 30) + 1);
    const attendanceCyclesDue = Math.max(1, Math.ceil(stats.attended / sessionsPerMonth));
    monthsDue = Math.max(elapsedCycles, attendanceCyclesDue);
  } else {
    // Fallback: If enrolled but first class not taken yet, we count cycles based on enrollment date
    const start = new Date(studyStartDate);
    const end = new Date(endDateStr);
    const daysDiff = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    monthsDue = Math.max(1, Math.floor(daysDiff / 30) + 1);
  }

  const monthlyPrice = course.price || 0;
  const totalTuition = monthsDue * monthlyPrice;
  const balance = Math.max(0, totalTuition - totalPaid);

  const unpaidMonths = [];
  let remainingPool = coursePayments
    .filter(p => !p.month || !p.year)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  for (let i = 0; i < monthsDue; i++) {
    const pStart = getPeriodStartDateStr(studyStartDate, i);
    const pLabel = getPeriodString(studyStartDate, i, language, t);
    const pLabelEn = getPeriodString(studyStartDate, i, 'en', t);
    const pYear = new Date(pStart).getFullYear();

    const paidForPeriod = coursePayments
      .filter(p => {
        if (p.month && /^\d{4}-\d{2}-\d{2}$/.test(p.month)) {
          return p.month === pStart;
        }
        if (p.month && p.year) {
          if (p.month.toLowerCase() === pLabelEn.toLowerCase() && Number(p.year) === Number(pYear)) {
            return true;
          }
          const periodDate = new Date(pStart);
          const periodMonthName = periodDate.toLocaleString('en-US', { month: 'long' });
          const periodYear = periodDate.getFullYear();
          return p.month.toLowerCase() === periodMonthName.toLowerCase() && 
                 Number(p.year) === Number(periodYear);
        }
        return false;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const dueForPeriod = Math.max(0, monthlyPrice - paidForPeriod);
    let finalDueForPeriod = dueForPeriod;
    
    if (remainingPool > 0 && finalDueForPeriod > 0) {
      const deduction = Math.min(finalDueForPeriod, remainingPool);
      finalDueForPeriod -= deduction;
      remainingPool -= deduction;
    }
    
    if (finalDueForPeriod > 0) {
      unpaidMonths.push({
        month: pLabelEn,
        monthLabel: pLabel,
        year: pYear,
        due: finalDueForPeriod,
        rawStartDate: pStart
      });
    }
  }

  return {
    totalTuition,
    totalPaid,
    balance,
    unpaidMonths,
    totalMonths: monthsDue,
    studyStartDate,
    frozen: student.status === 'Dropped' || student.status === 'Graduated'
  };
};
