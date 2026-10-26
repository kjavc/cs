// src/utils/timeUtils.ts

export const formatTime = (time: string, format: '12h' | '24h') => {
    if (!time) return '';
    const [h, m] = time.split(':');
    let hour = parseInt(h) % 24; // Wrap virtual hours (25 -> 1)

    if (format === '24h') {
        return `${String(hour).padStart(2, '0')}:${m}`;
    }

    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, '0')}:${m} ${suffix}`;
};
