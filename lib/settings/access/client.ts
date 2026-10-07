import { supabase } from '@/lib/supabase'
import type { ClientAdministration } from './types'

export async function getClientAdministration(
  clientAccountId: string
): Promise<ClientAdministration> {
  const { data, error } = await supabase.rpc(
    'get_client_administration',
    {
      p_client_account_id: clientAccountId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Client administration state was not returned')
  }

  return data as ClientAdministration
}

export async function getClientAdministrationForEntity(
  entityId: string
): Promise<ClientAdministration> {
  const { data, error } = await supabase.rpc(
    'get_client_administration_for_entity',
    {
      p_entity_id: entityId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Client administration state was not returned')
  }

  return data as ClientAdministration
}

export async function setClientUserAccessProfiles(input: {
  clientAccountId: string
  clientUserId: string
  accessProfileIds: string[]
}): Promise<void> {
  const { error } = await supabase.rpc(
    'set_client_user_access_profiles',
    {
      p_client_account_id: input.clientAccountId,
      p_client_user_id: input.clientUserId,
      p_access_profile_ids: input.accessProfileIds,
      p_user_agent:
        typeof navigator === 'undefined' ? null : navigator.userAgent,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}