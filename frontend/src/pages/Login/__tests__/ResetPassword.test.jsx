import {render, screen} from '@testing-library/react';
import ResetPassword from '../ResetPassword.jsx';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

test('renders reset password form', () => {
    render(
        <MemoryRouter initialEntries={['/reset/abc123/token456']}>
            <Routes>
                <Route path="/reset/:uid/:token" element={<ResetPassword/>}/>
            </Routes>
        </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
});
