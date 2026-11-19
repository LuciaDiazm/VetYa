import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BarraNavegacion } from './components/BarraNavegacion'
import { BotonArriba } from './components/BotonArriba'
import { Pie } from './components/Pie'
import { DisenoPanel } from './components/DisenoPanel'
import { RutaProtegida } from './components/RutaProtegida'
import { SaltarAlContenido } from './components/SaltarAlContenido'
import { VolverArriba } from './components/VolverArriba'
import { AuthProvider } from './context/AuthContext'
import { Cirugias } from './pages/Cirugias'
import { Configuracion } from './pages/panel/configuracion/Configuracion'
import { Estadisticas } from './pages/panel/Estadisticas'
import { InformeTurnos } from './pages/panel/InformeTurnos'
import { MiClave } from './pages/panel/MiClave'
import { Pagos } from './pages/panel/Pagos'
import { ComprobantePago } from './pages/panel/ComprobantePago'
import { Ingresar } from './pages/Ingresar'
import { Inicio } from './pages/Inicio'
import { MiCuenta } from './pages/MiCuenta'
import { Panel } from './pages/Panel'
import { Registro } from './pages/Registro'
import { Urgencias } from './pages/Urgencias'
import { ClienteDetalle } from './pages/panel/ClienteDetalle'
import { Clientes } from './pages/panel/Clientes'
import { MascotaDetalle } from './pages/panel/MascotaDetalle'
import { NuevoCliente } from './pages/panel/NuevoCliente'
import { Agenda } from './pages/panel/Agenda'
import { NuevoTurno } from './pages/panel/NuevoTurno'
import { NuevaConsulta } from './pages/panel/NuevaConsulta'
import { Recordatorios } from './pages/panel/Recordatorios'
import { SacarTurno } from './pages/SacarTurno'

// Páginas públicas y de dueños: llevan la barra de arriba.
function DisenoPublico() {
  return (
    // "sitio-publico": en la compu todo el sitio se ve al 80 % (ver index.css)
    <div className="sitio-publico">
      <SaltarAlContenido />
      <BarraNavegacion />
      <Outlet />
      <Pie />
      <BotonArriba />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <VolverArriba />
        <Routes>
          <Route element={<DisenoPublico />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/ingresar" element={<Ingresar />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/urgencias" element={<Urgencias />} />
            <Route path="/turno" element={<SacarTurno />} />
            <Route path="/cirugias" element={<Cirugias tipo="cirugia" />} />
            <Route path="/limpieza-dental" element={<Cirugias tipo="limpieza" />} />
            <Route
              path="/mi-cuenta"
              element={
                <RutaProtegida roles={['DUENIO']}>
                  <MiCuenta />
                </RutaProtegida>
              }
            />
          </Route>

          <Route
            path="/panel"
            element={
              <RutaProtegida roles={['VETERINARIO', 'ADMIN']}>
                <DisenoPanel />
              </RutaProtegida>
            }
          >
            <Route index element={<Panel />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="agenda/nuevo" element={<NuevoTurno />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/nuevo" element={<NuevoCliente />} />
            <Route path="clientes/:id" element={<ClienteDetalle />} />
            <Route path="mascotas/:id" element={<MascotaDetalle />} />
            <Route path="mascotas/:id/consulta" element={<NuevaConsulta />} />
            <Route path="recordatorios" element={<Recordatorios />} />
            <Route path="estadisticas" element={<Estadisticas />} />
            <Route path="informe" element={<InformeTurnos />} />
            <Route path="contrasena" element={<MiClave />} />
            <Route path="pagos" element={<Pagos />} />
            <Route path="pagos/:id/comprobante" element={<ComprobantePago />} />
            <Route
              path="configuracion"
              element={
                <RutaProtegida roles={['ADMIN']}>
                  <Configuracion />
                </RutaProtegida>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
