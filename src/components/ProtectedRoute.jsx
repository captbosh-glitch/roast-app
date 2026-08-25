import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted font-body">
        Loading...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
