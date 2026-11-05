
import { supabase } from '../supabase.js';

// Elemen halaman
const activityTitle = document.getElementById('activity-title');
const activityMessage = document.getElementById('activity-message');
const activityContent = document.getElementById('activity-content');
const completeButton = document.getElementById('complete-activity-btn');

// Ambil ID aktivitas dari URL
const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

let currentUser = null;
let currentMaterialId = null;

// Status aktivitas
let isReadOnly = false;
let savedAnswers = new Map();

// Penghitung penyelesaian aktivitas
let totalChallenges = 0;
let completedChallenges = 0;

// Memperbarui status tombol selesai
function updateCompletionButton() {
    if (!completeButton) return;

    completeButton.disabled =
        totalChallenges === 0 ||
        completedChallenges < totalChallenges;

    console.log('Status penyelesaian:', {
        totalChallenges,
        completedChallenges,
        tombolAktif: !completeButton.disabled
    });
}

// Mencatat tantangan yang berhasil diselesaikan
function completeChallenge() {
    completedChallenges++;
    updateCompletionButton();
}

// Ambil akun murid yang sedang login
async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        throw new Error('Silakan login terlebih dahulu.');
    }

    currentUser = data.user;
}

// Tampilkan pesan
function showMessage(message) {
    activityMessage.textContent = message;
}


// Simpan progres aktivitas murid
async function saveActivityProgress() {
    try {
        if (!currentUser || !currentMaterialId || !activityId) {
            throw new Error('Data aktivitas atau akun murid tidak lengkap.');
        }

        completeButton.disabled = true;
        completeButton.textContent = 'Menyimpan...';

        const { error } = await supabase
            .from('student_activity_progress')
            .upsert({
                student_id: currentUser.id,
                material_id: currentMaterialId,
                activity_id: activityId,
                completed_at: new Date().toISOString()
           }, {
                onConflict: 'student_id,material_id,activity_id'
        });

        if (error) {
            throw error;
        }

        completeButton.textContent = '✓ Aktivitas Selesai!';
        completeButton.disabled = true;

        showMessage(
            'Yeay! Kamu berhasil menyelesaikan aktivitas ini. Siap melanjutkan ke aktivitas berikutnya?'
        );

        activityMessage.classList.add('success-message');
        activityMessage.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

    } catch (error) {
        console.error('Gagal menyimpan progres:', error);

        completeButton.disabled = false;
        completeButton.textContent = 'Selesaikan aktivitas';

        showMessage(
            error.message || 'Gagal menyimpan progres. Silakan coba lagi.'
        );
    }
}

