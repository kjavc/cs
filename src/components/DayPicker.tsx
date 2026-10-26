// src/components/DayPicker.tsx
import React from 'react';
import './DayPicker.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PRESETS: { label: string; days: string[] }[] = [
  { label: 'MW', days: ['Mon', 'Wed'] },
  { label: 'TTh', days: ['Tue', 'Thu'] },
  { label: 'MWF', days: ['Mon', 'Wed', 'Fri'] },
  { label: 'TThF', days: ['Tue', 'Thu', 'Fri'] },
  { label: 'MTWTh', days: ['Mon', 'Tue', 'Wed', 'Thu'] },
];

interface DayPickerProps {
  selectedDays: string[];
  onDayToggle: (day: string) => void;
  onSetDays?: (days: string[]) => void;
}

const DayPicker: React.FC<DayPickerProps> = ({ selectedDays, onDayToggle, onSetDays }) => {
  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  return (
    <div className="day-picker-wrapper">
      {onSetDays && (
        <div className="day-presets">
          {PRESETS.map(p => (
            <button
              key={p.label}
              className={`day-preset-btn ${arraysEqual(selectedDays, p.days) ? 'active' : ''}`}
              onClick={() => onSetDays(p.days)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="day-picker-container">
        {DAYS.map(day => {
          const isSelected = selectedDays.includes(day);
          return (
            <div
              key={day}
              className={`day-picker-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onDayToggle(day)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayPicker;
