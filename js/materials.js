
import { supabase } from '../supabase.js';

// Menyimpan identitas guru yang sedang login
let currentUser = null;

// Mengamankan teks sebelum ditampilkan ke HTML
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

// Memeriksa login dan hak akses guru
async function checkTeacher() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'login.html';
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.role !== 'teacher') {
        alert('Halaman ini hanya dapat diakses oleh guru.');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return false;
    }

    currentUser = user;
    return true;
}


// Mengambil BAB, subbab, dan aktivitas dari Supabase
async function loadMaterials() {
    const container = document.getElementById('chapters-container');

    container.innerHTML = '<p>Memuat materi pembelajaran...</p>';

    // Mengambil BAB aktif
    const { data: chapters, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    if (chapterError) {
        container.innerHTML = '<p>Gagal memuat BAB: ' +
            escapeHTML(chapterError.message) + '</p>';
        return;
    }

    // Mengambil Subbab aktif
    const { data: materials, error: materialError } = await supabase
        .from('materials')
        .select('id, title, description, status, chapter_id')
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

    if (materialError) {
        container.innerHTML = '<p>Gagal memuat subbab: ' +
            escapeHTML(materialError.message) + '</p>';
        return;
    }

    // Mengambil seluruh aktivitas
    const { data: activities, error: activityError } = await supabase
        .from('material_activities')
        .select('id, material_id, title, status, position')
        .order('position', { ascending: true });

    if (activityError) {
        container.innerHTML = '<p>Gagal memuat aktivitas: ' +
            escapeHTML(activityError.message) + '</p>';
        return;
    }

    // Memperbarui jumlah BAB dan Subbab
    document.getElementById('total-chapters').textContent =
        chapters.length;

    document.getElementById('total-materials').textContent =
        materials.filter(material =>
            chapters.some(chapter => chapter.id === material.chapter_id)
        ).length;

    if (chapters.length === 0) {
        container.innerHTML = `
            <div class="material-section">
                <h2>Belum Ada BAB</h2>
                <p class="section-description">
                    Silakan tambahkan BAB pertama untuk mulai
                    menyusun materi pembelajaran.
                </p>
            </div>
        `;
        return;
    }

    // Menampilkan BAB, Subbab, dan Aktivitas
    container.innerHTML = chapters.map((chapter, index) => {

        const chapterMaterials = materials.filter(
            material => material.chapter_id === chapter.id
        );

        return `
            <section class="material-section">

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">

                    <h2>
                        ${String(index + 1).padStart(2, '0')}.
                        ${escapeHTML(chapter.title)}
                    </h2>

                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">

                        <button
                            class="add-subbab-btn"
                            data-id="${chapter.id}"
                            style="padding: 8px 14px; border: none; border-radius: 8px; background: #ecfccb; color: #365314; cursor: pointer;"
                        >
                            + Tambah Subbab
                        </button>

                        <button
                            class="archive-chapter-btn"
                            data-id="${chapter.id}"
                            style="padding: 8px 14px; border: none; border-radius: 8px; background: #fef3c7; color: #92400e; cursor: pointer;"
                        >
                            <i class="fas fa-archive"></i> Arsipkan
                        </button>

                    </div>

                </div>

                <p class="section-description">
                    ${escapeHTML(chapter.description || 'Belum ada deskripsi BAB.')}
                </p>

                <div class="material-list">

                    ${
                        chapterMaterials.length > 0
                        ? chapterMaterials.map((material, i) => {

                            // Mengambil aktivitas milik Subbab ini
                            const materialActivities = activities.filter(
                                activity => activity.material_id === material.id
                            );

                            return `
                                <div class="material-item">

                                    <div class="material-info">
                                        <div class="material-number">
                                            ${i + 1}
                                        </div>

                                        <div>
                                            <h3>${escapeHTML(material.title)}</h3>
                                            <p>
                                                ${escapeHTML(material.description || 'Belum ada deskripsi subbab.')}
                                            </p>
                                        </div>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">

                                        <span class="material-status">
                                            ${escapeHTML(material.status)}
                                        </span>


                                        <button
                                            class="edit-subbab-btn"
                                            data-id="${material.id}"
                                            data-title="${escapeHTML(material.title)}"
                                            data-description="${escapeHTML(material.description || '')}"
                                            style="padding: 7px 12px; border: none; border-radius: 8px; background: #e0f2fe; color: #075985; cursor: pointer;"
                                        >
                                            <i class="fas fa-edit"></i> Edit
                                        </button>

                                        <button
                                            class="add-activity-btn"
                                            data-id="${material.id}"
                                            style="padding: 7px 12px; border: none; border-radius: 8px; background: #dcfce7; color: #166534; cursor: pointer;"
                                        >
                                            <i class="fas fa-plus"></i> Tambah Aktivitas
                                        </button>

                                        <button
                                            class="archive-subbab-btn"
                                            data-id="${material.id}"
                                            style="padding: 7px 12px; border: none; border-radius: 8px; background: #fef3c7; color: #92400e; cursor: pointer;"
                                        >
                                            <i class="fas fa-archive"></i> Arsipkan
                                        </button>

                                    </div>

                                    <!-- DAFTAR AKTIVITAS -->
                                    <div style="width: 100%; margin-top: 16px; padding: 14px; background: #f8fafc; border-radius: 10px;">

                                        <h4 style="margin: 0 0 12px; color: #365314;">
                                            Aktivitas Pembelajaran
                                        </h4>

                                        ${
                                            materialActivities.length > 0
                                            ? materialActivities.map((activity, activityIndex) => `
                                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; margin-bottom: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; flex-wrap: wrap;">

                                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">

                                                        <span style="width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: #ecfccb; color: #365314; border-radius: 50%; font-size: 12px; font-weight: bold;">
                                                            ${activityIndex + 1}
                                                        </span>

                                                        <span style="color: #334155;">
                                                            ${escapeHTML(activity.title)}
                                                        </span>

                                                        <button
                                                            class="open-activity-editor-btn"
                                                            data-id="${activity.id}"
                                                            style="padding: 7px 12px; border: none; border-radius: 8px; background: #e0f2fe; color: #075985; cursor: pointer;"
                                                        >
                                                            <i class="fas fa-edit"></i> Buka Editor
                                                        </button>

                                                    </div>

                                                    <div style="display: flex; align-items: center; gap: 8px;">

                                                        <span class="material-status">
                                                            ${escapeHTML(activity.status)}
                                                        </span>

                                                        <select
                                                            class="activity-status-select"
                                                            data-id="${activity.id}"
                                                            style="padding: 7px; border: 1px solid #cbd5e1; border-radius: 8px;"
                                                        >
                                                            <option value="draft" ${activity.status === 'draft' ? 'selected' : ''}>
                                                                Draft
                                                            </option>

                                                            <option value="published" ${activity.status === 'published' ? 'selected' : ''}>
                                                                Published
                                                            </option>
                                                        </select>

                                                    </div>

                                                </div>
                                            `).join('')
                                            : '<p style="margin: 0; color: #64748b; font-size: 14px;">Belum ada aktivitas. Klik Tambah Aktivitas untuk membuat aktivitas pertama.</p>'
                                        }

                                    </div>

                                </div>
                            `;
                        }).join('')
                        : '<p class="section-description">Belum ada subbab dalam BAB ini.</p>'
                    }

                </div>

            </section>
        `;
    }).join('');
}


// Menyimpan BAB baru
async function saveChapter(event) {
    event.preventDefault();

    const title = document.getElementById('chapter-title').value.trim();
    const description = document.getElementById('chapter-description').value.trim();

    if (!title) {
        alert('Nama BAB tidak boleh kosong.');
        return;
    }

    const { data: chapters, error: countError } = await supabase
        .from('chapters')
        .select('id');

    if (countError) {
        alert('Gagal memeriksa urutan BAB: ' + countError.message);
        return;
    }

    const { error } = await supabase
        .from('chapters')
        .insert({
            title: title,
            description: description || null,
            position: chapters.length + 1,
            status: 'draft',
            created_by: currentUser.id
        });

    if (error) {
        alert('Gagal menambahkan BAB: ' + error.message);
        return;
    }

    alert('BAB berhasil ditambahkan!');

    document.getElementById('add-chapter-form').reset();
    document.getElementById('add-chapter-modal').classList.remove('active');

    await loadMaterials();
}

// Menyimpan ID Subbab tujuan aktivitas
let selectedActivityMaterialId = null;

// Membuka modal Tambah Aktivitas
function openAddActivityModal(materialId) {
    selectedActivityMaterialId = materialId;

    document.getElementById('add-activity-form').reset();

    document
        .getElementById('add-activity-modal')
        .classList.add('active');
}

// Menyimpan ID BAB tempat subbab akan ditambahkan
let selectedParentChapterId = null;

// Menyimpan subbab baru
async function saveSubbab(event) {
    event.preventDefault();

    const title = document.getElementById('subbab-title').value.trim();
    const description = document.getElementById('subbab-description').value.trim();

    if (!title) {
        alert('Nama subbab tidak boleh kosong.');
        return;
    }

    if (!selectedParentChapterId) {
        alert('BAB tujuan belum dipilih.');
        return;
    }

    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('title')
        .eq('id', selectedParentChapterId)
        .single();

    if (chapterError) {
        alert('Gagal memeriksa BAB: ' + chapterError.message);
        return;
    }

    const { error } = await supabase
        .from('materials')
        .insert({
            title: title,
            topic: chapter.title,
            description: description || null,
            chapter_id: selectedParentChapterId,
            status: 'draft',
            created_by: currentUser.id
        });

    if (error) {
        alert('Gagal menambahkan subbab: ' + error.message);
        return;
    }

    document.getElementById('add-subbab-form').reset();
    document.getElementById('add-subbab-modal').classList.remove('active');

    selectedParentChapterId = null;

    await loadMaterials();

    alert('Subbab berhasil ditambahkan!');
}

// Menyimpan aktivitas baru
async function saveActivity(event) {
    event.preventDefault();

    const title = document.getElementById('activity-title').value.trim();

    if (!title) {
        alert('Nama aktivitas tidak boleh kosong.');
        return;
    }

    if (!selectedActivityMaterialId) {
        alert('Subbab tujuan belum dipilih.');
        return;
    }

    // Mengambil urutan aktivitas dalam Subbab
    const { data: activities, error: positionError } = await supabase
        .from('material_activities')
        .select('position')
        .eq('material_id', selectedActivityMaterialId);

    if (positionError) {
        alert('Gagal memeriksa urutan aktivitas: ' + positionError.message);
        return;
    }

    const nextPosition = activities.length > 0
        ? Math.max(...activities.map(activity => activity.position || 0)) + 1
        : 1;

    // Menyimpan aktivitas ke Supabase
    const { error } = await supabase
        .from('material_activities')
        .insert({
            material_id: selectedActivityMaterialId,
            title: title,
            content: {},
            position: nextPosition,
            status: 'draft',
            created_by: currentUser.id
        });

    if (error) {
        alert('Gagal membuat aktivitas: ' + error.message);
        return;
    }

    document.getElementById('add-activity-form').reset();
    document.getElementById('add-activity-modal').classList.remove('active');

    selectedActivityMaterialId = null;

    alert('Aktivitas berhasil dibuat!');
}

// Menyimpan ID subbab yang sedang diedit
let selectedSubbabId = null;

// Membuka formulir Edit Subbab
function openEditSubbab(material) {
    selectedSubbabId = material.id;

    document.getElementById('edit-subbab-title').value =
        material.title || '';

    document.getElementById('edit-subbab-description').value =
        material.description || '';

    document
        .getElementById('edit-subbab-modal')
        .classList.add('active');
}

// Menyimpan perubahan subbab
async function updateSubbab(event) {
    event.preventDefault();

    const title = document.getElementById('edit-subbab-title').value.trim();
    const description = document.getElementById('edit-subbab-description').value.trim();

    if (!title) {
        alert('Nama subbab tidak boleh kosong.');
        return;
    }

    const { error } = await supabase
        .from('materials')
        .update({
            title: title,
            description: description || null
        })
        .eq('id', selectedSubbabId);

    if (error) {
        alert('Gagal memperbarui subbab: ' + error.message);
        return;
    }

    selectedSubbabId = null;

    document.getElementById('edit-subbab-form').reset();
    document.getElementById('edit-subbab-modal').classList.remove('active');

    await loadMaterials();

    alert('Subbab berhasil diperbarui!');
}


// Menyimpan ID subbab yang akan diarsipkan
let selectedArchiveSubbabId = null;

// Membuka modal konfirmasi arsip subbab
function openArchiveSubbabModal(subbabId) {
    selectedArchiveSubbabId = subbabId;

    document
        .getElementById('archive-subbab-modal')
        .classList.add('active');
}

// Menutup modal konfirmasi arsip subbab
function closeArchiveSubbabModal() {
    selectedArchiveSubbabId = null;

    document
        .getElementById('archive-subbab-modal')
        .classList.remove('active');
}

// Mengarsipkan subbab
async function archiveSubbab() {
    if (!selectedArchiveSubbabId) return;

    const { error } = await supabase
        .from('materials')
        .update({ is_archived: true })
        .eq('id', selectedArchiveSubbabId);

    if (error) {
        alert('Gagal mengarsipkan subbab: ' + error.message);
        return;
    }

    closeArchiveSubbabModal();

    await loadMaterials();
}


// Menyimpan ID BAB yang akan diarsipkan
let selectedChapterId = null;

// Membuka modal konfirmasi arsip
function openArchiveModal(chapterId) {
    selectedChapterId = chapterId;

    document
        .getElementById('archive-confirm-modal')
        .classList.add('active');
}

// Menutup modal konfirmasi arsip
function closeArchiveModal() {
    selectedChapterId = null;

    document
        .getElementById('archive-confirm-modal')
        .classList.remove('active');
}

// Mengarsipkan BAB setelah dikonfirmasi
async function archiveChapter() {

    if (!selectedChapterId) return;

    const { error } = await supabase
        .from('chapters')
        .update({ is_archived: true })
        .eq('id', selectedChapterId);

    if (error) {
        alert('Gagal mengarsipkan BAB: ' + error.message);
        return;
    }

    closeArchiveModal();

    document
        .getElementById('archive-success-modal')
        .classList.add('active');

    await loadMaterials();
    }
// Menampilkan daftar BAB dan Subbab yang diarsipkan
async function loadArchivedMaterials() {
    const container = document.getElementById('archive-container');

    container.innerHTML = '<p>Memuat arsip...</p>';

    // Mengambil BAB yang diarsipkan
    const { data: chapters, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('is_archived', true)
        .order('position', { ascending: true });

    if (chapterError) {
        container.innerHTML =
            '<p>Gagal memuat arsip BAB: ' +
            escapeHTML(chapterError.message) + '</p>';
        return;
    }

    // Mengambil Subbab yang diarsipkan
    const { data: materials, error: materialError } = await supabase
        .from('materials')
        .select('id, title, description, chapter_id')
        .eq('is_archived', true)
        .order('created_at', { ascending: true });

    if (materialError) {
        container.innerHTML =
            '<p>Gagal memuat arsip Subbab: ' +
            escapeHTML(materialError.message) + '</p>';
        return;
    }

    container.innerHTML = `
        <h2>Arsip Materi</h2>

        <h3 style="margin: 20px 0 12px;">
            BAB yang Diarsipkan
        </h3>

        ${
            chapters.length > 0
            ? chapters.map(chapter => `
                <div class="material-section">
                    <h3>${escapeHTML(chapter.title)}</h3>

                    <p>
                        ${escapeHTML(chapter.description || 'Tidak ada deskripsi.')}
                    </p>

                    <span class="material-status">BAB Diarsipkan</span>
                </div>
            `).join('')
            : '<p>Belum ada BAB yang diarsipkan.</p>'
        }

        <h3 style="margin: 24px 0 12px;">
            Subbab yang Diarsipkan
        </h3>

        ${
            materials.length > 0
            ? materials.map(material => `
                <div class="material-section">
                    <h3>${escapeHTML(material.title)}</h3>

                    <p>
                        ${escapeHTML(material.description || 'Tidak ada deskripsi.')}
                    </p>

                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">

                        <span class="material-status">Subbab Diarsipkan</span>

                        <button
                            class="restore-subbab-btn"
                            data-id="${material.id}"
                            style="padding: 8px 14px; border: none; border-radius: 8px; background: #ecfccb; color: #365314; cursor: pointer;"
                        >
                            <i class="fas fa-undo"></i> Pulihkan Subbab
                        </button>

                    </div>
                </div>
            `).join('')
            : '<p>Belum ada Subbab yang diarsipkan.</p>'
        }
    `;
}
// Memulihkan BAB dari arsip
async function restoreChapter(chapterId) {

    const { error } = await supabase
        .from('chapters')
        .update({ is_archived: false })
        .eq('id', chapterId);

    if (error) {
        alert('Gagal memulihkan BAB: ' + error.message);
        return;
    }

    await loadArchivedMaterials();
    await loadMaterials();

    alert('BAB berhasil dipulihkan!');
}
// Memulihkan Subbab dari arsip
async function restoreSubbab(subbabId) {

    const { error } = await supabase
        .from('materials')
        .update({ is_archived: false })
        .eq('id', subbabId);

    if (error) {
        alert('Gagal memulihkan Subbab: ' + error.message);
        return;
    }

    await loadArchivedMaterials();
    await loadMaterials();

    alert('Subbab berhasil dipulihkan!');
}
// Menjalankan halaman
async function init() {
    const isTeacher = await checkTeacher();

    if (!isTeacher) return;

    // Membuka modal Tambah BAB
const modal = document.getElementById('add-chapter-modal');

document.getElementById('add-chapter-btn')
    .addEventListener('click', () => {
        modal.classList.add('active');
    });

// Menutup modal melalui tombol X
document.getElementById('close-add-chapter')
    .addEventListener('click', () => {
        modal.classList.remove('active');
    });

// Menutup modal melalui tombol Batal
document.getElementById('cancel-add-chapter')
    .addEventListener('click', () => {
        modal.classList.remove('active');
    });

// Menutup modal jika area luar diklik
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.classList.remove('active');
    }
});

