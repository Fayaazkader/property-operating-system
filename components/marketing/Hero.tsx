"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import ScreenshotFrame from "@/components/ui/ScreenshotFrame";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#050505] pt-44">

      {/* Ambient Light */}

      <div className="absolute left-1/2 top-60 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[180px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="mx-auto max-w-5xl text-center"
        >

          <p className="text-sm uppercase tracking-[0.4em] text-zinc-500">

            Commercial Property Operating System

          </p>

          <h1 className="mt-8 text-6xl font-semibold tracking-[-0.06em] text-white md:text-8xl xl:text-[7rem]">

            Commercial property.

            <br />

            Finally connected.

          </h1>

          <p className="mx-auto mt-10 max-w-3xl text-xl leading-9 text-zinc-400">

            Leasing.

            Finance.

            Operations.

            Accounting.

            Reporting.

            Intelligence.

            <br />

            Built into one operating system.

          </p>

          <div className="mt-14 flex flex-wrap justify-center gap-5">

            <Link
              href="/contact"
              className="rounded-full bg-white px-8 py-4 font-medium text-black transition hover:scale-[1.02]"
            >
              Request Demo
            </Link>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-8 py-4 text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              View Pricing

              <ArrowRight size={17} />

            </Link>

          </div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .35, duration: 1.2 }}
          className="relative mx-auto mt-24 max-w-[1500px]"
        >

          <ScreenshotFrame
            src="/screenshots/morning-brief.png"
            alt="Morning Brief"
          />

        </motion.div>

      </div>

    </section>
  );
}
