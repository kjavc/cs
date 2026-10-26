// src/components/Settings.tsx
import React from 'react';
import { Sun, Moon, Clock, X, Building2 } from 'lucide-react';
import { AcademicTerm } from '../types';
import { useSettings } from '../hooks/useSettings';
import { useRooms } from '../hooks/useRooms';
import './Settings.css';

interface SettingsProps {
  calendar: AcademicTerm[];
  settingsAPI: ReturnType<typeof useSettings>;
  onClose?: () => void;
}

export const formatHour12 = (hour: number) => {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

interface TimeSelectorProps {
  time: string;
  onTimeChange: (newTime: string) => void;
  timeFormat: '12h' | '24h';
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({ time, onTimeChange, timeFormat }) => {
  const [hour, minute] = time.split(':').map(Number);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTimeChange(`${String(e.target.value).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onTimeChange(`${String(hour).padStart(2, '0')}:${String(e.target.value).padStart(2, '0')}`);
  };

  return (
    <div className="time-selector-container">
      <select value={hour} onChange={handleHourChange}>
        {Array.from({ length: 15 }, (_, i) => i + 6).map(h => ( // 6 AM to 8 PM
          <option key={h} value={h}>
            {timeFormat === '12h' ? formatHour12(h) : String(h).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="time-separator">:</span>
      <select value={minute} onChange={handleMinuteChange}>
        {minuteOptions.map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ settingsAPI, onClose }) => {
  const {
    theme, setTheme, timeFormat, setTimeFormat,
    selectedDivisionId, setSelectedDivisionId
  } = settingsAPI;
  const { divisionOptions } = useRooms(selectedDivisionId);

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>App Settings</h2>
        <button onClick={onClose} className="settings-close-btn" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="settings-content">
        <div className="setting-group">
          <label className="setting-label">Appearance</label>
          <div className="segmented-control">
            <button
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun size={14} /> Light
            </button>
            <button
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label className="setting-label">Time Display</label>
          <div className="segmented-control">
            <button
              className={timeFormat === '12h' ? 'active' : ''}
              onClick={() => setTimeFormat('12h')}
            >
              <Clock size={14} /> 12-Hour
            </button>
            <button
              className={timeFormat === '24h' ? 'active' : ''}
              onClick={() => setTimeFormat('24h')}
            >
              <Clock size={14} /> 24-Hour
            </button>
          </div>
        </div>
        <div className="setting-group">
          <label className="setting-label"><Building2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Division</label>
          <select
            className="division-select"
            value={selectedDivisionId}
            onChange={(e) => setSelectedDivisionId(e.target.value)}
          >
            <option value="">— Select Division —</option>
            {divisionOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default Settings;
