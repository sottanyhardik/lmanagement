import React from 'react';
import {FaDollarSign, FaKey} from 'react-icons/fa';
import './Dashboard.css'; // Retains primary color variables only

const Dashboard = () => {
    return (
        <div className="dashboard">
            <div className="container py-5">
                <div className="row g-4 justify-content-center">
                    <div className="col-md-4">
                        <div className="card shadow text-center p-4">
                            <div className="card-icon display-5 text-primary mb-3"><FaKey/></div>
                            <h5 className="card-title">Total Licenses</h5>
                            <p className="card-text fs-4 fw-bold text-primary">128</p>
                        </div>
                    </div>

                    <div className="col-md-4">
                        <div className="card shadow text-center p-4">
                            <div className="card-icon display-5 text-primary mb-3"><FaDollarSign/></div>
                            <h5 className="card-title">Available Balance</h5>
                            <p className="card-text fs-4 fw-bold text-primary">$5,620.00</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
