
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');

    if (!sidebar || !topbar) return;

    // Buat tombol hamburger jika belum tersedia
    let toggle = document.querySelector('.sidebar-toggle');

    if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'sidebar-toggle';
        toggle.id = 'sidebarToggle';
        toggle.setAttribute('aria-label', 'Buka menu navigasi');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        topbar.prepend(toggle);
    }

    // Buat overlay jika belum tersedia
    let overlay = document.querySelector('.sidebar-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebarOverlay';
        sidebar.insertAdjacentElement('afterend', overlay);
    }

    // Hindari memasang event dua kali
    if (toggle.dataset.sidebarReady === 'true') return;
    toggle.dataset.sidebarReady = 'true';

    function openSidebar() {
        sidebar.classList.add('is-open');
        overlay.classList.add('is-visible');
        toggle.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        sidebar.classList.remove('is-open');
        overlay.classList.remove('is-visible');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function() {
        if (sidebar.classList.contains('is-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', closeSidebar);

    sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeSidebar();
    });
}

document.addEventListener('DOMContentLoaded', initSidebar);
