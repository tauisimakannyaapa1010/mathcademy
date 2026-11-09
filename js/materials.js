
import { supabase } from '../supabase.js';
import { initTeacherNotifications } from './notification.js';

// Menyimpan identitas guru yang sedang login
let currentUser = null;
let selectedSubbabToDeleteId = null;
let selectedActivityToDeleteId = null;
let selectedChapterToDeleteId = null;
let selectedReorderChapterId = null;
let reorderMaterials = [];
let reorderChapters = [];
let reorderManagerSubbab = [];
let reorderManagerActivities = [];
let selectedReorderMaterialId = null;

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
    .select('full_name, role')
    .eq('id', user.id)
    .single();

    if (profileError || profile?.role !== 'teacher') {
        alert('Halaman ini hanya dapat diakses oleh guru.');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return false;
    }

    const teacherName = profile.full_name || 'Guru';

const nameElement = document.getElementById('teacherName');
const avatarElement = document.getElementById('teacherAvatar');

if (nameElement) {
    nameElement.textContent = teacherName;
}

if (avatarElement) {
    avatarElement.textContent = teacherName.trim().charAt(0).toUpperCase() || 'G';
}

currentUser = user;

// Inisialisasi sistem notifikasi guru
await initTeacherNotifications(user);

return true;
}
// Menampilkan daftar BAB untuk pengaturan urutan
// Menampilkan daftar BAB untuk pengaturan urutan
function renderReorderChapters() {
    const container = document.getElementById('reorder-manager-content');

    if (!container) return;

    if (reorderChapters.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:#64748b;">
                <i class="fas fa-folder-open" style="font-size:28px; margin-bottom:10px;"></i>
                <p>Belum ada BAB yang tersedia.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom:12px; color:#64748b; font-size:13px;">
            Gunakan panah untuk mengatur urutan BAB.
        </div>

        <div style="border-top:1px solid #e2e8f0;">
            ${reorderChapters.map((chapter, index) => `
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    padding:14px 8px;
                    border-bottom:1px solid #e2e8f0;
                    background:white;
                ">
                    <div style="
                        display:flex;
                        align-items:center;
                        gap:14px;
                        min-width:0;
                    ">
                        <span style="
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            width:30px;
                            height:30px;
                            flex-shrink:0;
                            border-radius:9px;
                            background:#ecfdf5;
                            color:#047857;
                            font-size:13px;
                            font-weight:700;
                        ">
                            ${index + 1}
                        </span>

                        <span style="
                            color:#334155;
                            font-size:14px;
                            font-weight:600;
                            overflow-wrap:anywhere;
                        ">
                            ${escapeHTML(chapter.title)}
                        </span>
                    </div>

                    <div style="display:flex; gap:5px; flex-shrink:0;">
                        <button
                            type="button"
                            class="move-chapter-up"
                            data-index="${index}"
                            aria-label="Naikkan urutan BAB"
                            ${index === 0 ? 'disabled' : ''}
                            style="
                                width:32px;
                                height:32px;
                                border:1px solid #e2e8f0;
                                border-radius:8px;
                                background:${index === 0 ? '#f8fafc' : '#ffffff'};
                                color:${index === 0 ? '#cbd5e1' : '#475569'};
                                cursor:${index === 0 ? 'not-allowed' : 'pointer'};
                                font-size:16px;
                            "
                        >↑</button>

                        <button
                            type="button"
                            class="move-chapter-down"
                            data-index="${index}"
                            aria-label="Turunkan urutan BAB"
                            ${index === reorderChapters.length - 1 ? 'disabled' : ''}
                            style="
                                width:32px;
                                height:32px;
                                border:1px solid #e2e8f0;
                                border-radius:8px;
                                background:${index === reorderChapters.length - 1 ? '#f8fafc' : '#ffffff'};
                                color:${index === reorderChapters.length - 1 ? '#cbd5e1' : '#475569'};
                                cursor:${index === reorderChapters.length - 1 ? 'not-allowed' : 'pointer'};
                                font-size:16px;
                            "
                        >↓</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}
// Menyimpan perubahan urutan BAB ke Supabase
async function saveReorderChapters() {
    const saveButton = document.getElementById('save-reorder-manager');

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';

    for (let i = 0; i < reorderChapters.length; i++) {
        const { error } = await supabase
            .from('chapters')
            .update({ position: i + 1 })
            .eq('id', reorderChapters[i].id);

        if (error) {
            alert('Gagal menyimpan urutan BAB: ' + error.message);
            saveButton.disabled = false;
            saveButton.textContent = 'Simpan Perubahan';
            return;
        }
    }

    alert('Urutan BAB berhasil disimpan!');

    saveButton.disabled = false;
    saveButton.textContent = 'Simpan Perubahan';

    await loadMaterials();
}
// Menyimpan perubahan urutan Subbab ke Supabase
async function saveReorderSubbab() {
    if (!selectedReorderChapterId) {
        alert('Silakan pilih BAB terlebih dahulu.');
        return;
    }

    if (reorderManagerSubbab.length === 0) {
        alert('Tidak ada Subbab yang perlu disimpan.');
        return;
    }

    const saveButton = document.getElementById('save-reorder-manager');

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';

    for (let index = 0; index < reorderManagerSubbab.length; index++) {
        const { error } = await supabase
            .from('materials')
            .update({ position: index + 1 })
            .eq('id', reorderManagerSubbab[index].id)
            .eq('chapter_id', selectedReorderChapterId);

        if (error) {
            alert('Gagal menyimpan urutan Subbab: ' + error.message);
            saveButton.disabled = false;
            saveButton.textContent = 'Simpan Perubahan';
            return;
        }
    }

    alert('Urutan Subbab berhasil disimpan!');

    saveButton.disabled = false;
    saveButton.textContent = 'Simpan Perubahan';

    await loadMaterials();
}
// Menyimpan urutan Aktivitas ke Supabase
async function saveReorderActivities() {
    if (!selectedReorderMaterialId) {
        alert('Silakan pilih BAB dan Subbab terlebih dahulu.');
        return;
    }

    if (reorderManagerActivities.length === 0) {
        alert('Tidak ada Aktivitas yang perlu disimpan.');
        return;
    }

    const saveButton = document.getElementById('save-reorder-manager');

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';

    for (let index = 0; index < reorderManagerActivities.length; index++) {
        const { error } = await supabase
            .from('material_activities')
            .update({ position: index + 1 })
            .eq('id', reorderManagerActivities[index].id)
            .eq('material_id', selectedReorderMaterialId);

        if (error) {
            alert('Gagal menyimpan urutan Aktivitas: ' + error.message);
            saveButton.disabled = false;
            saveButton.textContent = 'Simpan Perubahan';
            return;
        }
    }

    alert('Urutan Aktivitas berhasil disimpan!');

    saveButton.disabled = false;
    saveButton.textContent = 'Simpan Perubahan';

    await loadMaterials();
}

// Menampilkan daftar subbab pada modal pengaturan urutan
function renderReorderMaterials() {
    const container = document.getElementById('reorder-subbab-list');

    if (!reorderMaterials.length) {
        container.innerHTML = `
            <p style="text-align: center; color: #87917e; padding: 20px;">
                Belum ada subbab pada BAB ini.
            </p>
        `;
        return;
    }

    container.innerHTML = reorderMaterials.map((material, index) => `
        <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            margin-bottom: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #ffffff;
        ">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #ecfccb;
                    color: #365314;
                    border-radius: 8px;
                    font-weight: bold;
                    flex-shrink: 0;
                ">${index + 1}</span>

                <strong style="color: #26351d;">
                    ${escapeHTML(material.title)}
                </strong>
            </div>

            <div style="display: flex; gap: 6px;">
                <button
                    type="button"
                    class="move-subbab-up"
                    data-index="${index}"
                    ${index === 0 ? 'disabled' : ''}
                    style="padding: 6px 11px; border: 1px solid #d1d5db; border-radius: 7px; cursor: pointer;"
                >↑</button>

                <button
                    type="button"
                    class="move-subbab-down"
                    data-index="${index}"
                    ${index === reorderMaterials.length - 1 ? 'disabled' : ''}
                    style="padding: 6px 11px; border: 1px solid #d1d5db; border-radius: 7px; cursor: pointer;"
                >↓</button>
            </div>
        </div>
    `).join('');
}
// Mengatur perpindahan urutan subbab dengan tombol panah
document.getElementById('reorder-subbab-list')
    .addEventListener('click', (event) => {

        const upButton = event.target.closest('.move-subbab-up');
        const downButton = event.target.closest('.move-subbab-down');

        if (!upButton && !downButton) return;

        const index = Number(
            (upButton || downButton).dataset.index
        );

        if (upButton && index > 0) {
            [
                reorderMaterials[index - 1],
                reorderMaterials[index]
            ] = [
                reorderMaterials[index],
                reorderMaterials[index - 1]
            ];
        }

        if (downButton && index < reorderMaterials.length - 1) {
            [
                reorderMaterials[index],
                reorderMaterials[index + 1]
            ] = [
                reorderMaterials[index + 1],
                reorderMaterials[index]
            ];
        }

        renderReorderMaterials();
    });
// Menutup modal Atur Urutan Subbab
function closeReorderModal() {
    document
        .getElementById('reorder-subbab-modal')
        .classList.remove('active');
}
// Menyimpan urutan subbab ke Supabase
document.getElementById('save-reorder-subbab')
    .addEventListener('click', async () => {

        if (!selectedReorderChapterId) return;

        const saveButton = document.getElementById('save-reorder-subbab');

        saveButton.disabled = true;
        saveButton.textContent = 'Menyimpan...';

        for (let index = 0; index < reorderMaterials.length; index++) {

            const material = reorderMaterials[index];

            const { error } = await supabase
                .from('materials')
                .update({
                    position: index + 1
                })
                .eq('id', material.id);

            if (error) {
                alert('Gagal menyimpan urutan subbab: ' + error.message);

                saveButton.disabled = false;
                saveButton.textContent = 'Simpan Urutan';
                return;
            }
        }

        closeReorderModal();

        await loadMaterials();

        alert('Urutan subbab berhasil disimpan!');

        saveButton.disabled = false;
        saveButton.textContent = 'Simpan Urutan';
    });

document.getElementById('close-reorder-subbab')
    .addEventListener('click', closeReorderModal);

document.getElementById('cancel-reorder-subbab')
    .addEventListener('click', closeReorderModal);
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
        .select('id, title, description, status, chapter_id, position')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    if (materialError) {
        container.innerHTML = '<p>Gagal memuat subbab: ' +
            escapeHTML(materialError.message) + '</p>';
        return;
    }

    // Mengambil seluruh aktivitas
    const { data: activities, error: activityError } = await supabase
        .from('material_activities')
        .select('id, material_id, title, status, position, is_locked')
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

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">

    <h2 style="margin: 0;">
        ${String(index + 1).padStart(2, '0')}.
        ${escapeHTML(chapter.title)}
    </h2>

    <select
        class="chapter-status-select"
        data-id="${chapter.id}"
        style="
            padding: 7px 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: white;
            color: #365314;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        "
    >
        <option value="draft" ${chapter.status === 'draft' ? 'selected' : ''}>
            Draft
        </option>

        <option value="published" ${chapter.status === 'published' ? 'selected' : ''}>
            Published
        </option>

        <option value="delete">
            Hapus BAB
        </option>
    </select>

</div>

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

                                        <select
    class="subbab-status-select"
    data-id="${material.id}"
    style="
        padding: 7px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        color: #365314;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    "
>
    <option value="draft" ${material.status === 'draft' ? 'selected' : ''}>
        Draft
    </option>

    <option value="published" ${material.status === 'published' ? 'selected' : ''}>
        Published
    </option>
    <option value="delete">
        Hapus Subbab
    </option>
</select>


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
                                                            <option value="delete">
                                                                Hapus Aktivitas
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
    // Mengambil posisi subbab terakhir dalam BAB yang dipilih
const { data: existingMaterials, error: positionError } = await supabase
    .from('materials')
    .select('position')
    .eq('chapter_id', selectedParentChapterId);

if (positionError) {
    alert('Gagal menentukan urutan subbab: ' + positionError.message);
    return;
}

const nextPosition = existingMaterials.length
    ? Math.max(...existingMaterials.map(item => item.position || 0)) + 1
    : 1;

    const { error } = await supabase
        .from('materials')
        .insert({
            title: title,
            topic: chapter.title,
            description: description || null,
            chapter_id: selectedParentChapterId,
            status: 'draft',
            position: nextPosition,
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

    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">

        <span class="material-status">BAB Diarsipkan</span>

        <button
            class="restore-chapter-btn"
            data-id="${chapter.id}"
        >
            <i class="fas fa-undo"></i> Pulihkan BAB
        </button>

    </div>
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
// Mengatur status atau menghapus BAB
if (event.target.classList.contains('chapter-status-select')) {
    const chapterId = event.target.dataset.id;
    const newStatus = event.target.value;

    if (newStatus === 'delete') {
        selectedChapterToDeleteId = chapterId;

        document.getElementById('delete-chapter-modal').style.display = 'flex';

        await loadMaterials();
        return;
    }

    const { error } = await supabase
        .from('chapters')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', chapterId);

    if (error) {
        alert('Gagal mengubah status BAB: ' + error.message);
        await loadMaterials();
        return;
    }

    alert('Status BAB berhasil diperbarui!');
    await loadMaterials();
    return;
}
    // Mengubah status subbab
    const subbabSelect = event.target.closest('.subbab-status-select');

    if (subbabSelect) {
        const materialId = subbabSelect.dataset.id;
        const newStatus = subbabSelect.value;
            // Jika guru memilih hapus subbab
    if (newStatus === 'delete') {
        selectedSubbabToDeleteId = materialId;

        document.getElementById('delete-subbab-modal').style.display = 'flex';

        // Kembalikan dropdown ke status sebelumnya
        await loadMaterials();

        return;
    }

        const { error } = await supabase
            .from('materials')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', materialId);

        if (error) {
            alert('Gagal mengubah status subbab: ' + error.message);
            await loadMaterials();
            return;
        }

        alert(
            newStatus === 'published'
                ? 'Subbab berhasil dipublikasikan!'
                : 'Subbab dikembalikan ke draft.'
        );

        await loadMaterials();
        return;
    }

    // Handler status aktivitas yang lama tetap dilanjutkan di bawah ini
    const select = event.target.closest('.activity-status-select');
    if (!select) return;

    const activityId = select.dataset.id;
    const newStatus = select.value;

    // Jika guru memilih hapus aktivitas
if (newStatus === 'delete') {

    selectedActivityToDeleteId = activityId;

    document.getElementById('delete-activity-modal').style.display = 'flex';

    // Mengembalikan dropdown ke status sebelumnya
    await loadMaterials();

    return;
}

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

// Menutup modal hapus subbab
const deleteSubbabModal = document.getElementById('delete-subbab-modal');

document.getElementById('cancel-delete-subbab').addEventListener('click', () => {
    deleteSubbabModal.style.display = 'none';
    selectedSubbabToDeleteId = null;
});
// Membatalkan penghapusan BAB
document.getElementById('cancel-delete-chapter').addEventListener('click', () => {
    document.getElementById('delete-chapter-modal').style.display = 'none';
    selectedChapterToDeleteId = null;
});

document.getElementById('close-delete-subbab').addEventListener('click', () => {
    deleteSubbabModal.style.display = 'none';
    selectedSubbabToDeleteId = null;
});

// Menutup modal hapus aktivitas
const deleteActivityModal = document.getElementById('delete-activity-modal');

document.getElementById('cancel-delete-activity').addEventListener('click', () => {
    deleteActivityModal.style.display = 'none';
    selectedActivityToDeleteId = null;
});

document.getElementById('close-delete-activity').addEventListener('click', () => {
    deleteActivityModal.style.display = 'none';
    selectedActivityToDeleteId = null;
});
// Menghapus aktivitas secara permanen
document.getElementById('confirm-delete-activity').addEventListener('click', async () => {

    if (!selectedActivityToDeleteId) return;

    const { error } = await supabase
        .from('material_activities')
        .delete()
        .eq('id', selectedActivityToDeleteId);

    if (error) {
        alert('Gagal menghapus aktivitas: ' + error.message);
        return;
    }

    deleteActivityModal.style.display = 'none';
    selectedActivityToDeleteId = null;

    alert('Aktivitas berhasil dihapus permanen.');

    await loadMaterials();
});
// Menghapus subbab secara permanen
document.getElementById('confirm-delete-subbab').addEventListener('click', async () => {

    if (!selectedSubbabToDeleteId) return;

    const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', selectedSubbabToDeleteId);

    if (error) {
        alert('Gagal menghapus subbab: ' + error.message);
        return;
    }

    deleteSubbabModal.style.display = 'none';
    selectedSubbabToDeleteId = null;

    alert('Subbab dan seluruh aktivitas di dalamnya berhasil dihapus permanen.');

    await loadMaterials();
});
// Menghapus BAB beserta seluruh subbab dan aktivitas
document.getElementById('confirm-delete-chapter').addEventListener('click', async () => {
    if (!selectedChapterToDeleteId) return;

    const chapterId = selectedChapterToDeleteId;
    const confirmButton = document.getElementById('confirm-delete-chapter');

    confirmButton.disabled = true;
    confirmButton.textContent = 'Menghapus...';

    try {
        // 1. Ambil seluruh ID subbab dalam BAB
        const { data: materials, error: materialsError } = await supabase
            .from('materials')
            .select('id')
            .eq('chapter_id', chapterId);

        if (materialsError) throw materialsError;

        const materialIds = materials.map(item => item.id);

        if (materialIds.length > 0) {
            // 2. Hapus riwayat aktivitas murid
            const { error: progressError } = await supabase
                .from('student_activity_progress')
                .delete()
                .in('material_id', materialIds);

            if (progressError) throw progressError;

            // 3. Hapus seluruh aktivitas dalam subbab
            const { error: activityError } = await supabase
                .from('material_activities')
                .delete()
                .in('material_id', materialIds);

            if (activityError) throw activityError;

            // 4. Hapus seluruh subbab
            const { error: subbabError } = await supabase
                .from('materials')
                .delete()
                .eq('chapter_id', chapterId);

            if (subbabError) throw subbabError;
        }

        // 5. Hapus BAB
        const { error: chapterError } = await supabase
            .from('chapters')
            .delete()
            .eq('id', chapterId);

        if (chapterError) throw chapterError;

        document.getElementById('delete-chapter-modal').style.display = 'none';

        selectedChapterToDeleteId = null;

        alert('BAB beserta seluruh subbab dan aktivitas berhasil dihapus permanen!');

        await loadMaterials();

    } catch (error) {
        console.error('Gagal menghapus BAB:', error);
        alert('Gagal menghapus BAB: ' + error.message);
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Ya, Hapus Permanen';
    }
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

// Membuka modal Kelola Urutan
const openReorderManager = document.getElementById('open-reorder-manager');
const reorderManagerModal = document.getElementById('reorder-manager-modal');

if (openReorderManager && reorderManagerModal) {
    openReorderManager.addEventListener('click', () => {
        reorderManagerModal.classList.add('active');
    });
}

// Menutup modal Kelola Urutan
const closeReorderManager = document.getElementById('close-reorder-manager');
const cancelReorderManager = document.getElementById('cancel-reorder-manager');

function closeReorderManagerModal() {
    reorderManagerModal?.classList.remove('active');
}

closeReorderManager?.addEventListener('click', closeReorderManagerModal);
cancelReorderManager?.addEventListener('click', closeReorderManagerModal);
// Mengatur perpindahan tab Kelola Urutan
const reorderTabs = document.querySelectorAll('.reorder-tab');
const reorderManagerContent = document.getElementById('reorder-manager-content');
// Mengatur perpindahan posisi Subbab
reorderManagerContent?.addEventListener('click', (event) => {
    const upButton = event.target.closest('.move-manager-subbab-up');
    const downButton = event.target.closest('.move-manager-subbab-down');

    if (!upButton && !downButton) return;

    const index = Number((upButton || downButton).dataset.index);
    let targetIndex = index;

    if (upButton && index > 0) {
        targetIndex = index - 1;
    }

    if (downButton && index < reorderManagerSubbab.length - 1) {
        targetIndex = index + 1;
    }

    if (targetIndex === index) return;

    [reorderManagerSubbab[index], reorderManagerSubbab[targetIndex]] =
        [reorderManagerSubbab[targetIndex], reorderManagerSubbab[index]];

    const subbabContainer = document.getElementById('reorder-subbab-manager-list');

    subbabContainer.innerHTML = reorderManagerSubbab.map((item, index) => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid #e2e8f0;">
            <span style="background:#ecfdf5; color:#047857; padding:6px 10px; border-radius:8px; font-weight:700;">
                ${index + 1}
            </span>

            <span style="flex:1; color:#334155; font-weight:600;">
                ${escapeHTML(item.title)}
            </span>

            <div style="display:flex; gap:5px;">
                <button type="button" class="move-manager-subbab-up"
                    data-index="${index}" ${index === 0 ? 'disabled' : ''}
                    style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↑</button>

                <button type="button" class="move-manager-subbab-down"
                    data-index="${index}" ${index === reorderManagerSubbab.length - 1 ? 'disabled' : ''}
                    style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↓</button>
            </div>
        </div>
    `).join('');
});
// Mengatur perpindahan posisi BAB
reorderManagerContent?.addEventListener('click', (event) => {
    const upButton = event.target.closest('.move-chapter-up');
    const downButton = event.target.closest('.move-chapter-down');

    if (!upButton && !downButton) return;

    const index = Number((upButton || downButton).dataset.index);
    let targetIndex = index;

    if (upButton && index > 0) targetIndex = index - 1;
    if (downButton && index < reorderChapters.length - 1) {
        targetIndex = index + 1;
    }

    if (targetIndex === index) return;

    [reorderChapters[index], reorderChapters[targetIndex]] =
        [reorderChapters[targetIndex], reorderChapters[index]];

    renderReorderChapters();
});
// Mengatur perpindahan urutan Aktivitas
reorderManagerContent?.addEventListener('click', (event) => {
    const upButton = event.target.closest('.move-manager-activity-up');
    const downButton = event.target.closest('.move-manager-activity-down');

    if (!upButton && !downButton) return;

    const index = Number((upButton || downButton).dataset.index);
    let targetIndex = index;

    if (upButton && index > 0) {
        targetIndex = index - 1;
    }

    if (downButton && index < reorderManagerActivities.length - 1) {
        targetIndex = index + 1;
    }

    if (targetIndex === index) return;

    [reorderManagerActivities[index], reorderManagerActivities[targetIndex]] =
        [reorderManagerActivities[targetIndex], reorderManagerActivities[index]];

    const activityContainer = document.getElementById('reorder-activity-manager-list');

    activityContainer.innerHTML = reorderManagerActivities.map((item, index) => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid #e2e8f0;">
            <span style="background:#ecfdf5; color:#047857; padding:6px 10px; border-radius:8px; font-weight:700;">
                ${index + 1}
            </span>

            <span style="flex:1; color:#334155; font-weight:600;">
                ${escapeHTML(item.title)}
            </span>

            <div style="display:flex; gap:5px;">
                <button type="button" class="move-manager-activity-up"
                    data-index="${index}" ${index === 0 ? 'disabled' : ''}
                    style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↑</button>

                <button type="button" class="move-manager-activity-down"
                    data-index="${index}" ${index === reorderManagerActivities.length - 1 ? 'disabled' : ''}
                    style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↓</button>
            </div>
        </div>
    `).join('');
});
reorderTabs.forEach(tab => {
    tab.addEventListener('click', async () => {

        // Menghapus status aktif dari semua tab
        reorderTabs.forEach(item => {
            item.classList.remove('active');
        });
        // Mengaktifkan tab yang dipilih
        tab.classList.add('active');

        const selectedTab = tab.dataset.tab;

        if (selectedTab === 'bab') {

    reorderManagerContent.innerHTML = `
        <p style="color:#64748b;">Memuat daftar BAB...</p>
    `;

    const { data, error } = await supabase
        .from('chapters')
        .select('id, title, position')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    if (error) {
        console.error('Gagal mengambil data BAB:', error);

        reorderManagerContent.innerHTML = `
            <p style="color:#dc2626;">Gagal memuat daftar BAB.</p>
        `;

        return;
    }

    reorderChapters = data || [];

    renderReorderChapters();
}

        if (selectedTab === 'subbab') {
    reorderManagerContent.innerHTML = `
        <div style="margin-bottom:16px;">
            <label for="reorder-chapter-select"
                style="display:block; margin-bottom:8px; font-weight:600; color:#334155;">
                Pilih BAB
            </label>

            <select id="reorder-chapter-select"
                style="width:100%; padding:11px; border:1px solid #cbd5e1;
                border-radius:9px; background:white; color:#334155;">
                <option value="">Memuat daftar BAB...</option>
            </select>
        </div>

        <div id="reorder-subbab-manager-list"></div>
    `;

    const { data, error } = await supabase
        .from('chapters')
        .select('id, title')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    const chapterSelect = document.getElementById('reorder-chapter-select');

    if (error) {
        chapterSelect.innerHTML = '<option value="">Gagal memuat BAB</option>';
        return;
    }

    chapterSelect.innerHTML = `
        <option value="">-- Pilih BAB --</option>
        ${(data || []).map(chapter => `
            <option value="${chapter.id}">
                ${escapeHTML(chapter.title)}
            </option>
        `).join('')}
    `;
    chapterSelect.addEventListener('change', async () => {
    const chapterId = chapterSelect.value;
    const subbabContainer = document.getElementById('reorder-subbab-manager-list');

    selectedReorderChapterId = chapterId;

    if (!chapterId) {
        subbabContainer.innerHTML = '';
        return;
    }

    subbabContainer.innerHTML = '<p>Memuat daftar Subbab...</p>';

    const { data: subbabList, error: subbabError } = await supabase
        .from('materials')
        .select('id, title, position')
        .eq('chapter_id', chapterId)
        .eq('is_archived', false)
        .order('position', { ascending: true });

    if (subbabError) {
        subbabContainer.innerHTML = '<p>Gagal memuat Subbab: ' + escapeHTML(subbabError.message) + '</p>';
        return;
    }
    reorderManagerSubbab = subbabList || [];
    if (!subbabList || subbabList.length === 0) {
        subbabContainer.innerHTML = '<p>Belum ada Subbab pada BAB ini.</p>';
        return;
    }

    subbabContainer.innerHTML = reorderManagerSubbab.map((item, index) => `
    <div style="display:flex; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid #e2e8f0;">
        <span style="background:#ecfdf5; color:#047857; padding:6px 10px; border-radius:8px; font-weight:700;">
            ${index + 1}
        </span>

        <span style="flex:1; color:#334155; font-weight:600;">
            ${escapeHTML(item.title)}
        </span>

        <div style="display:flex; gap:5px;">
            <button type="button" class="move-manager-subbab-up"
                data-index="${index}"
                ${index === 0 ? 'disabled' : ''}
                style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">
                ↑
            </button>

            <button type="button" class="move-manager-subbab-down"
                data-index="${index}"
                ${index === reorderManagerSubbab.length - 1 ? 'disabled' : ''}
                style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">
                ↓
            </button>
        </div>
    </div>
`).join('');
});
}

        if (selectedTab === 'aktivitas') {
    reorderManagerContent.innerHTML = `
        <div style="margin-bottom:16px;">
            <label for="reorder-activity-chapter-select"
                style="display:block; margin-bottom:8px; font-weight:600; color:#334155;">
                Pilih BAB
            </label>

            <select id="reorder-activity-chapter-select"
                style="width:100%; padding:11px; border:1px solid #cbd5e1;
                border-radius:9px; background:white; color:#334155;">
                <option value="">Memuat daftar BAB...</option>
            </select>
        </div>

        <div style="margin-bottom:16px;">
            <label for="reorder-activity-subbab-select"
                style="display:block; margin-bottom:8px; font-weight:600; color:#334155;">
                Pilih Subbab
            </label>

            <select id="reorder-activity-subbab-select"
                disabled
                style="width:100%; padding:11px; border:1px solid #cbd5e1;
                border-radius:9px; background:#f8fafc; color:#334155;">
                <option value="">Pilih BAB terlebih dahulu</option>
            </select>
        </div>

        <div id="reorder-activity-manager-list"></div>
    `;

    const { data: chapters, error } = await supabase
        .from('chapters')
        .select('id, title')
        .eq('is_archived', false)
        .order('position', { ascending: true });

    const chapterSelect = document.getElementById('reorder-activity-chapter-select');

    if (error) {
        chapterSelect.innerHTML = '<option value="">Gagal memuat BAB</option>';
        return;
    }

    chapterSelect.innerHTML = `
        <option value="">-- Pilih BAB --</option>
        ${(chapters || []).map(chapter => `
            <option value="${chapter.id}">
                ${escapeHTML(chapter.title)}
            </option>
        `).join('')}
    `;
        const subbabSelect = document.getElementById('reorder-activity-subbab-select');

    chapterSelect.addEventListener('change', async () => {
        const chapterId = chapterSelect.value;

        selectedReorderMaterialId = null;
        reorderManagerActivities = [];

        subbabSelect.disabled = true;
        subbabSelect.innerHTML = '<option value="">Memuat Subbab...</option>';

        document.getElementById('reorder-activity-manager-list').innerHTML = '';

        if (!chapterId) {
            subbabSelect.innerHTML = '<option value="">Pilih BAB terlebih dahulu</option>';
            return;
        }

        const { data: subbabList, error: subbabError } = await supabase
            .from('materials')
            .select('id, title')
            .eq('chapter_id', chapterId)
            .eq('is_archived', false)
            .order('position', { ascending: true });

        if (subbabError) {
            subbabSelect.innerHTML = '<option value="">Gagal memuat Subbab</option>';
            console.error('Gagal mengambil Subbab:', subbabError);
            return;
        }

        subbabSelect.innerHTML = `
            <option value="">-- Pilih Subbab --</option>
            ${(subbabList || []).map(subbab => `
                <option value="${subbab.id}">
                    ${escapeHTML(subbab.title)}
                </option>
            `).join('')}
        `;

        subbabSelect.disabled = false;
                subbabSelect.addEventListener('change', async () => {
            const materialId = subbabSelect.value;

            selectedReorderMaterialId = materialId;
            reorderManagerActivities = [];

            const activityContainer = document.getElementById('reorder-activity-manager-list');

            if (!materialId) {
                activityContainer.innerHTML = '';
                return;
            }

            activityContainer.innerHTML = '<p style="color:#64748b;">Memuat daftar Aktivitas...</p>';

            const { data: activityList, error: activityError } = await supabase
                .from('material_activities')
                .select('id, material_id, title, position')
                .eq('material_id', materialId)
                .order('position', { ascending: true });

            if (activityError) {
                activityContainer.innerHTML = '<p style="color:#dc2626;">Gagal memuat Aktivitas.</p>';
                console.error('Gagal mengambil Aktivitas:', activityError);
                return;
            }

            reorderManagerActivities = activityList || [];

            if (reorderManagerActivities.length === 0) {
                activityContainer.innerHTML = '<p style="color:#64748b;">Belum ada Aktivitas pada Subbab ini.</p>';
                return;
            }

            activityContainer.innerHTML = reorderManagerActivities.map((item, index) => `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid #e2e8f0;">
                    <span style="background:#ecfdf5; color:#047857; padding:6px 10px; border-radius:8px; font-weight:700;">
                        ${index + 1}
                    </span>

                    <span style="flex:1; color:#334155; font-weight:600;">
                        ${escapeHTML(item.title)}
                    </span>

                    <div style="display:flex; gap:5px;">
                        <button type="button" class="move-manager-activity-up"
                            data-index="${index}" ${index === 0 ? 'disabled' : ''}
                            style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↑</button>

                        <button type="button" class="move-manager-activity-down"
                            data-index="${index}" ${index === reorderManagerActivities.length - 1 ? 'disabled' : ''}
                            style="border:1px solid #d1d5db; background:white; border-radius:7px; padding:5px 9px; cursor:pointer;">↓</button>
                    </div>
                </div>
            `).join('');
        });
    });
}
    });
});
// Menyimpan urutan sesuai tab yang sedang dibuka
document.getElementById('save-reorder-manager')
    ?.addEventListener('click', () => {
        const activeTab = document.querySelector('.reorder-tab.active')?.dataset.tab;

        if (activeTab === 'bab') {
            saveReorderChapters();
        } else if (activeTab === 'subbab') {
            saveReorderSubbab();
        } else if (activeTab === 'aktivitas') {
            saveReorderActivities();
        }
    });
