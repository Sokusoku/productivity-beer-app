// --- 1. CONFIGURATION ---
const MANIFEST_URL = 'stories/manifest.json';

// --- STATE ---
let library = []; 
let currentStory = null;
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
    // Pages
    pageIntro: document.getElementById('page-intro'),
    pageHome: document.getElementById('page-home'),
    pageReader: document.getElementById('page-reader'),
    pageSettings: document.getElementById('page-settings'),
    
    // Intro Elements
    btnEnterApp: document.getElementById('btnEnterApp'),
    btnSkipTutorial: document.getElementById('btnSkipTutorial'),
    iLeft: document.getElementById('iLeft'),
    iPivot: document.getElementById('iPivot'),
    iRight: document.getElementById('iRight'),
    introWpm: document.getElementById('introWpmDisplay'),
    
    // Intro Control Simulation
    iBtnPlay: document.getElementById('iBtnPlay'),
    iBtnFaster: document.getElementById('iBtnFaster'),
    iBtnSlower: document.getElementById('iBtnSlower'),
    iBtnReset: document.getElementById('iBtnReset'),
    
    // Tooltips
    tipFocus: document.getElementById('tip-focus'),
    tipPlay: document.getElementById('tip-play'),
    tipFaster: document.getElementById('tip-faster'),
    tipSlower: document.getElementById('tip-slower'),
    tipReset: document.getElementById('tip-reset'),
    tipWpm: document.getElementById('tip-wpm'),

    // Home Inputs
    select: document.getElementById('storySelect'),
    btnGoToTutorial: document.getElementById('btnGoToTutorial'),
    toneSelector: document.getElementById('toneSelector'),
    lengthSelector: document.getElementById('lengthSelector'),
    toneBtns: document.querySelectorAll('#toneSelector .option-btn'),
    lengthBtns: document.querySelectorAll('#lengthSelector .option-btn'),
    staticSummary: document.getElementById('staticSummary'),
    wordCount: document.getElementById('wordCountDisplay'),
    btnStart: document.getElementById('btnStartReading'),
    
    // Reader & Settings Elements
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
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnCloseSettingsX: document.getElementById('btnCloseSettingsX'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnResetSettings: document.getElementById('btnResetSettings'),
    setFontFamily: document.getElementById('setFontFamily'),
    setFontSize: document.getElementById('setFontSize'),
    fontSizeDisplay: document.getElementById('fontSizeDisplay'),
    soundSelects: document.querySelectorAll('.sound-select'),
    pLeft: document.getElementById('pLeft'),
    pPivot: document.getElementById('pPivot'),
    pRight: document.getElementById('pRight'),
    previewDisplay: document.getElementById('previewDisplay')
};

// --- INITIALIZATION ---
async function init() {
    // 0. Start Intro Sequence
    startIntroLoop();
    initTutorial();
    
    // Intro Listeners
    els.btnEnterApp.addEventListener('click', enterApp);
    els.btnSkipTutorial.addEventListener('click', skipTutorial);
    els.btnGoToTutorial.addEventListener('click', restartTutorial);
    
    // Tutorial Interactions
    els.iBtnPlay.addEventListener('click', () => handleIntroInteraction('play'));
    els.iBtnFaster.addEventListener('click', () => handleIntroInteraction('faster'));
    els.iBtnSlower.addEventListener('click', () => handleIntroInteraction('slower'));
    els.iBtnReset.addEventListener('click', () => handleIntroInteraction('reset'));

    // 1. Load and Parse Library
    await buildLibrary();

    // 2. Setup Event Listeners
    setupEventListeners();

    // 3. Select first story if available
    if (library.length > 0) {
        els.select.value = library[0].id;
        loadSelectedStory(library[0].id);
    }
}

// --- INTRO PAGE LOGIC ---
let introInterval = null;
let introSpeed = 200;
let isIntroPlaying = true;
let tutorialStep = 0;

