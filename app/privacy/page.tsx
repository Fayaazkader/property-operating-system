export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <div className="mt-8 space-y-4 text-gray-400">
          <p>AssetFlow takes your privacy seriously. This policy outlines how we collect, use, and protect your data.</p>
          <h2 className="text-lg font-semibold text-white mt-6">Data Collection</h2>
          <p>We collect only the information necessary to provide our property management services — company names, contact details, and portfolio information.</p>
          <h2 className="text-lg font-semibold text-white mt-6">Data Protection</h2>
          <p>All data is encrypted at rest and in transit. We use enterprise-grade infrastructure with automated backups.</p>
          <h2 className="text-lg font-semibold text-white mt-6">POPIA Compliance</h2>
          <p>AssetFlow is built in accordance with South Africa's Protection of Personal Information Act (POPIA).</p>
          <h2 className="text-lg font-semibold text-white mt-6">Contact</h2>
          <p>For privacy-related inquiries, contact us at hello@assetflow.africa.</p>
        </div>
      </div>
    </div>
  );
}
