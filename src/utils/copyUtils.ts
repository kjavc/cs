// src/utils/copyUtils.ts
import { GeneratedSchedule, AcademicTerm, SavedSection, ExportType, AttendanceAccountingRules } from '../types';
import { formatTime } from './timeUtils';
import { exportForSpreadsheet } from './spreadsheetExport';



export const formatScheduleSimple = (
    schedule: GeneratedSchedule,
    timeFormat: '12h' | '24h'
): string => {
    let text = "";
    const blocks = schedule.scheduleBlocks;
    const lectureBlocks = blocks.filter(b => b.type === 'lecture');
    const labBlocks = blocks.filter(b => b.type === 'lab');

    if (lectureBlocks.length > 0) {
        const days = Array.from(new Set(lectureBlocks.map(b => b.dayOfWeek))).join('/');
        const sTime = lectureBlocks.reduce((min, b) => b.startTime < min ? b.startTime : min, lectureBlocks[0].startTime);
        const eTime = lectureBlocks.reduce((max, b) => b.endTime > max ? b.endTime : max, lectureBlocks[0].endTime);
        text += `Lecture: ${days} (${formatTime(sTime, timeFormat)} - ${formatTime(eTime, timeFormat)})\n`;
    }
    if (labBlocks.length > 0) {
        const days = Array.from(new Set(labBlocks.map(b => b.dayOfWeek))).join('/');
        const sTime = labBlocks.reduce((min, b) => b.startTime < min ? b.startTime : min, labBlocks[0].startTime);
        const eTime = labBlocks.reduce((max, b) => b.endTime > max ? b.endTime : max, labBlocks[0].endTime);
        text += `Lab: ${days} (${formatTime(sTime, timeFormat)} - ${formatTime(eTime, timeFormat)})\n`;
    }
    return text.trim();
};

export const formatScheduleDetailed = (
    schedule: GeneratedSchedule,
    sectionName: string,
    timeFormat: '12h' | '24h'
): string => {
    let text = `--- Course Schedule: ${sectionName} ---\n`;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        const dayBlocks = schedule.scheduleBlocks.filter(b => b.dayOfWeek === day);
        if (dayBlocks.length > 0) {
            text += `${day}:\n`;
            dayBlocks.forEach(b => {
                text += `  ${formatTime(b.startTime, timeFormat)} - ${formatTime(b.endTime, timeFormat)} (${b.type})\n`;
            });
        }
    });
    return text.trim();
};

export const formatBulkExport = (
    sections: SavedSection[],
    calendar: AcademicTerm[]
): string => {
    let exportText = "";
    sections.forEach((section) => {
        const term = calendar.find(t => t.id === section.selectedTermId);
        exportText += `======= ${section.name.toUpperCase()} =======\n`;
        exportText += `Term: ${term?.name || 'Unknown'}\n`;
        const lecAmount = section.fixedHours ? `${section.fixedHours.lec} hrs` : `${section.lectureUnits} units`;
        const labAmount = section.fixedHours ? `${section.fixedHours.lab} hrs` : `${section.labUnits} units`;
        exportText += `Lecture: ${lecAmount}, Days: ${section.lectureDays.join('')}${section.lecTbaHours ? ` (+ ${section.lecTbaHours} TBA hrs)` : ''}\n`;
        if (section.labUnits > 0) {
            exportText += `Lab: ${labAmount}, Days: ${section.labDays.join('')}${section.labTbaHours ? ` (+ ${section.labTbaHours} TBA hrs)` : ''}\n`;
        }
        exportText += `Start Time: ${section.startTime}${section.labStartTime ? ` (Lab: ${section.labStartTime})` : ''}\n\n`;
    });
    return exportText.trim();
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
    // 1. Try modern Clipboard API (requires HTTPS/Localhost)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Modern clipboard error:', err);
        }
    }

    // 2. Fallback to older execCommand method (works on mobile/HTTP)
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch (err) {
        console.error('Fallback clipboard error:', err);
        return false;
    }
};

// Copy a table as both plain TSV and HTML so spreadsheets that read HTML keep cell colors.
// Falls back to plain text where rich clipboard writes aren't supported.
export const copyRichToClipboard = async (text: string, html: string): Promise<boolean> => {
    if (navigator.clipboard && window.isSecureContext && typeof ClipboardItem !== 'undefined') {
        try {
            await navigator.clipboard.write([new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
            })]);
            return true;
        } catch (err) {
            console.error('Rich clipboard error:', err);
        }
    }
    return copyToClipboard(text);
};

export const handleCopyAction = async (
    type: ExportType,
    data: {
        schedule?: GeneratedSchedule | null;
        sectionName?: string;
        sections?: SavedSection[];
        calendar: AcademicTerm[];
        attendanceRules?: AttendanceAccountingRules | null;
        timeFormat: '12h' | '24h';
    },
    showToast: (message: string, type?: any) => void
) => {
    let text = "";
    let message = "Copied to clipboard!";

    if (type === 'spreadsheet') {
        if (data.sections) {
            text = exportForSpreadsheet(data.sections, data.calendar, data.attendanceRules ?? null);
            message = "All sections copied in spreadsheet format!";
        } else if (data.schedule && data.sectionName) {
            showToast("Specific section spreadsheet copy not yet refactored to utility", "error");
            return;
        }
    } else if (type === 'simple' && data.schedule) {
        text = formatScheduleSimple(data.schedule, data.timeFormat);
    } else if (type === 'detailed' && data.schedule) {
        text = formatScheduleDetailed(data.schedule, data.sectionName || "Current", data.timeFormat);
    }

    if (text) {
        const success = await copyToClipboard(text);
        if (success) showToast(message);
        else showToast("Failed to copy to clipboard", "error");
    }
};

