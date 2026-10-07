export type ClientAdministrationRoleType = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

export type ClientAdministrationEntity = {
  id: string
  name: string
  code: string
}

export type ClientAdministrationAccessProfile = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  systemKey: string | null
  permissions: string[]
}

export type ClientAdministrationPermission = {
  key: string
  name: string
  description: string | null
  category: string
}

export type ClientAdministrationUser = {
  clientUserId: string
  userId: string
  email: string | null
  displayName: string | null
  roleTypeId: string
  status: 'active' | 'suspended'
  isSuperUser: boolean
  entityIds: string[]
  accessProfileIds: string[]
  permissionOverrides: Record<string, boolean>
}

export type ClientAdministrationInvitation = {
  id: string
  email: string
  roleTypeId: string
  status: string
  expiresAt: string
  createdAt: string
  entityIds: string[]
  accessProfileIds: string[]
  permissionOverrides: Record<string, boolean>
}

export type ClientAdministration = {
  clientAccount: {
    id: string
    name: string
    status: string
  }

  currentUser: ClientAdministrationUser | null

  roleTypes: ClientAdministrationRoleType[]
  entities: ClientAdministrationEntity[]
  accessProfiles: ClientAdministrationAccessProfile[]
  assignablePermissions: ClientAdministrationPermission[]
  users: ClientAdministrationUser[]
  invitations: ClientAdministrationInvitation[]
}