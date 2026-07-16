import ProductSection from "./ProductSection";

export default function ProductShowcase() {
  return (
    <>

      <ProductSection
        eyebrow="Revenue Operations"
        title="Revenue should flow. Not wait."
        description="Generate billing, verify charges, produce statements, recover arrears and activate leases through one connected operational workflow."
        image="/screenshots/revenue-operations.png"
      />

      <ProductSection
        eyebrow="Property Operations"
        title="Every property. Every supplier. Every work order."
        description="Manage inspections, maintenance, compliance, suppliers and operational risk from one workspace designed for commercial property."
        image="/screenshots/property-workspace.png"
        reverse
      />

      <ProductSection
        eyebrow="Reporting Centre"
        title="Every report. Every number. Completely traceable."
        description="Operational reports, financial reporting, executive insights and scheduled deliveries—all generated from one connected source of truth."
        image="/screenshots/reporting-centre.png"
      />

    </>
  );
}
