import { useAuth } from '../hooks/useAuth';

export const Header = () => {
  const { isAuthenticated, logout } = useAuth();
 

  return (
    <header className="bg-usda-green shadow-lg border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">SNAP Benefits Applications Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-white">Connected</span>
                </div>
                <button
                  onClick={logout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            )}
            {/* UiPath Logo */}
            <div className="flex items-center px-3 py-1 rounded-lg">
              <img
                src={"https://companieslogo.com/img/orig/PATH.D-e3f55f9c.png?t=1757051310"}
                alt="UiPath"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};