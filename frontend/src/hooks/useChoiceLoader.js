// useLicenseChoices.js
import {useEffect, useState} from 'react';
import axios from '../api/axiosInstance.js';

let cachedChoices = null;

export function useLicenseChoices() {
    const [choices, setChoices] = useState(cachedChoices);
    const [loading, setLoading] = useState(!cachedChoices);

    useEffect(() => {
        if (!cachedChoices) {
            axios.get('/api/choices/')
                .then(res => {
                    cachedChoices = res.data;
                    setChoices(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load choices:", err);
                    setLoading(false);
                });
        }
    }, []);

    return {choices, loading};
}
