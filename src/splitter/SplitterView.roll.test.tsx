import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SplitterView from './SplitterView';
import { ToastProvider } from '../components/Toast';
import { parseAttendanceAccountingRules } from '../utils/ruleParser';
import { COL } from './types';

const rules = parseAttendanceAccountingRules(
    fs.readFileSync(path.join(__dirname, '../data/attendance-method.md'), 'utf8')
);

const row = (crn: string, sub: string, num: string, days: string, s: string, e: string, ttl: string, mt: string, sd = '6/15/26', ed = '8/7/26') => {
    const c = new Array(26).fill('');
    c[COL.CRN] = crn; c[COL.SUB] = sub; c[COL.NUM] = num; c[COL.SEC] = '01'; c[COL.DAYS] = days;
    c[COL.S_TIME] = s; c[COL.E_TIME] = e; c[COL.SES_NUM] = '01'; c[COL.S_DATE] = sd; c[COL.E_DATE] = ed;
    c[COL.HRS_TTL] = ttl; c[COL.MT] = mt;
    return c.join('\t');
};

const renderView = () => render(
    <ToastProvider>
        <SplitterView attendanceRules={rules} appMode="splitter" setAppMode={() => {}} />
    </ToastProvider>
);

test('roll flow: paste → detect → review → results', () => {
    renderView();
    fireEvent.click(screen.getByRole('tab', { name: /Roll to another term/ }));
    fireEvent.change(screen.getByPlaceholderText(/Paste tab-separated/), {
        target: { value: [row('100', 'AERO', '120', 'MTWRF', '8:00 AM', '1:35 PM', '224.2', 'A'), row('500', 'ART', '101', 'MW', '10:00', '13:10', '54.4', 'L')].join('\n') },
    });
    expect(screen.getByDisplayValue('Summer 2026 (detected)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Summer 2027')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    expect(screen.getByText(/Review Roll: Summer 2026 → Summer 2027/)).toBeInTheDocument();
    expect(screen.getByText(/1 split/)).toBeInTheDocument();
    expect(screen.getByText(/1 can't roll/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull(); // AY26-27 catalog exists

    fireEvent.click(screen.getByRole('button', { name: /See Results/ }));
    expect(screen.getByText('Rolled to Summer 2027')).toBeInTheDocument();
    const tables = screen.getAllByRole('table');
    expect(within(tables[0]).getAllByText('6/14/27')).toHaveLength(2);
    expect(within(tables[1]).getByText('Not in AY26-27 catalog')).toBeInTheDocument();
});

test('fall roll shows the stand-in catalog warning', () => {
    renderView();
    fireEvent.click(screen.getByRole('tab', { name: /Roll to another term/ }));
    fireEvent.change(screen.getByPlaceholderText(/Paste tab-separated/), {
        target: { value: row('800', 'ENGL', '102', 'MW', '10:00', '11:25', '54.0', 'L', '8/17/26', '12/5/26') },
    });
    expect(screen.getByDisplayValue('Fall 2027')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('AY27-28 catalog not available yet');
});

test('split mode still works', () => {
    renderView();
    fireEvent.change(screen.getByPlaceholderText(/Paste tab-separated/), {
        target: { value: row('100', 'AERO', '120', 'MTWRF', '08:00', '13:35', '224.2', 'A') },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Parse/ }));
    expect(screen.getByText(/1 to split/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Process/ }));
    expect(screen.getByText(/1 input row → 2 output rows/)).toBeInTheDocument();
});
