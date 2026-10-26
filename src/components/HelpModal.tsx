import React, { useState, useEffect } from 'react';
import { X, Save, Edit2, Copy, ExternalLink, Table, Share2, Clock, CalendarDays } from 'lucide-react';

import './HelpModal.css';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: "How do I start scheduling?",
    answer: "Use the Course Catalog to pick a course, or enter units manually in the Configuration panel above. The calendar will update instantly as you make changes to units, days, or times."
  },
  {
    question: "How do I save my work?",
    answer: (
      <>
        Once you’re happy with a schedule, click the <strong><Save size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /> Save Section</strong> button in the top toolbar to stash it in the sidebar. It will automatically be assigned an intelligent name based on the subject and course number.
      </>
    )
  },
  {
    question: "Can I see multiple sections at once?",
    answer: "Yes! Use the check circles on the left side of your saved sections in the sidebar. Selected sections will appear as semi-transparent 'ghost' blocks on the calendar, allowing you to visually detect overlaps and conflicts."
  },
  {
    question: "What does the dot next to a section name mean?",
    answer: "A small dot next to the section name indicates unsaved changes. It means you’ve loaded a section and tweaked its configuration, but haven't clicked 'Update Section' to push your changes to the saved copy."
  },
  {
    question: "How do I reorder or rename my sections?",
    answer: (
      <>
        Hover over a section in the sidebar to see the <strong><Edit2 size={12} style={{ display: 'inline', verticalAlign: '-1px', margin: '0 2px' }} /></strong> icon for renaming. To reorder, use the <strong>⠿</strong> drag handle on the left of the section pill and slide it to a new position.
      </>
    )
  },
  {
    question: "How do I set different start times for each day?",
    answer: (
      <>
        In the <strong>Start Times</strong> area, click the <strong><Clock size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> icon next to Lecture or Lab to switch from a single shared start time to per-day start times. Each meeting day gets its own time picker. Click the <strong><CalendarDays size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> icon again to switch back to a shared time. You must first unlock separate Lab times (the lock icon) before you can set per-day Lab times.
      </>
    )
  },
  {
    question: "Can I split meeting time unevenly across days?",
    answer: "If a component (lecture or lab) meets on 2 or more days, a \"Custom Split\" button appears below the units and days area. Click it to set a different end time for each day — for example, a shorter meeting on Monday and a longer one on Wednesday. The app shows the contact hours for each day and a running total so you can balance them. Each day must have at least 1.0 contact hour. If the math doesn't work for your unit/day combination, the button will say \"unavailable\" and explain why."
  },
  {
    question: "Can I move meetings by dragging on the calendar?",
    answer: "Yes! Once a schedule is on the grid, you can click and drag any block to change its start time. A normal drag moves all days for that component together. Hold Shift while dragging to move just one day independently (this enables per-day start times). The block snaps to 5-minute increments. If you drag it over another block on the same day, it will turn red — you need at least a 10-minute gap between lecture and lab."
  },
  {
    question: "What are TBA Hours?",
    answer: "TBA (To Be Announced) hours represent contact time that hasn't been assigned to a specific meeting pattern yet. When you add TBA hours to a lecture or lab component, they are subtracted from that component's total required contact hours — the remaining hours are what get applied to your scheduled days and times on the calendar. Lecture and lab TBA hours are tracked independently of each other."
  },
  {
    question: "How do I export my data?",
    answer: (
      <>
        To export a single section, use the <strong><Copy size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /> Copy</strong> split-button in the toolbar. To export every section in your sidebar at once, click the <strong><ExternalLink size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> (Details) or <strong><Table size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> (Spreadsheet) icons at the very top of the sidebar header. To share your entire schedule with someone or transfer it to another device, use the <strong><Share2 size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> Share Link button.
      </>
    )
  },
  {
    question: "How do I transfer my sections to another device?",
    answer: (
      <>
        Click the <strong><Share2 size={14} style={{ display: 'inline', verticalAlign: '-2px', margin: '0 2px' }} /></strong> Share Link button in the sidebar header. This copies a URL containing all your saved sections. Open that link on any device or browser to import them instantly — no account needed. You can also send the link to a colleague so they can view your schedule.
      </>
    )
  }
];

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Help & FAQ</h2>
          <button onClick={onClose} className="settings-close-btn" aria-label="Close">
            <X size={20} />
          </button>
        </div>


        <div className="faq-container">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button
                className="faq-question"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <span>{faq.question}</span>
                <span>{expandedIndex === index ? '−' : '+'}</span>
              </button>
              {expandedIndex === index && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          Need more help? Contact the Academic Affairs office.
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
