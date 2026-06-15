import { supabase } from "../supabase";

type AuditAction = "view" | "create" | "update" | "delete" | "login" | "logout" | "export" | "approve" | "reject" | "escalate";

type AuditEntry = {
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  resource_label?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("audit_log").insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      resource_label: entry.resource_label || null,
      old_values: entry.old_values || null,
      new_values: entry.new_values || null,
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}