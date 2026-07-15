// lib/platform/admin/engine.ts
// Platform Administration Engine v2
// Users, permissions-based roles, teams with purpose, invitations, feature flags, operational policies

import { supabase } from '@/lib/supabase';
import { publish } from '../events/event-bus';
import { logger } from '../events/logger.service';
import { conditionEngine } from '../automation/condition-engine';
import type {
  Permission, Role, FeatureFlag, Team, TeamMember, Invitation,
  OperationalPolicy, UserEntityAccess, EntityHealth,
  InviteUserParams, UpdateAccessParams, CreateTeamParams, CreatePolicyParams,
  PolicyCondition, PolicyEffect,
} from './types';

export class AdminEngine {
  // ============================================================
  // PERMISSIONS
  // ============================================================

  async getAllPermissions(): Promise<Permission[]> {
    const { data } = await supabase.from('permissions').select('*').order('category');
    return (data || []) as Permission[];
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    const { data } = await supabase.from('permissions').select('*').eq('category', category);
    return (data || []) as Permission[];
  }

  // ============================================================
  // ROLES (permissions-based)
  // ============================================================

  async getRoles(entityId: string): Promise<Role[]> {
    const { data } = await supabase.from('roles').select('*').eq('entity_id', entityId);
    return (data || []) as Role[];
  }

  async createRole(entityId: string, name: string, permissions: string[], description?: string): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert({ entity_id: entityId, name, description, permissions, is_system: false })
      .select('*')
      .single();

