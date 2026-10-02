-- Preserve the structurally faithful OCR representation used by document
-- intelligence workflows that depend on page/line layout.
--
-- ocr_text remains the normalized/search-friendly representation.
-- raw_ocr_text preserves the source-oriented representation required for
-- deterministic re-analysis and interrupted-work recovery.

BEGIN;

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS raw_ocr_text text;

COMMENT ON COLUMN public.documents.raw_ocr_text IS
'Structurally preserved OCR text, including meaningful line/page layout where available. Used for deterministic document re-analysis and recovery; ocr_text remains the normalized representation.';

COMMIT;
