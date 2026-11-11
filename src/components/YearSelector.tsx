import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  AlertCircle,
  Calendar,
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  MONTHS,
  validateYear,
  isLeapYear,
  getDaysInMonth,
  getNextPeriod,
  getPreviousPeriod
} from '../utils/dateUtils';

interface YearSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  compact?: boolean;
}

export const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onYearChange,
  selectedMonth = 'October',
  onMonthChange,
  compact = false
}) => {
  const { isDark } = useTheme();
  const [inputValue, setInputValue] = useState<string>(String(selectedYear));
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value whenever external selectedYear changes
  useEffect(() => {
    setInputValue(String(selectedYear));
    setError(null);
  }, [selectedYear]);

  // Handle clicking outside the search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  const handleCommitYear = (valToCommit: string) => {
    const trimmed = valToCommit.trim();
    const result = validateYear(trimmed);

    if (result.isValid && result.year !== undefined) {
      setError(null);
      setInputValue(String(result.year));
      onYearChange(result.year);
      setIsSearchOpen(false);
    } else {
      setError(result.error || 'Please enter a valid 4-digit year (1000–9999).');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // If exactly 4 digits, validate and update immediately for convenience
    if (/^\d{4}$/.test(val.trim())) {
      const res = validateYear(val.trim());
      if (res.isValid && res.year !== undefined) {
        setError(null);
        onYearChange(res.year);
      } else {
        setError(res.error || 'Invalid 4-digit year.');
      }
    } else {
      // Clear error while user is actively typing partial 1-3 digits
      if (val.trim().length <= 4 && /^\d*$/.test(val.trim())) {
        setError(null);
      } else {
        // If they typed non-digits, warn immediately
        const res = validateYear(val);
        if (!res.isValid) {
          setError(res.error || 'Invalid year.');
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitYear(inputValue);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setInputValue(String(selectedYear));
      setError(null);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepYear(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepYear(-1);
    }
  };

  const handleStepYear = (delta: number) => {
    const target = selectedYear + delta;
    const res = validateYear(target);
    if (res.isValid && res.year !== undefined) {
      setError(null);
      setInputValue(String(res.year));
      onYearChange(res.year);
    }
  };

  const handleStepMonth = (direction: 'next' | 'prev') => {
    if (!onMonthChange) return;
    const transition = direction === 'next'
      ? getNextPeriod(selectedMonth, selectedYear)
      : getPreviousPeriod(selectedMonth, selectedYear);

    onMonthChange(transition.month);
    if (transition.year !== selectedYear) {
      onYearChange(transition.year);
      setInputValue(String(transition.year));
      setError(null);
    }
  };

  // Quick milestone suggestions for the search popover
  const quickSuggestions = [
    2024, 2025, 2026, 2027, 2028, 2030, 2035, 2040, 2050, 2100, 3000, 3047
  ];

  const filteredYears = searchQuery.trim()
    ? (() => {
        const query = searchQuery.trim();
        // If user typed a number, generate suggestions matching that prefix or direct value
        const matches: number[] = [];
        const parsed = parseInt(query, 10);
        if (!isNaN(parsed) && parsed >= 1000 && parsed <= 9999) {
          matches.push(parsed);
        }
        for (const yr of quickSuggestions) {
          if (String(yr).includes(query) && !matches.includes(yr)) {
            matches.push(yr);
          }
        }
        // If user typed partial prefix (e.g. "30"), suggest "3000", "3047", etc.
        if (matches.length === 0 && /^\d+$/.test(query) && query.length < 4) {
          const sampleFuture = parseInt(query.padEnd(4, '0'), 10);
          if (sampleFuture >= 1000 && sampleFuture <= 9999) matches.push(sampleFuture);
        }
        return matches;
      })()
    : quickSuggestions;

  const daysInCurrentMonth = getDaysInMonth(selectedYear, selectedMonth);
  const leapYearStatus = isLeapYear(selectedYear);

  return (
    <div className="relative font-sans text-xs" ref={dropdownRef}>
      {/* Month & Year Selection Grid */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Month Selector */}
          {onMonthChange ? (
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              aria-label="Payroll Month"
              className={`text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#CB1417] border font-medium ${
                isDark
                  ? 'bg-[#000000] border-[#27272A] text-white'
                  : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <div
              className={`text-xs rounded px-2 py-1.5 border font-medium flex items-center ${
                isDark
                  ? 'bg-[#000000] border-[#27272A] text-white'
                  : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            >
              {selectedMonth}
            </div>
          )}

          {/* Editable Year Input with Search Icon & Step Arrows */}
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={() => handleCommitYear(inputValue)}
              onKeyDown={handleKeyDown}
              placeholder="Year"
              aria-label="Payroll Year (e.g. 2026, 3047)"
              title="Type any 4-digit year (e.g. 2026, 3047) and press Enter"
              className={`w-full text-xs rounded pl-2 pr-12 py-1.5 focus:outline-none font-semibold tabular-nums border transition ${
                error
                  ? 'border-red-500 ring-1 ring-red-500/30'
                  : 'focus:border-[#CB1417]'
              } ${
                isDark
                  ? 'bg-[#000000] border-[#27272A] text-white'
                  : 'bg-[#FFFFFF] border-[#D4D4D8] text-black'
              }`}
            />

            {/* Inline Controls: Search Dropdown Toggle & Steppers */}
            <div className="absolute right-1 flex items-center space-x-0.5">
              <button
                type="button"
                onClick={() => setIsSearchOpen(prev => !prev)}
                title="Search or jump to any year"
                aria-label="Search or pick year"
                className={`p-1 rounded hover:bg-neutral-500/20 transition cursor-pointer ${
                  isDark ? 'text-[#A1A1AA] hover:text-white' : 'text-[#71717A] hover:text-black'
                }`}
              >
                <Search className="w-3 h-3 text-[#CB1417]" />
              </button>

              <div className="flex flex-col -space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleStepYear(1)}
                  title="Next Year (+1)"
                  aria-label="Next Year"
                  className={`text-[9px] px-0.5 rounded leading-none hover:text-[#CB1417] transition cursor-pointer ${
                    isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                  }`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleStepYear(-1)}
                  title="Previous Year (-1)"
                  aria-label="Previous Year"
                  className={`text-[9px] px-0.5 rounded leading-none hover:text-[#CB1417] transition cursor-pointer ${
                    isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                  }`}
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Month Navigation Buttons (prev/next month transition) */}
        {onMonthChange && (
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <button
              type="button"
              onClick={() => handleStepMonth('prev')}
              title="Previous Month (rolls back year if January)"
              className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded hover:bg-neutral-500/10 transition cursor-pointer ${
                isDark ? 'text-[#A1A1AA] hover:text-white' : 'text-[#71717A] hover:text-black'
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Prev</span>
            </button>

            <span className={`text-[10px] tabular-nums font-medium ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              {daysInCurrentMonth} days
              {selectedMonth.toLowerCase() === 'february' && (
                <span> ({leapYearStatus ? 'Leap Year' : 'Common Year'})</span>
              )}
            </span>

            <button
              type="button"
              onClick={() => handleStepMonth('next')}
              title="Next Month (rolls over year if December)"
              className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded hover:bg-neutral-500/10 transition cursor-pointer ${
                isDark ? 'text-[#A1A1AA] hover:text-white' : 'text-[#71717A] hover:text-black'
              }`}
            >
              <span>Next</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Validation Error Banner (Visible when input is invalid) */}
        {error && (
          <div className="flex items-start space-x-1.5 p-1.5 rounded bg-red-500/10 border border-red-500/40 text-[11px] text-red-500 leading-tight animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputValue(String(selectedYear));
                setError(null);
              }}
              title="Revert to current year"
              className="text-red-500 hover:text-red-400 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Searchable Year Picker Dropdown / Popover (opens upward above selector) */}
      {isSearchOpen && (
        <div
          className={`absolute z-50 left-0 right-0 bottom-full mb-1.5 rounded-xl shadow-2xl border p-2.5 animate-in fade-in zoom-in-95 ${
            isDark
              ? 'bg-[#111113] border-[#2A2A2E] text-white'
              : 'bg-white border-neutral-200 text-black shadow-xl'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-neutral-500/20 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#CB1417] flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-[#ED1F24]" />
              <span>Select Any Year</span>
            </span>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="p-1 rounded hover:bg-neutral-500/20 text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Search Input inside popover */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleCommitYear(searchQuery);
                }
              }}
              placeholder="Search / enter year (e.g. 3047)..."
              autoFocus
              className={`w-full text-xs rounded-lg pl-7 pr-2 py-1.5 border focus:outline-none focus:border-[#CB1417] ${
                isDark
                  ? 'bg-[#18181B] border-[#27272A] text-white'
                  : 'bg-[#F4F4F6] border-[#E4E4E7] text-black'
              }`}
            />
          </div>

          {/* Quick Select Grid */}
          <div className="text-[10px] text-neutral-400 mb-1 font-semibold uppercase tracking-wider">
            {searchQuery ? 'Matches' : 'Quick Milestones & Years'}
          </div>

          <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5">
            {filteredYears.map(yr => {
              const isCurrent = yr === selectedYear;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => handleCommitYear(String(yr))}
                  className={`px-2 py-1.5 rounded text-xs font-semibold tabular-nums text-center transition flex items-center justify-center space-x-1 cursor-pointer ${
                    isCurrent
                      ? 'bg-[#CB1417] text-white shadow-sm'
                      : isDark
                      ? 'bg-[#18181B] hover:bg-[#27272A] text-neutral-200 hover:text-white'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                  }`}
                >
                  <span>{yr}</span>
                  {isCurrent && <Check className="w-2.5 h-2.5" />}
                </button>
              );
            })}
          </div>

          {searchQuery && filteredYears.length === 0 && (
            <div className="p-2 text-center text-xs text-neutral-400">
              <p>No preset found for &quot;{searchQuery}&quot;.</p>
              <button
                type="button"
                onClick={() => handleCommitYear(searchQuery)}
                className="mt-1 px-3 py-1 bg-[#CB1417] text-white rounded text-xs font-bold hover:bg-[#ED1F24]"
              >
                Apply Year {searchQuery}
              </button>
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-neutral-500/20 text-[10px] text-neutral-400 flex items-center justify-between">
            <span>Supports 1000–9999</span>
            <span className="font-semibold text-[#CB1417]">Unlimited</span>
          </div>
        </div>
      )}
    </div>
  );
};
