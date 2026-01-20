// --- 1. DATA CONFIGURATION ---
// Titles match the IDs. You must create "stories/{id}_{tone}_{length}.txt" files.
const baseStories = [
    { id: 1, title: "The Last Watchmaker" },
    { id: 2, title: "Ocean of Stars" },
    { id: 3, title: "The Coffee Shop" },
    { id: 4, title: "Digital Ghost" },
    { id: 5, title: "The Whispering Forest" },
    { id: 6, title: "Gravity Racing" },
    { id: 7, title: "The Painter of Dreams" },
    { id: 8, title: "Binary Love" },
    { id: 9, title: "The Library of Lost Things" },
    { id: 10, title: "Silence on Mars" }
];

// --- STATE ---
let currentStoryId = 1;
let currentTone = 'happy';
let currentLength = 'short';

let wordQueue = [];
let currentIndex = 0;
let isPlaying = false;
let wpm = 300;
let timer = null;
let soundEnabled = true;

// Default Settings
let appSettings = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "4",
    sounds: { comma: 'sine', period: 'sawtooth', exclamation: 'noise', question: 'triangle' }
};
let tempSettings = { ...appSettings };

// --- ELEMENTS ---
const els = {
    pageHome: document.getElementById('page-home'),
    pageReader: document.getElementById('page-reader'),
    pageSettings: document.getElementById('page-settings'),
    
    // Home Inputs
    select: document.getElementById('storySelect'),
    toneBtns: document.querySelectorAll('#toneSelector .option-btn'),
    lengthBtns: document.querySelectorAll('#lengthSelector .option-btn'),
    staticSummary: document.getElementById('staticSummary'),
    wordCount: document.getElementById('wordCountDisplay'),
    btnStart: document.getElementById('btnStartReading'),
    
    // Settings / Nav
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnCloseSettingsX: document.getElementById('btnCloseSettingsX'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnResetSettings: document.getElementById('btnResetSettings'),

    // Reader
    left: document.getElementById('txtLeft'),
    pivot: document.getElementById('txtPivot'),
    right: document.getElementById('txtRight'),
    wpmDisplay: document.getElementById('wpmDisplay'),
    progress: document.getElementById('progressDisplay'),
    btnPlay: document.getElementById('btnPlayPause'),
    btnReset: document.getElementById('btnRewind'),
    btnFaster: document.getElementById('btnFaster'),
    btnSlower: document.getElementById('btnSlower'),
    btnClose: document.getElementById('btnCloseReader'),
    btnSound: document.getElementById('btnSoundToggle'),
    
    // Settings Inputs
    setFontFamily: document.getElementById('setFontFamily'),
    setFontSize: document.getElementById('setFontSize'),
    fontSizeDisplay: document.getElementById('fontSizeDisplay'),
    soundSelects: document.querySelectorAll('.sound-select'),
    
    // Preview
    pLeft: document.getElementById('pLeft'),
    pPivot: document.getElementById('pPivot'),
    pRight: document.getElementById('pRight'),
    readerDisplay: document.getElementById('readerDisplay'),
    previewDisplay: document.getElementById('previewDisplay')
};

// --- INITIALIZATION ---
function init() {
    populateSelect();
    
    // Event Listeners
    els.select.addEventListener('change', (e) => {
        currentStoryId = parseInt(e.target.value);
        refreshHomeData();
    });

    // Tone Selection
    els.toneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.toneBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTone = btn.dataset.val;
            refreshHomeData();
        });
    });

    // Length Selection
    els.lengthBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.lengthBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentLength = btn.dataset.val;
            refreshHomeData();
        });
    });

    // Navigation
    els.btnStart.addEventListener('click', openReader);
    els.btnClose.addEventListener('click', closeReader);
    els.btnOpenSettings.addEventListener('click', openSettings);
    els.btnCloseSettingsX.addEventListener('click', closeSettingsNoSave);
    els.btnSaveSettings.addEventListener('click', saveSettings);
    els.btnResetSettings.addEventListener('click', resetSettings);

    // Reader Controls
    els.btnPlay.addEventListener('click', togglePlay);
    els.btnReset.addEventListener('click', resetReader);
    els.btnSound.addEventListener('click', toggleSound);
    els.btnFaster.addEventListener('click', () => changeSpeed(25));
    els.btnSlower.addEventListener('click', () => changeSpeed(-25));

    // Settings Live Updates
    els.setFontFamily.addEventListener('change', updatePreviewState);
    els.setFontSize.addEventListener('input', (e) => {
        els.fontSizeDisplay.textContent = e.target.value + "rem";
        updatePreviewState();
    });
    els.soundSelects.forEach(s => s.addEventListener('change', updateSoundState));

    // Initial Load
    els.select.value = "1";
    refreshHomeData();
}