// Ambil aktivitas dari Supabase
async function loadActivity() {
    try {
        if (!activityId) {
            throw new Error('ID aktivitas tidak ditemukan.');
        }

        await getCurrentUser();

        const { data, error } = await supabase
            .from('material_activities')
            .select('id, title, content, status, material_id')
            .eq('id', activityId)
            .eq('status', 'published')
            .single();

        if (error) {
            throw error;
        }

        activityTitle.textContent = data.title;
        currentMaterialId = data.material_id;
        // Periksa apakah aktivitas sudah pernah diselesaikan
const { data: existingProgress, error: progressError } = await supabase
    .from('student_activity_progress')
    .select('activity_id')
    .eq('student_id', currentUser.id)
    .eq('material_id', currentMaterialId)
    .eq('activity_id', activityId)
    .maybeSingle();

if (progressError) {
    throw progressError;
}

isReadOnly = !!existingProgress;

        // Memeriksa urutan aktivitas dalam subbab
const { data: allActivities, error: allActivitiesError } =
    await supabase
        .from('material_activities')
        .select('id')
        .eq('material_id', currentMaterialId)
        .eq('status', 'published')
        .eq('is_archived', false)
        .order('position', { ascending: true });

if (allActivitiesError) {
    throw allActivitiesError;
}

// Menentukan posisi aktivitas saat ini
const currentIndex = allActivities.findIndex(
    activity => activity.id === activityId
);

// Jika bukan aktivitas pertama, periksa aktivitas sebelumnya
if (currentIndex > 0) {
    const previousActivityId = allActivities[currentIndex - 1].id;

    const { data: previousProgress, error: previousProgressError } =
        await supabase
            .from('student_activity_progress')
            .select('activity_id')
            .eq('student_id', currentUser.id)
            .eq('material_id', currentMaterialId)
            .eq('activity_id', previousActivityId)
            .maybeSingle();

    if (previousProgressError) {
        throw previousProgressError;
    }

    if (!previousProgress) {
        activityContent.innerHTML = '';
        completeButton.style.display = 'none';

        showMessage(
            '🔒 Aktivitas ini masih terkunci. Selesaikan aktivitas sebelumnya terlebih dahulu, ya!'
        );

        return;
    }
}

        // Mendukung format array maupun object { blocks: [] }
        let blocks = [];

        if (Array.isArray(data.content)) {
            blocks = data.content;
        } else if (
            data.content &&
            Array.isArray(data.content.blocks)
        ) {
            blocks = data.content.blocks;
        }

        if (blocks.length === 0) {
    showMessage('Aktivitas ini belum memiliki materi.');
    return;
}

// Ambil jawaban sebelumnya jika aktivitas sudah selesai
savedAnswers = new Map();

if (isReadOnly) {
    const { data: answers, error: answersError } = await supabase
        .from('student_activity_answers')
        .select('block_id, answer, is_correct')
        .eq('student_id', currentUser.id)
        .eq('activity_id', activityId);

    if (answersError) {
        throw answersError;
    }

    (answers || []).forEach(item => {
        savedAnswers.set(item.block_id, item);
    });
    console.log('ID murid:', currentUser.id);
    console.log('ID aktivitas:', activityId);
    console.log('Jawaban dari Supabase:', answers);
    console.log('Isi savedAnswers:', [...savedAnswers.entries()]);

    completeButton.style.display = 'none';
    showMessage('Aktivitas ini sudah selesai. Kamu sedang melihat kembali jawabanmu.');
} else {
    completeButton.style.display = 'inline-block';
}

activityContent.innerHTML = '';

        blocks.forEach((block, index) => {
            renderBlock(block, index);
        });

        // Pulihkan jumlah tantangan yang sudah benar sebelumnya
if (isReadOnly) {
    completedChallenges = [...savedAnswers.values()]
        .filter(answer => answer.is_correct === true)
        .length;

    updateCompletionButton();
}

        console.log('Total tantangan yang terdeteksi:', totalChallenges);

        console.log('Blok aktivitas yang terbaca:', blocks);

        // Render ulang rumus matematika
        if (window.MathJax) {
            await MathJax.typesetPromise([activityContent]);
        }

        if (!isReadOnly) {
    showMessage('');
}

    } catch (error) {
        console.error('Gagal memuat aktivitas:', error);
        showMessage(error.message || 'Terjadi kesalahan saat memuat aktivitas.');
    }
}

