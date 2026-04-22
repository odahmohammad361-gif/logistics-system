import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'

const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 1,
  staff: 2,
  branch_manager: 3,
  admin: 4,
  super_admin: 5,
}

export const useAuth = () => {
  const { user, accessToken, logout, isAuthenticated } = useAuthStore()

  const hasRole = (minRole: UserRole): boolean => {
    if (!user) return false
    return ROLE_LEVEL[user.role] >= ROLE_LEVEL[minRole]
  }

  const isAdmin = hasRole('admin')
  const isStaff = hasRole('staff')

  return { user, accessToken, logout, isAuthenticated, hasRole, isAdmin, isStaff }
}
