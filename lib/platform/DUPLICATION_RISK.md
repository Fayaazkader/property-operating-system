# Platform Duplication Risk Assessment

## Identified Risks
- Configuration services (Revenue vs Financials)
- Audit services (Revenue uses logAudit, Financials uses timeline)
- Document generation (not yet built — will need shared service)
- Approval workflows (not yet built — will need shared service)

## Decision
When document generation, PDFs, and approval workflows are built, create shared 
Platform Services rather than implementing per-module. Extend existing Platform 
Services (Event Bus, Validation, Security, Notifications) with:
- Document Generation Service
- Approval Workflow Service
