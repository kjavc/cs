import { Course, CatalogHierarchy } from '../hooks/useCatalog';

export interface CatalogMatch {
    course: Course;
    division: string;
    department: string;
    subject: string;
}

export function buildCatalogIndex(catalog: CatalogHierarchy): Map<string, CatalogMatch> {
    const index = new Map<string, CatalogMatch>();

    for (const [division, departments] of Object.entries(catalog)) {
        for (const [department, subjects] of Object.entries(departments)) {
            for (const [subject, courses] of Object.entries(subjects)) {
                for (const course of courses as Course[]) {
                    const key = `${subject.toUpperCase()}|${course.no}`;
                    if (!index.has(key)) {
                        index.set(key, { course, division, department, subject });
                    }
                }
            }
        }
    }

    return index;
}

export function lookupCourse(
    index: Map<string, CatalogMatch>,
    sub: string,
    num: string
): CatalogMatch | null {
    const key = `${sub.toUpperCase().trim()}|${num.trim()}`;
    return index.get(key) || null;
}

export function getFixedUnits(value: number | { min: number; max: number }): number | null {
    if (typeof value === 'number') return value;
    return null;
}

export function getUnitRange(value: number | { min: number; max: number }): { min: number; max: number } {
    if (typeof value === 'number') return { min: value, max: value };
    return value;
}
