import { useMemo } from 'react';
import roomData from '../data/rooms.json';
import { RoomData, Division, Building, Room } from '../types/rooms';

const allRoomData = roomData as RoomData;

export function useRooms(selectedDivisionId: string) {
    const division: Division | null = useMemo(() => {
        return allRoomData[selectedDivisionId] || null;
    }, [selectedDivisionId]);

    const buildings: Building[] = useMemo(() => {
        return division?.buildings || [];
    }, [division]);

    const allRooms: Room[] = useMemo(() => {
        return buildings.flatMap(b => b.rooms);
    }, [buildings]);

    const findRoom = (roomId: string): { building: Building; room: Room } | null => {
        for (const building of buildings) {
            const room = building.rooms.find(r => r.id === roomId);
            if (room) return { building, room };
        }
        return null;
    };

    const divisionOptions = useMemo(() => {
        return Object.entries(allRoomData).map(([id, div]) => ({
            id,
            name: div.name
        }));
    }, []);

    return {
        division,
        buildings,
        allRooms,
        findRoom,
        divisionOptions
    };
}
