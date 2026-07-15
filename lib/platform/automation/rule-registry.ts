// lib/platform/automation/rule-registry.ts
// Rule Registry — Manages automation rules and targeted event subscriptions

import { supabase } from '@/lib/supabase';
import { subscribe } from '../events/event-bus';
import { logger } from '../events/logger.service';
import type { AutomationRule } from './types';

type RuleChangeCallback = (rules: AutomationRule[]) => void;

export class RuleRegistry {
  private cache: Map<string, AutomationRule[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000;
  private listeners: RuleChangeCallback[] = [];
  private subscribedEvents: Set<string> = new Set();

  async getActiveRules(): Promise<AutomationRule[]> {
    const now = Date.now();
    if (this.cache.has('active') && now < this.cacheExpiry) {
      return this.cache.get('active')!;
    }

    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: false });

      if (error) {
        logger.error('Failed to fetch automation rules', { error });
        return [];
      }

      const rules = (data || []) as AutomationRule[];
      this.cache.set('active', rules);
      this.cacheExpiry = now + this.CACHE_TTL;
      return rules;
    } catch (error) {
      logger.error('Failed to fetch automation rules', { error });
      return [];
    }
  }

  async getRulesByTrigger(event: string): Promise<AutomationRule[]> {
    const rules = await this.getActiveRules();
    return rules.filter(r => r.trigger === 'event' && r.trigger_config?.event === event);
  }

  getUniqueTriggerEvents(rules: AutomationRule[]): string[] {
    const events = new Set<string>();
    for (const rule of rules) {
      if (rule.trigger === 'event' && rule.trigger_config?.event) {
        events.add(rule.trigger_config.event);
      }
    }
    return Array.from(events);
  }

  async subscribeToActiveRuleEvents(handler: (event: any) => Promise<void>): Promise<void> {
    const rules = await this.getActiveRules();
    const events = this.getUniqueTriggerEvents(rules);

    for (const eventName of events) {
      if (!this.subscribedEvents.has(eventName)) {
        subscribe(eventName, handler);
        this.subscribedEvents.add(eventName);
        logger.info(`Automation subscribed to: ${eventName}`);
      }
    }

    logger.info(`Automation Engine listening to ${this.subscribedEvents.size} events`);
  }

  async refreshSubscriptions(handler: (event: any) => Promise<void>): Promise<void> {
    this.invalidateCache();
    const rules = await this.getActiveRules();
    const events = this.getUniqueTriggerEvents(rules);

    for (const eventName of events) {
      if (!this.subscribedEvents.has(eventName)) {
        subscribe(eventName, handler);
        this.subscribedEvents.add(eventName);
      }
    }
  }

  onRulesChanged(callback: RuleChangeCallback): void {
    this.listeners.push(callback);
  }

  invalidateCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}

export const ruleRegistry = new RuleRegistry();
