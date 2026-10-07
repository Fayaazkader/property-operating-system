'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEntityContext } from '@/app/context/EntityContext'
import {
  getClientAdministrationForEntity,
  setClientUserAccessProfiles,
} from '@/lib/settings/access/client'
import type {
  ClientAdministration,
  ClientAdministrationAccessProfile,
  ClientAdministrationUser,
} from '@/lib/settings/access/types'

function userLabel(user: ClientAdministrationUser) {
  return user.displayName?.trim() || user.email || 'Unnamed user'
}

function initials(user: ClientAdministrationUser) {
  const label = userLabel(user)

  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function roleName(
  administration: ClientAdministration,
  roleTypeId: string,
) {
  return (
    administration.roleTypes.find((role) => role.id === roleTypeId)?.name ||
    'No organisational role'
  )
}

function entityNames(
  administration: ClientAdministration,
  entityIds: string[],
) {
  return administration.entities
    .filter((entity) => entityIds.includes(entity.id))
    .map((entity) => entity.name)
}

function profileNames(
  administration: ClientAdministration,
  profileIds: string[],
) {
  return administration.accessProfiles
    .filter((profile) => profileIds.includes(profile.id))
    .map((profile) => profile.name)
}

export default function UsersPage() {
  const {
    activeEntityId,
    availableEntities,
    loading: entityLoading,
  } = useEntityContext()

  const administrationEntityId =
    activeEntityId ?? availableEntities[0]?.entity_id ?? null

  const [administration, setAdministration] =
    useState<ClientAdministration | null>(null)

  const [selectedUserId, setSelectedUserId] =
    useState<string | null>(null)

  const [selectedAdditionalProfileIds, setSelectedAdditionalProfileIds] =
    useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const loadAdministration = useCallback(async () => {
    if (!administrationEntityId) {
      setAdministration(null)
      setSelectedUserId(null)
      setPageError(null)
      return
    }

    setLoading(true)
    setPageError(null)

    try {
      const data =
        await getClientAdministrationForEntity(
          administrationEntityId,
        )

      setAdministration(data)

      setSelectedUserId((current) => {
        if (
          current &&
          data.users.some((user) => user.clientUserId === current)
        ) {
          return current
        }

        return (
          data.currentUser?.clientUserId ||
          data.users[0]?.clientUserId ||
          null
        )
      })
    } catch (error) {
      console.error(
        'Failed to load canonical client administration:',
        error,
      )

      setAdministration(null)
      setSelectedUserId(null)

      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to load Users & Access.',
      )
    } finally {
      setLoading(false)
    }
  }, [administrationEntityId])

  useEffect(() => {
    void loadAdministration()
  }, [loadAdministration])

  const selectedUser = useMemo(() => {
    if (!administration || !selectedUserId) {
      return null
    }

    return (
      administration.users.find(
        (user) => user.clientUserId === selectedUserId,
      ) || null
    )
  }, [administration, selectedUserId])

  const systemProfiles = useMemo(() => {
    return (
      administration?.accessProfiles.filter(
        (profile) => profile.isSystem,
      ) || []
    )
  }, [administration])

  const clientManagedProfiles = useMemo(() => {
    return (
      administration?.accessProfiles.filter(
        (profile) => !profile.isSystem,
      ) || []
    )
  }, [administration])

  useEffect(() => {
    if (!selectedUser || !administration) {
      setSelectedAdditionalProfileIds([])
      return
    }

    const clientManagedIds = new Set(
      administration.accessProfiles
        .filter((profile) => !profile.isSystem)
        .map((profile) => profile.id),
    )

    setSelectedAdditionalProfileIds(
      selectedUser.accessProfileIds.filter((id) =>
        clientManagedIds.has(id),
      ),
    )

    setSaveMessage(null)
  }, [selectedUser, administration])

  function selectUser(user: ClientAdministrationUser) {
    setSelectedUserId(user.clientUserId)
    setPageError(null)
    setSaveMessage(null)
  }

  function toggleProfile(profile: ClientAdministrationAccessProfile) {
    if (profile.isSystem || saving) {
      return
    }

    setSelectedAdditionalProfileIds((current) =>
      current.includes(profile.id)
        ? current.filter((id) => id !== profile.id)
        : [...current, profile.id],
    )

    setSaveMessage(null)
  }

  async function saveAccessProfiles() {
    if (!administration || !selectedUser) {
      return
    }

    setSaving(true)
    setPageError(null)
    setSaveMessage(null)

    try {
      await setClientUserAccessProfiles({
        clientAccountId: administration.clientAccount.id,
        clientUserId: selectedUser.clientUserId,
        accessProfileIds: selectedAdditionalProfileIds,
      })

      const refreshed =
        await getClientAdministrationForEntity(
          administrationEntityId as string,
        )

      setAdministration(refreshed)

      const refreshedUser = refreshed.users.find(
        (user) =>
          user.clientUserId === selectedUser.clientUserId,
      )

      if (!refreshedUser) {
        throw new Error(
          'The updated user could not be reloaded.',
        )
      }

      const expected = [...selectedAdditionalProfileIds].sort()

      const clientManagedIds = new Set(
        refreshed.accessProfiles
          .filter((profile) => !profile.isSystem)
          .map((profile) => profile.id),
      )

      const persisted =
        refreshedUser.accessProfileIds
          .filter((id) => clientManagedIds.has(id))
          .sort()

      if (
        expected.length !== persisted.length ||
        expected.some((id, index) => id !== persisted[index])
      ) {
        throw new Error(
          'Access profile update did not persist exactly as requested.',
        )
      }

      setSaveMessage('Access profiles updated.')
    } catch (error) {
      console.error('Failed to update access profiles:', error)

      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to update access profiles.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (entityLoading) {
    return (
      <div className="p-8 text-sm text-neutral-500">
        Loading portfolio context…
      </div>
    )
  }

  if (!administrationEntityId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-neutral-950">
          Users & Access
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Select an entity to manage client access.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">
            Settings / Control Plane
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Users & Access
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Manage organisational roles, entity scope and application
            authority for {administration?.clientAccount.name || 'this client'}.
          </p>
        </div>

        {administration && (
          <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600">
            {administration.users.length}{' '}
            {administration.users.length === 1 ? 'user' : 'users'}
          </div>
        )}
      </div>

      {pageError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {saveMessage && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
          {saveMessage}
        </div>
      )}

      {loading && !administration ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
          Loading canonical access state…
        </div>
      ) : administration ? (
        <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-neutral-200 bg-neutral-50/50 lg:border-b-0 lg:border-r">
            <div className="border-b border-neutral-200 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                People
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {administration.users.map((user) => {
                const selected =
                  user.clientUserId === selectedUserId

                return (
                  <button
                    key={user.clientUserId}
                    type="button"
                    onClick={() => selectUser(user)}
                    className={`flex w-full items-center gap-3 px-5 py-4 text-left transition ${
                      selected
                        ? 'bg-white'
                        : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                      {initials(user) || 'U'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-neutral-900">
                          {userLabel(user)}
                        </span>

                        {user.isSuperUser && (
                          <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Super User
                          </span>
                        )}
                      </div>

                      <div className="mt-1 truncate text-xs text-neutral-500">
                        {roleName(
                          administration,
                          user.roleTypeId,
                        )}
                      </div>
                    </div>

                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        user.status === 'active'
                          ? 'bg-emerald-500'
                          : 'bg-neutral-300'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </aside>

          <main className="min-w-0">
            {selectedUser ? (
              <>
                <div className="border-b border-neutral-200 px-6 py-6 lg:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                          {userLabel(selectedUser)}
                        </h2>

                        {selectedUser.isSuperUser && (
                          <span className="rounded-full border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Super User
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-neutral-500">
                        {selectedUser.email || 'No email available'}
                      </p>
                    </div>

                    <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium capitalize text-neutral-600">
                      {selectedUser.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-8 px-6 py-7 lg:px-8">
                  <section>
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-neutral-950">
                        Organisation
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        Organisational identity is separate from application authority.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-neutral-200 p-4">
                        <div className="text-xs font-medium text-neutral-400">
                          Organisational role
                        </div>

                        <div className="mt-2 text-sm font-medium text-neutral-900">
                          {roleName(
                            administration,
                            selectedUser.roleTypeId,
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-neutral-200 p-4">
                        <div className="text-xs font-medium text-neutral-400">
                          Entity access
                        </div>

                        <div className="mt-2 text-sm font-medium text-neutral-900">
                          {entityNames(
                            administration,
                            selectedUser.entityIds,
                          ).join(', ') || 'No entity access'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-950">
                          Access profiles
                        </h3>

                        <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
                          Profiles grant bundled application authority.
                          System-managed access is protected; client-managed
                          profiles can be assigned here.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {systemProfiles.map((profile) => {
                        const assigned =
                          selectedUser.accessProfileIds.includes(
                            profile.id,
                          )

                        return (
                          <div
                            key={profile.id}
                            className="flex items-start justify-between gap-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-neutral-900">
                                  {profile.name}
                                </span>

                                <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                  System managed
                                </span>
                              </div>

                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                {profile.description ||
                                  'AssetFlow-managed baseline access.'}
                              </p>
                            </div>

                            <div className="pt-1 text-xs font-medium text-neutral-500">
                              {assigned ? 'Included' : 'Required'}
                            </div>
                          </div>
                        )
                      })}

                      {clientManagedProfiles.map((profile) => {
                        const checked =
                          selectedAdditionalProfileIds.includes(
                            profile.id,
                          )

                        return (
                          <label
                            key={profile.id}
                            className="flex cursor-pointer items-start justify-between gap-5 rounded-xl border border-neutral-200 px-4 py-4 transition hover:border-neutral-300"
                          >
                            <div>
                              <div className="text-sm font-medium text-neutral-900">
                                {profile.name}
                              </div>

                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                {profile.description ||
                                  'Client-managed access profile.'}
                              </p>

                              {profile.permissions.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {profile.permissions.map(
                                    (permission) => (
                                      <span
                                        key={permission}
                                        className="rounded-md bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-500"
                                      >
                                        {permission}
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>

                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving}
                              onChange={() =>
                                toggleProfile(profile)
                              }
                              className="mt-1 h-4 w-4 rounded border-neutral-300"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </section>

                  <section className="rounded-xl border border-neutral-200 p-4">
                    <div className="text-xs font-medium text-neutral-400">
                      Effective profile set
                    </div>

                    <div className="mt-2 text-sm text-neutral-700">
                      {[
                        ...profileNames(
                          administration,
                          selectedUser.accessProfileIds.filter(
                            (id) =>
                              systemProfiles.some(
                                (profile) => profile.id === id,
                              ),
                          ),
                        ),
                        ...profileNames(
                          administration,
                          selectedAdditionalProfileIds,
                        ),
                      ].join(' · ') || 'No profiles'}
                    </div>

                    {Object.keys(
                      selectedUser.permissionOverrides,
                    ).length > 0 && (
                      <div className="mt-3 text-xs text-neutral-500">
                        This user also has{' '}
                        {
                          Object.keys(
                            selectedUser.permissionOverrides,
                          ).length
                        }{' '}
                        explicit permission override(s). Advanced
                        overrides will be managed separately.
                      </div>
                    )}
                  </section>

                  <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-6">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        if (!selectedUser) return

                        const clientManagedIds = new Set(
                          clientManagedProfiles.map(
                            (profile) => profile.id,
                          ),
                        )

                        setSelectedAdditionalProfileIds(
                          selectedUser.accessProfileIds.filter(
                            (id) => clientManagedIds.has(id),
                          ),
                        )

                        setSaveMessage(null)
                        setPageError(null)
                      }}
                      className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveAccessProfiles()
                      }
                      className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? 'Saving…'
                        : 'Save access'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[500px] items-center justify-center p-8 text-sm text-neutral-500">
                Select a user to manage access.
              </div>
            )}
          </main>
        </div>
      ) : !pageError ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
          No administration state is available.
        </div>
      ) : null}
    </div>
  )
}