function populateSelect() {
    els.select.innerHTML = '';
    baseStories.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        els.select.appendChild(opt);
    });
}

// --- FETCHING DATA ---
async function refreshHomeData() {
    const story = baseStories.find(s => s.id === currentStoryId);
    if(!story) return;

    // Reset UI while loading
    els.wordCount.textContent = "Loading...";
    els.staticSummary.textContent = "Fetching story content...";
    els.btnStart.disabled = true;

    // Construct filename: stories/1_happy_short.txt
    const filename = `stories/${currentStoryId}_${currentTone}_${currentLength}.txt`;

    try {
        const response = await fetch(filename);
        
        if (!response.ok) {
            throw new Error(`File not found: ${filename}`);
        }

        const fullText = await response.text();
        
        // Update State
        wordQueue = fullText.split(/\s+/).filter(w => w.length > 0);
        
        // Update UI
        els.wordCount.textContent = `Words: ${wordQueue.length}`;
        els.staticSummary.textContent = `Summary: A ${currentTone} version of "${story.title}" (${currentLength} length). Ready to read!`;
        els.btnStart.disabled = false;

    } catch (error) {
        console.error(error);
        els.staticSummary.textContent = `Error: Could not load "${filename}". Please ensure the .txt file exists in the 'stories' folder.`;
        els.wordCount.textContent = "Error";
        wordQueue = []; // Clear queue on error
    }
}


// --- NAVIGATION ---
function openReader() {
    if (wordQueue.length === 0) {
        alert("No story content loaded. Please check if the file exists.");
        return;
    }
    currentIndex = 0;
    updateDisplay();
    els.pageHome.classList.add('hidden');
    els.pageReader.classList.remove('hidden');
}

function closeReader() {
    stop();
    els.pageReader.classList.add('hidden');
    els.pageHome.classList.remove('hidden');
}

function openSettings() {
    tempSettings = JSON.parse(JSON.stringify(appSettings));
    
    els.setFontFamily.value = tempSettings.fontFamily;
    els.setFontSize.value = tempSettings.fontSize;
    els.fontSizeDisplay.textContent = tempSettings.fontSize + "rem";
    
    els.soundSelects.forEach(sel => {
        const punc = sel.dataset.punc;
        sel.value = tempSettings.sounds[punc];
    });

    startPreviewLoop();
    els.pageHome.classList.add('hidden');
    els.pageSettings.classList.remove('hidden');
}

function closeSettingsNoSave() {
    stopPreviewLoop();
    els.pageSettings.classList.add('hidden');
    els.pageHome.classList.remove('hidden');
}

function saveSettings() {
    appSettings = JSON.parse(JSON.stringify(tempSettings));
    document.documentElement.style.setProperty('--reader-font', appSettings.fontFamily);
    document.documentElement.style.setProperty('--reader-size', appSettings.fontSize + 'rem');
    stopPreviewLoop();
    els.pageSettings.classList.add('hidden');
    els.pageHome.classList.remove('hidden');
}

function resetSettings() {
    tempSettings = {
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "4",
        sounds: { comma: 'sine', period: 'sawtooth', exclamation: 'noise', question: 'triangle' }
    };
    els.setFontFamily.value = tempSettings.fontFamily;
    els.setFontSize.value = tempSettings.fontSize;
    els.fontSizeDisplay.textContent = "4rem";
    els.soundSelects.forEach(sel => {
            if(sel.dataset.punc === 'comma') sel.value = 'sine';
            if(sel.dataset.punc === 'period') sel.value = 'sawtooth';
            if(sel.dataset.punc === 'exclamation') sel.value = 'noise';
            if(sel.dataset.punc === 'question') sel.value = 'triangle';
    });
    updatePreviewState();
}

function updatePreviewState() {
    tempSettings.fontFamily = els.setFontFamily.value;
    tempSettings.fontSize = els.setFontSize.value;
    els.previewDisplay.style.fontFamily = tempSettings.fontFamily;
    els.previewDisplay.style.fontSize = tempSettings.fontSize + "rem";
}

function updateSoundState(e) {
    const punc = e.target.dataset.punc;
    tempSettings.sounds[punc] = e.target.value;
}

// --- PREVIEW LOOP ---
let previewInterval = null;
const previewWords = "A quick fox jumped over".split(" ");
let previewIndex = 0;

