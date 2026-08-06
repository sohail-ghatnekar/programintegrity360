import { useState } from 'react';

interface StartApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationFilePath: string;
  setApplicationFilePath: (value: string) => void;
  caseWorkerEmail: string;
  setCaseWorkerEmail: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
  sdk: any; // UiPath SDK instance
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
}

export const StartApplicationModal = ({
  isOpen,
  onClose,
  applicationFilePath,
  setApplicationFilePath,
  caseWorkerEmail,
  setCaseWorkerEmail,
  onSubmit,
  isLoading,
  error,
  sdk,
  uploadedFile,
  setUploadedFile,
}: StartApplicationModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingApplication, setDownloadingApplication] = useState<string | null>(null);

  const BUCKET_ID = 56094;
  const FOLDER_ID = 1930361;

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isLoading) {
      setUploadedFile(null);
      onClose();
    }
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (pdfFile) {
      setUploadedFile(pdfFile);
      setApplicationFilePath(pdfFile.name);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFile = files[0];

    if (pdfFile && pdfFile.type === 'application/pdf') {
      setUploadedFile(pdfFile);
      setApplicationFilePath(pdfFile.name.replace(/\.pdf.*$/i, '.pdf'));
    }
  };

  const handleSampleSelection = (filePath: string) => {
    setUploadedFile(null);
    setApplicationFilePath(filePath);
  };

  const handleDownloadApplication = async (applicantName: string) => {
    try {
      setDownloadingApplication(applicantName);
      const sampleFilePath = `/${applicantName}-MO.pdf`;
      const response = await sdk.buckets.getReadUri({
        bucketId: BUCKET_ID,
        folderId: FOLDER_ID,
        path: sampleFilePath,
      });

      const uri = response.Uri || response.uri;
      if (uri) {
        window.open(uri, '_blank');
      }
    } catch (err) {
      console.error(`Error downloading application ${applicantName}:`, err);
    } finally {
      setDownloadingApplication(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shrink-0">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            Start New Application
          </h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto min-h-0">
          {/* File Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Application (Optional)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileInputChange}
                disabled={isLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center">
                {uploadedFile ? (
                  <>
                    <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">
                      Drop your application PDF here or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF files only</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Download Sample Applications */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Download Sample Applications</label>
            <div className="flex gap-2">
              {[
                { label: 'Adrian', filePath: 'Adrian-MO.pdf' },
                { label: 'Brianna', filePath: 'Brianna-MO.pdf' },
                { label: 'Caroline', filePath: 'Caroline-MO.pdf' },
              ].map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => handleDownloadApplication(sample.label)}
                  disabled={isLoading || downloadingApplication !== null}
                  className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg border border-blue-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  type="button"
                >
                  {downloadingApplication === sample.label ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {sample.label}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Application File Path */}
          <div className="mb-6">
            <label htmlFor="applicationFilePath" className="block text-sm font-medium text-gray-700 mb-2">
              Application File Path
            </label>
            <div className="mt-3">
              <div className="flex gap-2">
              {[
                { label: 'Adrian', filePath: 'Adrian-MO.pdf' },
                { label: 'Brianna', filePath: 'Brianna-MO.pdf' },
                { label: 'Caroline', filePath: 'Caroline-MO.pdf' },
              ].map((sample) => (
                <button
                  key={`prefill-${sample.label}`}
                  type="button"
                  onClick={() => handleSampleSelection(sample.filePath)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg border border-blue-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {sample.label}
                </button>
              ))}
              </div>
            </div>
            <input
              id="applicationFilePath"
              type="text"
              value={applicationFilePath}
              onChange={(e) => setApplicationFilePath(e.target.value)}
              placeholder="e.g., Adrian-MO.pdf"
              disabled={isLoading}
              className="mt-3 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-2 text-xs text-gray-500">
              Choose a sample above or enter an existing bucket file such as <code>Adrian-MO.pdf</code>, or upload a file to replace it
            </p>
          </div>

          {/* Caseworker Email */}
          <div className="mb-6">
            <label htmlFor="caseWorkerEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Caseworker Email
            </label>
            <input
              id="caseWorkerEmail"
              type="email"
              value={caseWorkerEmail}
              onChange={(e) => setCaseWorkerEmail(e.target.value)}
              placeholder="caseworker@agency.gov"
              disabled={isLoading}
              autoComplete="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-2 text-xs text-gray-500">Enter the caseworker email address for this application</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={isLoading || !applicationFilePath || !caseWorkerEmail}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                  Start Process
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
