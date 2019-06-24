window.addEventListener('load', () => {
  if ('orientation' in window)
    document.body.classList.add('mobile');
});
