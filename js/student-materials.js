
import { supabase } from '../supabase.js';

const chapterList = document.getElementById('chapterList');
const logoutButton = document.getElementById('logoutButton');
const selectedChapterId = new URLSearchParams(window.location.search).get('chapter');

// Mencegah teks dari database dibaca sebagai HTML
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

// Memeriksa akun murid
async function checkStudent() {
    const { data: { user }, error: userError } =
        await supabase.auth.getUser();

    if (userError || !user) {
        window.location.href = 'login.html';
        return null;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

    if (error || !profile || profile.role !== 'student') {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    const name = profile.full_name || 'Murid';

    document.getElementById('studentName').textContent = name;
    document.getElementById('studentAvatar').textContent =
        name.charAt(0).toUpperCase();

    return user;
}

// Mengambil dan menampilkan materi
async function loadStudentMaterials() {
    chapterList.innerHTML =
        '<div class="empty-message">Memuat materi pembelajaran...</div>';

    // Mengambil BAB
    const { data: chapters, error: chapterError } = await supabase
            .from('chapters')
            .select('*')
            .eq('status', 'published')
            .eq('is_archived', false)
            .order('position', { ascending: true });

    if (chapterError) {
        console.error(chapterError);
        chapterList.innerHTML =
            '<div class="empty-message">Gagal memuat BAB. Silakan coba lagi.</div>';
        return;
    }

    // Jika murid memilih BAB tertentu dari dashboard
const visibleChapters = selectedChapterId
    ? chapters.filter(chapter => chapter.id === selectedChapterId)
    : chapters;
    if (!chapters || chapters.length === 0) {
        chapterList.innerHTML =
            '<div class="empty-message">Belum ada materi pembelajaran.</div>';
        return;
    }

    // Mengambil subbab
    const { data: materials, error: materialError } = await supabase
        .from('materials')
        .select('id, title, description, chapter_id')
        .eq('status', 'published')
        .eq('is_archived', false);

    if (materialError) {
        console.error(materialError);
        chapterList.innerHTML =
            '<div class="empty-message">Gagal memuat subbab.</div>';
        return;
    }

    // Mengambil aktivitas yang sudah dipublikasikan
    const { data: activities, error: activityError } = await supabase
        .from('material_activities')
        .select('id, material_id, title, position')
        .eq('status', 'published')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    if (activityError) {
        console.error(activityError);
        chapterList.innerHTML =
            '<div class="empty-message">Gagal memuat aktivitas.</div>';
        return;
    }

        // Mengambil progres aktivitas murid
    const { data: progress, error: progressError } = await supabase
        .from('student_activity_progress')
        .select('activity_id')
        .eq('student_id', user.id);

    if (progressError) {
        console.error(progressError);
        chapterList.innerHTML =
            '<div class="empty-message">Gagal memuat progres aktivitas.</div>';
        return;
    }

    // Mengumpulkan ID aktivitas yang sudah selesai
    const completedActivityIds = new Set(
        (progress || []).map(item => item.activity_id)
    );

    // Menyusun BAB, subbab, dan aktivitas
    // Tombol untuk kembali melihat semua BAB
const backButton = selectedChapterId
    ? `
        <button
            class="activity-button"
            onclick="window.location.href='student-materials.html'"
            style="margin-bottom: 20px;"
        >
            ← Kembali ke Semua BAB
        </button>
    `
    : '';
    chapterList.innerHTML = visibleChapters.map((chapter, index) => {
        const chapterMaterials = materials.filter(
            material => material.chapter_id === chapter.id
        );

        // Menghitung progres keseluruhan BAB
const chapterMaterialIds = chapterMaterials.map(
    material => material.id
);

const chapterActivities = activities.filter(
    activity => chapterMaterialIds.includes(activity.material_id)
);

const totalChapterActivities = chapterActivities.length;

const completedChapterActivities = chapterActivities.filter(
    activity => completedActivityIds.has(activity.id)
).length;

const chapterProgressPercentage = totalChapterActivities > 0
    ? Math.round(
        (completedChapterActivities / totalChapterActivities) * 100
    )
    : 0;

        const subchapterHTML = chapterMaterials.map((material, subIndex) => {
            const materialActivities = activities.filter(
                activity => activity.material_id === material.id
            );

            // Menghitung progres subbab
            const totalActivities = materialActivities.length;

            const completedCount = materialActivities.filter(
                activity => completedActivityIds.has(activity.id)
            ).length;

            const progressPercentage = totalActivities > 0
                ? Math.round((completedCount / totalActivities) * 100)
                : 0;

            const activityHTML = materialActivities.length > 0
    ? materialActivities.map((activity, activityIndex) => {
        const isCompleted = completedActivityIds.has(activity.id);
        const isUnlocked =
            activityIndex === 0 ||
            completedActivityIds.has(materialActivities[activityIndex - 1].id);

        let buttonHTML = '';

        if (isCompleted) {
    buttonHTML = `
        <a
            class="activity-button"
            href="student-activity.html?activityId=${encodeURIComponent(activity.id)}"
        >
            Lihat Kembali →
        </a>
        <span class="activity-status completed">
            ✓ Selesai
        </span>
    `;
} else if (isUnlocked) {
    buttonHTML = `
        <a
            class="activity-button"
            href="student-activity.html?activityId=${encodeURIComponent(activity.id)}"
        >
            Mulai →
        </a>
    `;
} else {
    buttonHTML = `
        <span class="activity-status locked">
            🔒 Terkunci
        </span>
    `;
}

        return `
            <div class="activity-item">
                <span>
                    Aktivitas ${activityIndex + 1}:
                    ${escapeHTML(activity.title)}
                </span>
                ${buttonHTML}
            </div>
        `;
    }).join('')
    : '<p>Belum ada aktivitas yang tersedia.</p>';

            return `
                <div class="subchapter-item">
                    <h3>${subIndex + 1}. ${escapeHTML(material.title)}</h3>
                    <p>${escapeHTML(material.description || '')}</p>

<div class="subchapter-progress">
    <div class="progress-info">
        <span class="progress-label">Progres aktivitas</span>
        <span class="progress-count">
            ${completedCount} dari ${totalActivities} selesai (${progressPercentage}%)
        </span>
    </div>

    <div class="progress-track">
        <div
            class="progress-fill"
            style="width: ${progressPercentage}%"
        ></div>
    </div>
</div>

                    <div class="activity-list">
                        ${activityHTML}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <article class="chapter-card">
                <div class="chapter-heading">
    <div class="chapter-number">
            ${String(index + 1).padStart(2, '0')}
        </div>
        <div>
            <h2>${escapeHTML(chapter.title)}</h2>
            <p>${chapterMaterials.length} subbab</p>
        </div>
    </div>

    <div class="chapter-progress">
        <div class="progress-info">
            <span class="progress-label">Progres pembelajaran BAB</span>
            <span class="progress-count">
                ${completedChapterActivities} dari ${totalChapterActivities} aktivitas selesai
                (${chapterProgressPercentage}%)
            </span>
        </div>

        <div class="progress-track">
            <div
                class="progress-fill"
                style="width: ${chapterProgressPercentage}%"
            ></div>
        </div>
    </div>

                <div class="subchapter-list">
                    ${subchapterHTML || '<p>Belum ada subbab.</p>'}
                </div>
            </article>
        `;
    }).join('');

chapterList.innerHTML = backButton + chapterList.innerHTML;
}

// Tombol keluar
logoutButton.addEventListener('click', async (event) => {
    event.preventDefault();

    const { error } = await supabase.auth.signOut();

    if (error) {
        alert('Gagal keluar. Silakan coba lagi.');
        return;
    }

    window.location.href = 'login.html';
});

// Menjalankan halaman
const user = await checkStudent();

if (user) {
    await loadStudentMaterials();
}
