// src/utils/downloadSmartFile.js
import {toast} from 'react-toastify';

/**
 * Smart file downloader:
 * - Works when the server returns a binary (blob/arraybuffer) file
 * - OR a JSON body like { url: "https://..." } to open in a new tab
 * - Respects Content-Disposition filename when present
 *
 * Usage:
 *   await downloadSmartFile(
 *     axios.get('/export', { responseType: 'blob' }),
 *     { fallbackFileName: 'export.xlsx' }
 *   );
 *
 *   // Or pass a factory to ensure responseType=blob is used:
 *   await downloadSmartFile(
 *     (cfg) => axios.get('/export', { responseType: 'blob', ...cfg }),
 *     { fallbackFileName: 'export.xlsx' }
 *   );
 */
export async function downloadSmartFile(axiosPromiseOrFactory, {
    fallbackFileName = 'download.bin',
    openJsonUrl = true,        // open { url } JSON in new tab
    preferServerName = true,   // use Content-Disposition filename if provided
} = {}) {
    try {
        // Support either a ready promise or a factory
        const promise = typeof axiosPromiseOrFactory === 'function'
            ? axiosPromiseOrFactory({responseType: 'blob'})
            : axiosPromiseOrFactory;

        const res = await promise;

        // Normalize headers (axios lowercases keys)
        const headers = res?.headers || {};
        const contentType =
            headers['content-type'] ||
            res?.data?.type || // Blob.type if present
            '';

        // If the server sent JSON, it may be a blob or an already-parsed object
        const maybeJson = await resolveJsonIfAny(res.data, contentType);
        if (maybeJson && typeof maybeJson === 'object' && 'url' in maybeJson) {
            if (openJsonUrl && maybeJson.url) {
                openLink(maybeJson.url);
                toast.success('Download link opened');
                return;
            }
        }

        // Otherwise, treat as a file
        const blob = await ensureBlob(res.data, contentType);
        const filename = preferServerName
            ? (parseContentDispositionFilename(headers['content-disposition']) || fallbackFileName)
            : fallbackFileName;

        downloadBlob(blob, filename);
        toast.success('File downloaded');
    } catch (error) {
        // Try to surface JSON error details even if they came as a blob
        const detail = await extractErrorDetail(error);
        console.error('Download failed:', error);
        toast.error(detail || 'Download failed');
    }
}

/* ---------------- helpers ---------------- */

function openLink(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // allow layout to settle before revoking
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function ensureBlob(data, contentType = 'application/octet-stream') {
    if (data instanceof Blob) return data;
    if (data instanceof ArrayBuffer) return new Blob([data], {type: contentType || 'application/octet-stream'});
    if (typeof data === 'string') return new Blob([data], {type: contentType || 'text/plain'});
    // Plain object → JSON
    try {
        return new Blob([JSON.stringify(data)], {type: 'application/json'});
    } catch {
        return new Blob([], {type: contentType || 'application/octet-stream'});
    }
}

async function resolveJsonIfAny(data, contentType = '') {
    // Blob JSON (common when responseType: 'blob')
    if (data instanceof Blob) {
        if (contentType.includes('application/json') || data.type.includes('application/json')) {
            try {
                const text = await data.text();
                return JSON.parse(text);
            } catch {
                return null;
            }
        }
        return null;
    }
    // Already parsed JSON
    if (contentType.includes('application/json') && data && typeof data === 'object') {
        return data;
    }
    // Heuristic: plain object without binary markers
    if (data && typeof data === 'object' && !('byteLength' in data)) {
        return data;
    }
    return null;
}

// Parse RFC 6266 / 5987 filename from Content-Disposition
function parseContentDispositionFilename(cd) {
    if (!cd || typeof cd !== 'string') return null;

    // filename*=UTF-8''encoded%20name.ext (RFC 5987)
    const star = cd.match(/filename\*\s*=\s*(?:UTF-8''|)[^']*'?'?([^;]+)/i);
    if (star && star[1]) {
        try {
            return decodeURIComponent(star[1].trim().replace(/^"(.*)"$/, '$1'));
        } catch {
            // fall through
        }
    }

    // filename="name.ext" OR filename=name.ext
    const plain = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
    if (plain && plain[2]) {
        return plain[2].trim();
    }

    return null;
}

async function extractErrorDetail(error) {
    const resp = error?.response;
    if (!resp) return error?.message;

    const headers = resp.headers || {};
    const type = headers['content-type'] || resp?.data?.type || '';

    // Blob JSON error
    if (resp.data instanceof Blob && type.includes('application/json')) {
        try {
            const text = await resp.data.text();
            const json = JSON.parse(text);
            return (
                json?.detail ||
                json?.message ||
                Object.values(json || {})[0] ||
                'Download failed'
            );
        } catch {
            return 'Download failed';
        }
    }

    // Plain JSON error
    if (type.includes('application/json') && resp.data && typeof resp.data === 'object') {
        const json = resp.data;
        return (
            json?.detail ||
            json?.message ||
            Object.values(json || {})[0] ||
            'Download failed'
        );
    }

    return error?.message || 'Download failed';
}
