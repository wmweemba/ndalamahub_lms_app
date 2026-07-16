export function AuthLayout({ children }) {
  return (
    <div className="bg-[--background] min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 bg-[--card] rounded-2xl border border-[--border]">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/brand/svg/NdalamaHub-lockup-stacked.svg"
            alt="NdalamaHub"
            className="h-24"
          />
          <p className="text-[--muted-foreground] mt-2">Sign in to your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}
