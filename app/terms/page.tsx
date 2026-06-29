export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <div className="mt-8 space-y-4 text-gray-400">
          <p>By using AssetFlow, you agree to these terms. AssetFlow is provided as a software-as-a-service platform for commercial property operations.</p>
          <h2 className="text-lg font-semibold text-white mt-6">Beta Usage</h2>
          <p>During the beta period, AssetFlow is provided on an as-is basis. We appreciate your feedback and will continuously improve the platform.</p>
          <h2 className="text-lg font-semibold text-white mt-6">Data Ownership</h2>
          <p>You retain full ownership of your data. AssetFlow does not share or sell your data to third parties.</p>
          <h2 className="text-lg font-semibold text-white mt-6">Contact</h2>
          <p>For questions about these terms, contact us at hello@assetflow.africa.</p>
        </div>
      </div>
    </div>
  );
}
