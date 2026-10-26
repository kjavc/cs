import { useState, useEffect } from 'react';
import {
    parseContactHourCalculationRules,
    parseAttendanceAccountingRules,
} from '../utils/ruleParser';
import { ContactHourCalculationRules, AttendanceAccountingRules } from '../types';

import contactHoursRulesPath from '../data/contact_hours_rules.md';
import attendanceMethodRulesPath from '../data/attendance-method.md';

export function useRules() {
    const [contactHourRules, setContactHourRules] = useState<ContactHourCalculationRules | null>(null);
    const [attendanceRules, setAttendanceRules] = useState<AttendanceAccountingRules | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchRules = async () => {
            try {
                const [contactRes, attendanceRes] = await Promise.all([
                    fetch(contactHoursRulesPath),
                    fetch(attendanceMethodRulesPath)
                ]);
                const contactText = await contactRes.text();
                const attendanceText = await attendanceRes.text();
                if (isMounted) {
                    setContactHourRules(parseContactHourCalculationRules(contactText));
                    setAttendanceRules(parseAttendanceAccountingRules(attendanceText));
                }
            } catch (error) {
                console.error("Error fetching rules", error);
            }
        };
        fetchRules();
        return () => { isMounted = false; };
    }, []);

    return { contactHourRules, setContactHourRules, attendanceRules, setAttendanceRules };
}
