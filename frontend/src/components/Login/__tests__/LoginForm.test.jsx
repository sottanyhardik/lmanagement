import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../components/Login/LoginForm';
import { AuthContext } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

test('renders login form', () => {
  render(
    <BrowserRouter>
      <AuthContext.Provider value={{ login: jest.fn() }}>
        <LoginForm />
      </AuthContext.Provider>
    </BrowserRouter>
  );

  expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
});
