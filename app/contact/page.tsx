export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center text-white">
      <h1 className="text-3xl font-bold">Contact Us</h1>
      <p className="mt-6 text-lg text-gray-400">
        Interested in AssetFlow? Have questions about beta access?
      </p>
      <div className="mt-8 space-y-3 text-gray-400">
        <p>Email: <a href="mailto:hello@assetflow.africa" className="text-white hover:underline">hello@assetflow.africa</a></p>
        <p>Or fill in the <a href="/#beta" className="text-white hover:underline">beta access form</a> and we'll reach out.</p>
      </div>
    </div>
  );
}
