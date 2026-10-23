import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Detail from './pages/Detail'
import AdminHome from './admin/AdminHome'
import AdminEdit from './admin/AdminEdit'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <main className="app">
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:id" element={<Detail />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/new" element={<AdminEdit />} />
        <Route path="/admin/r/:id" element={<AdminEdit />} />
        <Route path="*" element={<p className="status">없는 페이지예요. <Link to="/">처음으로</Link></p>} />
      </Routes>
    </main>
  )
}
