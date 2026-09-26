import React, { useState } from 'react';
import Table from '../ui/Table';
import StatusBadge from '../ui/StatusBadge';
import { mockOperations } from '../../mocks/operations.mock';

export default function OperationList({ type, title }) {
  // In Phase 5, this will be replaced with an API call: await client.get(`/api/operations?type=${type}`)
  const [data] = useState(() => 
    mockOperations.filter(op => op.operation_type === type)
  );

  const columns = [
    { 
      header: 'Reference', 
      accessor: 'reference',
      cell: (row) => <span className="font-medium text-gray-900">{row.reference}</span>
    },
    { 
      header: 'Partner', 
      accessor: 'partner_name' 
    },
    { 
      header: 'From', 
      accessor: 'source_location',
      cell: (row) => row.source_location?.name 
    },
    { 
      header: 'To', 
      accessor: 'destination_location',
      cell: (row) => row.destination_location?.name 
    },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} /> 
    },
  ];

  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <button className="mt-3 sm:mt-0 inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
          New {title.slice(0, -1)}
        </button>
      </div>
      
      <Table 
        columns={columns} 
        data={data} 
        emptyStateTitle={`No ${title} found`}
        emptyStateMessage="Create a new operation to get started."
        onRowClick={(row) => console.log('Navigate to details:', row._id)}
      />
    </div>
  );
}