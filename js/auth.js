async function showAuthTab(tabName) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');

    if (tabName === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
    }
}

async function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
        await API.signIn(email, password);
        showToast('Logged in successfully!');
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get('redirect') || 'shop.html';
        window.location.href = redirectTo;
    } catch (error) {
        showToast(`Login failed: ${error.message}`, true);
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const fullName = document.getElementById('signup-full-name').value;
    const btn = document.getElementById('signup-btn');
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    try {
        await API.signUp(email, password, { full_name: fullName });
        showToast('Account created successfully! Redirecting...', false, 4000);
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get('redirect') || 'shop.html';
        window.location.href = redirectTo;
    } catch (error) {
        showToast(`Sign up failed: ${error.message}`, true);
        btn.disabled = false;
        btn.textContent = 'Sign Up';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-form')) {
        showAuthTab('login'); 

        // Attach event listeners
        document.getElementById('login-form').addEventListener('submit', handleSignIn);
        document.getElementById('signup-form').addEventListener('submit', handleSignUp);
        document.getElementById('login-tab').addEventListener('click', () => showAuthTab('login'));
        document.getElementById('signup-tab').addEventListener('click', () => showAuthTab('signup'));
    }
});
