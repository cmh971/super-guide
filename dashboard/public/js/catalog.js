/* Live filter for the Command Catalog tab. Loaded by dashboard.html. */
(function () {
  const input = document.getElementById('catalogSearch');
  if (!input) return;

  function applyFilter(q) {
    const term = q.trim().toLowerCase();
    const cards = document.querySelectorAll('#tab-catalog .cat-card');
    const visiblePerSection = new Map();

    cards.forEach((card) => {
      const name = (card.dataset.name || '').toLowerCase();
      const show = !term || name.includes(term);
      card.style.display = show ? '' : 'none';
      const section = card.closest('.catalog');
      if (section) {
        visiblePerSection.set(section, (visiblePerSection.get(section) || 0) + (show ? 1 : 0));
      }
    });

    // Hide a category heading + grid when nothing in it matches.
    document.querySelectorAll('#tab-catalog .catalog').forEach((section) => {
      const count = visiblePerSection.get(section) || 0;
      section.style.display = count ? '' : 'none';
      const title = section.previousElementSibling;
      if (title && title.classList.contains('cat-section-title')) {
        title.style.display = count ? '' : 'none';
      }
    });
  }

  input.addEventListener('input', (e) => applyFilter(e.target.value));
})();
