// src/components/CoursePicker.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, BookOpen, ArrowLeft, X } from 'lucide-react';
import { CatalogHierarchy, Course } from '../hooks/useCatalog';
import './CoursePicker.css';

interface CoursePickerProps {
  catalog: CatalogHierarchy;
  divisions: Record<string, string>;
  departments: Record<string, string>;
  onSelect: (subject: string, course: Course) => void;
  onClear?: () => void;
  selectedCourse?: { sub: string, no: string, title?: string } | null;
}

type ViewState = 'divisions' | 'departments' | 'subjects' | 'courses';

const CoursePicker: React.FC<CoursePickerProps> = ({ catalog, divisions, departments, onSelect, onClear, selectedCourse }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setViewState] = useState<ViewState>('divisions');
  const [selectedDiv, setSelectedDiv] = useState<string | null>(null);
  const [selectedDpt, setSelectedDpt] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to top on mobile when opened
  useEffect(() => {
    if (isOpen && window.innerWidth <= 768) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 50);
    }
  }, [isOpen]);

  // Search Logic (Global search across all levels)
  const searchResults = useMemo(() => {
    if (search.length < 2) return [];
    const results: { sub: string, course: Course }[] = [];
    const searchLower = search.toLowerCase();

    Object.entries(catalog).forEach(([div, dpts]) => {
      Object.entries(dpts).forEach(([dpt, subs]) => {
        Object.entries(subs).forEach(([sub, courses]) => {
          courses.forEach(c => {
            // Combined string for smart matching (e.g. "ENGL 101 Freshman Comp")
            const fullString = `${sub} ${c.no} ${c.title || ''}`.toLowerCase();

            if (fullString.includes(searchLower)) {
              results.push({ sub, course: c });
            }
          });
        });
      });
    });
    return results.slice(0, 50); // Limit results for performance
  }, [catalog, search]);

  const handleSelect = (sub: string, course: Course) => {
    onSelect(sub, course);
    setIsOpen(false);
    setSearch('');
    resetSelection(); // Reset the picker state for next open
  };

  const resetSelection = () => {
    setViewState('divisions');
    setSelectedDiv(null);
    setSelectedDpt(null);
    setSelectedSub(null);
  };

  const triggerLabel = useMemo(() => {
    if (selectedCourse) {
      return `${selectedCourse.sub} ${selectedCourse.no}`;
    }
    return 'Select Course...';
  }, [selectedCourse]);

  return (
    <div className="course-picker-container" ref={containerRef}>
      <div className="picker-trigger-wrapper">
        <button
          className="picker-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <div className="picker-trigger-content">
            <BookOpen size={14} />
            <span>{triggerLabel}</span>
          </div>
        </button>
        {selectedCourse && onClear && (
          <button
            className="picker-clear-btn"
            onClick={(e) => { e.stopPropagation(); onClear(); setIsOpen(false); }}
            title="Clear saved course"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="picker-popover"
          >
            <div className="picker-search-box">
              <Search size={16} />
              <input
                placeholder="Search subject or course number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="picker-content">
              {search.length >= 2 ? (
                <div className="picker-list">
                  {searchResults.map((res, i) => (
                    <button key={i} className="picker-item course" onClick={() => handleSelect(res.sub, res.course)}>
                      <div className="course-identity">
                        <strong>{res.sub} {res.course.no}</strong>
                        {res.course.title && <span>{res.course.title}</span>}
                      </div>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {searchResults.length === 0 && <div className="no-results">No courses found</div>}
                </div>
              ) : (
                <>
                  {/* Breadcrumb / Back button */}
                  <div className="picker-breadcrumb">
                    {view !== 'divisions' && (
                      <button onClick={() => {
                        if (view === 'departments') setViewState('divisions');
                        if (view === 'subjects') setViewState('departments');
                        if (view === 'courses') setViewState('subjects');
                      }}>
                        <ArrowLeft size={14} /> Back
                      </button>
                    )}
                    <span>{view.toUpperCase()}</span>
                  </div>

                  <div className="picker-list">
                    {view === 'divisions' && Object.keys(catalog)
                      .sort((a, b) => (divisions[a] || a).localeCompare(divisions[b] || b))
                      .map(div => (
                        <button key={div} className="picker-item" onClick={() => { setSelectedDiv(div); setViewState('departments'); }}>
                          <span>{divisions[div] || div}</span>
                          <ChevronRight size={14} />
                        </button>
                      ))}

                    {view === 'departments' && selectedDiv && Object.keys(catalog[selectedDiv] || {})
                      .sort((a, b) => (departments[a] || a).localeCompare(departments[b] || b))
                      .map(dpt => (
                        <button key={dpt} className="picker-item" onClick={() => { setSelectedDpt(dpt); setViewState('subjects'); }}>
                          <span>{departments[dpt] || dpt}</span>
                          <ChevronRight size={14} />
                        </button>
                      ))}

                    {view === 'subjects' && selectedDiv && selectedDpt && Object.keys(catalog[selectedDiv][selectedDpt] || {})
                      .sort((a, b) => a.localeCompare(b))
                      .map(sub => (
                        <button key={sub} className="picker-item" onClick={() => { setSelectedSub(sub); setViewState('courses'); }}>
                          <span>{sub}</span>
                          <ChevronRight size={14} />
                        </button>
                      ))}

                    {view === 'courses' && selectedDiv && selectedDpt && selectedSub && (catalog[selectedDiv][selectedDpt][selectedSub] || [])
                      .sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true, sensitivity: 'base' }))
                      .map(course => (
                        <button key={course.no} className="picker-item course" onClick={() => handleSelect(selectedSub, course)}>
                          <div className="course-identity">
                            <strong>{selectedSub} {course.no}</strong>
                            {course.title && <span>{course.title}</span>}
                          </div>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CoursePicker;
