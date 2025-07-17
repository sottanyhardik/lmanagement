import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="p-4">
      <h1>Dashboard</h1>
      <button className="btn btn-danger mt-3" onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Dashboard;
