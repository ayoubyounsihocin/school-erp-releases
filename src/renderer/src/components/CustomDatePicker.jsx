import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CustomDatePicker({
  value,
  onChange,
  placeholder,
  language = 'en',
  t = (key) => key,
  id,
  name,
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  });
  const [tempSelectedDate, setTempSelectedDate] = useState(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  });
  
  // Navigation states
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed.getMonth();
    }
    return new Date().getMonth();
  });
  const [currentYear, setCurrentYear] = useState(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return new Date().getFullYear();
  });
  
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  // Initialize selected date from value
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        if (!selectedDate || parsed.getTime() !== selectedDate.getTime()) {
          setSelectedDate(parsed);
          setTempSelectedDate(parsed);
          setCurrentMonth(parsed.getMonth());
          setCurrentYear(parsed.getFullYear());
        }
        return;
      }
    }
    if (selectedDate !== null) {
      setSelectedDate(null);
      setTempSelectedDate(null);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const isAr = language === 'ar';

  const monthsEN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthsAR = [
    'جانفي / يناير', 'فيفري / فبراير', 'مارس', 'أفريل / أبريل', 'ماي / مايو', 'جوان / يونيو',
    'جويلية / يوليو', 'أوت / أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const months = isAr ? monthsAR : monthsEN;

  const weekdaysEN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weekdaysAR = ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح']; // Mon to Sun
  const weekdays = isAr ? weekdaysAR : weekdaysEN;

  // Year list: 100 years back, 10 years forward
  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear + 10; y >= thisYear - 100; y--) {
    years.push(y);
  }

  // Prev / Next month handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Helper to format date as YYYY-MM-DD
  const formatDateString = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Format date for display in the input
  const getDisplayValue = () => {
    if (!selectedDate) return placeholder || (isAr ? 'اختر التاريخ...' : 'Select date...');
    return formatDateString(selectedDate);
  };

  // Generate calendar days grid
  const getCalendarCells = () => {
    const cells = [];
    
    // First day of current month
    const firstDayDate = new Date(currentYear, currentMonth, 1);
    // getDay() is 0 (Sun) to 6 (Sat)
    // We want Monday to be 0, Tuesday 1, ..., Sunday 6
    let startDayIdx = firstDayDate.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6; // Sunday becomes index 6

    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Days in previous month
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 1. Previous month padding cells
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      cells.push({
        day: prevDay,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth - 1, prevDay)
      });
    }

    // 2. Current month cells
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true,
        date: new Date(currentYear, currentMonth, d)
      });
    }

    // 3. Next month padding cells to make grid multiple of 7
    const remaining = 42 - cells.length; // 6 rows of 7 days
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth + 1, d)
      });
    }

    return cells;
  };

  const handleDaySelect = (cellDate) => {
    setTempSelectedDate(cellDate);
  };

  const handleApply = () => {
    if (tempSelectedDate) {
      setSelectedDate(tempSelectedDate);
      const formatted = formatDateString(tempSelectedDate);
      if (onChange) {
        onChange({ target: { id, name: name || id, value: formatted } });
      }
    } else {
      setSelectedDate(null);
      if (onChange) {
        onChange({ target: { id, name: name || id, value: '' } });
      }
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSelectedDate(selectedDate);
    setIsOpen(false);
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} id={id}>
      {/* Input Trigger Box */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-955 border border-slate-800 rounded-xl text-xs text-slate-350 hover:text-slate-100 hover:border-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none transition-colors"
      >
        <span className={selectedDate ? 'font-mono text-slate-200' : 'text-slate-500'}>
          {getDisplayValue()}
        </span>
        <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
      </button>

      {/* Floating Premium Calendar Popover */}
      {isOpen && (
        <div 
          className={`absolute top-[calc(100%+6px)] ${isAr ? 'right-0' : 'left-0'} z-50 p-4 bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl w-[280px] text-slate-200 animate-scale-in text-start select-none`}
        >
          {/* Header Month / Year Selectors */}
          <div className="flex items-center justify-between gap-1.5 mb-4">
            {/* Prev Month */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Dropdown selectors */}
            <div className="flex items-center gap-1">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                className="bg-slate-950 text-slate-200 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-800 focus:outline-none cursor-pointer"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx}>{isAr ? m.split(' / ')[0] : m}</option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="bg-slate-950 text-slate-200 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-800 focus:outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Next Month */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday letters */}
          <div className="grid grid-cols-7 text-center gap-y-1 mb-2">
            {weekdays.map((w, idx) => (
              <span key={idx} className="text-[10px] font-bold text-slate-500 uppercase">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center font-mono text-[10.5px]">
            {getCalendarCells().map((cell, idx) => {
              const isSelected = isSameDay(cell.date, tempSelectedDate);
              const isToday = isSameDay(cell.date, new Date());
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDaySelect(cell.date)}
                  className={`
                    h-7 w-7 mx-auto rounded-full flex items-center justify-center cursor-pointer transition-all text-xs font-semibold
                    ${!cell.isCurrentMonth ? 'text-slate-650 opacity-40 hover:bg-slate-800/40' : 'text-slate-250 hover:bg-slate-800'}
                    ${isToday && !isSelected ? 'border border-blue-500/50 text-blue-400' : ''}
                    ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105' : ''}
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-850">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-250 hover:bg-slate-800 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-800"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-550 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all"
            >
              {isAr ? 'تطبيق' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
