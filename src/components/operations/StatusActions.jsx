import React from 'react';

export default function StatusActions({ status, onMarkReady, onValidate, onCancel }) {
  const currentStatus = status?.toLowerCase();

  return (
    <div className="flex gap-3 mt-6">
      {currentStatus === 'draft' && (
        <button 
          onClick={onMarkReady}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Mark as Ready
        </button>
      )}

      {currentStatus === 'ready' && (
        <button 
          onClick={onValidate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Validate
        </button>
      )}

      {(currentStatus === 'draft' || currentStatus === 'ready') && (
        <button 
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
      )}
    </div>
  );
}