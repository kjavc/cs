// src/utils/catalogForTerm.ts
import type { CatalogHierarchy } from '../hooks/useCatalog';

import courses2526 from '../data/courses_2526.json';
import courses2627 from '../data/courses_2627.json';

// Catalogs on hand, keyed by academic year ("2526" = AY25-26).
const CATALOGS: Record<string, CatalogHierarchy> = {
    '2526': courses2526 as CatalogHierarchy,
    '2627': courses2627 as CatalogHierarchy,
};

export interface TermCatalog {
    ay: string;          // AY the term belongs to, e.g. "2728"
    catalogAy: string;   // AY of the catalog actually used, e.g. "2627"
    catalog: CatalogHierarchy;
    isFallback: boolean; // true when the term's own AY has no catalog yet
}

export const termSeason = (termId: string) => termId.slice(0, 2);
export const termYear = (termId: string) => parseInt(termId.slice(2), 10);

// Fall starts an AY; Winter, Spring, and Summer belong to the AY that began the prior fall
// (su2026 → AY25-26, su2027 → AY26-27).
export function academicYearForTerm(termId: string): string {
    const year = termYear(termId);
    const start = termSeason(termId) === 'fa' ? year : year - 1;
    const yy = (n: number) => String(n % 100).padStart(2, '0');
    return `${yy(start)}${yy(start + 1)}`;
}

export const formatAy = (ay: string) => `AY${ay.slice(0, 2)}-${ay.slice(2)}`;

export function catalogForTerm(termId: string): TermCatalog {
    const ay = academicYearForTerm(termId);
    if (CATALOGS[ay]) {
        return { ay, catalogAy: ay, catalog: CATALOGS[ay], isFallback: false };
    }
    // No catalog for this AY yet (e.g. next year's is still being built): use the
    // latest catalog that isn't newer than the term, else the earliest one.
    const available = Object.keys(CATALOGS).sort();
    const catalogAy = [...available].reverse().find(k => k <= ay) ?? available[0];
    return { ay, catalogAy, catalog: CATALOGS[catalogAy], isFallback: true };
}

export function latestCatalog(): CatalogHierarchy {
    const available = Object.keys(CATALOGS).sort();
    return CATALOGS[available[available.length - 1]];
}