// Menyimpan BAB melalui form
document.getElementById('add-chapter-form')
    .addEventListener('submit', saveChapter);

    // Tombol X untuk menutup modal arsip
document.getElementById('close-archive-modal')
    .addEventListener('click', closeArchiveModal);

// Tombol Batal untuk menutup modal arsip
document.getElementById('cancel-archive')
    .addEventListener('click', closeArchiveModal);

// Klik area luar untuk menutup modal arsip
document.getElementById('archive-confirm-modal')
    .addEventListener('click', (event) => {

        if (event.target.id === 'archive-confirm-modal') {
            closeArchiveModal();
        }

    });

// Tombol Ya, Arsipkan
document.getElementById('confirm-archive')
    .addEventListener('click', archiveChapter);

    // Menutup modal notifikasi berhasil
document.getElementById('close-archive-success')
    .addEventListener('click', () => {

        document
            .getElementById('archive-success-modal')
            .classList.remove('active');

    });

    // Membuka dan menutup halaman Arsip
const archiveButton = document.getElementById('show-archive-btn');
const archiveContainer = document.getElementById('archive-container');
const chaptersContainer = document.getElementById('chapters-container');
chaptersContainer.addEventListener('change', async (event) => {
    const select = event.target.closest('.activity-status-select');
    if (!select) return;

    const activityId = select.dataset.id;
    const newStatus = select.value;

    const { error } = await supabase
        .from('material_activities')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', activityId);

    if (error) {
        alert('Gagal mengubah status aktivitas: ' + error.message);
        await loadMaterials();
        return;
    }

    alert(newStatus === 'published'
        ? 'Aktivitas berhasil dipublikasikan!'
        : 'Aktivitas dikembalikan ke draft.');

    await loadMaterials();
});

