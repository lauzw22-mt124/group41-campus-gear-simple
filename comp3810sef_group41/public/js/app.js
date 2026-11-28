/**
 * Minimal client-side behaviour: confirmation dialogs for destructive forms
 * and a back button that falls back to the equipment list.
 */

// Ask before submitting a form marked with data-confirm.
document.querySelectorAll('form[data-confirm]').forEach((form) =>
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  }),
);

// Go back when history exists; otherwise return to the main page.
document.querySelectorAll('[data-back]').forEach((button) =>
  button.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  }),
);
