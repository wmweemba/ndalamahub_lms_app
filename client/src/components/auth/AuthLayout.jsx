export function AuthLayout({ children }) {
  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          <div className="p-4 bg-gray-800 text-white rounded-full shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V5a4 4 0 0 0-4-4z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mt-4">NdalamaHub</h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}