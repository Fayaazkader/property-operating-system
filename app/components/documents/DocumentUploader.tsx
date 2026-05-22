"use client";

import { useState } from "react";

import { supabase } from "../../../lib/supabase";

interface DocumentUploaderProps {
  leaseId: string
  onUploadComplete?: () => void
}

export default function DocumentUploader({
  leaseId,
  onUploadComplete,
}: DocumentUploaderProps) {

  const [uploading, setUploading] =
    useState(false);
    const [documentType, setDocumentType] =
  useState("Lease Agreement");

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.target.files?.[0];

    if (!file) return;

    try {

      setUploading(true);

      const filePath =
        `${leaseId}/${Date.now()}-${file.name}`;

      const { error: uploadError } =
        await supabase.storage
          .from("lease-documents")
          .upload(
            filePath,
            file
          );

      if (uploadError) {

        alert(uploadError.message);

        return;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("lease-documents")
        .getPublicUrl(filePath);

      const documentUrl =
        publicUrlData.publicUrl;

      const { error: insertError } =
        await supabase
          .from("lease_documents")
          .insert([{

            lease_id: leaseId,

            document_name:
              file.name,

            document_url:
              documentUrl,

            document_type:
  documentType,

            uploaded_by:
              "Asset Manager",

          }]);

      if (insertError) {

        alert(insertError.message);

        return;
      }

      alert(
        "Document uploaded successfully."
      );

      if (onUploadComplete) {

        onUploadComplete();
      }

    } finally {

      setUploading(false);
    }
  }

  return (

    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8">

      <div className="flex flex-col items-center justify-center text-center">

        <div className="mb-4 text-5xl">
          📄
        </div>

        <h3 className="text-xl font-bold text-black mb-2">
          Upload Lease Documents
        </h3>

        <p className="text-zinc-500 mb-6 max-w-md">
          Upload lease agreements, addendums, notices and supporting operational documentation.
        </p>
<select
  value={documentType}
  onChange={(e) =>
    setDocumentType(
      e.target.value
    )
  }
  className="
    mb-6
    w-full
    max-w-sm
    rounded-2xl
    border
    border-zinc-300
    bg-white
    px-4
    py-3
    text-sm
    text-black
  "
>

  <option>
    Lease Agreement
  </option>

  <option>
    Addendum
  </option>

  <option>
    Renewal Notice
  </option>

  <option>
    Tenant Correspondence
  </option>

  <option>
    Compliance
  </option>

  <option>
    Financial
  </option>

  <option>
    Other
  </option>

</select>
        <label className="cursor-pointer rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90">

          {uploading
            ? "Uploading..."
            : "Select Document"}

          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />

        </label>

      </div>

    </div>
  );
}