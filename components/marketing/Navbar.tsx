"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const navigation = [
  {
    title: "Platform",
    href: "#platform",
  },
  {
    title: "Solutions",
    href: "#solutions",
  },
  {
    title: "Enterprise",
    href: "#enterprise",
  },
  {
    title: "Pricing",
    href: "/pricing",
  },
  {
    title: "Resources",
    href: "#resources",
  },
  {
    title: "Company",
    href: "/about",
  },
];

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">

      <div className="mx-auto max-w-7xl px-6">

        <div className="mt-6 flex h-20 items-center justify-between rounded-2xl border border-white/10 bg-black/70 px-8 backdrop-blur-3xl">

          <Link href="/" className="flex items-center">

            <Image
              src="/logos/assetflow-logo.png"
              alt="AssetFlow"
              width={185}
              height={52}
              priority
              className="h-11 w-auto"
            />

          </Link>

          <nav className="hidden xl:flex items-center gap-10">

            {navigation.map((item) => (

              <Link
                key={item.title}
                href={item.href}
                className="text-sm font-medium text-zinc-400 transition-all duration-300 hover:text-white"
              >
                {item.title}
              </Link>

            ))}

          </nav>

          <div className="flex items-center gap-4">

            <Link
              href="/login"
              className="hidden md:block text-sm text-zinc-400 transition hover:text-white"
            >
              Sign In
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02]"
            >
              Request Demo

              <ArrowRight size={16} />

            </Link>

          </div>

        </div>

      </div>

    </header>
  );
}
