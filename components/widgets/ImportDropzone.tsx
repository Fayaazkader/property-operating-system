"use client";

type ImportDropzoneProps = {
  title: string;

  description: string;

  loading?: boolean;

  fileName?: string;

  onFileSelect: (
    file: File
  ) => void;
};

export default function ImportDropzone({
  title,
  description,
  loading,
  fileName,
  onFileSelect,
}: ImportDropzoneProps) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-dashed
        border-zinc-700
        bg-zinc-900
        p-10
        transition-all
        hover:border-zinc-500
      "
    >
      <div className="max-w-2xl">

        <p
          className="
            text-sm
            uppercase
            tracking-[0.25em]
            text-zinc-500
          "
        >
          Import Pipeline
        </p>

        <h2
          className="
            mt-3
            text-3xl
            font-black
            text-white
          "
        >
          {title}
        </h2>

        <p
          className="
            mt-4
            text-zinc-400
            leading-7
          "
        >
          {description}
        </p>

        <div className="mt-8">

          <label
            className="
              inline-flex
              cursor-pointer
              items-center
              rounded-2xl
              bg-white
              px-6
              py-4
              text-sm
              font-bold
              text-black
              transition-all
              hover:scale-[1.02]
            "
          >
            Select CSV File

            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file =
                  event.target
                    .files?.[0];

                if (!file) {
                  return;
                }

                onFileSelect(file);
              }}
            />
          </label>

        </div>

        {fileName && (
          <div
            className="
              mt-6
              rounded-2xl
              border
              border-zinc-800
              bg-black
              p-4
            "
          >
            <p className="text-sm text-zinc-400">
              Selected File
            </p>

            <p className="mt-1 font-semibold text-white">
              {fileName}
            </p>
          </div>
        )}

        {loading && (
          <div
            className="
              mt-6
              rounded-2xl
              border
              border-blue-500/20
              bg-blue-500/10
              p-4
            "
          >
            <p className="text-sm text-blue-300">
              Importing transactions...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}