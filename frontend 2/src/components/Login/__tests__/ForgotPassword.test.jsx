import { render, screen, fireEvent } from '@testing-library/react';
import ForgotPassword from '../ForgotPassword';
import { ToastContainer } from 'react-toastify';

test('renders forgot password form and submits', async () => {
  render(<><ForgotPassword /><ToastContainer /></>);

  const input = screen.getByPlaceholderText(/enter your email/i);
  const button = screen.getByRole('button', { name: /send reset link/i });

  fireEvent.change(input, { target: { value: 'test@example.com' } });
  expect(input.value).toBe('test@example.com');

  fireEvent.click(button);

  // Optional: mock fetch if needed and assert toast/alert
});
