import { useState } from 'react';

export const LoginInstructions = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header - Clickable to expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-semibold text-blue-900 text-sm">
              Setup Instructions - Click to {isExpanded ? 'Collapse' : 'Expand'}
            </h3>
          </div>
          <svg
            className={`w-5 h-5 text-blue-600 transform transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Content - Collapsible */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-blue-200 pt-4">
            <p className="text-xs text-blue-800 font-medium">
              Before logging in, ensure you have completed the following setup requirements:
            </p>

            {/* Step 1 */}
            <div className="bg-white rounded-md p-3 border border-blue-100">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    Use SSO Login
                  </h4>
                  <p className="text-xs text-gray-700 mb-2">
                    Log in using Single Sign-On (SSO) to:
                  </p>
                  <a
                    href="https://staging.uipath.com/uipathlabs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    https://staging.uipath.com/uipathlabs/
                    <svg
                      className="w-3 h-3 ml-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-md p-3 border border-blue-100">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    Verify Folder Access
                  </h4>
                  <p className="text-xs text-gray-700 mb-2">
                    In the <span className="font-semibold">Playground Tenant</span>, ensure you have access to:
                  </p>
                  <div className="bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <p className="text-xs font-mono text-gray-800">
                      Amer Presales → Public Sector Folder
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-md p-3 border border-blue-100">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    Verify Data Fabric Permissions
                  </h4>
                  <p className="text-xs text-gray-700 mb-2">
                    In the <span className="font-semibold">Playground Tenant</span>, confirm you have the following permissions:
                  </p>
                  <ul className="space-y-1">
                    <li className="flex items-center text-xs text-gray-700">
                      <svg
                        className="w-3 h-3 text-green-600 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-semibold">Data Fabric Data Reader</span>
                    </li>
                    <li className="flex items-center text-xs text-gray-700">
                      <svg
                        className="w-3 h-3 text-green-600 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-semibold">Data Fabric Data Writer</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-start space-x-2">
                <svg
                  className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-xs text-yellow-800 font-medium mb-1">
                    Need Help?
                  </p>
                  <p className="text-xs text-yellow-700">
                    If you don't have the required access or permissions, contact your UiPath administrator or tenant owner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
