// src/hooks/useSections.ts
import { useState, useEffect, useCallback } from 'react';
import { SavedSection } from '../types';

const SAVED_SECTIONS_KEY = 'cs-app-saved-sections';



export function useSections() {
  const [savedSections, setSavedSections] = useState<SavedSection[]>(() => {
    const saved = localStorage.getItem(SAVED_SECTIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(SAVED_SECTIONS_KEY, JSON.stringify(savedSections));
  }, [savedSections]);

  const saveSection = useCallback((data: Omit<SavedSection, 'id' | 'name' | 'timestamp'> & { name?: string }, asNew: boolean = false) => {
    const isUpdating = !asNew && currentSectionId;

    const newSection: SavedSection = {
      ...data,
      id: isUpdating ? currentSectionId! : Date.now().toString(),
      name: data.name || (isUpdating
        ? (savedSections.find(s => s.id === currentSectionId)?.name || 'New Section')
        : `Section ${savedSections.length + 1}`),
      timestamp: Date.now()
    };

    if (isUpdating) {
      setSavedSections(prev => prev.map(s => s.id === currentSectionId ? newSection : s));
    } else {
      setSavedSections(prev => [newSection, ...prev]);
      setCurrentSectionId(newSection.id);
    }
  }, [currentSectionId, savedSections]);

  const deleteSection = useCallback((id: string) => {
    setSavedSections(prev => prev.filter(s => s.id !== id));
    if (currentSectionId === id) setCurrentSectionId(null);
  }, [currentSectionId]);

  const renameSection = useCallback((id: string, newName: string) => {
    setSavedSections(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  }, []);

  const reorderSections = useCallback((newOrder: SavedSection[]) => {
    setSavedSections(newOrder);
  }, []);

  const importSections = useCallback((sections: SavedSection[]) => {
    setSavedSections(sections);
    setCurrentSectionId(null);
  }, []);

  const clearAllSections = useCallback(() => {
    setSavedSections([]);
    setCurrentSectionId(null);
  }, []);

  return {
    savedSections,
    currentSectionId,
    setCurrentSectionId,
    saveSection,
    deleteSection,
    renameSection,
    reorderSections,
    importSections,
    clearAllSections
  };
}