// Menjalankan tombol Arsipkan pada setiap BAB
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.archive-chapter-btn');

    if (!button) return;

    const chapterId = button.dataset.id;

    openArchiveModal(chapterId);

});


// Membuka formulir Tambah Subbab
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.add-subbab-btn');

    if (!button) return;

    selectedParentChapterId = button.dataset.id;

    document
        .getElementById('add-subbab-modal')
        .classList.add('active');

});

// Membuka modal Tambah Aktivitas
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.add-activity-btn');

    if (!button) return;

    const materialId = button.dataset.id;

    openAddActivityModal(materialId);

});

// Membuka Editor Aktivitas
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.open-activity-editor-btn');

    if (!button) return;

    const activityId = button.dataset.id;

    window.location.href =
        `activity-editor.html?activityId=${encodeURIComponent(activityId)}`;

});

// Menutup modal Tambah Aktivitas
const activityModal = document.getElementById('add-activity-modal');

// Tombol X
document.getElementById('close-add-activity')
    .addEventListener('click', () => {
        activityModal.classList.remove('active');
        selectedActivityMaterialId = null;
    });

// Tombol Batal
document.getElementById('cancel-add-activity')
    .addEventListener('click', () => {
        activityModal.classList.remove('active');
        selectedActivityMaterialId = null;
    });

