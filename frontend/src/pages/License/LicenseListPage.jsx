import React, {useEffect, useState} from 'react';
import axios from '../../api/axiosInstance';
import LicenseList from './LicenseList';

const LicenseListPage = () => {
    const [licenses, setLicenses] = useState([]);

    useEffect(() => {
        axios.get('/api/licenses/?page=1').then((res) => {
            setLicenses(res.data.results);
        });
    }, []);

    return (
        <div className="container mt-4">
            <h3 className="mb-4">📄 License List</h3>
            <LicenseList licenses={licenses}/>
        </div>
    );
};

export default LicenseListPage;
