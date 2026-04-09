const redirectTarget = new URLSearchParams(window.location.search).get('redirect') || '/';

// No longer needed: initializeFirebase, setAuthPersistence functions

async function setupAuthListener() {
  // Use the API object's auth state change listener
  API.onAuthStateChanged(user => {
    if (user && (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html'))) {
      window.location.href = redirectTarget;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // showAuthTab('login'); // This function is not defined in this file
  setupAuthListener().catch(console.error);

  // Event listeners for login and signup forms are now handled directly in login.html and signup.html
});