// Klik area luar modal
activityModal.addEventListener('click', (event) => {
    if (event.target === activityModal) {
        activityModal.classList.remove('active');
        selectedActivityMaterialId = null;
    }
});

// Menyimpan aktivitas melalui formulir
document.getElementById('add-activity-form')
    .addEventListener('submit', saveActivity);

// Menutup formulir Tambah Subbab
const subbabModal = document.getElementById('add-subbab-modal');

document.getElementById('close-add-subbab')
    .addEventListener('click', () => {
        subbabModal.classList.remove('active');
    });

document.getElementById('cancel-add-subbab')
    .addEventListener('click', () => {
        subbabModal.classList.remove('active');
    });

// Menutup modal jika area luar diklik
subbabModal.addEventListener('click', (event) => {
    if (event.target === subbabModal) {
        subbabModal.classList.remove('active');
    }
});

// Menyimpan subbab melalui formulir
document.getElementById('add-subbab-form')
    .addEventListener('submit', saveSubbab);


// Membuka formulir Edit Subbab
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.edit-subbab-btn');

    if (!button) return;

    const material = {
        id: button.dataset.id,
        title: button.dataset.title,
        description: button.dataset.description
    };

    openEditSubbab(material);

});

// Menutup formulir Edit Subbab
const editSubbabModal = document.getElementById('edit-subbab-modal');

