import { CRNGroup, COL } from './types';
import { CatalogMatch, lookupCourse, getUnitRange } from './catalogLookup';

export interface CrosslistError {
    xlistCode: string;
    crns: string[];
    message: string;
}

export function validateCrosslists(
    groups: CRNGroup[],
    catalogIndex: Map<string, CatalogMatch>
): CrosslistError[] {
    const errors: CrosslistError[] = [];

    // Group CRNs by crosslist code
    const xlistGroups = new Map<string, CRNGroup[]>();
    groups.forEach(group => {
        if (!group.xlistCode) return;
        const existing = xlistGroups.get(group.xlistCode);
        if (existing) existing.push(group);
        else xlistGroups.set(group.xlistCode, [group]);
    });

    Array.from(xlistGroups.entries()).forEach(([xlistCode, siblings]) => {
        if (siblings.length < 2) return;

        const crns = siblings.map((g: CRNGroup) => g.crn);
        const primary = siblings[0];
        const primaryFaculty = primary.rows[0]?.cells[COL.FACULTY] || '';
        const primaryBldg = primary.rows[0]?.cells[COL.BLDG] || '';
        const primaryRm = primary.rows[0]?.cells[COL.RM] || '';

        // Check faculty and room consistency
        for (let i = 1; i < siblings.length; i++) {
            const sib = siblings[i];
            const sibFaculty = sib.rows[0]?.cells[COL.FACULTY] || '';
            const sibBldg = sib.rows[0]?.cells[COL.BLDG] || '';
            const sibRm = sib.rows[0]?.cells[COL.RM] || '';

            if (sibFaculty !== primaryFaculty) {
                errors.push({
                    xlistCode,
                    crns,
                    message: `Faculty mismatch in crosslist ${xlistCode}: CRN ${primary.crn} has "${primaryFaculty}", CRN ${sib.crn} has "${sibFaculty}".`
                });
                break;
            }
            if (sibBldg !== primaryBldg || sibRm !== primaryRm) {
                errors.push({
                    xlistCode,
                    crns,
                    message: `Room mismatch in crosslist ${xlistCode}: CRN ${primary.crn} has ${primaryBldg} ${primaryRm}, CRN ${sib.crn} has ${sibBldg} ${sibRm}.`
                });
                break;
            }
        }

        // Check unit consistency across crosslist
        const unitSets: string[] = [];
        for (const sib of siblings) {
            const match = lookupCourse(catalogIndex, sib.sub, sib.num);
            if (!match) continue;
            const lecRange = getUnitRange(match.course.lec);
            const labRange = getUnitRange(match.course.lab);
            unitSets.push(`${lecRange.min}-${lecRange.max}|${labRange.min}-${labRange.max}|${match.course.lecHours ?? ''}|${match.course.labHours ?? ''}`);
        }

        if (unitSets.length > 1) {
            const allSame = unitSets.every(u => u === unitSets[0]);
            if (!allSame) {
                errors.push({
                    xlistCode,
                    crns,
                    message: `Crosslist courses don't match units in crosslist ${xlistCode}.`
                });
            }
        }
    });

    return errors;
}

export function buildCrosslistMap(groups: CRNGroup[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const group of groups) {
        if (!group.xlistCode) continue;
        if (!map.has(group.xlistCode)) {
            map.set(group.xlistCode, group.crn);
        }
    }
    return map;
}
