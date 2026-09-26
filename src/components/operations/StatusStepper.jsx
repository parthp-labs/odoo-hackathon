import React from 'react';

const STEPS = ['Draft', 'Waiting', 'Ready', 'Done'];

export default function StatusStepper({ currentStatus }) {
  const currentIndex = STEPS.findIndex(s => s.toLowerCase() === currentStatus?.toLowerCase());

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step} className={`relative ${index !== STEPS.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className={`h-0.5 w-full ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
                <div className={`h-3 w-3 rounded-full ${
                  isCompleted ? 'bg-blue-600' : isCurrent ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-gray-300'
                }`} />
              </div>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}