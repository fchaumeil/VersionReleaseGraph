import { BrowserRouter, Routes, Route } from "react-router-dom"
import { HomePage } from "./pages/HomePage"
import { ClientPage } from "./pages/ClientPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/client/:id" element={<ClientPage />} />
      </Routes>
    </BrowserRouter>
  )
}