// Tampilkan setiap jenis blok
function renderBlock(block, index) {
    // Memberikan ID cadangan untuk blok lama yang belum memiliki ID
if (!block.id) {
    block.id = `block-${index}`;
}
    console.log('DATA BLOK AKTIVITAS:', block);
    const wrapper = document.createElement('section');
    wrapper.className = 'student-activity-block';

    // BLOK TEKS
    if (block.type === 'text') {
        if (block.title) {
            const heading = document.createElement('h2');
            heading.textContent = block.title;
            wrapper.appendChild(heading);
        }

        const content = document.createElement('div');
        content.className = 'student-text-content';

        // Konten berasal dari editor guru.
        // Hapus elemen dan atribut berbahaya sebelum ditampilkan.
        content.innerHTML = sanitizeHTML(block.content || '');

        // Tampilkan rumus inline dari MathLive
        content.querySelectorAll('.saved-inline-math').forEach(el => {
            const formula = el.dataset.formula || el.textContent;
            const math = document.createElement('span');

            math.textContent = `\\(${formula}\\)`;
            el.replaceWith(math);
        });

        wrapper.appendChild(content);
    }
    // BLOK PEMBATAS
else if (block.type === 'divider') {
    const divider = document.createElement('hr');

    divider.className = 'student-divider';

    divider.style.cssText = `
        border: none;
        border-top: 2px solid #b7d8ce;
        width: 100%;
        margin: 30px 0;
    `;

    wrapper.appendChild(divider);
}
// BLOK PDF
else if (block.type === 'pdf') {
    if (block.title) {
        const heading = document.createElement('h2');
        heading.textContent = block.title;
        wrapper.appendChild(heading);
    }

    if (block.url) {
        const pdfFrame = document.createElement('iframe');

        pdfFrame.src = block.url;
        pdfFrame.title = block.title || 'Dokumen PDF';
        pdfFrame.style.cssText = `
            display: block;
            width: 100%;
            height: 650px;
            border: 1px solid #d9e8e3;
            border-radius: 12px;
            background: white;
        `;

        wrapper.appendChild(pdfFrame);

        const downloadLink = document.createElement('a');
        downloadLink.href = block.url;
        downloadLink.target = '_blank';
        downloadLink.rel = 'noopener noreferrer';
        downloadLink.textContent = '↓ Buka atau unduh PDF';
        downloadLink.style.cssText = `
            display: inline-block;
            margin-top: 12px;
            color: #28796b;
            font-weight: 600;
            text-decoration: none;
        `;

        wrapper.appendChild(downloadLink);
    } else {
        const message = document.createElement('p');
        message.textContent = 'Dokumen PDF belum tersedia.';
        wrapper.appendChild(message);
    }
}

    // BLOK GAMBAR
    else if (block.type === 'image') {
        const image = document.createElement('img');
        image.src = block.url;
        image.alt = block.caption || 'Gambar materi';
        image.className = 'student-material-image';
        image.loading = 'lazy';
        wrapper.appendChild(image);

        if (block.caption) {
            const caption = document.createElement('p');
            caption.className = 'image-caption';
            caption.textContent = block.caption;
            wrapper.appendChild(caption);
        }
    }

        // BLOK VIDEO
    else if (block.type === 'video') {
        if (block.title) {
            const heading = document.createElement('h2');
            heading.textContent = block.title;
            wrapper.appendChild(heading);
        }

        const videoFrame = document.createElement('iframe');
        videoFrame.src = getYouTubeEmbedUrl(block.url);

        videoFrame.title = block.title || 'Video pembelajaran';
        videoFrame.width = '100%';
        videoFrame.height = '450';
        videoFrame.style.border = '0';
        videoFrame.style.borderRadius = '12px';
        videoFrame.allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        videoFrame.allowFullscreen = true;
        videoFrame.loading = 'lazy';

        wrapper.appendChild(videoFrame);
    }

    // BLOK RUMUS MATEMATIKA
else if (block.type === 'math') {
    const formula = document.createElement('div');
    formula.className = 'student-math-block';

    formula.innerHTML = `\\[${block.formula || ''}\\]`;

    wrapper.appendChild(formula);
}

    // BLOK PILIHAN GANDA
    else if (block.type === 'multiple-choice') {
        renderMultipleChoice(block, wrapper);
    }

    // BLOK DRAG AND DROP
else if (block.type === 'drag-drop') {
    renderDragDrop(block, wrapper);
}

// BLOK SHORT ANSWER
else if (block.type === 'short-answer') {
    renderShortAnswer(block, wrapper);
}

else {
    console.warn('Tipe blok belum didukung:', block.type);
    return;
}

    activityContent.appendChild(wrapper);
}

