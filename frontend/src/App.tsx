import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Browse from './pages/Browse'
import AddTool from './pages/AddTool'
import ToolDetail from './pages/ToolDetail'
import Suggest from './pages/Suggest'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Browse />} />
          <Route path="add" element={<AddTool />} />
          <Route path="tool/:id" element={<ToolDetail />} />
          <Route path="suggest" element={<Suggest />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
