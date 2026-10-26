// src/components/UnitSelector.tsx
import React, { useState, useEffect } from 'react';
import './UnitSelector.css';

interface UnitSelectorProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
}

const UnitSelector: React.FC<UnitSelectorProps> = ({ 
  label, value, step, min = 0, max = 10, onChange, disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(String(value));

  // This effect handles debouncing the text input
  useEffect(() => {
    // Don't run this effect if the prop and state are already in sync
    if (parseFloat(inputValue) === value) {
      return;
    }

    const handler = setTimeout(() => {
      const parsedValue = parseFloat(inputValue);
      if (!isNaN(parsedValue) && parsedValue >= min && parsedValue <= max) {
        onChange(parsedValue);
      } else if (inputValue === '' || inputValue === '.') {
        onChange(0);
      }
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, onChange, min, max, value]);


  // This effect ensures that if the parent changes the value (e.g. +/- buttons), the input updates
  useEffect(() => {
    // Only update if the numeric value of the input string is different from the prop value
    // This prevents overwriting the input while the user is typing something like "3."
    if (parseFloat(inputValue) !== value) {
        setInputValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleDecrement = () => {
    if (disabled) return;
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const validDecimalRegex = /^\d*\.?\d{0,2}$/; // Allow up to 2 decimal places

    if (validDecimalRegex.test(rawValue)) {
      setInputValue(rawValue); // Update local state immediately for responsive UI
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (inputValue === '0') {
      setInputValue('');
    }
    e.target.select(); // Highlight existing text
  };

  const handleBlur = () => {
    if (inputValue === '' || inputValue === '.') {
      setInputValue('0');
      onChange(0);
    }
  };

  return (
    <div className={`unit-selector-container ${disabled ? 'disabled' : ''}`}>
      <button 
        type="button" 
        onClick={handleDecrement} 
        className="unit-selector-btn" 
        aria-label={`Decrease ${label}`}
        disabled={disabled}
      >
        -
      </button>
      <input
        id={label}
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="unit-selector-input"
        disabled={disabled}
        readOnly={disabled}
      />
      <button 
        type="button" 
        onClick={handleIncrement} 
        className="unit-selector-btn" 
        aria-label={`Increase ${label}`}
        disabled={disabled}
      >
        +
      </button>
    </div>
  );
};

export default UnitSelector;