// SHORT ANSWER
async function renderShortAnswer(block, wrapper) {
    totalChallenges++;

    const blockId = block.id;
    let answered = false;

    const question = document.createElement('h3');

    renderRichContent(
        question,
        block.question || 'Jawablah pertanyaan berikut.'
    );
    wrapper.appendChild(question);

    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    answerInput.placeholder = 'Ketik jawabanmu di sini...';
    answerInput.className = 'short-answer-input';

    answerInput.style.width = '100%';
    answerInput.style.padding = '14px';
    answerInput.style.marginTop = '15px';
    answerInput.style.border = '1px solid #cbd5e1';
    answerInput.style.borderRadius = '10px';
    answerInput.style.fontFamily = 'DM Sans, sans-serif';

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'student-option';
    submitButton.style.marginTop = '15px';
    submitButton.textContent = 'Periksa Jawaban';

    const feedback = document.createElement('p');
    feedback.className = 'answer-feedback';

    const previousAnswer = savedAnswers.get(blockId);
    const correctAnswer = String(block.answer || '').trim();

    // MODE REVIEW
    if (isReadOnly) {
        answered = true;

        answerInput.value = previousAnswer?.answer || '';
        answerInput.disabled = true;
        submitButton.style.display = 'none';

        if (previousAnswer?.is_correct) {
            answerInput.style.background = '#ecfccb';
            answerInput.style.border = '2px solid #65a30d';
            answerInput.style.color = '#365314';

            feedback.textContent =
                '✓ Jawabanmu benar! ' +
                (block.explanation || 'Jawabanmu tepat.');

            feedback.className = 'answer-feedback correct';
        } else if (previousAnswer) {
            answerInput.style.background = '#fef2f2';
            answerInput.style.border = '2px solid #ef4444';
            answerInput.style.color = '#b91c1c';

            feedback.textContent =
                'Jawaban terakhir yang kamu pilih belum tepat. ' +
                'Jawaban yang benar adalah: ' +
                correctAnswer + '. ' +
                (block.explanation || '');

            feedback.className = 'answer-feedback incorrect';
        } else {
            feedback.textContent =
                'Tidak ada jawaban tersimpan untuk soal ini.';
            feedback.className = 'answer-feedback incorrect';
        }
    }

    // MODE MENGERJAKAN
    submitButton.addEventListener('click', async () => {
        if (answered || isReadOnly) return;

        const studentAnswer = answerInput.value.trim();

        if (!studentAnswer) {
            feedback.textContent =
                'Isi jawabanmu terlebih dahulu, ya!';
            feedback.className = 'answer-feedback incorrect';
            return;
        }

        const isCorrect =
            studentAnswer.toLowerCase() === correctAnswer.toLowerCase();

        submitButton.disabled = true;

        const { error } = await supabase
            .from('student_activity_answers')
            .upsert({
                student_id: currentUser.id,
                material_id: currentMaterialId,
                activity_id: activityId,
                block_id: blockId,
                answer: studentAnswer,
                is_correct: isCorrect,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'student_id,activity_id,block_id'
            });

        if (error) {
            console.error('Gagal menyimpan jawaban:', error);

            feedback.textContent =
                'Jawaban belum berhasil disimpan. Coba lagi, ya!';
            feedback.className = 'answer-feedback incorrect';

            submitButton.disabled = false;
            return;
        }

        if (isCorrect) {
            answered = true;
            completeChallenge();

            answerInput.disabled = true;
            answerInput.style.background = '#ecfccb';
            answerInput.style.border = '2px solid #65a30d';
            answerInput.style.color = '#365314';

            feedback.textContent =
                '✓ Benar! ' +
                (block.explanation || 'Jawabanmu tepat.');

            feedback.className = 'answer-feedback correct';

            submitButton.disabled = true;
        } else {
            feedback.textContent =
                'Belum tepat. Coba pikirkan kembali dan periksa jawabanmu.';

            feedback.className = 'answer-feedback incorrect';

            submitButton.disabled = false;
        }
    });

    wrapper.append(answerInput, submitButton, feedback);
}

// Mengubah link YouTube menjadi link embed
function getYouTubeEmbedUrl(url) {
    if (!url) return '';

    let videoId = '';

    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes('youtu.be')) {
            videoId = parsedUrl.pathname.slice(1);
        } else if (parsedUrl.hostname.includes('youtube.com')) {
            if (parsedUrl.pathname === '/watch') {
                videoId = parsedUrl.searchParams.get('v');
            } else if (parsedUrl.pathname.startsWith('/embed/')) {
                videoId = parsedUrl.pathname.split('/')[2];
            } else if (parsedUrl.pathname.startsWith('/shorts/')) {
                videoId = parsedUrl.pathname.split('/')[2];
            }
        }
    } catch (error) {
        console.error('Link YouTube tidak valid:', error);
        return '';
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return '';
    }

    return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// Mengubah HTML yang tersimpan dalam bentuk escaped menjadi HTML biasa
function decodeHTML(html) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html || '';
    return textarea.value;
}

