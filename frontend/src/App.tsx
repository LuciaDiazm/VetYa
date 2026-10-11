import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BarraNavegacion } from './components/BarraNavegacion'
import { RutaProtegida } from './components/RutaProtegida'
import { AuthProvider } from './context/AuthContext'
import { Ingresar } from './pages/Ingresar'
import { Inicio } from './pages/Inicio'
import { MiCuenta } from './pages/MiCuenta'
import { Panel } from './pages/Panel'
import { Registro } from './pages/Registro'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <BarraNavegacion />
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route
            path="/panel"
            element={
              <RutaProtegida roles={['VETERINARIO', 'ADMIN']}>
                <Panel />
              </RutaProtegida>
            }
          />
          <Route
            path="/mi-cuenta"
            element={
              <RutaProtegida roles={['DUENIO']}>
                <MiCuenta />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
