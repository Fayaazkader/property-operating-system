"use client";

type Props = {
  placeholder?: string;
};

export default function SearchBar({
  placeholder = "Search leases...",
}: Props) {

  return (

    <div className="w-full">

      <input
        type="text"
        placeholder={placeholder}
        className="w-full bg-gray-100 border border-gray-200 rounded-2xl px-6 py-4 text-black outline-none focus:ring-2 focus:ring-black transition-all"
      />

    </div>
  );
}