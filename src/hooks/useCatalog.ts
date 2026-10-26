// src/hooks/useCatalog.ts
import { useMemo } from 'react';
import { catalogForTerm } from '../utils/catalogForTerm';

import metadata from '../data/catalog-metadata.json';
import { FixedHours } from '../types/section';

export interface Course {
  no: string;
  title?: string;
  lec: number | { min: number; max: number };
  lab: number | { min: number; max: number };
  // Courses listed in total contact hours instead of units (e.g. WELD 900: 1 lec + 9 lab hrs).
  // Each component meets once on a single day; the term calendar is ignored. Use sparingly.
  lecHours?: number;
  labHours?: number;
}

export function fixedHoursOf(course: Course): FixedHours | undefined {
  if (course.lecHours === undefined && course.labHours === undefined) return undefined;
  return { lec: course.lecHours ?? 0, lab: course.labHours ?? 0 };
}

export type SubjectMap = Record<string, Course[]>;
export type DeptMap = Record<string, SubjectMap>;
export type CatalogHierarchy = Record<string, DeptMap>;

export function useCatalog(selectedTermId: string) {
  // Catalog for the term's academic year; terms without one yet (AY27-28) fall back
  const catalog = useMemo(() => catalogForTerm(selectedTermId).catalog, [selectedTermId]);

  return {
    catalog,
    divisions: metadata.divisions,
    departments: metadata.departments
  };
}
