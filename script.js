// Inisialisasi FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    // Menggunakan core khusus untuk menghindari isu keamanan browser
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
});

// Elemen DOM
const videoUpload = document.getElementById('video-upload');
const fileName = document.getElementById('file-name');
const settingsSection = document.getElementById('settings-section');
const totalDurationEl = document.getElementById('total-duration');
const clipDurationInput = document.getElementById('clip-duration');
const estimatedClipsEl = document.getElementById('estimated-clips');
const processBtn = document.getElementById('process-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultSection = document.getElementById('result-section');
const downloadList = document.getElementById('download-list');

let videoFile = null;
let videoDuration = 0; // dalam detik

// Format detik ke MM:SS atau HH:MM:SS
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Menghitung jumlah klip
function calculateClips() {
    const clipDur = parseInt(clipDurationInput.value);
    if (clipDur > 0 && videoDuration > 0) {
        const clips = Math.ceil(videoDuration / clipDur);
        estimatedClipsEl.textContent = `${clips} klip`;
    } else {
        estimatedClipsEl.textContent = `0 klip`;
    }
}

// Event saat video dipilih
videoUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    videoFile = file;
    fileName.textContent = `File: ${file.name}`;
    
    // Mendapatkan durasi video tanpa mengunggahnya
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoElement.src);
        videoDuration = videoElement.duration;
        totalDurationEl.textContent = formatTime(videoDuration);
        
        settingsSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        downloadList.innerHTML = ''; // reset hasil sebelumnya
        
        calculateClips();
    };
    videoElement.src = URL.createObjectURL(file);
});

// Event saat input durasi per klip diubah
clipDurationInput.addEventListener('input', calculateClips);

// Proses Pemotongan Video
processBtn.addEventListener('click', async () => {
    const clipDur = parseInt(clipDurationInput.value);
    if (!clipDur || clipDur <= 0) return alert('Masukkan durasi per klip yang valid (minimal 1 detik).');

    processBtn.disabled = true;
    settingsSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    downloadList.innerHTML = '';

    const totalClips = Math.ceil(videoDuration / clipDur);
    const ext = videoFile.name.split('.').pop();
    const inputName = 'input.' + ext;

    try {
        // Load FFmpeg jika belum dimuat
        if (!ffmpeg.isLoaded()) {
            progressText.textContent = "Memuat modul FFmpeg... (membutuhkan koneksi internet)";
            await ffmpeg.load();
        }

        // Tulis file ke virtual file system (Memory)
        progressText.textContent = "Menyiapkan file video ke memory...";
        ffmpeg.FS('writeFile', inputName, await fetchFile(videoFile));

        // Loop untuk memotong
        for (let i = 0; i < totalClips; i++) {
            let startTime = i * clipDur;
            let outputName = `klip_${i + 1}.${ext}`;
            
            progressText.textContent = `Memotong klip ${i + 1} dari ${totalClips}...`;
            progressBar.style.width = `${((i) / totalClips) * 100}%`;

            // Eksekusi Command FFmpeg
            // -ss : Waktu Mulai
            // -t : Durasi
            // -c copy : Proses pemotongan secepat kilat (tanpa re-encode)
            await ffmpeg.run(
                '-i', inputName, 
                '-ss', startTime.toString(), 
                '-t', clipDur.toString(), 
                '-c', 'copy', 
                outputName
            );

            // Ambil data hasil dan buat link download
            const data = ffmpeg.FS('readFile', outputName);
            const blob = new Blob([data.buffer], { type: `video/${ext}` });
            const url = URL.createObjectURL(blob);
            
            // Buat elemen di HTML untuk download
            const listItem = document.createElement('div');
            listItem.className = 'download-item';
            listItem.innerHTML = `
                <span>Klip ${i + 1} (${formatTime(startTime)} - ${formatTime(Math.min(startTime + clipDur, videoDuration))})</span>
                <a href="${url}" download="${videoFile.name.split('.')[0]}_part${i+1}.${ext}">Download</a>
            `;
            downloadList.appendChild(listItem);
        }

        // Selesai
        progressBar.style.width = '100%';
        progressText.textContent = "Pemotongan Selesai!";
        
        setTimeout(() => {
            progressSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            processBtn.disabled = false;
            settingsSection.classList.remove('hidden');
        }, 1500);

    } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan saat memproses video.');
        processBtn.disabled = false;
        progressSection.classList.add('hidden');
        settingsSection.classList.remove('hidden');
    }
});