// Menampilkan teks dan rumus matematika dari editor guru
function renderRichContent(element, content) {
    const decodedContent = decodeHTML(content);
    element.innerHTML = sanitizeHTML(decodedContent);

    element.querySelectorAll('.saved-inline-math').forEach(el => {
        const formula = el.dataset.formula || el.textContent;
        const math = document.createElement('span');

        math.textContent = `\\(${formula}\\)`;
        el.replaceWith(math);
    });
}
// Sanitasi HTML dari editor teks guru
function sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    template.content.querySelectorAll(
        'script, style, iframe, object, embed, form'
    ).forEach(el => el.remove());

    template.content.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim().toLowerCase();

            if (
                name.startsWith('on') ||
                ((name === 'href' || name === 'src') &&
                value.startsWith('javascript:'))
            ) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return template.innerHTML;
}

// PILIHAN GANDA

async function renderMultipleChoice(block, wrapper) {
    totalChallenges++;

    const blockId = block.id;
    const question = document.createElement('h3');

    renderRichContent(
        question,
        block.question || 'Pilih jawaban yang benar'
    );

    wrapper.appendChild(question);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'student-options';

    const feedback = document.createElement('p');
    feedback.className = 'answer-feedback';

    let answered = false;
    const previousAnswer = savedAnswers.get(blockId);
    const correctIndex = Number(block.correctAnswer);

    (block.options || []).forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'student-option';

        renderRichContent(button, option);

        const isCorrectOption = index === correctIndex;
        const isPreviousChoice =
            previousAnswer &&
            String(previousAnswer.answer) === String(index);

        // Mode review: tandai jawaban yang benar
        if (isReadOnly) {
            button.disabled = true;

            if (isCorrectOption) {
                button.style.background = '#ecfccb';
                button.style.border = '2px solid #65a30d';
                button.style.color = '#365314';
                button.textContent = '✓ ' + button.textContent;
            }

            // Tandai jawaban terakhir murid jika salah
            if (isPreviousChoice && !previousAnswer.is_correct) {
                button.style.background = '#fef2f2';
                button.style.border = '2px solid #ef4444';
                button.style.color = '#b91c1c';
            }

            // Tandai jawaban terakhir murid jika benar
            if (isPreviousChoice && previousAnswer.is_correct) {
                button.style.background = '#84cc16';
                button.style.border = '2px solid #65a30d';
                button.style.color = '#243b0b';
            }
        }

        button.addEventListener('click', async () => {
            if (answered || isReadOnly) return;

            optionsContainer.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('selected');
                btn.style.background = '';
                btn.style.border = '';
                btn.style.color = '';
            });

            button.classList.add('selected');

            const isCorrect = index === correctIndex;

            const { error } = await supabase
                .from('student_activity_answers')
                .upsert({
                    student_id: currentUser.id,
                    material_id: currentMaterialId,
                    activity_id: activityId,
                    block_id: blockId,
                    answer: String(index),
                    is_correct: isCorrect,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'student_id,activity_id,block_id'
                });

            if (error) {
                console.error('Gagal menyimpan jawaban:', error);
                feedback.textContent =
                    'Jawaban belum berhasil disimpan. Coba lagi, ya!';
                feedback.className = 'answer-feedback incorrect';
                return;
            }

            if (isCorrect) {
                answered = true;
                completeChallenge();

                button.style.background = '#ecfccb';
                button.style.border = '2px solid #65a30d';
                button.style.color = '#365314';

                feedback.textContent =
                    'Benar! ' + (block.explanation || 'Jawabanmu tepat.');
                feedback.className = 'answer-feedback correct';

                optionsContainer.querySelectorAll('button').forEach(btn => {
                    btn.disabled = true;
                });
            } else {
                button.style.background = '#fef2f2';
                button.style.border = '2px solid #ef4444';
                button.style.color = '#b91c1c';

                feedback.textContent =
                    'Belum tepat. Coba periksa kembali pilihanmu.';
                feedback.className = 'answer-feedback incorrect';
            }
        });

        optionsContainer.appendChild(button);
    });

    // Tampilkan jawaban sebelumnya ketika aktivitas dibuka kembali
    if (isReadOnly) {
        answered = true;

        if (previousAnswer) {
            const correctOption = block.options?.[Number(correctIndex)] || '';

            if (previousAnswer.is_correct) {
                feedback.textContent =
                    '✓ Jawabanmu benar! ' +
                    (block.explanation || 'Jawabanmu tepat.');
                feedback.className = 'answer-feedback correct';
            } else {
                feedback.textContent =
                    'Jawaban terakhir yang kamu pilih belum tepat. ' +
                    'Jawaban yang benar adalah: ' +
                    correctOption + '. ' +
                    (block.explanation || '');
                feedback.className = 'answer-feedback incorrect';
            }
        } else {
            feedback.textContent =
                'Tidak ada jawaban tersimpan untuk soal ini.';
        }
    }

    wrapper.append(optionsContainer, feedback);
}


