/* assets/js/maps-loader.js */
let isLoaded = false;
let loadPromise = null;

/**
 * Loads the Google Maps JavaScript API dynamically using the API key from environment variables.
 * @returns {Promise} Resolves when the API is loaded.
 */
export function loadGoogleMaps() {
    if (isLoaded) return Promise.resolve(window.google);
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey || apiKey === 'tu_google_maps_api_key') {
            console.warn("VITE_GOOGLE_MAPS_API_KEY is not defined or is the default value.");
            reject(new Error("API Key missing"));
            return;
        }

        const script = document.createElement('script');
        // We only need 'places' for autocomplete and 'geometry' for distance calculations
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            isLoaded = true;
            resolve(window.google);
        };
        script.onerror = (err) => {
            loadPromise = null;
            console.error("Failed to load Google Maps API:", err);
            reject(err);
        };
        document.head.appendChild(script);
    });

    return loadPromise;
}
