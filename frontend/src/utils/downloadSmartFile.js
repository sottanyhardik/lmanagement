// utils/downloadSmartFile.js

import {toast} from 'react-toastify';

/**
 * Smart file downloader that handles both file blob and JSON URL responses.
 * @param {Promise} axiosPromise - Axios POST or GET call that returns a response.
 * @param {string} fallbackFileName - Default name to use when downloading a blob.
 */
export async function downloadSmartFile(axiosPromise, fallbackFileName = 'download.zip') {
    try {
        const res = await axiosPromise;

        const contentType = res.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const text = await res.data.text();
            const json = JSON.parse(text);
            if (json?.url) {
                const link = document.createElement('a');
                link.href = json.url;
                link.target = '_blank';
                link.download = '';
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success('Download link opened');
            } else {
                toast.error('Unexpected JSON response format');
            }
        } else {
            // Assume it's a file blob
            const blob = new Blob([res.data], {type: contentType || 'application/octet-stream'});
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fallbackFileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('File downloaded');
        }
    } catch (error) {
        console.error('Download failed:', error);
        toast.error('Download failed');
    }
}
