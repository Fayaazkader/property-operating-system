import SigningClient from './signing-client';

export const dynamic = 'force-dynamic';

type SigningPageProps = {
  params: Promise<{ token: string }>;
};

export default async function SigningPage({ params }: SigningPageProps) {
  if (
    process.env.EXECUTION_PUBLIC_SIGNING_ENABLED !== 'true' ||
    process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true'
  ) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">
            Secure signing temporarily unavailable
          </h1>
          <p className="mt-3 text-sm">
            Please contact your leasing manager.
            Your agreement has not been signed.
          </p>
        </div>
      </main>
    );
  }

  const { token } = await params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <main className="p-6">Invalid signing invitation.</main>;
  }

  return <SigningClient token={token} />;
}
