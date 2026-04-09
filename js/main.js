document.addEventListener('DOMContentLoaded', () => {
  // Ripple effect for buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const x = e.clientX - e.target.offsetLeft;
      const y = e.clientY - e.target.offsetTop;
      const ripples = document.createElement('span');
      ripples.style.left = x + 'px';
      ripples.style.top = y + 'px';
      ripples.classList.add('ripple');
      btn.appendChild(ripples);
      setTimeout(() => {
        ripples.remove()
      }, 600);
    });
  });
});
