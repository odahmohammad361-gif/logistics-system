import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getMe } from '@/services/authService'

export default function ProtectedRoute() {
  const { accessToken, user, setAuth, logout } = useAuthStore()
  const [checking, setChecking] = useState(!user && !!accessToken)

  useEffect(() => {
    if (!user && accessToken) {
      getMe(accessToken)
        .then((u) => {
          setAuth(u, accessToken, localStorage.getItem('refresh_token') ?? '')
        })
        .catch(() => logout())
        .finally(() => setChecking(false))
    }
  }, [])

  if (!accessToken) return <Navigate to="/login" replace />
  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return <Outlet />
}