// DRAG AND DROP

function renderDragDrop(block, wrapper) {
    totalChallenges++;

    const blockId = block.id;
    let challengeCompleted = false;

    const title = document.createElement('h3');
    renderRichContent(
        title,
        block.title || 'Aktivitas memasangkan'
    );
    wrapper.appendChild(title);

    const instruction = document.createElement('p');
    renderRichContent(
        instruction,
        block.instruction || 'Pasangkan setiap kartu dengan tempat yang tepat.'
    );
    wrapper.appendChild(instruction);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'drag-cards';

    const targetsContainer = document.createElement('div');
    targetsContainer.className = 'drop-targets';

    const feedback = document.createElement('p');
    feedback.className = 'answer-feedback';

    const cards = block.cards || [];
    const targets = block.targets || [];

    const placedCards = new Map();
    const previousAnswer = savedAnswers.get(blockId);
    const isCompletedView = isReadOnly;

    // Pulihkan susunan kartu sebelumnya
    if (previousAnswer?.answer) {
        Object.entries(previousAnswer.answer).forEach(([cardIndex, targetId]) => {
            placedCards.set(Number(cardIndex), targetId);
        });
    }

    // Membuat kartu
    cards.forEach((card, index) => {
        const cardElement = document.createElement('button');
        cardElement.type = 'button';
        cardElement.className = 'drag-card';

        renderRichContent(cardElement, card.text);

        cardElement.draggable = !isCompletedView;
        cardElement.dataset.cardIndex = index;

        cardElement.addEventListener('dragstart', event => {
            if (isCompletedView) {
                event.preventDefault();
                return;
            }

            event.dataTransfer.setData('text/plain', String(index));
        });

        cardsContainer.appendChild(cardElement);
    });

    // Membuat tempat tujuan
    targets.forEach(target => {
        const targetElement = document.createElement('div');
        targetElement.className = 'drop-target';
        targetElement.dataset.targetId = target.id;

        const label = document.createElement('strong');
        renderRichContent(label, target.label);

        const content = document.createElement('div');
        content.className = 'drop-target-content';

        targetElement.append(label, content);

        targetElement.addEventListener('dragover', event => {
            if (isCompletedView) return;

            event.preventDefault();
            targetElement.classList.add('drag-over');
        });

        targetElement.addEventListener('dragleave', () => {
            targetElement.classList.remove('drag-over');
        });

        targetElement.addEventListener('drop', event => {
            if (isCompletedView) return;

            event.preventDefault();
            targetElement.classList.remove('drag-over');

            const cardIndex = Number(
                event.dataTransfer.getData('text/plain')
            );

            const cardElement = wrapper.querySelector(
                `[data-card-index="${cardIndex}"]`
            );

            if (!cards[cardIndex] || !cardElement) return;

            placedCards.set(cardIndex, target.id);
            content.appendChild(cardElement);

            checkDragDrop();
        });

        targetsContainer.appendChild(targetElement);
    });

    // Mengembalikan kartu ke tempat semula
    cardsContainer.addEventListener('dragover', event => {
        if (isCompletedView) return;

        event.preventDefault();
        cardsContainer.classList.add('drag-over');
    });

    cardsContainer.addEventListener('dragleave', () => {
        cardsContainer.classList.remove('drag-over');
    });

    cardsContainer.addEventListener('drop', event => {
        if (isCompletedView) return;

        event.preventDefault();
        cardsContainer.classList.remove('drag-over');

        const cardIndex = Number(
            event.dataTransfer.getData('text/plain')
        );

        const cardElement = wrapper.querySelector(
            `[data-card-index="${cardIndex}"]`
        );

        if (!cards[cardIndex] || !cardElement) return;

        placedCards.delete(cardIndex);
        cardsContainer.appendChild(cardElement);

        checkDragDrop();
    });

    // Memeriksa dan menyimpan jawaban
    async function checkDragDrop() {
        if (isCompletedView) return;

        const cardElements = wrapper.querySelectorAll('.drag-card');

        cardElements.forEach(card => {
            card.classList.remove('is-correct', 'is-incorrect');
        });

        feedback.className = 'answer-feedback';

        if (placedCards.size < cards.length) {
            feedback.textContent =
                'Masih ada kartu yang belum dipasangkan.';
            return;
        }

        const savedArrangement = Object.fromEntries(placedCards);
        const incorrectCards = [];

        cards.forEach((card, index) => {
            const isCorrect =
                String(placedCards.get(index)) === String(card.targetId);

            const cardElement = wrapper.querySelector(
                `[data-card-index="${index}"]`
            );

            if (isCorrect) {
                cardElement.classList.add('is-correct');
            } else {
                cardElement.classList.add('is-incorrect');
                incorrectCards.push(card.text);
            }
        });

        const isCorrect = incorrectCards.length === 0;

        const { error } = await supabase
            .from('student_activity_answers')
            .upsert({
                student_id: currentUser.id,
                material_id: currentMaterialId,
                activity_id: activityId,
                block_id: blockId,
                answer: savedArrangement,
                is_correct: isCorrect,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'student_id,activity_id,block_id'
            });

        if (error) {
            console.error('Gagal menyimpan pasangan kartu:', error);
            feedback.textContent =
                'Jawaban belum berhasil disimpan. Coba lagi, ya!';
            feedback.className = 'answer-feedback incorrect';
            return;
        }

        if (isCorrect) {
            if (!challengeCompleted) {
                completeChallenge();
                challengeCompleted = true;
            }

            feedback.textContent =
                'Hebat! Semua pasangan sudah benar. ' +
                (block.explanation || 'Kamu berhasil!');
            feedback.className = 'answer-feedback correct';

            cardElements.forEach(card => {
                card.draggable = false;
            });
        } else {
            feedback.textContent =
                'Belum tepat. Coba periksa kembali pasangan kartumu.';
            feedback.className = 'answer-feedback incorrect';
        }
    }

    wrapper.append(cardsContainer, targetsContainer, feedback);

    // Mode review aktivitas yang sudah selesai
    if (isCompletedView) {
        cards.forEach((card, index) => {
            const targetId = placedCards.get(index);

            if (targetId === undefined) return;

            const targetElement = targetsContainer.querySelector(
                `[data-target-id="${targetId}"]`
            );

            const cardElement = wrapper.querySelector(
                `[data-card-index="${index}"]`
            );

            const content = targetElement?.querySelector(
                '.drop-target-content'
            );

            if (content && cardElement) {
                content.appendChild(cardElement);
            }

            const isCorrect =
                String(targetId) === String(card.targetId);

            cardElement?.classList.add(
                isCorrect ? 'is-correct' : 'is-incorrect'
            );
        });

        if (previousAnswer?.is_correct) {
            feedback.textContent =
                '✓ Semua pasangan sudah benar! ' +
                (block.explanation || 'Kamu berhasil menyelesaikan aktivitas ini.');
            feedback.className = 'answer-feedback correct';

            challengeCompleted = true;
        } else if (previousAnswer) {
            feedback.textContent =
                'Ini adalah susunan jawaban terakhir yang kamu simpan. ' +
                (block.explanation || 'Perhatikan kembali pasangan yang ditandai.');
            feedback.className = 'answer-feedback incorrect';
        } else {
            feedback.textContent =
                'Tidak ada susunan jawaban yang tersimpan untuk aktivitas ini.';
            feedback.className = 'answer-feedback incorrect';
        }
    }
}


// Pengaturan tombol selesai aktivitas
if (completeButton) {
    completeButton.disabled = true;
    completeButton.textContent = 'Selesaikan aktivitas';

    completeButton.addEventListener('click', saveActivityProgress);
}

// Jalankan halaman
loadActivity();