    if (error) throw error;
    return data as Role;
  }

  async updateRolePermissions(roleId: string, permissions: string[]): Promise<void> {
    await supabase.from('roles').update({ permissions, updated_at: new Date().toISOString() }).eq('id', roleId);
  }

  async hasPermission(userId: string, entityId: string, permissionKey: string): Promise<boolean> {
    const { data: access } = await supabase
      .from('user_entity_access')
      .select('role')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .single();

    if (!access) return false;

    const { data: role } = await supabase
      .from('roles')
      .select('permissions')
      .eq('entity_id', entityId)
      .eq('name', access.role)
      .single();

    if (!role) return false;

    return role.role_permissions.includes(permissionKey) || role.role_permissions.includes('*');
  }

  // ============================================================
  // USERS & ACCESS
  // ============================================================

  async getEntityUsers(entityId: string): Promise<any[]> {
    const { data } = await supabase.from('user_entities').select('*').eq('entity_id', entityId);
    if (!data) return [];

    const userIds = data.map(u => u.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const { data: access } = await supabase.from('user_entity_access').select('*').eq('entity_id', entityId);
    const accessMap = new Map((access || []).map(a => [a.user_id, a]));

    return data.map(u => ({
      ...u,
      profile: profileMap.get(u.user_id) || { email: '', full_name: 'Unknown' },
      role: accessMap.get(u.user_id)?.role || 'viewer',
    }));
  }

  async inviteUser(params: InviteUserParams): Promise<Invitation> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        entity_id: params.entity_id,
        email: params.email,
        role: params.role,
        team_ids: params.team_ids,
        invited_by: params.invited_by,
        token,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) throw error;

    await publish('admin.invitation.sent', {
      correlationId: crypto.randomUUID(),
      source: 'admin-engine',
      version: '1.0',
      payload: { invitation: data },
    });

    return data as Invitation;
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    const { data: invitation } = await supabase.from('invitations').select('*').eq('token', token).single();
    if (!invitation || invitation.status !== 'pending') throw new Error('Invalid or expired invitation');
    if (new Date(invitation.expires_at) < new Date()) throw new Error('Invitation expired');

    await supabase.from('user_entities').insert({ user_id: userId, entity_id: invitation.entity_id });
    await supabase.from('user_entity_access').insert({ user_id: userId, entity_id: invitation.entity_id, role: invitation.role });

    if (invitation.team_ids?.length) {
      const members = invitation.team_ids.map((teamId: string) => ({ team_id: teamId, user_id: userId }));
      await supabase.from('team_members').insert(members);
    }

    await supabase.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invitation.id);

    await publish('admin.invitation.accepted', {
      correlationId: crypto.randomUUID(),
      source: 'admin-engine',
      version: '1.0',
      payload: { userId, entityId: invitation.entity_id, role: invitation.role },
    });
  }

  async updateAccess(params: UpdateAccessParams): Promise<void> {
    await supabase.from('user_entity_access').upsert({
      user_id: params.user_id, entity_id: params.entity_id,
      role: params.role, assigned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entity_id' });
  }

  async removeUser(userId: string, entityId: string): Promise<void> {
    await supabase.from('user_entity_access').delete().eq('user_id', userId).eq('entity_id', entityId);
    await supabase.from('team_members').delete().eq('user_id', userId);
    await supabase.from('user_entities').delete().eq('user_id', userId).eq('entity_id', entityId);
  }

  // ============================================================
  // TEAMS
  // ============================================================

  async createTeam(params: CreateTeamParams): Promise<Team> {
    const { data, error } = await supabase.from('teams').insert({
      entity_id: params.entity_id, name: params.name,
      description: params.description, category: params.category,
      purpose: params.purpose, lead_id: params.lead_id,
    }).select('*').single();

    if (error) throw error;
    return data as Team;
  }

  async getTeams(entityId: string): Promise<Team[]> {
    const { data: teams } = await supabase.from('teams').select('*').eq('entity_id', entityId);
    if (!teams) return [];

    const result: Team[] = [];
    for (const team of teams) {
      const { count } = await supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', team.id);
      result.push({ ...team, member_count: count || 0 });
    }
    return result;
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId);
    return (data || []) as TeamMember[];
  }

  async addTeamMember(teamId: string, userId: string): Promise<void> {
    await supabase.from('team_members').insert({ team_id: teamId, user_id: userId });
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
  }

  // ============================================================
  // FEATURE FLAGS (hierarchical)
  // ============================================================

  async getFeatureFlags(entityId?: string): Promise<FeatureFlag[]> {
    let query = supabase.from('feature_flags').select('*');
    if (entityId) {
      query = query.or(`entity_id.eq.${entityId},entity_id.is.null`);
    } else {
      query = query.is('entity_id', null);
    }
    const { data } = await query.order('flag_key');
    return (data || []) as FeatureFlag[];
  }

  async isFeatureEnabled(entityId: string, flagKey: string, userId?: string, role?: string): Promise<boolean> {
    // Check entity override first
    const { data: entityFlag } = await supabase.from('feature_flags').select('*').eq('entity_id', entityId).eq('flag_key', flagKey).single();
    if (entityFlag) return this.evaluateFlag(entityFlag, userId, role);

    // Fall back to global
    const { data: globalFlag } = await supabase.from('feature_flags').select('*').is('entity_id', null).eq('flag_key', flagKey).single();
    if (globalFlag) return this.evaluateFlag(globalFlag, userId, role);

    return false;
  }

  private evaluateFlag(flag: FeatureFlag, userId?: string, role?: string): boolean {
    if (!flag.enabled) return false;
    if (flag.rollout_percentage < 100 && userId) {
      if (this.hashUserId(userId) > flag.rollout_percentage) return false;
    }
    if (flag.target_roles?.length && role && !flag.target_roles.includes(role)) return false;
    if (flag.target_user_ids?.length && userId && !flag.target_user_ids.includes(userId)) return false;
    return true;
  }

  async toggleFeature(entityId: string, flagKey: string, enabled: boolean): Promise<void> {
    await supabase.from('feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('entity_id', entityId).eq('flag_key', flagKey);
  }

  // ============================================================
  // OPERATIONAL POLICIES
  // ============================================================

  async createPolicy(params: CreatePolicyParams): Promise<OperationalPolicy> {
    const { data, error } = await supabase.from('operational_policies').insert({
      entity_id: params.entity_id, name: params.name, description: params.description,
      category: params.category, resource: params.resource, action: params.action,
      conditions: params.conditions, effect: params.effect,
      effect_config: params.effect_config || {}, priority: params.priority || 0,
    }).select('*').single();

    if (error) throw error;
    return data as OperationalPolicy;
  }

  async getPolicies(entityId: string, resource?: string): Promise<OperationalPolicy[]> {
    let query = supabase.from('operational_policies').select('*').eq('entity_id', entityId).eq('is_active', true);
    if (resource) query = query.eq('resource', resource);
    const { data } = await query.order('priority', { ascending: false });
    return (data || []) as OperationalPolicy[];
  }

  async evaluatePolicies(entityId: string, resource: string, action: string, context: Record<string, any>): Promise<{
    effect: PolicyEffect;
    config: Record<string, any>;
    matchedPolicies: string[];
  }> {
    const policies = await this.getPolicies(entityId, resource);
    const matched: string[] = [];

    for (const policy of policies) {
      if (policy.action !== action && policy.action !== '*') continue;
      const results = conditionEngine.evaluate(policy.conditions, context);
      if (conditionEngine.allPassed(results)) {
        matched.push(policy.id);
        if (policy.effect === 'block') {
          return { effect: 'block', config: policy.effect_config, matchedPolicies: matched };
        }
      }
    }

    if (matched.length > 0) {
      const highestPriority = policies.filter(p => matched.includes(p.id)).sort((a, b) => b.priority - a.priority)[0];
      return { effect: highestPriority.effect, config: highestPriority.effect_config, matchedPolicies: matched };
    }

    return { effect: 'allow', config: {}, matchedPolicies: [] };
  }

  async togglePolicy(policyId: string, isActive: boolean): Promise<void> {
    await supabase.from('operational_policies').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', policyId);
  }

  // ============================================================
  // ENTITY HEALTH
  // ============================================================

  async getEntityHealth(entityId: string): Promise<EntityHealth> {
    const [
      { count: userCount },
      { count: teamCount },
      { count: automationCount },
      { count: approvalCount },
      { data: flags },
    ] = await Promise.all([
      supabase.from('user_entities').select('*', { count: 'exact', head: true }).eq('entity_id', entityId),
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('entity_id', entityId),
      supabase.from('automation_rules').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'active'),
      supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'pending_approval'),
      supabase.from('feature_flags').select('flag_key').eq('entity_id', entityId).eq('enabled', true),
    ]);

    return {
      entity_id: entityId,
      name: '',
      user_count: userCount || 0,
      team_count: teamCount || 0,
      active_automations: automationCount || 0,
      pending_approvals: approvalCount || 0,
      active_features: (flags || []).map(f => f.flag_key),
      integrations: {
        whatsapp: 'disconnected',
        email: 'disconnected',
        bank: 'disconnected',
      },
      storage_used_mb: 0,
      security_score: 100,
      api_keys_count: 0,
    };
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }
}

export const adminEngine = new AdminEngine();
