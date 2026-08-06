import { useOptionalAuth } from '../hooks/useAuth';
import { getLogoUrls } from '../utils/logoUtils';
import { LoginInstructions } from './ui/LoginInstructions';

export interface LoginScreenProps {
  customerLogo?: string;
  customerName?: string;
  appName?: string;
  appDescription?: string;
  systemFeatures?: string[];
  detailedDescription?: string;
  configurationError?: string | null;
}

export const LoginScreen = ({
  customerLogo,
  customerName = 'UiPath',
  appName = 'Application Dashboard',
  appDescription = 'Automated Workflow Management',
  systemFeatures = [
    'Real-time processing tracking',
    'Document verification status',
    'Automated processing workflows',
    'Analytics and reporting',
  ],
  detailedDescription,
  configurationError,
}: LoginScreenProps = {}) => {
  const auth = useOptionalAuth();
  const { uipathLogoSrc } = getLogoUrls();
  const visibleError = configurationError || auth?.error || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center">
            {/* Only show customer logo if provided */}
            {customerLogo && (
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-full">
                  <div className="flex items-center">
                    <img
                      src={customerLogo}
                      alt={customerName}
                      className="h-28 w-auto object-contain"
                      onError={(e) => {
                        console.error('Failed to load customer logo:', customerLogo);
                        // Hide the image if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            <h2 className="text-3xl font-bold text-gray-900">{appName}</h2>
            <p className="text-gray-600 mt-2">{appDescription}</p>
          </div>

          {/* Description */}
          {detailedDescription && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-700">
                {detailedDescription}
              </p>
            </div>
          )}

          {/* Error Message */}
          {visibleError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{visibleError}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={() => {
              void auth?.login();
            }}
            disabled={auth?.isLoading || Boolean(configurationError)}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {auth?.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="text-white">Login with UiPath</span>
              </>
            )}
          </button>

          {/* UiPath Logo */}
          <div className="flex justify-center pt-4 border-t border-gray-100">
            <div className="bg-white p-3 rounded-lg">
              <img
                src={uipathLogoSrc}
                alt="UiPath"
                className="h-28 w-auto object-contain"
              />
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs text-gray-500 pt-2">
            <p>Powered by UiPath TypeScript SDK</p>
            <p className="mt-1">Secure access for authorized users only</p>
          </div>
        </div>

        
        {/* Login Instructions - Collapsible */}
        <LoginInstructions />

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">System Features</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              {systemFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
