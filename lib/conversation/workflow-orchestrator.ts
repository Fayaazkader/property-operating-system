// Workflow Orchestrator — starts and coordinates governed business processes

export type WorkflowStep = {
  id: string;
  action: string;
  service: string;
  config: Record<string, any>;
  nextOnSuccess?: string;
  nextOnFailure?: string;
};

export type Workflow = {
  id: string;
  name: string;
  steps: WorkflowStep[];
};

class WorkflowOrchestrator {
  private workflows: Map<string, Workflow> = new Map();

  register(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
  }

  async execute(workflowId: string, context: Record<string, any>): Promise<{ success: boolean; results: any[] }> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return { success: false, results: [] };

    const results: any[] = [];
    let currentStep: WorkflowStep | undefined = workflow.steps[0];

    while (currentStep) {
      try {
        const result = await this.executeStep(currentStep, context);
        results.push({ step: currentStep.id, success: true, data: result });
        context = { ...context, ...result };
        currentStep = currentStep.nextOnSuccess ? workflow.steps.find(s => s.id === currentStep!.nextOnSuccess) : undefined;
      } catch (error) {
        results.push({ step: currentStep.id, success: false, error });
        currentStep = currentStep.nextOnFailure ? workflow.steps.find(s => s.id === currentStep!.nextOnFailure) : undefined;
      }
    }

    return { success: results.every(r => r.success), results };
  }

  private async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const service = await import(`@/lib/workflows/${step.service}`);
    return service[step.action](context, step.config);
  }
}

export const orchestrator = new WorkflowOrchestrator();

// Register lease renewal workflow
orchestrator.register({
  id: "lease_renewal",
  name: "Lease Renewal Process",
  steps: [
    { id: "generate_renewal_pack", action: "generatePack", service: "lease-renewal", config: {}, nextOnSuccess: "draft_lease" },
    { id: "draft_lease", action: "draftLease", service: "lease-renewal", config: {}, nextOnSuccess: "notify_manager" },
    { id: "notify_manager", action: "notifyManager", service: "lease-renewal", config: {}, nextOnSuccess: "create_billing" },
    { id: "create_billing", action: "createBilling", service: "lease-renewal", config: {}, nextOnSuccess: "notify_tenant" },
    { id: "notify_tenant", action: "notifyTenant", service: "lease-renewal", config: {} },
  ],
});

// Register maintenance workflow
orchestrator.register({
  id: "maintenance",
  name: "Maintenance Request Process",
  steps: [
    { id: "create_ticket", action: "createTicket", service: "maintenance", config: {}, nextOnSuccess: "assign_contractor" },
    { id: "assign_contractor", action: "assignContractor", service: "maintenance", config: {}, nextOnSuccess: "notify_tenant" },
    { id: "notify_tenant", action: "notifyTenant", service: "maintenance", config: {} },
  ],
});

// Register lease application intake workflow
orchestrator.register({
  id: "lease_application_intake",
  name: "Lease Application Intake",
  steps: [
    { id: "validate", action: "validateDocument", service: "lease-application", config: {}, nextOnSuccess: "draft", nextOnFailure: "notify_review" },
    { id: "draft", action: "draftLease", service: "lease-application", config: {}, nextOnSuccess: "notify" },
    { id: "notify", action: "notifyManager", service: "lease-application", config: {} },
    { id: "notify_review", action: "notifyManager", service: "lease-application", config: { reason: "needs_review" } },
  ],
});

// Register lease activation workflow
orchestrator.register({
  id: "lease_activation",
  name: "Lease Activation",
  steps: [
    { id: "activate", action: "activateLease", service: "lease-activation", config: {}, nextOnSuccess: "billing" },
    { id: "billing", action: "createBilling", service: "lease-activation", config: {}, nextOnSuccess: "notify" },
    { id: "notify", action: "notifyTenant", service: "lease-activation", config: {} },
  ],
});