function startPreviewLoop() {
    if (previewInterval) clearInterval(previewInterval);
    els.previewDisplay.style.fontFamily = tempSettings.fontFamily;
    els.previewDisplay.style.fontSize = tempSettings.fontSize + "rem";
    previewIndex = 0;
    const tick = () => {
        const word = previewWords[previewIndex];
        const match = word.match(/^([^\w]*)([\w\-'’]+)([^\w]*)$/);
        let prefix = "", core = word, suffix = "";
        if (match) { prefix = match[1]; core = match[2]; suffix = match[3]; }
        const pivotIdx = getPivotIndex(core);
        els.pLeft.textContent = prefix + core.substring(0, pivotIdx);
        els.pPivot.textContent = core.charAt(pivotIdx);
        els.pRight.textContent = core.substring(pivotIdx + 1) + suffix;
        previewIndex = (previewIndex + 1) % previewWords.length;
    };
    tick(); 
    previewInterval = setInterval(tick, 400); 
}

function stopPreviewLoop() { clearInterval(previewInterval); }


// --- AUDIO ENGINE ---
const AudioEngine = (() => {
    let ctx = null;
    function initCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
    }

    function playWave(type, freq, duration, slide) {
        if (!ctx) initCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        if (type === 'slide') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + duration);
        } else {
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
        }
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    function playNoise(duration) {
        if (!ctx) initCtx();
        const bSize = ctx.sampleRate * duration;
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for(let i=0; i<bSize; i++) data[i] = Math.random()*2-1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+duration);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    }

    return {
        trigger: (puncType) => {
            const soundType = appSettings.sounds[puncType]; 
            if (soundType === 'noise') {
                playNoise(0.2);
            } else {
                let freq = 440;
                if (puncType === 'period') freq = 100;
                if (puncType === 'question') freq = 800;
                if (puncType === 'exclamation') freq = 200;
                playWave(soundType, freq, 0.2, soundType === 'slide');
            }
        },
        init: initCtx
    };
})();

// --- READER LOGIC ---
function getPivotIndex(cleanWord) {
    const len = cleanWord.length;
    if (len === 1) return 0;
    if (len >= 2 && len <= 5) return 1;
    if (len >= 6 && len <= 9) return 2;
    if (len >= 10 && len <= 13) return 3;
    return 4;
}

function renderWord(rawWord) {
    if (soundEnabled && isPlaying) {
        const lastChar = rawWord.slice(-1);
        if (lastChar === ',') AudioEngine.trigger('comma');
        else if (lastChar === '.') AudioEngine.trigger('period');
        else if (lastChar === '!') AudioEngine.trigger('exclamation');
        else if (lastChar === '?') AudioEngine.trigger('question');
    }

    const match = rawWord.match(/^([^\w]*)([\w\-'’]+)([^\w]*)$/);
    let prefix = "", core = rawWord, suffix = "";
    if (match) { prefix = match[1]; core = match[2]; suffix = match[3]; }

    const pivotIdx = getPivotIndex(core);
    els.left.textContent = prefix + core.substring(0, pivotIdx);
    els.pivot.textContent = core.charAt(pivotIdx);
    els.right.textContent = core.substring(pivotIdx + 1) + suffix;
}

function updateDisplay() {
    els.progress.textContent = `${currentIndex} / ${wordQueue.length}`;
    if (currentIndex < wordQueue.length) {
        renderWord(wordQueue[currentIndex]);
    } else {
        stop();
        els.left.textContent = "";
        els.pivot.textContent = "DONE";
        els.right.textContent = "";
    }
}

function togglePlay() { isPlaying ? stop() : start(); }
function start() {
    if (currentIndex >= wordQueue.length) currentIndex = 0;
    isPlaying = true;
    els.btnPlay.textContent = "⏸";
    if (soundEnabled) AudioEngine.init();
    runTimer();
}
function runTimer() {
    const msPerWord = 60000 / wpm;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        if (!isPlaying) return;
        currentIndex++;
        if (currentIndex >= wordQueue.length) { updateDisplay(); stop(); }
        else { updateDisplay(); runTimer(); }
    }, msPerWord);
}
function stop() { isPlaying = false; els.btnPlay.textContent = "▶"; if(timer) clearTimeout(timer); }
function resetReader() { stop(); currentIndex = 0; updateDisplay(); }
function changeSpeed(delta) {
        wpm += delta; if(wpm < 50) wpm=50; if(wpm>2000) wpm=2000;
        els.wpmDisplay.textContent = `${wpm} WPM`;
        if(isPlaying) { clearTimeout(timer); runTimer(); }
}
function toggleSound() {
    soundEnabled = !soundEnabled;
    els.btnSound.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) AudioEngine.init();
}

init();
