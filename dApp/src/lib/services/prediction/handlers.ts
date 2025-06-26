export function isChunkLoadError(err: any): boolean {
    const errorMessage = err?.message?.toLowerCase() || '';
    return errorMessage.includes('loading chunk') ||
        errorMessage.includes('loading css chunk') ||
        errorMessage.includes('chunk load failed') ||
        errorMessage.includes('loading module');
}

export function setupChunkErrorHandling(toastStore: any) {
    if (typeof window !== 'undefined') {
        window.addEventListener('error', (event) => {
            if (event.error && isChunkLoadError(event.error)) {
                console.error('Chunk loading error detected:', event.error);
                toastStore.error('Some resources failed to load. Refreshing page...');
                setTimeout(() => window.location.reload(), 2000);
            }
        });
    }
}
