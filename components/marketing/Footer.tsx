import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-20">

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 px-6 lg:flex-row">

        <div>

          <Image
            src="/logos/assetflow-logo.png"
            alt="AssetFlow"
            width={180}
            height={48}
            className="h-10 w-auto"
          />

          <p className="mt-6 max-w-md text-zinc-500 leading-8">

            Commercial property.
            Finally connected.

          </p>

        </div>

        <div className="flex flex-wrap gap-10 text-sm text-zinc-500">

          <Link href="/pricing">Pricing</Link>

          <Link href="/security">Security</Link>

          <Link href="/about">Company</Link>

          <Link href="/contact">Contact</Link>

          <Link href="/login">Sign In</Link>

        </div>

      </div>

      <div className="mx-auto mt-16 max-w-7xl border-t border-white/10 pt-10 px-6 text-sm text-zinc-600">

        © {new Date().getFullYear()} AssetFlow. All rights reserved.

      </div>

    </footer>
  );
}
