import React, {useEffect, useState} from 'react';
import axios from '../api/axiosInstance';
import ListControls from "../components/ListControls.jsx";
import {Card, CardBody, CardHeader, Container} from 'react-bootstrap';
import {toast} from "react-toastify";

const IcegateCaptchaForm = () => {
    const [captchaData, setCaptchaData] = useState(null);
    const [userCaptcha, setUserCaptcha] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchCaptcha = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/iecgate/fetch');
            console.log(res.data);
            setCaptchaData(res.data);
            setUserCaptcha('');
            setError('');
        } catch (err) {
            setError('❌ Failed to fetch CAPTCHA');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCaptcha();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        if (!captchaData?.csrftoken || !captchaData?.cookies) {
            setError('❌ Missing session data');
            return;
        }

        try {
            const payload = {
                captcha: userCaptcha,
                csrftoken: captchaData.csrftoken,
                cookies: captchaData.cookies,
            };

            const res = await axios.post('/api/iecgate/fetch', payload);

            if (res.data?.status === 'triggered') {
                fetchCaptcha();
                toast.success(`✅ Fetch triggered for ${res.data.count} entries`);
            } else {
                toast.info(`ℹ️ Response received but not confirmed.`);
            }
        } catch (err) {
            toast.info(`❌ Failed to submit CAPTCHA - ${err}`);
        }
        setSubmitting(false);
    };

    return (
        <Container className="mt-4">
            <ListControls
                title="📋 ICEGATE CAPTCHA"
                onlyHeader={false}
            />

            {loading ? (
                <p>Loading CAPTCHA...</p>
            ) : error ? (
                <p className="text-danger">{error}</p>
            ) : (
                <Card>
                    <form onSubmit={handleSubmit}>
                        <CardHeader>
                            <div className="mb-3 text-center">
                                <img
                                    src={captchaData.captcha}
                                    alt="ICEGATE CAPTCHA"
                                    className="img-fluid border img-thumbnail"
                                />
                            </div>
                        </CardHeader>
                        <CardBody>
                            <div className="mb-2">
                                <label className="form-label">Enter CAPTCHA</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={userCaptcha}
                                    onChange={(e) => setUserCaptcha(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={fetchCaptcha}
                                >
                                    🔄 Reload
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? '⏳ Submitting...' : '✅ Submit'}
                                </button>
                            </div>
                        </CardBody>
                    </form>
                </Card>
            )}
        </Container>
    );
};

export default IcegateCaptchaForm;
