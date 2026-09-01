import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import Profile from './pages/Profile'
import ModeLauncher from './pages/ModeLauncher'
import GymMode from './pages/GymMode'
import DrinkingMode from './pages/DrinkingMode'
import BowlingMode from './pages/BowlingMode'
import GolfMode from './pages/GolfMode'
import GroupView from './pages/GroupView'
import JoinCreateGroup from './pages/JoinCreateGroup'
import Feed from './pages/Feed'
import PostThread from './pages/PostThread'
import GolfCaddie from './pages/GolfCaddie'

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
          <Route path="/mode/drinking" element={<ProtectedRoute><DrinkingMode /></ProtectedRoute>} />
          <Route path="/mode/bowling" element={<ProtectedRoute><BowlingMode /></ProtectedRoute>} />
          <Route path="/mode/golf" element={<ProtectedRoute><GolfMode /></ProtectedRoute>} />
          <Route path="/group" element={<ProtectedRoute><GroupView /></ProtectedRoute>} />
          <Route path="/group/join" element={<ProtectedRoute><JoinCreateGroup /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/feed/:postId" element={<ProtectedRoute><PostThread /></ProtectedRoute>} />
<Route path="/mode/golf/caddie" element={<ProtectedRoute><GolfCaddie /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
