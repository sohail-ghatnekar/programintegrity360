import { useState, useMemo } from 'react';
import type { ProcessedClaim } from '../hooks/useClaims';

interface ClaimsDataGridProps {
  claims: ProcessedClaim[];
  onClaimSelect?: (claim: ProcessedClaim) => void;
  selectedClaim?: ProcessedClaim | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  sdk?: any;
}

type SortField = 'applicantName' | 'eligibilityStatus' | 'addressVerifiedFlag' | 'incomeVerifiedFlag' | 'caseWorkerName' | 'applicationCreationTime';
type SortDirection = 'asc' | 'desc';

const PROCESS_KEY = import.meta.env.VITE_MAESTRO_PROCESS_KEY || 'd0d245fb-a685-4784-9320-5de1601d3463';
const DEFAULT_FOLDER_KEY = import.meta.env.VITE_MAESTRO_FOLDER_KEY || '88686c50-0dff-4b68-a7d9-77e4ef9db33b';

function renderVerificationIcon(state: ProcessedClaim['addressVerificationState']) {
  if (state === 'loading') {
    return (
      <span className="inline-flex items-center justify-center text-gray-400">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      </span>
    );
  }

  if (state === 'verified') {
    return (
      <span className="inline-flex items-center justify-center text-green-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (state === 'manual-review') {
    return (
      <span className="inline-flex items-center justify-center text-yellow-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.487 0l6.518 11.596c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center text-red-600">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export const ClaimsDataGrid = ({ claims, onClaimSelect, selectedClaim: _selectedClaim, onRefresh, isRefreshing, sdk: _sdk }: ClaimsDataGridProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('applicationCreationTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addressVerifiedFilter, setAddressVerifiedFilter] = useState<string>('all');
  const [incomeVerifiedFilter, setIncomeVerifiedFilter] = useState<string>('all');

  // Open Maestro process in new tab
  const openMaestroProcess = (claim: ProcessedClaim, e: React.MouseEvent) => {
    e.stopPropagation();
    const maestroKey = claim.rawData.maestroProcessInstanceKey;
    const folderId = claim.rawData.FolderId;
    const folderKey = typeof folderId === 'string' && folderId.includes('-')
      ? folderId
      : DEFAULT_FOLDER_KEY;

    if (!maestroKey || !folderKey) {
      console.error('Missing maestroProcessInstanceKey or FolderId');
      return;
    }

    const url = `https://staging.uipath.com/uipathlabs/Playground/maestro_/processes/${PROCESS_KEY}/instances/${maestroKey}?folderKey=${folderKey}`;
    window.open(url, '_blank');
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort claims
  const filteredAndSortedClaims = useMemo(() => {
    let filtered = claims;

    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        claim =>
          claim.applicantName.toLowerCase().includes(lowerSearch) ||
          claim.caseWorkerName.toLowerCase().includes(lowerSearch) ||
          claim.eligibilityStatus.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(claim => claim.eligibilityStatus === statusFilter);
    }

    // Apply address verified filter
    if (addressVerifiedFilter !== 'all') {
      const isVerified = addressVerifiedFilter === 'true';
      filtered = filtered.filter(claim => (claim.addressVerificationState === 'verified') === isVerified);
    }

    // Apply income verified filter
    if (incomeVerifiedFilter !== 'all') {
      const isVerified = incomeVerifiedFilter === 'true';
      filtered = filtered.filter(claim => (claim.incomeVerificationState === 'verified') === isVerified);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date sorting
      if (sortField === 'applicationCreationTime') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle boolean sorting
      if (typeof aValue === 'boolean') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      }

      // Handle string sorting
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [claims, searchTerm, sortField, sortDirection, statusFilter, addressVerifiedFilter, incomeVerifiedFilter]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Generate random state for each claim
  const getRandomState = (claimId: string) => {
    const states = ['CA', 'NY', 'TX', 'FL', 'MO', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ'];
    // Use claim ID to generate consistent state for each claim
    const hash = claimId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return states[hash % states.length];
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Denied':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Under Review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div>
      {/* Filters and Search */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search by name, caseworker, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full lg:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Denied">Denied</option>
              <option value="Under Review">Under Review</option>
            </select>
          </div>

          {/* Address Verified Filter */}
          <div className="w-full lg:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={addressVerifiedFilter}
              onChange={(e) => setAddressVerifiedFilter(e.target.value)}
            >
              <option value="all">All Addresses</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>

          {/* Income Verified Filter */}
          <div className="w-full lg:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={incomeVerifiedFilter}
              onChange={(e) => setIncomeVerifiedFilter(e.target.value)}
            >
              <option value="all">All Income</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh data"
            >
              <svg
                className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredAndSortedClaims.length} of {claims.length} applications
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('applicantName')}
              >
                <div className="flex items-center space-x-1">
                  <span>Applicant Name</span>
                  <SortIcon field="applicantName" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('eligibilityStatus')}
              >
                <div className="flex items-center space-x-1">
                  <span>Eligibility Status</span>
                  <SortIcon field="eligibilityStatus" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                State
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('addressVerifiedFlag')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Address Verified</span>
                  <SortIcon field="addressVerifiedFlag" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('incomeVerifiedFlag')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Income Verified</span>
                  <SortIcon field="incomeVerifiedFlag" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('caseWorkerName')}
              >
                <div className="flex items-center space-x-1">
                  <span>Caseworker</span>
                  <SortIcon field="caseWorkerName" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('applicationCreationTime')}
              >
                <div className="flex items-center space-x-1">
                  <span>Created</span>
                  <SortIcon field="applicationCreationTime" />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Maestro
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedClaims.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">No applications found</p>
                </td>
              </tr>
            ) : (
              filteredAndSortedClaims.map((claim) => (
                <tr
                  key={claim.id}
                  onClick={() => onClaimSelect?.(claim)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                    
                      <div>
                        <div className="text-sm font-medium text-gray-900">{claim.applicantName}</div>
                        <div className="text-xs text-gray-500">{claim.id ? claim.id.substring(0, 8) + '...' : 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        claim.eligibilityStatus
                      )}`}
                    >
                      {claim.eligibilityStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                    {getRandomState(claim.id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {renderVerificationIcon(claim.addressVerificationState)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {renderVerificationIcon(claim.incomeVerificationState)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.caseWorkerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(claim.applicationCreationTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {claim.rawData.maestroProcessInstanceKey && claim.rawData.FolderId ? (
                      <button
                        onClick={(e) => openMaestroProcess(claim, e)}
                        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 transition-all duration-200 hover:shadow-md"
                        title="Open in Maestro"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 13a5 5 0 007.42.8l.13-.13a5 5 0 000-7.08 5.01 5.01 0 00-7.07-.01l-3 3"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 11a5 5 0 00-7.42-.8l-.13.13a5 5 0 000 7.08 5.01 5.01 0 007.07.01l3-3"/>
                        </svg>
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
