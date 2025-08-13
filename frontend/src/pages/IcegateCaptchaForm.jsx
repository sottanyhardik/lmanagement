// src/pages/IcegateCaptchaForm.jsx
import React, {useEffect, useState} from 'react';
import axios from '../api/axiosInstance';
import {toast} from 'react-toastify';
import {Card, Container} from 'react-bootstrap';
import ListControls from '../components/ListControls';

const IcegateCaptchaForm = () => {
    const [captchaData, setCaptchaData] = useState(null);
    const [userCaptcha, setUserCaptcha] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const fetchCaptcha = async () => {
        setLoading(true);
        setError('');
        try {
            const {data} = await axios.get('iecgate/fetch/'); // ✅ no /api prefix
            setCaptchaData(data);
            setUserCaptcha('');
        } catch (err) {
            setError('❌ Failed to fetch CAPTCHA');
            toast.error('Failed to fetch CAPTCHA');
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
            toast.error('Missing session data. Please reload the CAPTCHA.');
            setSubmitting(false);
            return;
        }

        try {
            const payload = {
                captcha: userCaptcha,
                csrftoken: captchaData.csrftoken,
                cookies: captchaData.cookies,
            };

            const {data} = await axios.post('iecgate/fetch/', payload); // ✅ same endpoint

            if (data?.status === 'triggered') {
                toast.success(`✅ Fetch triggered for ${data.count} entr${data.count === 1 ? 'y' : 'ies'}`);
                await fetchCaptcha(); // get a fresh captcha/session
            } else {
                toast.info('ℹ️ Submitted, waiting on server confirmation.');
            }
        } catch (err) {
            toast.error('❌ Failed to submit CAPTCHA');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Container className="mt-4">
            <ListControls title="📋 ICEGATE CAPTCHA" onlyHeader={false}/>

            {loading ? (
                <p>Loading CAPTCHA...</p>
            ) : error ? (
                <p className="text-danger">{error}</p>
            ) : (
                <Card>
                    <form onSubmit={handleSubmit}>
                        <Card.Header>
                            <div className="mb-3 text-center">
                                <img
                                    src={captchaData?.captcha}
                                    alt="ICEGATE CAPTCHA"
                                    className="img-fluid border img-thumbnail"
                                />
                            </div>
                        </Card.Header>

                        <Card.Body>
                            <div className="mb-2">
                                <label className="form-label" htmlFor="captcha-input">
                                    Enter CAPTCHA
                                </label>
                                <input
                                    id="captcha-input"
                                    type="text"
                                    className="form-control"
                                    value={userCaptcha}
                                    onChange={(e) => setUserCaptcha(e.target.value)}
                                    required
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                />
                            </div>

                            <div className="d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={fetchCaptcha}
                                    disabled={loading || submitting}
                                >
                                    🔄 Reload
                                </button>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting || !userCaptcha.trim()}
                                >
                                    {submitting ? '⏳ Submitting…' : '✅ Submit'}
                                </button>
                            </div>
                        </Card.Body>
                    </form>
                </Card>
            )}
        </Container>
    );
};

export default IcegateCaptchaForm;
