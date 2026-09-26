import React from 'react';
import Loader from './Loader';
import EmptyState from './EmptyState';

export default function Table({ 
  columns, 
  data, 
  isLoading = false, 
  emptyStateTitle = "No data found",
  emptyStateMessage = "Get started by creating a new record.",
  onRowClick
}) {
  if (isLoading) return <Loader size="lg" />;
  
  if (!data || data.length === 0) {
    return <EmptyState title={emptyStateTitle} message={emptyStateMessage} />;
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((row, rowIndex) => (
            <tr 
              key={row._id || rowIndex} 
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                  {col.cell ? col.cell(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}