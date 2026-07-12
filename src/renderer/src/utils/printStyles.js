export const STUDENT_PRINT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

* {
  box-sizing: border-box;
}

@page {
  size: A5 landscape;
  margin: 0;
}

body {
  font-family: 'Inter', -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  color: #1e293b;
  background-color: #ffffff;
  width: 210mm;
  height: 148mm;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-container {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 12px 16px;
  justify-content: space-between;
  position: relative;
}

.invoice-half {
  width: 47%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}

.empty-half {
  width: 47%;
  height: 100%;
}

/* Dual Copy Divider */
.middle-divider {
  width: 6%;
  height: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.middle-divider::after {
  content: "";
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 50%;
  border-left: 1px dashed #cbd5e1;
}

.scissors-icon {
  background: #ffffff;
  padding: 4px 0;
  z-index: 10;
  font-size: 10px;
  color: #94a3b8;
  font-family: Arial, sans-serif;
}

/* Copy Badges */
.copy-badge {
  font-size: 6.5px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border: 1px solid #e2e8f0;
  padding: 1.5px 5px;
  border-radius: 4px;
  background-color: #f8fafc;
  display: inline-block;
  margin-bottom: 4px;
}

/* Header styling */
.header-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4px;
}

.school-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.school-name {
  font-size: 9px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: -0.2px;
}

.school-subtitle {
  font-size: 6.5px;
  color: #64748b;
  font-weight: 500;
}

.header-info {
  font-size: 7px;
  color: #475569;
  line-height: 1.25;
}

.divider-line {
  border-bottom: 2px solid #0f172a;
  margin: 4px 0 6px 0;
  width: 100%;
}

.invoice-title {
  font-size: 11px;
  font-weight: 900;
  color: #0f172a;
  margin: 0 0 6px 0;
  letter-spacing: -0.2px;
  text-transform: uppercase;
}

/* Details Grid */
.details-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.details-td {
  padding: 4px 6px;
  vertical-align: top;
}

.details-label {
  font-size: 6px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 2px;
}

.details-value {
  font-size: 8.5px;
  font-weight: 800;
  color: #0f172a;
}

.details-subtext {
  font-size: 7px;
  color: #475569;
  margin-top: 1px;
}

/* Items Table */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
}

.items-table th {
  padding: 4px 0;
  font-size: 7px;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-top: 1px solid #0f172a;
  border-bottom: 1px solid #e2e8f0;
}

.items-table td {
  padding: 4.5px 0;
  font-size: 8px;
  color: #334155;
  border-bottom: 1px dashed #e2e8f0;
}

/* Totals */
.totals-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 2px;
}

.totals-table td {
  padding: 3px 0;
  font-size: 8px;
}

.total-due-row {
  font-weight: 900;
  color: #0f172a;
  border-top: 1px solid #0f172a;
  border-bottom: 1px solid #0f172a;
}

.total-amount {
  font-size: 11px;
  font-weight: 900;
  font-family: monospace;
}

/* Footer & Signatures */
.footer-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 6px;
}

.signature-box {
  text-align: center;
}

.signature-line {
  width: 80px;
  border-bottom: 1px solid #475569;
  margin-bottom: 2.5px;
  margin-left: auto;
  margin-right: auto;
}

