
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for the API to be ready
    await ensureSupabase();

    const user = await API.getCurrentUser();
    if (!user?.data.user) {
        window.location.href = 'login.html';
        return;
    }

    const userId = user.data.user.id;
    const profileForm = document.getElementById('profile-form');
    const userListingsSection = document.getElementById('user-listings');

    // Load Profile Data
    async function loadProfile() {
        try {
            const profile = await API.getProfile(userId);
            if (profile) {
                document.getElementById('username').value = profile.username || '';
                document.getElementById('full_name').value = profile.full_name || '';
                document.getElementById('location').value = profile.location || '';
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
            showToast('Failed to load your profile data.', true);
        }
    }

    // Load User's Listings
    async function loadUserListings() {
        try {
            const listings = await API.getUserListings(userId);
            userListingsSection.innerHTML = ''; // Clear existing
            if (listings && listings.length > 0) {
                listings.forEach(listing => {
                    const card = buildCard(listing);
                    userListingsSection.appendChild(card);
                });
            } else {
                userListingsSection.innerHTML = '<p>You haven't listed any items yet.</p>';
            }
        } catch (e) {
            console.error('Failed to load user listings:', e);
            showToast('Failed to load your listings.', true);
        }
    }

    // Handle Profile Update
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(profileForm);
        const profileData = {
            username: formData.get('username'),
            full_name: formData.get('full_name'),
            location: formData.get('location'),
        };

        try {
            await API.updateProfile(userId, profileData);
            showToast('Profile updated successfully!');
        } catch (e) {
            console.error('Failed to update profile:', e);
            showToast(e.message || 'Failed to update profile.', true);
        }
    });

    // Initial Load
    await loadProfile();
    await loadUserListings();
});
