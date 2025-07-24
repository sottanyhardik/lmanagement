import {useContext} from 'react';
import AuthContext from '../../context/AuthContext.jsx';
import GenericProfileForm from '../../layouts/GenericForm.jsx';

const ViewProfile = () => {
    const {user, authTokens} = useContext(AuthContext);

    return (
        <GenericProfileForm
            title="My Profile"
            apiEndpoint={`${import.meta.env.VITE_API_BASE_URL}/users/${user.user_id}/`}
            token={authTokens.access}
            fields={[
                {name: 'username', label: 'Username', disabled: true},
                {name: 'email', label: 'Email'},
                {name: 'first_name', label: 'First Name'},
                {name: 'last_name', label: 'Last Name'},
            ]}
        />
    );
};

export default ViewProfile;