.signature-title {
  font-size: 6.5px;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stamp-box {
  width: 40px;
  height: 40px;
  border: 1px dashed #cbd5e1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 0.2px;
}

.terms-text {
  font-size: 6px;
  color: #64748b;
  line-height: 1.3;
  border-top: 1px solid #f1f5f9;
  padding-top: 4px;
  margin-top: 5px;
}
`;

export const RECEIPT_PRINT_STYLES = STUDENT_PRINT_STYLES;
export const TEACHER_PAYOUT_PRINT_STYLES = STUDENT_PRINT_STYLES;

export const TEACHER_PRINT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

* {
  box-sizing: border-box;
}

@page {
  size: A5 landscape;
  margin: 0;
}

body {
  font-family: 'Inter', -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  color: #1e293b;
  background-color: #ffffff;
  width: 210mm;
  height: 148mm;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-container {
  width: 100%;
  height: 100%;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.header-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2px;
}

.school-name {
  font-size: 10px;
  font-weight: 900;
  color: #0f172a;
  text-transform: uppercase;
}

.header-info {
  font-size: 7px;
  color: #64748b;
  text-align: right;
  line-height: 1.2;
}

.divider {
  border-bottom: 2px solid #0f172a;
  margin: 4px 0;
  width: 100%;
}

.title {
  font-size: 11px;
  font-weight: 900;
  color: #0f172a;
  margin: 0 0 1px 0;
  text-transform: uppercase;
  letter-spacing: -0.2px;
}

.subtitle {
  font-size: 6.5px;
  color: #64748b;
  font-family: monospace;
  margin-bottom: 4px;
}

.details-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.details-col {
  padding: 4px 6px;
  vertical-align: top;
}

.details-label {
  font-size: 5.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 2px;
}

.details-value {
  font-size: 8.5px;
  font-weight: 800;
  color: #0f172a;
}

.timetable-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}

.timetable-table th {
  border-bottom: 1px solid #cbd5e1;
  border-right: 1px solid #cbd5e1;
  padding: 3.5px 4px;
  font-weight: 800;
  text-align: center;
  background-color: #f8fafc;
  color: #1e293b;
  font-size: 7px;
  text-transform: uppercase;
}

.timetable-table th:last-child {
  border-right: none;
}

.timetable-table td {
  border-bottom: 1px solid #cbd5e1;
  border-right: 1px solid #cbd5e1;
  padding: 3px;
  vertical-align: top;
}

.timetable-table tr:last-child td {
  border-bottom: none;
}

.timetable-table td:last-child {
  border-right: none;
}

.day-cell {
  background-color: #f8fafc;
  font-weight: 800;
  font-size: 7.5px;
  color: #0f172a;
  text-align: center;
  vertical-align: middle !important;
}

.recess-cell {
  background-color: #f1f5f9;
  font-weight: 850;
  color: #64748b;
  font-size: 7px;
  text-align: center;
  vertical-align: middle !important;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.sched-card {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 2.5px solid #2563eb;
  border-radius: 4px;
  padding: 3px;
  margin-bottom: 2px;
}

.sched-card:last-child {
  margin-bottom: 0;
}

.sched-title {
  font-weight: 800;
  color: #0f172a;
  font-size: 7.5px;
  line-height: 1.1;
  margin-bottom: 1px;
}

.sched-room {
  font-size: 6.5px;
  color: #475569;
  font-weight: 500;
}

.sched-students {
  font-size: 6.5px;
  color: #64748b;
}

.sched-teacher {
  font-size: 6.5px;
  color: #475569;
  margin-top: 1px;
}
`;

export const CERTIFICATE_PRINT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Kufi+Arabic:wght@400;600;700;850&display=swap');

* {
  box-sizing: border-box;
}

@page {
  size: A5 landscape;
  margin: 0;
}

body {
  font-family: 'Inter', 'Noto Kufi Arabic', -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  color: #0f172a;
  background-color: #ffffff;
  width: 210mm;
  height: 148mm;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-container {
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.certificate-border {
  width: 100%;
  height: 100%;
  border: 4px double #1e3a8a;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  background-color: #fafaf9;
}

.certificate-corner-decor {
  position: absolute;
  width: 15px;
  height: 15px;
  border: 2px solid #b45309;
}

.decor-tl { top: 6px; left: 6px; border-right: none; border-bottom: none; }
.decor-tr { top: 6px; right: 6px; border-left: none; border-bottom: none; }
.decor-bl { bottom: 6px; left: 6px; border-right: none; border-top: none; }
.decor-br { bottom: 6px; right: 6px; border-left: none; border-top: none; }

.header-table {
  width: 100%;
  border-collapse: collapse;
}

.school-name {
  font-size: 10px;
  font-weight: 900;
  color: #1e3a8a;
  text-transform: uppercase;
  font-family: 'Inter', 'Noto Kufi Arabic', sans-serif;
}

.school-logo img {
  max-height: 25px;
  max-width: 90px;
  object-fit: contain;
}

.certificate-title-box {
  text-align: center;
  margin: 6px 0;
}

.certificate-title-ar {
  font-family: 'Noto Kufi Arabic', sans-serif;
  font-size: 16px;
  font-weight: 850;
  color: #1e3a8a;
  margin: 0;
  letter-spacing: 0.5px;
}

.certificate-title-en {
  font-size: 10px;
  font-weight: 900;
  color: #b45309;
  margin: 2px 0 0 0;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.certificate-body {
  text-align: center;
  font-size: 9.5px;
  line-height: 1.6;
  color: #334155;
  margin: 6px 0;
  padding: 0 15px;
}

.student-highlight {
  font-size: 12px;
  font-weight: 900;
  color: #0f172a;
  border-bottom: 1px solid #cbd5e1;
  padding: 0 8px;
  display: inline-block;
  font-family: 'Noto Kufi Arabic', 'Inter', sans-serif;
}

.course-badge-list {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.course-badge {
  font-size: 8px;
  font-weight: 700;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 2px 6px;
  border-radius: 4px;
}

.certificate-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 4px;
  padding: 0 10px;
}

.date-info {
  font-size: 7.5px;
  color: #475569;
  line-height: 1.4;
  text-align: left;
}

.signature-block {
  text-align: center;
}

.signature-line {
  width: 90px;
  border-bottom: 1px solid #1e3a8a;
  margin-bottom: 3px;
}

.signature-title {
  font-size: 7px;
  font-weight: 800;
  color: #1e3a8a;
  text-transform: uppercase;
}

.stamp-seal {
  width: 42px;
  height: 42px;
  border: 1.5px dashed #b45309;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5.5px;
  color: #b45309;
  text-transform: uppercase;
  font-weight: 900;
  transform: rotate(-10deg);
}
`;
