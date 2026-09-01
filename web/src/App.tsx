import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useAuthStore } from './store/auth'
import { CircularsPage } from './pages/CircularsPage'
import { DashboardPage } from './pages/DashboardPage'
import { EnquiryDatabasePage } from './pages/EnquiryDatabasePage'
import { LoginPage } from './pages/LoginPage'
import { SmartQuoteAirPage } from './pages/SmartQuoteAirPage'
import { SmartQuoteSeaPage } from './pages/SmartQuoteSeaPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="smart-quote/air" element={<SmartQuoteAirPage />} />
          <Route path="smart-quote/sea" element={<SmartQuoteSeaPage />} />
          <Route path="enquiries" element={<EnquiryDatabasePage />} />
          <Route path="circulars" element={<CircularsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