const introWords = "Welcome to Speed Reader Pro! This technique is called RSVP. Keep your eyes fixed on the red letter, do not move your eyes left or right. Ready? Just relax, and let the words flow. Can you hear the sounds? You can read much faster this way!".split(" ");
let introIndex = 0;

function startIntroLoop() {
    if (introInterval) clearInterval(introInterval);
    isIntroPlaying = true;
    const interval = 60000 / introSpeed;
    
    const tick = () => {
        const word = introWords[introIndex];
        
        // Add Audio Trigger for Tutorial
        if (soundEnabled && isIntroPlaying) {
            const lastChar = word.slice(-1);
            if (lastChar === ',') AudioEngine.trigger('comma');
            else if (lastChar === '.') AudioEngine.trigger('period');
            else if (lastChar === '!') AudioEngine.trigger('exclamation');
            else if (lastChar === '?') AudioEngine.trigger('question');
        }

        const match = word.match(/^([^\w]*)([\w\-'’]+)([^\w]*)$/);
        let prefix = "", core = word, suffix = "";
        if (match) { prefix = match[1]; core = match[2]; suffix = match[3]; }
        const pivotIdx = getPivotIndex(core);
        els.iLeft.textContent = prefix + core.substring(0, pivotIdx);
        els.iPivot.textContent = core.charAt(pivotIdx);
        els.iRight.textContent = core.substring(pivotIdx + 1) + suffix;
        els.iPivot.style.color = 'var(--text-red)';
        introIndex = (introIndex + 1) % introWords.length;
    };
    tick();
    introInterval = setInterval(tick, interval);
    els.iBtnPlay.textContent = "⏸";
}

function stopIntroLoop() {
    clearInterval(introInterval);
    isIntroPlaying = false;
    els.iBtnPlay.textContent = "▶";
}

function toggleIntroPlay() {
    if (isIntroPlaying) stopIntroLoop();
    else startIntroLoop();
}

function updateIntroSpeed(newSpeed) {
    introSpeed = newSpeed;
    els.introWpm.textContent = `${introSpeed} WPM`;
    if (isIntroPlaying) startIntroLoop();
}

// --- INTERACTIVE TUTORIAL SEQUENCE ---

function initTutorial() {
    tutorialStep = 0;
    introIndex = 0;
    updateIntroSpeed(200);
    document.querySelectorAll('.tutorial-tooltip').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.highlight-target').forEach(t => t.classList.remove('highlight-target'));
    els.btnEnterApp.disabled = true;
    els.btnEnterApp.classList.remove('pulse-btn');

    els.tipFocus.classList.add('active');
    setTimeout(() => {
        els.tipFocus.classList.remove('active');
        advanceTutorial(1); 
    }, 4000);
}

function advanceTutorial(step) {
    tutorialStep = step;
    document.querySelectorAll('.highlight-target').forEach(t => t.classList.remove('highlight-target'));
    document.querySelectorAll('.tutorial-tooltip').forEach(t => t.classList.remove('active'));

    if (step === 1) { els.tipPlay.classList.add('active'); els.iBtnPlay.classList.add('highlight-target'); }
    else if (step === 2) { els.tipFaster.classList.add('active'); els.iBtnFaster.classList.add('highlight-target'); }
    else if (step === 3) { els.tipSlower.classList.add('active'); els.iBtnSlower.classList.add('highlight-target'); }
    else if (step === 4) { els.tipReset.classList.add('active'); els.iBtnReset.classList.add('highlight-target'); }
    else if (step === 5) { els.btnEnterApp.disabled = false; els.btnEnterApp.classList.add('pulse-btn'); }
}

function handleIntroInteraction(action) {
    if (tutorialStep === 1 && action === 'play') { toggleIntroPlay(); advanceTutorial(2); }
    else if (tutorialStep === 2 && action === 'faster') { updateIntroSpeed(300); advanceTutorial(3); }
    else if (tutorialStep === 3 && action === 'slower') { updateIntroSpeed(200); advanceTutorial(4); }
    else if (tutorialStep === 4 && action === 'reset') { introIndex = 0; if(!isIntroPlaying) startIntroLoop(); advanceTutorial(5); }
    else {
        if(action === 'play') toggleIntroPlay();
        if(action === 'faster') updateIntroSpeed(introSpeed + 25);
        if(action === 'slower') updateIntroSpeed(introSpeed - 25);
        if(action === 'reset') introIndex = 0;
    }
}

function skipTutorial() {
    document.querySelectorAll('.tutorial-tooltip').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.highlight-target').forEach(t => t.classList.remove('highlight-target'));
    els.btnEnterApp.disabled = false;
    els.btnEnterApp.classList.add('pulse-btn');
}

function enterApp() {
    stopIntroLoop();
    els.pageIntro.classList.add('hidden');
    els.pageHome.classList.remove('hidden');
}

function restartTutorial() {
    els.pageHome.classList.add('hidden');
    els.pageIntro.classList.remove('hidden');
    startIntroLoop();
    initTutorial();
}


// --- LIBRARY LOGIC ---

async function buildLibrary() {
    els.select.innerHTML = '<option disabled>Scanning library...</option>';
    
    try {
        // 1. Fetch Manifest
        const response = await fetch(MANIFEST_URL);
        if (!response.ok) throw new Error("Manifest not found");
        
        const fileList = await response.json(); // Expects ["file1.txt", "file2.txt"]
        
        // 2. Fetch Files listed in Manifest
        const parsedStories = [];
        const promises = fileList.map(filename => fetch(`stories/${filename}`).then(res => {
            if (!res.ok) throw new Error(`Failed to load ${filename}`);
            return res.text();
        }).then(text => parseStoryFile(text, filename))
          .catch(err => console.warn(`Skipping ${filename}:`, err))
        );

        const results = await Promise.all(promises);
        
        results.forEach(story => {
            if (story) parsedStories.push(story);
        });

        parsedStories.sort((a, b) => a.title.localeCompare(b.title));
        library = parsedStories;
        
        if (library.length === 0) {
            els.select.innerHTML = '<option disabled>No stories found.</option>';
        } else {
            populateSelectDropdown();
        }

    } catch (err) {
        console.error("Library Error:", err);
        els.select.innerHTML = '<option disabled>Error: Start local server</option>';
        // Fallback or alert user
        alert("To load stories dynamically, please ensure you are running a local web server and 'stories/manifest.json' exists.");
    }
}

function parseStoryFile(text, filename) {
    const lines = text.split('\n');
    let story = {
        id: filename, 
        title: "Unknown Title",
        summary: "No summary found.", // Default
        variants: {} 
    };

    let readingMetadata = false;
    let currentVariant = null;
    let currentLength = null;
    let buffer = [];

    for (let line of lines) {
        const trimmed = line.trim();

        if (trimmed === 'METADATA') {
            readingMetadata = true;
            continue;
        }
        if (trimmed === 'END_METADATA') {
            readingMetadata = false;
            continue;
        }

        if (readingMetadata) {
            if (trimmed.startsWith('Title:')) story.title = trimmed.replace('Title:', '').trim();
            if (trimmed.startsWith('Summary:')) story.summary = trimmed.replace('Summary:', '').trim();
            continue;
        }

        if (trimmed.startsWith('===') && trimmed.endsWith('===')) {
            if (currentVariant && currentLength && buffer.length > 0) {
                if (!story.variants[currentVariant]) story.variants[currentVariant] = {};
                story.variants[currentVariant][currentLength] = buffer.join('\n').trim();
            }

            const content = trimmed.replace(/===/g, '').trim();
            const parts = content.split('|');
            currentVariant = null;
            currentLength = null;

            parts.forEach(part => {
                const [key, val] = part.split(':').map(s => s.trim().toLowerCase());
                if (key === 'variant') currentVariant = val;
                if (key === 'length') currentLength = val;
            });

            buffer = []; 
        } else {
            if (currentVariant && currentLength) {
                buffer.push(line);
            }
        }
    }

    if (currentVariant && currentLength && buffer.length > 0) {
        if (!story.variants[currentVariant]) story.variants[currentVariant] = {};
        story.variants[currentVariant][currentLength] = buffer.join('\n').trim();
    }

    return story;
}

function populateSelectDropdown() {
    els.select.innerHTML = '';
    library.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        els.select.appendChild(opt);
    });
}

// --- UI UPDATE LOGIC ---

function loadSelectedStory(id) {
    currentStory = library.find(s => s.id === id);
    if (!currentStory) return;
    updateAvailabilityUI();
    refreshContent();
}

function updateAvailabilityUI() {
    if (!currentStory) return;

    els.toneBtns.forEach(btn => {
        const val = btn.dataset.val;
        const exists = currentStory.variants.hasOwnProperty(val);
        btn.disabled = !exists;
        btn.style.opacity = exists ? '1' : '0.3';
        
        if (currentTone === val && !exists) {
            const firstValid = Object.keys(currentStory.variants)[0];
            if (firstValid) {
                currentTone = firstValid;
                updateSelectionClasses(els.toneBtns, currentTone);
            }
        }
    });

    const availableLengths = currentStory.variants[currentTone] || {};
    
    els.lengthBtns.forEach(btn => {
        const val = btn.dataset.val;
        const exists = availableLengths.hasOwnProperty(val);
        btn.disabled = !exists;
        btn.style.opacity = exists ? '1' : '0.3';

        if (currentLength === val && !exists) {
            const firstValid = Object.keys(availableLengths)[0];
            if (firstValid) {
                currentLength = firstValid;
                updateSelectionClasses(els.lengthBtns, currentLength);
            }
        }
    });
}

function updateSelectionClasses(nodeList, activeVal) {
    nodeList.forEach(btn => {
        if (btn.dataset.val === activeVal) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}

function refreshContent() {
    if (!currentStory || !currentStory.variants[currentTone] || !currentStory.variants[currentTone][currentLength]) {
        els.wordCount.textContent = "Unavailable";
        els.staticSummary.textContent = "This combination is not available.";
        els.btnStart.disabled = true;
        wordQueue = [];
        return;
    }

    const text = currentStory.variants[currentTone][currentLength];
    
    wordQueue = text.split(/\s+/).filter(w => w.length > 0);
    
    els.wordCount.textContent = `Words: ${wordQueue.length}`;
    els.staticSummary.textContent = currentStory.summary;
    els.btnStart.disabled = false;
}

// --- EVENT HANDLERS ---

function setupEventListeners() {
    els.select.addEventListener('change', (e) => loadSelectedStory(e.target.value));

    els.toneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            currentTone = btn.dataset.val;
            updateSelectionClasses(els.toneBtns, currentTone);
            updateAvailabilityUI();
            refreshContent();
        });
    });

    els.lengthBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            currentLength = btn.dataset.val;
            updateSelectionClasses(els.lengthBtns, currentLength);
            refreshContent();
        });
    });

    els.btnStart.addEventListener('click', openReader);
    els.btnClose.addEventListener('click', closeReader);
    els.btnOpenSettings.addEventListener('click', openSettings);
    els.btnCloseSettingsX.addEventListener('click', closeSettingsNoSave);
    els.btnSaveSettings.addEventListener('click', saveSettings);
    els.btnResetSettings.addEventListener('click', resetSettings);
    els.btnPlay.addEventListener('click', togglePlay);
    els.btnReset.addEventListener('click', resetReader);
    els.btnSound.addEventListener('click', toggleSound);
    els.btnFaster.addEventListener('click', () => changeSpeed(25));
    els.btnSlower.addEventListener('click', () => changeSpeed(-25));
    els.setFontFamily.addEventListener('change', updatePreviewState);
    els.setFontSize.addEventListener('input', (e) => {
        els.fontSizeDisplay.textContent = e.target.value + "rem";
        updatePreviewState();
    });
    els.soundSelects.forEach(s => s.addEventListener('change', updateSoundState));
}

// --- READER & AUDIO LOGIC ---

function openReader() {
    if (wordQueue.length === 0) return;
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

// Start App
init();
