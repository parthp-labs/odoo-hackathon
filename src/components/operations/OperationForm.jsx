import React from 'react';

export default function OperationForm({ operation, isReadOnly = false }) {
  return (
    <div className="bg-white shadow sm:rounded-lg border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Partner (Vendor/Customer)</label>
          <input
            type="text"
            disabled={isReadOnly}
            defaultValue={operation?.partner_name || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Source Location</label>
          <select 
            disabled={isReadOnly}
            defaultValue={operation?.source_location?._id || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value={operation?.source_location?._id}>{operation?.source_location?.name || 'Select Location'}</option>
            {/* Populate with actual locations later */}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Destination Location</label>
          <select 
            disabled={isReadOnly}
            defaultValue={operation?.destination_location?._id || ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value={operation?.destination_location?._id}>{operation?.destination_location?.name || 'Select Location'}</option>
            {/* Populate with actual locations later */}
          </select>
        </div>

      </div>
    </div>
  );
}