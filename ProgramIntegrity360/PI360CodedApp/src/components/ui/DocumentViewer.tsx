import { useState, useEffect } from 'react';

interface DocumentViewerProps {
  documentUrl?: string;
  loading: boolean;
  error: string | null;
  title: string;
  subtitle: string;
}

export const DocumentViewer = ({ documentUrl, loading, error, title }: DocumentViewerProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!documentUrl) {
      setBlobUrl(null);
      return;
    }

    let objectUrl: string | null = null;

    const fetchPdfAsBlob = async () => {
      try {
        setIsFetching(true);
        setFetchError(null);

        const response = await fetch(documentUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const blob = await response.blob();
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(objectUrl);
      } catch (err) {
        console.error('Error fetching PDF:', err);
        setFetchError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsFetching(false);
      }
    };

    fetchPdfAsBlob();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentUrl]);

  const isLoading = loading || isFetching;
  const displayError = error || fetchError;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
          </div>
        ) : displayError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{displayError}</p>
          </div>
        ) : blobUrl ? (
          <iframe src={blobUrl} className="w-full h-[800px] border border-gray-300 rounded" title={title} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No {title.toLowerCase()} available</p>
          </div>
        )}
      </div>
    </div>
  );
};
