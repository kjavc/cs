import { GeneratedSchedule, ScheduleBlock } from '../types/schedule';
import { RoomContextSchedule } from '../components/ScheduleDisplay';

export interface RoomConflict {
    sectionName: string;
    day: string;
    currentTime: string;
    conflictTime: string;
    weekLabel: string;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

export function detectRoomConflicts(
    currentSchedule: GeneratedSchedule | null,
    roomContextSchedules: RoomContextSchedule[]
): RoomConflict[] {
    if (!currentSchedule || roomContextSchedules.length === 0) return [];

    const conflicts: RoomConflict[] = [];

    for (const currentBlock of currentSchedule.scheduleBlocks) {
        const cStart = timeToMinutes(currentBlock.startTime);
        const cEnd = timeToMinutes(currentBlock.endTime);

        for (const rcs of roomContextSchedules) {
            for (const rBlock of rcs.schedule.scheduleBlocks) {
                if (rBlock.dayOfWeek !== currentBlock.dayOfWeek) continue;

                const rStart = timeToMinutes(rBlock.startTime);
                const rEnd = timeToMinutes(rBlock.endTime);

                // Overlap check (no buffer — exact overlap)
                if (cStart < rEnd && rStart < cEnd) {
                    conflicts.push({
                        sectionName: rcs.name,
                        day: currentBlock.dayOfWeek,
                        currentTime: `${currentBlock.startTime}-${currentBlock.endTime}`,
                        conflictTime: `${rBlock.startTime}-${rBlock.endTime}`,
                        weekLabel: rcs.weekLabel
                    });
                }
            }
        }
    }

    return conflicts;
}
