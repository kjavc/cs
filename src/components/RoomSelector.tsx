import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Building, Room } from '../types/rooms';
import './RoomSelector.css';

interface RoomSelectorProps {
    buildings: Building[];
    lectureBuildingId: string;
    setLectureBuildingId: (v: string) => void;
    lectureRoomId: string;
    setLectureRoomId: (v: string) => void;
    labBuildingId: string;
    setLabBuildingId: (v: string) => void;
    labRoomId: string;
    setLabRoomId: (v: string) => void;
    lectureUnits: number;
    labUnits: number;
    hasDivision: boolean;
}

const RoomSelector: React.FC<RoomSelectorProps> = ({
    buildings,
    lectureBuildingId, setLectureBuildingId,
    lectureRoomId, setLectureRoomId,
    labBuildingId, setLabBuildingId,
    labRoomId, setLabRoomId,
    lectureUnits, labUnits, hasDivision
}) => {
    const isLinked = lectureBuildingId === labBuildingId && lectureRoomId === labRoomId && lectureRoomId !== '';
    const showLab = labUnits > 0;
    const showLec = lectureUnits > 0;

    const handleLecBuildingChange = (id: string) => {
        setLectureBuildingId(id);
        setLectureRoomId('');
        if (isLinked || (!showLab)) {
            setLabBuildingId(id);
            setLabRoomId('');
        }
    };

    const handleLecRoomChange = (id: string) => {
        setLectureRoomId(id);
        if (isLinked || (!showLab)) {
            setLabRoomId(id);
        }
    };

    const handleLink = () => {
        if (!isLinked) {
            setLabBuildingId(lectureBuildingId);
            setLabRoomId(lectureRoomId);
        }
    };

    const handleUnlink = () => {
        // just allow independent editing
    };

    const lecRooms = buildings.find(b => b.id === lectureBuildingId)?.rooms || [];
    const labRooms = buildings.find(b => b.id === labBuildingId)?.rooms || [];

    const formatRoomLabel = (r: Room) => `${r.number} (${r.type})`;

    if (!hasDivision) {
        return (
            <div className="room-selector-wrapper">
                <span className="room-no-division">Select a division in Settings to assign rooms</span>
            </div>
        );
    }

    return (
        <div className="room-selector-wrapper">
            <div className="room-selector-header">
                <label className="config-label" style={{ lineHeight: 1 }}>Room Assignment</label>
                {showLec && showLab && (
                    <button
                        className="icon-btn-xs"
                        style={{ padding: 0 }}
                        onClick={isLinked ? handleUnlink : handleLink}
                        title={isLinked ? 'Use separate rooms for Lecture and Lab' : 'Use the same room for both'}
                    >
                        {isLinked ? <Lock size={10} /> : <Unlock size={10} />}
                    </button>
                )}
            </div>
            <div className="room-selector-controls">
                {showLec && (
                    <div className="room-pair">
                        <span className="micro-label">{showLab && !isLinked ? 'Lec Bldg' : 'Building'}</span>
                        <select value={lectureBuildingId} onChange={(e) => handleLecBuildingChange(e.target.value)}>
                            <option value="">—</option>
                            {buildings.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                        </select>
                    </div>
                )}
                {showLec && (
                    <div className="room-pair">
                        <span className="micro-label">{showLab && !isLinked ? 'Lec Room' : 'Room'}</span>
                        <select value={lectureRoomId} onChange={(e) => handleLecRoomChange(e.target.value)} disabled={!lectureBuildingId}>
                            <option value="">—</option>
                            {lecRooms.map(r => <option key={r.id} value={r.id}>{formatRoomLabel(r)}</option>)}
                        </select>
                    </div>
                )}
                {showLab && !isLinked && (
                    <>
                        <div className="room-pair">
                            <span className="micro-label">Lab Bldg</span>
                            <select value={labBuildingId} onChange={(e) => { setLabBuildingId(e.target.value); setLabRoomId(''); }}>
                                <option value="">—</option>
                                {buildings.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                            </select>
                        </div>
                        <div className="room-pair">
                            <span className="micro-label">Lab Room</span>
                            <select value={labRoomId} onChange={(e) => setLabRoomId(e.target.value)} disabled={!labBuildingId}>
                                <option value="">—</option>
                                {labRooms.map(r => <option key={r.id} value={r.id}>{formatRoomLabel(r)}</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RoomSelector;
