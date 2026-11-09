
import { supabase } from '../supabase.js';

// ========================================
// KOMPONEN GLOBAL NOTIFIKASI
// ========================================

function escapeNotificationHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

async function loadNotificationComponent() {
    const topbar = document.querySelector('.topbar-right');

    if (!topbar) return false;

    if (document.getElementById('notificationButton')) {
        return true;
    }

    try {
        const response = await fetch('notification.html');

        if (!response.ok) {
            throw new Error('Gagal memuat komponen notifikasi.');
        }

        const html = await response.text();
        const profile = topbar.querySelector('.profile');

        if (profile) {
            profile.insertAdjacentHTML('beforebegin', html);
        } else {
            topbar.insertAdjacentHTML('afterbegin', html);
        }

        return true;

    } catch (error) {
        console.error('Gagal memuat komponen:', error);
        return false;
    }
}

// ========================================
// INISIALISASI NOTIFIKASI GURU
// ========================================

export async function initTeacherNotifications(user) {
    const componentLoaded = await loadNotificationComponent();

    if (!componentLoaded) return;

    const notificationButton = document.getElementById('notificationButton');
    const notificationPanel = document.getElementById('notificationPanel');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllNotificationsRead = document.getElementById('markAllNotificationsRead');

    let teacherNotifications = [];

    // Menampilkan notifikasi
    function renderNotifications() {
        const unreadCount = teacherNotifications.filter(
            item => !item.is_read
        ).length;

        notificationBadge.textContent =
            unreadCount > 99 ? '99+' : unreadCount;

        notificationBadge.hidden = unreadCount === 0;

        if (teacherNotifications.length === 0) {
            notificationList.innerHTML = `
                <div class="notification-empty">
                    Belum ada notifikasi.
                </div>
            `;
            return;
        }

        notificationList.innerHTML = teacherNotifications.map(item => {
            const date = new Date(item.created_at);

            const formattedDate = date.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div
                    class="notification-item ${item.is_read ? '' : 'unread'}"
                    data-notification-id="${item.id}"
                    role="button"
                    tabindex="0"
                >
                    <div class="notification-item-content">
                        <strong>${escapeNotificationHtml(item.title)}</strong>
                        <p>${escapeNotificationHtml(item.message)}</p>
                        <small>${formattedDate}</small>
                    </div>

                    ${!item.is_read
                        ? '<span class="notification-unread-dot"></span>'
                        : ''}
                </div>
            `;
        }).join('');
    }

    // Mengambil data notifikasi
    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, title, message, type, link, is_read, created_at')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            teacherNotifications = data || [];
            renderNotifications();

        } catch (error) {
            console.error('Gagal memuat notifikasi:', error);

            notificationList.innerHTML = `
                <div class="notification-empty">
                    Gagal memuat notifikasi.
                </div>
            `;
        }
    }

    await loadNotifications();

    // Membuka dan menutup panel
    notificationButton.addEventListener('click', () => {
        notificationPanel.hidden = !notificationPanel.hidden;
    });

    // Menutup panel saat klik di luar
    document.addEventListener('click', event => {
        const clickedInsidePanel = notificationPanel.contains(event.target);
        const clickedBell = notificationButton.contains(event.target);

        if (!clickedInsidePanel && !clickedBell) {
            notificationPanel.hidden = true;
        }
    });

    // Tandai semua sudah dibaca
    markAllNotificationsRead.addEventListener('click', async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('recipient_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('Gagal menandai notifikasi:', error);
            return;
        }

        teacherNotifications = teacherNotifications.map(item => ({
            ...item,
            is_read: true
        }));

        renderNotifications();
    });

    // Klik satu notifikasi
    notificationList.addEventListener('click', async event => {
        const itemElement = event.target.closest('.notification-item');

        if (!itemElement) return;

        const notificationId = itemElement.dataset.notificationId;

        const notification = teacherNotifications.find(
            item => item.id === notificationId
        );

        if (!notification) return;

        if (!notification.is_read) {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('recipient_id', user.id);

            if (error) {
                console.error('Gagal memperbarui notifikasi:', error);
                return;
            }

            notification.is_read = true;
            renderNotifications();
        }

        if (notification.link) {
            window.location.href = notification.link;
        }
    });

    // Realtime notifikasi
    supabase
        .channel(`teacher-notifications-${user.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `recipient_id=eq.${user.id}`
            },
            payload => {
                const newNotification = payload.new;

                if (teacherNotifications.some(
                    item => item.id === newNotification.id
                )) {
                    return;
                }

                teacherNotifications.unshift(newNotification);
                teacherNotifications = teacherNotifications.slice(0, 20);

                renderNotifications();
            }
        )
        .subscribe();
}
// ========================================
// INISIALISASI NOTIFIKASI MURID
// ========================================

export async function initStudentNotifications(user) {
    const componentLoaded = await loadNotificationComponent();

    if (!componentLoaded) return;

    const notificationButton = document.getElementById('notificationButton');
    const notificationPanel = document.getElementById('notificationPanel');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllNotificationsRead = document.getElementById('markAllNotificationsRead');

    let studentNotifications = [];

    function renderNotifications() {
        const unreadCount = studentNotifications.filter(
            item => !item.is_read
        ).length;

        notificationBadge.textContent =
            unreadCount > 99 ? '99+' : unreadCount;

        notificationBadge.hidden = unreadCount === 0;

        if (studentNotifications.length === 0) {
            notificationList.innerHTML = `
                <div class="notification-empty">
                    Belum ada notifikasi.
                </div>
            `;
            return;
        }

        notificationList.innerHTML = studentNotifications.map(item => {
            const date = new Date(item.created_at);

            const formattedDate = date.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div
                    class="notification-item ${item.is_read ? '' : 'unread'}"
                    data-notification-id="${item.id}"
                    role="button"
                    tabindex="0"
                >
                    <div class="notification-item-content">
                        <strong>${escapeNotificationHtml(item.title)}</strong>
                        <p>${escapeNotificationHtml(item.message)}</p>
                        <small>${formattedDate}</small>
                    </div>

                    ${!item.is_read
                        ? '<span class="notification-unread-dot"></span>'
                        : ''}
                </div>
            `;
        }).join('');
    }

    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, title, message, type, link, is_read, created_at')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            studentNotifications = data || [];
            renderNotifications();

        } catch (error) {
            console.error('Gagal memuat notifikasi murid:', error);

            notificationList.innerHTML = `
                <div class="notification-empty">
                    Gagal memuat notifikasi.
                </div>
            `;
        }
    }

    await loadNotifications();

    notificationButton.addEventListener('click', () => {
        notificationPanel.hidden = !notificationPanel.hidden;
    });

    document.addEventListener('click', event => {
        const clickedInsidePanel = notificationPanel.contains(event.target);
        const clickedBell = notificationButton.contains(event.target);

        if (!clickedInsidePanel && !clickedBell) {
            notificationPanel.hidden = true;
        }
    });

    markAllNotificationsRead.addEventListener('click', async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('recipient_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('Gagal menandai notifikasi:', error);
            return;
        }

        studentNotifications = studentNotifications.map(item => ({
            ...item,
            is_read: true
        }));

        renderNotifications();
    });

    notificationList.addEventListener('click', async event => {
        const itemElement = event.target.closest('.notification-item');

        if (!itemElement) return;

        const notificationId = itemElement.dataset.notificationId;

        const notification = studentNotifications.find(
            item => item.id === notificationId
        );

        if (!notification) return;

        if (!notification.is_read) {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('recipient_id', user.id);

            if (error) {
                console.error('Gagal memperbarui notifikasi:', error);
                return;
            }

            notification.is_read = true;
            renderNotifications();
        }

        if (notification.link) {
            window.location.href = notification.link;
        }
    });

    supabase
        .channel(`student-notifications-${user.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `recipient_id=eq.${user.id}`
            },
            payload => {
                const newNotification = payload.new;

                if (studentNotifications.some(
                    item => item.id === newNotification.id
                )) {
                    return;
                }

                studentNotifications.unshift(newNotification);
                studentNotifications = studentNotifications.slice(0, 20);

                renderNotifications();
            }
        )
        .subscribe();
}