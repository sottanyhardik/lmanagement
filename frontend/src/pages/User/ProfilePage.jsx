// src/pages/ProfilePage.jsx
import GenericForm from '../../layouts/GenericForm.jsx';
import {useContext} from 'react';
import AuthContext from '../../context/AuthContext.jsx';

const ProfilePage = () => {
    const {authTokens} = useContext(AuthContext);

    const fields = [
        {name: 'username', label: 'Username', required: true, disabled: true},
        {name: 'email', label: 'Email', type: 'email', required: true},

        {
            name: 'role', label: 'Role', type: 'select', required: true, options: [
                {label: 'Admin', value: 'admin'},
                {label: 'User', value: 'user'},
            ]
        },
        {name: 'profile_pic', label: 'Profile Picture', type: 'file'},
        {name: 'dob', label: 'Date of Birth', type: 'date'},
        {name: 'is_active', label: 'Active', type: 'checkbox'},
        {
            group: 'skills',
            label: 'Skills',
            repeatable: true,
            fields: [
                {
                    name: 'name',
                    label: 'Skill Name',
                    type: 'select',
                    async: true,
                    required: true,
                    loadOptions: async (inputValue) => {
                        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/skills/?search=${inputValue}`);
                        const data = await res.json();
                        return data.results.map((item) => ({label: item.name, value: item.name}));
                    },
                    createEndpoint: `${import.meta.env.VITE_API_BASE_URL}/skills/`,
                },
                {
                    name: 'level',
                    label: 'Level',
                    type: 'select',
                    options: [
                        {label: 'Beginner', value: 'beginner'},
                        {label: 'Intermediate', value: 'intermediate'},
                        {label: 'Expert', value: 'expert'},
                    ],
                },
            ],
        },
        {
            group: 'habits',
            label: 'Habits',
            repeatable: true,
            fields: [
                {name: 'name', label: 'Habit Name', required: true},
                {
                    name: 'name', label: 'Name', type: 'select', required: true, options: [
                        {label: 'Danching', value: 'danching'},
                    ]
                },
            ],
        },
        {name: 'bio', label: 'Bio', type: 'textarea'},
    ];

    return (
        <GenericForm
            apiEndpoint={`${import.meta.env.VITE_API_BASE_URL}/users/me/`}
            fields={fields}
            token={authTokens.access}
            title="My Profile"
            method="PUT"
            fetchOnLoad={true}
        />
    );
};

export default ProfilePage;
