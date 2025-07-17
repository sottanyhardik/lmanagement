import { Routes, Route } from 'react-router-dom';
import LoginForm from './components/Login/LoginForm';
import ForgotPassword from './components/Login/ForgotPassword';
import ResetPassword from './components/Login/ResetPassword';
import Dashboard from './components/Dashboard/Dashboard';
import PrivateRoute from './routes/PrivateRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/login" element={<LoginForm />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset/:uid/:token" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
