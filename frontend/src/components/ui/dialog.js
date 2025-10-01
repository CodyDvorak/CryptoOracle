import React from 'react';
import { X } from 'lucide-react';

export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
    >
      <div 
        className="relative bg-[var(--surface)] border border-[var(--card-border)] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className = '' }) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
};

export const DialogHeader = ({ children }) => {
  return (
    <div className="mb-4 pb-4 border-b border-[var(--card-border)]">
      {children}
    </div>
  );
};

export const DialogTitle = ({ children }) => {
  return (
    <h2 className="text-xl font-bold text-[var(--text)]">
      {children}
    </h2>
  );
};

export const DialogClose = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 p-2 rounded-md hover:bg-[var(--panel)] transition-colors"
      aria-label="Close"
    >
      <X className="w-5 h-5 text-[var(--muted)]" />
    </button>
  );
};