document.getElementById('close-edit-subbab')
    .addEventListener('click', () => {
        editSubbabModal.classList.remove('active');
    });

document.getElementById('cancel-edit-subbab')
    .addEventListener('click', () => {
        editSubbabModal.classList.remove('active');
    });

// Menutup modal jika area luar diklik
editSubbabModal.addEventListener('click', (event) => {
    if (event.target === editSubbabModal) {
        editSubbabModal.classList.remove('active');
    }
});

// Menyimpan perubahan melalui formulir
document.getElementById('edit-subbab-form')
    .addEventListener('submit', updateSubbab);

    
// Menjalankan tombol Arsipkan Subbab
chaptersContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.archive-subbab-btn');

    if (!button) return;

    openArchiveSubbabModal(button.dataset.id);

});

// Tombol X untuk menutup modal arsip subbab
document.getElementById('close-archive-subbab')
    .addEventListener('click', closeArchiveSubbabModal);

// Tombol Batal
document.getElementById('cancel-archive-subbab')
    .addEventListener('click', closeArchiveSubbabModal);

// Klik area luar untuk menutup modal
document.getElementById('archive-subbab-modal')
    .addEventListener('click', (event) => {

        if (event.target.id === 'archive-subbab-modal') {
            closeArchiveSubbabModal();
        }

    });

// Tombol Ya, Arsipkan
document.getElementById('confirm-archive-subbab')
    .addEventListener('click', archiveSubbab);


// Menjalankan tombol Pulihkan BAB
archiveContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.restore-chapter-btn');

    if (!button) return;

    const chapterId = button.dataset.id;

    restoreChapter(chapterId);

});

// Menjalankan tombol Pulihkan Subbab
archiveContainer.addEventListener('click', (event) => {

    const button = event.target.closest('.restore-subbab-btn');

    if (!button) return;

    const subbabId = button.dataset.id;

    restoreSubbab(subbabId);

});

archiveButton.addEventListener('click', async () => {

    const archiveIsOpen = archiveContainer.style.display === 'block';

    if (archiveIsOpen) {
        // Kembali ke daftar BAB aktif
        archiveContainer.style.display = 'none';
        chaptersContainer.style.display = 'block';
        archiveButton.innerHTML = '<i class="fas fa-archive"></i> Arsip';

    } else {
        // Membuka daftar Arsip
        chaptersContainer.style.display = 'none';
        archiveContainer.style.display = 'block';
        archiveButton.textContent = 'Kembali ke Materi';

        await loadArchivedMaterials();
    }
});

    await loadMaterials();
}

init();
