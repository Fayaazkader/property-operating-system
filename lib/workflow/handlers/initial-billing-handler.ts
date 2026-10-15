/** Compatibility registration. Commencement approval/posting is owned solely by
 * post_lease_commencement_billing. In-memory events cannot authorize or retry a
 * second financial command; durable timeline/workflow updates are in that RPC.
 */
export function registerInitialBillingHandler(): void {}
