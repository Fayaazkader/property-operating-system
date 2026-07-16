import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-44">

      <div className="mx-auto max-w-5xl px-6 text-center">

        <h2 className="text-6xl font-semibold tracking-tight text-white">

          The operating system
          for commercial property.

        </h2>

        <p className="mx-auto mt-10 max-w-3xl text-xl leading-9 text-zinc-400">

          Every lease.
          Every payment.
          Every supplier.
          Every report.
          Connected.

        </p>

        <Link
          href="/contact"
          className="mt-14 inline-flex rounded-full bg-white px-10 py-5 text-black font-semibold"
        >
          Request Demo
        </Link>

      </div>

    </section>
  );
}
