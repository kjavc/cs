export interface Room {
    id: string;
    number: string;
    type: string;
    capacity: number;
}

export interface Building {
    id: string;
    code: string;
    name: string;
    rooms: Room[];
}

export interface Division {
    name: string;
    buildings: Building[];
}

export type RoomData = Record<string, Division>;
