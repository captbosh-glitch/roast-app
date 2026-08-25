import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import Profile from './pages/Profile'
import ModeLauncher from './pages/ModeLauncher'
import GymMode from './pages/GymMode'
import Feed from './pages/Feed'
import PostThread from './pages/PostThread'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<CreateAccount />} />

          <Route path="/" element={<ProtectedRoute><ModeLauncher /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/mode/gym" element={<ProtectedRoute><GymMode /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/feed/:postId" element={<ProtectedRoute><PostThread /></ProtectedRoute>} />

          {/* Golf, Bowling, Drinking modes and Groups screens are Phase 2 */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
