// This script manages all interactions with backend services.

let supabase = null;

// --- SINGLE INITIALIZATION LOGIC ---

// Create a single promise that resolves once the Supabase client is initialized.
const initializationPromise = (async () => {
    try {
        // 1. Fetch backend configuration
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch API config. Status: ${response.status}`);
        }
        const config = await response.json();

        // 2. Initialize Supabase
        if (typeof window.supabase !== 'undefined') {
            supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        } else {
            throw new Error("Supabase client library not loaded.");
        }

        // 3. The promise resolves with the client, but we don't strictly need to wait for an initial session
        //    because Supabase handles session restoration automatically.
        return supabase;

    } catch (error) {
        console.error("FATAL: Could not initialize API client.", error);
        document.body.innerHTML = `<div style="padding: 2rem; text-align: center; font-family: sans-serif; color: #fff; background-color: #1a1a1a;"><h1>Application Error</h1><p>Could not connect to services. Please check your .env file and console for details.</p></div>`;
        return Promise.reject(error);
    }
})();


// --- PUBLIC API OBJECT ---

const API = {
    ready: initializationPromise,

    // --- AUTHENTICATION ---

    async signIn(email, password) {
        await API.ready;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signUp(email, password, profileData = {}) {
        await API.ready;
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // You can pass initial profile data here if your backend trigger uses it
                data: profileData
            }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        await API.ready;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getCurrentUser() {
        await API.ready;
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    onAuthStateChanged(callback) {
        // Supabase returns a subscription object. The callback is called
        // with the event and the session object.
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session?.user);
        });
    },

    // --- SECURE API CALLS ---

    async _fetchSecure(endpoint, options = {}) {
        await API.ready;
        
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
             throw new Error('Authentication required. Please log in.');
        }

        const token = session.access_token;

        const response = await fetch(endpoint, {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error on ${endpoint}: ${errorBody}`);
        }

        // Handle different response types
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text(); // or handle as blob, etc.
        }
    },

    // Existing protected methods - no changes needed here as they use _fetchSecure
    createListing(listingData) {
        return this._fetchSecure('/api/listings', { 
            method: 'POST', 
            body: JSON.stringify(listingData) 
        });
    },

    getProfile() {
        return this._fetchSecure('/api/profile');
    },

    updateProfile(profileData) {
        return this._fetchSecure('/api/profile', { 
            method: 'POST', 
            body: JSON.stringify(profileData) 
        });
    },

    // --- PUBLIC DATA (Supabase) ---

    async getListings(filters = {}) {
        await API.ready;
        let query = supabase.from('listings').select('*');
        if (filters.search) query = query.ilike('title', `%${filters.search}%`);
        if (filters.category) query = query.eq('category', filters.category);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching listings:', error);
            throw error;
        }
        return data;
    },

    async getListing(id) {
        await API.ready;
        const { data, error } = await supabase.from('listings').select('*').eq('id', id).single();
        if (error) {
            console.error('Error fetching listing:', error);
            // Don't throw an error if the listing is just not found, return null.
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    },
};