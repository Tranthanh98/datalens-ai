import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ManageDatabase from "./pages/ManageDatabase";

/**
 * Main App component for DataLens AI
 * Manages the overall layout and routing
 */
function App() {
  return (
    <Router>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <Header />

        {/* Main Content with Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/manage-database" element={<ManageDatabase />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
