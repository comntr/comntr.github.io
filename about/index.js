snippet = `<iframe id="comntr"
  referrerpolicy="no-referrer">
</iframe>
<script>
  document.querySelector('#comntr').src =
    'https://comntr.github.io#'
      + location.href;
</script>`

window.onload = () =>
  document.querySelector('#snippet').textContent = snippet;