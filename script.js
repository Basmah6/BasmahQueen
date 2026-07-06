/* ==========================================================================
   Itqan English 30-Day Reading Challenge - Core Engine
   Features: 30 days stories (B1 CEFR), Interactive dictionary clicks,
   Vocabulary Wallet with filter, local storage sync, Comprehension Quizzes,
   and Text-to-Speech audio support.
   ========================================================================== */

// Note: The 30-Day CEFR B1 Reading Curriculum Data is loaded from curriculum.js

// Active State Management
let currentDayIndex = 0; // index mapping to day - 1
let completedDays = [];   // Array of day numbers
let savedWords = [];      // Array of objects { word, translation, day, source }
let streakCount = 0;
let synth = window.speechSynthesis;
let currentUtterance = null;
let activeTab = "challenge"; // challenge | wallet
let selectedQuizAnswers = {}; // map of { questionIndex: selectedOptionIndex }

// DOM Cache Elements
const appRoot = document.getElementById("app-root");
const logoHome = document.getElementById("logo-home");
const tabChallengeBtn = document.getElementById("tab-challenge");
const tabWalletBtn = document.getElementById("tab-wallet");
const walletCountBadge = document.getElementById("wallet-count");
const streakCountText = document.getElementById("streak-count");
const progressPercentText = document.getElementById("progress-percent");
const headerProgressBar = document.getElementById("header-progress-bar");

const panelChallenge = document.getElementById("panel-challenge");
const panelWallet = document.getElementById("panel-wallet");

const daysNavContainer = document.getElementById("days-navigation-container");

const activeDayBadge = document.getElementById("active-day-badge");
const activeStoryTitle = document.getElementById("active-story-title");
const difficultyTag = document.getElementById("difficulty-tag");
const wordCountBadge = document.getElementById("word-count-badge");
const storyTextView = document.getElementById("story-text-view");
const btnListen = document.getElementById("btn-listen");

const targetWordsContainer = document.getElementById("target-words-container");
const quizQuestionsContainer = document.getElementById("quiz-questions-container");

const btnCompleteDay = document.getElementById("btn-complete-day");
const btnNextDay = document.getElementById("btn-next-day");

// Wallet Views
const emptyWalletView = document.getElementById("empty-wallet-view");
const walletItemsGridView = document.getElementById("wallet-items-grid-view");
const walletTotalCount = document.getElementById("wallet-total-count");
const btnClearWallet = document.getElementById("btn-clear-wallet");
const btnWalletGoReading = document.getElementById("btn-wallet-go-reading");
const walletSearchBar = document.getElementById("wallet-search");
const savedWordsContainer = document.getElementById("saved-words-container");
const filterChips = document.querySelectorAll(".filter-chip");

// Tooltip Popup elements
const dictTooltip = document.getElementById("dict-tooltip");
const tooltipEng = document.getElementById("tooltip-eng");
const tooltipArb = document.getElementById("tooltip-arb");
const tooltipPos = document.getElementById("tooltip-pos");
const tooltipAudioBtn = document.getElementById("tooltip-audio");
const tooltipSaveBtn = document.getElementById("tooltip-save-btn");
const tooltipSaveText = document.getElementById("tooltip-save-text");
const tooltipCloseBtn = document.getElementById("tooltip-close-btn");

// Celebration modal
const celebrationModal = document.getElementById("celebration-modal");
const statCompletedDays = document.getElementById("stat-completed-days");
const statStreakDays = document.getElementById("stat-streak-days");
const btnCelebrationContinue = document.getElementById("btn-celebration-continue");


/* ==========================================================================
   State Persistence with Local Storage
   ========================================================================== */
function loadStateFromStorage() {
  // Load Completed Days
  const savedCompleted = localStorage.getItem("itqan_completed_days");
  if (savedCompleted) {
    completedDays = JSON.parse(savedCompleted);
  } else {
    completedDays = [];
  }

  // Load Saved Word Wallet
  const savedVocab = localStorage.getItem("itqan_vocab_wallet");
  if (savedVocab) {
    savedWords = JSON.parse(savedVocab);
  } else {
    savedWords = [];
  }

  // Load Active Day
  const savedActiveDay = localStorage.getItem("itqan_active_day");
  if (savedActiveDay) {
    const dNum = parseInt(savedActiveDay);
    if (dNum >= 1 && dNum <= 30) {
      currentDayIndex = dNum - 1;
    }
  }

  // Load Streak Count & Last Activity
  calculateStreak();
}

function saveStateToStorage() {
  localStorage.setItem("itqan_completed_days", JSON.stringify(completedDays));
  localStorage.setItem("itqan_vocab_wallet", JSON.stringify(savedWords));
  localStorage.setItem("itqan_active_day", (currentDayIndex + 1).toString());
}

function calculateStreak() {
  const lastActiveDateStr = localStorage.getItem("itqan_last_active_date");
  const storedStreak = localStorage.getItem("itqan_streak_count");
  
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  
  if (!storedStreak) {
    streakCount = 0;
    return;
  }
  
  streakCount = parseInt(storedStreak);
  
  if (lastActiveDateStr) {
    const lastActive = new Date(lastActiveDateStr);
    const timeDiff = today.getTime() - lastActive.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff > 1) {
      // Streak broken
      streakCount = 0;
      localStorage.setItem("itqan_streak_count", "0");
    }
  }
}

function recordActivityForStreak() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const lastActiveDateStr = localStorage.getItem("itqan_last_active_date");
  
  if (!lastActiveDateStr) {
    streakCount = 1;
  } else {
    if (lastActiveDateStr !== todayStr) {
      const lastActive = new Date(lastActiveDateStr);
      const timeDiff = today.getTime() - lastActive.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
      
      if (daysDiff === 1) {
        streakCount += 1; // Consecutive day
      } else if (daysDiff > 1) {
        streakCount = 1; // Streak was broken
      }
    }
  }
  
  localStorage.setItem("itqan_streak_count", streakCount.toString());
  localStorage.setItem("itqan_last_active_date", todayStr);
  updateHeaderStats();
}


/* ==========================================================================
   Rendering Mechanics & UI Updates
   ========================================================================== */

function initializeApp() {
  loadStateFromStorage();
  
  // Render Sidebar curriculum list
  renderSidebarDays();
  
  // Load Active Day content
  loadActiveDayContent();
  
  // Update header elements
  updateHeaderStats();
  updateWalletCountBadge();
  
  // Bind Static Listeners
  bindStaticListeners();
}

function updateHeaderStats() {
  streakCountText.innerText = streakCount.toString();
  
  const completionPercent = Math.round((completedDays.length / 30) * 100);
  progressPercentText.innerText = `${completionPercent}%`;
  headerProgressBar.style.width = `${completionPercent}%`;
}

function updateWalletCountBadge() {
  const count = savedWords.length;
  walletCountBadge.innerText = count.toString();
  walletTotalCount.innerText = count.toString();
  
  if (count === 0) {
    emptyWalletView.classList.remove("hidden");
    walletItemsGridView.classList.add("hidden");
  } else {
    emptyWalletView.classList.add("hidden");
    walletItemsGridView.classList.remove("hidden");
    renderWalletItems();
  }
}

// 1. Sidebar renderer
function renderSidebarDays() {
  daysNavContainer.innerHTML = "";
  
  challengeData.forEach((dayData, index) => {
    const isCompleted = completedDays.includes(dayData.day);
    const isActive = index === currentDayIndex;
    
    const dayBtn = document.createElement("button");
    dayBtn.className = `day-nav-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`;
    dayBtn.id = `sidebar-day-${dayData.day}`;
    
    let statusIconHtml = "";
    if (isCompleted) {
      statusIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="status-icon-check"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (isActive) {
      statusIconHtml = `<div class="status-icon-active"></div>`;
    } else {
      statusIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon-locked"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>`;
    }
    
    dayBtn.innerHTML = `
      <div class="day-status-indicator">
        ${statusIconHtml}
      </div>
      <div class="day-item-meta">
        <div class="day-item-num">Day ${dayData.day.toString().padStart(2, '0')}</div>
        <div class="day-item-title">${dayData.title}</div>
      </div>
      <span class="day-level-tag">${dayData.difficulty.split(" ")[0]}</span>
    `;
    
    dayBtn.addEventListener("click", () => {
      // Pause TTS before transitioning
      stopVoice();
      currentDayIndex = index;
      saveStateToStorage();
      
      // Update sidebar visual active class
      document.querySelectorAll(".day-nav-item").forEach(btn => btn.classList.remove("active"));
      dayBtn.classList.add("active");
      
      // Reload Workspace active Day
      loadActiveDayContent();
      
      // Reset sidebar statuses visually
      renderSidebarDays();
      
      // Smooth scroll back to top of reader area on click
      document.querySelector(".reader-area").scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    daysNavContainer.appendChild(dayBtn);
  });
}

// 2. Active Day Reader Card Loader
function loadActiveDayContent() {
  const currentDayData = challengeData[currentDayIndex];
  
  // Update badge and basic texts
  activeDayBadge.innerText = `DAY ${currentDayData.day.toString().padStart(2, '0')}`;
  activeStoryTitle.innerText = currentDayData.title;
  difficultyTag.innerText = currentDayData.difficulty;
  
  const wordCount = currentDayData.story.split(/\s+/).length;
  wordCountBadge.innerText = `${wordCount} Words`;
  
  // Prepare & Render Clickable Story Text
  storyTextView.innerHTML = prepareStoryWordsHtml(currentDayData.story, currentDayData.dictionary);
  
  // Render Target Words for today
  renderTargetWords(currentDayData.target_words, currentDayData.dictionary);
  
  // Render Comprehension Quiz
  renderQuiz(currentDayData.quiz);
  
  // Progress Complete button handling
  selectedQuizAnswers = {}; // reset quiz answers
  
  const isCompleted = completedDays.includes(currentDayData.day);
  if (isCompleted) {
    btnCompleteDay.classList.add("hidden");
    // Show next day button if not on day 30
    if (currentDayIndex < 29) {
      btnNextDay.classList.remove("hidden");
    } else {
      btnNextDay.classList.add("hidden");
    }
  } else {
    btnCompleteDay.classList.remove("hidden");
    btnNextDay.classList.add("hidden");
  }
  
  // Close any open tooltips
  closeTooltip();
}

// 3. String Word Tokenizer Builder
function prepareStoryWordsHtml(storyText, dictionary) {
  // Sort dictionary keys by length in descending order to match multi-word phrases first
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  
  let html = storyText;
  
  if (sortedKeys.length === 0) return storyText;
  
  // Escaping regex chars
  const escapedKeys = sortedKeys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  
  // We match full phrases/words using word boundaries
  const regexStr = '\\b(' + escapedKeys.join('|') + ')\\b';
  const regex = new RegExp(regexStr, 'gi');
  
  // Match and replace in story
  html = html.replace(regex, (match) => {
    const lowerMatch = match.toLowerCase();
    // Locate match in original dictionary keys to preserve dictionary mapping
    const exactKey = Object.keys(dictionary).find(k => k.toLowerCase() === lowerMatch) || match;
    return `<span class="story-word" data-word="${exactKey.replace(/"/g, '&quot;')}">${match}</span>`;
  });
  
  return html;
}

// 4. Render Target Words Badges
function renderTargetWords(targetWords, dictionary) {
  targetWordsContainer.innerHTML = "";
  
  targetWords.forEach(word => {
    const translation = dictionary[word.toLowerCase()] || dictionary[word] || "مترجم قريباً";
    const isSaved = isWordSaved(word);
    
    const card = document.createElement("div");
    card.className = "word-badge-card";
    
    card.innerHTML = `
      <div class="word-info">
        <span class="word-eng-text">${word}</span>
        <span class="word-arb-text">${translation}</span>
      </div>
      <button class="save-word-badge-btn ${isSaved ? 'saved' : ''}" data-word="${word.replace(/"/g, '&quot;')}" data-translation="${translation.replace(/"/g, '&quot;')}" title="Save to Vocabulary Wallet">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    `;
    
    // Bookmark save listener
    const saveBtn = card.querySelector(".save-word-badge-btn");
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWordSave(word, translation, "target");
      saveBtn.classList.toggle("saved");
      updateWalletCountBadge();
    });
    
    targetWordsContainer.appendChild(card);
  });
}

// 5. Render Comprehension Quiz
function renderQuiz(quizArray) {
  quizQuestionsContainer.innerHTML = "";
  
  quizArray.forEach((q, qIdx) => {
    const questionCard = document.createElement("div");
    questionCard.className = "quiz-question-item";
    
    const optionsHtml = q.options.map((option, optIdx) => {
      const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C...
      return `
        <button class="quiz-option" data-qidx="${qIdx}" data-optidx="${optIdx}">
          <span class="option-prefix">${optionLetter}</span>
          <span class="option-text">${option}</span>
        </button>
      `;
    }).join('');
    
    questionCard.innerHTML = `
      <p class="quiz-q-text">${qIdx + 1}. ${q.question}</p>
      <div class="quiz-options-grid">
        ${optionsHtml}
      </div>
    `;
    
    // Bind click events to options
    const optionBtns = questionCard.querySelectorAll(".quiz-option");
    optionBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const activeQuizObj = challengeData[currentDayIndex].quiz[qIdx];
        const correctIdx = activeQuizObj.answer;
        const currentSelected = parseInt(btn.getAttribute("data-optidx"));
        
        // Disable other clicking once answered
        const siblingButtons = questionCard.querySelectorAll(".quiz-option");
        siblingButtons.forEach(sb => sb.classList.remove("selected", "correct", "incorrect"));
        
        selectedQuizAnswers[qIdx] = currentSelected;
        
        // Grade option immediately
        if (currentSelected === correctIdx) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("incorrect");
          // Visual guide highlighting correct answer
          siblingButtons[correctIdx].classList.add("correct");
        }
      });
    });
    
    quizQuestionsContainer.appendChild(questionCard);
  });
}

// 6. Vocabulary Wallet (My Saved Words List) Renderer
function renderWalletItems() {
  savedWordsContainer.innerHTML = "";
  
  const searchQuery = walletSearchBar.value.toLowerCase().trim();
  const activeFilterChip = document.querySelector(".filter-chip.active");
  const activeFilter = activeFilterChip ? activeFilterChip.getAttribute("data-filter") : "all";
  
  // Filter saved words array
  const filtered = savedWords.filter(item => {
    // Search query filter
    const matchesSearch = item.word.toLowerCase().includes(searchQuery) || item.translation.includes(searchQuery);
    
    // Filter chip constraints
    let matchesType = true;
    if (activeFilter === "saved") {
      matchesType = item.source === "click-saved";
    } else if (activeFilter === "target") {
      matchesType = item.source === "target";
    }
    
    return matchesSearch && matchesType;
  });
  
  if (filtered.length === 0) {
    savedWordsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 12px; color: var(--color-text-muted);">
        <p>No words found matching your active filter criteria.</p>
      </div>
    `;
    return;
  }
  
  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "wallet-word-card";
    
    const sourceLabel = item.source === "target" ? "Target Word" : "Manually Saved";
    const sourceClass = item.source === "target" ? "target-saved" : "manually-saved";
    
    card.innerHTML = `
      <div class="wallet-word-card-header">
        <span class="wallet-card-term">${item.word}</span>
        <span class="wallet-card-meta ${sourceClass}">${sourceLabel}</span>
      </div>
      <div class="wallet-card-body">
        <span class="wallet-card-translation">${item.translation}</span>
        <span class="wallet-card-source">Saved from Day ${item.day} stories</span>
      </div>
      <div class="wallet-card-actions">
        <button class="wallet-action-btn btn-speak" title="Listen to word">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
        <button class="wallet-action-btn btn-delete" title="Remove word from wallet">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    
    // Audio trigger
    card.querySelector(".btn-speak").addEventListener("click", () => {
      speakWord(item.word);
    });
    
    // Delete word trigger
    card.querySelector(".btn-delete").addEventListener("click", () => {
      savedWords = savedWords.filter(w => w.word.toLowerCase() !== item.word.toLowerCase());
      saveStateToStorage();
      updateWalletCountBadge();
      loadActiveDayContent(); // Updates star highlights in active reading session
    });
    
    savedWordsContainer.appendChild(card);
  });
}


/* ==========================================================================
   Interactive Handlers & Event Binding
   ========================================================================== */

function bindStaticListeners() {
  
  // Navigation Tabs Switching
  tabChallengeBtn.addEventListener("click", () => {
    switchTab("challenge");
  });
  
  tabWalletBtn.addEventListener("click", () => {
    switchTab("wallet");
  });
  
  logoHome.addEventListener("click", () => {
    switchTab("challenge");
  });
  
  btnWalletGoReading.addEventListener("click", () => {
    switchTab("challenge");
  });
  
  // Interactive Word Click Detection inside Story Board
  storyTextView.addEventListener("click", (e) => {
    const targetWordNode = e.target.closest(".story-word");
    if (!targetWordNode) {
      closeTooltip();
      return;
    }
    
    e.stopPropagation();
    openTooltip(targetWordNode);
  });
  
  // Click outside to close Tooltip popup
  document.addEventListener("click", (e) => {
    if (!dictTooltip.contains(e.target) && !e.target.closest(".story-word")) {
      closeTooltip();
    }
  });
  
  // Audio Narrator Event
  btnListen.addEventListener("click", () => {
    toggleVoiceStory();
  });
  
  // Complete Day Action Button
  btnCompleteDay.addEventListener("click", () => {
    completeDayChallenge();
  });
  
  // Next Day Transition action
  btnNextDay.addEventListener("click", () => {
    transitionToNextDay();
  });
  
  // Search vocabulary wallet live updates
  walletSearchBar.addEventListener("input", () => {
    renderWalletItems();
  });
  
  // Vocabulary Wallet Filters
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderWalletItems();
    });
  });
  
  // Wallet clear/reset list
  btnClearWallet.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your Vocabulary Wallet? This will delete all your saved words.")) {
      savedWords = [];
      saveStateToStorage();
      updateWalletCountBadge();
      loadActiveDayContent(); // sync highlights
    }
  });
  
  // Close dictionary popups manually
  tooltipCloseBtn.addEventListener("click", () => {
    closeTooltip();
  });
  
  // Tooltip Audio triggers
  tooltipAudioBtn.addEventListener("click", () => {
    speakWord(tooltipEng.innerText);
  });
  
  // Milestone modal Continue button
  btnCelebrationContinue.addEventListener("click", () => {
    celebrationModal.classList.add("hidden");
    transitionToNextDay();
  });
}

function switchTab(target) {
  activeTab = target;
  if (activeTab === "challenge") {
    tabChallengeBtn.classList.add("active");
    tabWalletBtn.classList.remove("active");
    panelChallenge.classList.add("active");
    panelWallet.classList.remove("active");
  } else {
    tabChallengeBtn.classList.remove("active");
    tabWalletBtn.classList.add("active");
    panelChallenge.classList.remove("active");
    panelWallet.classList.add("active");
    renderWalletItems();
  }
  // Pause any voice active during transitions
  stopVoice();
}


/* ==========================================================================
   Part of Speech Detection Core
   ========================================================================== */
function getPartOfSpeech(word) {
  const clean = word.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  
  // Custom exact overrides for specific words from our curriculum:
  const posMap = {
    // Verbs
    "start": "verb / فعل",
    "starts": "verb / فعل",
    "brewing": "verb / فعل",
    "learning": "verb / فعل",
    "select": "verb / فعل",
    "roast": "verb / فعل",
    "release": "verb / فعل",
    "remains": "verb / فعل",
    "survive": "verb / فعل",
    "adapted": "verb / فعل",
    "encourage": "verb / فعل",
    "reduce": "verb / فعل",
    "protect": "verb / فعل",
    "prevent": "verb / فعل",
    "improves": "verb / فعل",
    "boosting": "verb / فعل",
    "invented": "verb / فعل",
    "communicated": "verb / فعل",
    "emerged": "verb / فعل",
    "utilized": "verb / فعل",
    "record": "verb / فعل",
    "enabling": "verb / فعل",
    "expand": "verb / فعل",
    "looking for": "phrase / عبارة فعلية",
    "manage": "verb / فعل",
    "utilize": "verb / فعل",
    "monitor": "verb / فعل",
    "optimize": "verb / فعل",
    "perform": "verb / فعل",
    "fly": "verb / فعل",
    "searching": "verb / فعل",
    "transport": "verb / فعل",
    "allows": "verb / فعل",
    "reproduce": "verb / فعل",
    "produce": "verb / فعل",
    "generate": "verb / فعل",
    "run out": "phrase / عبارة فعلية",
    "consolidates": "verb / فعل",
    "repairs": "verb / فعل",
    "strengthens": "verb / فعل",
    "maintain": "verb / فعل",
    "consumed": "verb / فعل",
    "surpassed": "verb / فعل",
    "discovered": "verb / فعل",
    "noticed": "verb / فعل",
    "located": "verb / فعل",
    "consists": "verb / فعل",
    "arranged": "verb / فعل",
    "debated": "verb / فعل",
    "transported": "verb / فعل",
    "feel": "verb / فعل",
    "seeks": "verb / فعل",
    "save": "verb / فعل",
    "identifying": "verb / فعل",
    "rewarding": "verb / فعل",
    "build": "verb / فعل",
    "creates": "verb / فعل",
    "wearing": "verb / فعل",
    "explore": "verb / فعل",
    "training": "verb / فعل",
    "simulating": "verb / فعل",
    "stretching": "verb / فعل",
    "pose": "verb / فعل",
    "confined": "verb / فعل",
    "recommend": "verb / فعل",
    "predict": "verb / فعل",
    "filter": "verb / فعل",
    "answer": "verb / فعل",
    "struggled": "verb / فعل",
    "halting": "verb / فعل",
    "employs": "verb / فعل",
    "extend": "verb / فعل",
    "spanned": "verb / فعل",
    "originating": "verb / فعل",
    "marked": "verb / فعل",
    "focused": "verb / فعل",
    "possess": "verb / فعل",
    "convey": "verb / فعل",
    "evokes": "verb / فعل",
    "stimulates": "verb / فعل",
    "coexist": "verb / فعل",
    "depend": "verb / فعل",
    "disrupt": "verb / فعل",
    "transformed": "verb / فعل",
    "began": "verb / فعل",
    "share": "verb / فعل",
    "transmit": "verb / فعل",
    "traded": "verb / فعل",
    "rely": "verb / فعل",
    "escape": "verb / فعل",
    "erupts": "verb / فعل",
    "originates": "verb / فعل",
    "enrich": "verb / فعل",
    "running": "noun/verb / اسم أو فعل",
    "train": "verb / فعل",
    "avoid": "verb / فعل",
    "reaching": "verb / فعل",
    "finish": "verb / فعل",
    "exploring": "verb / فعل",
    "deployed": "verb / فعل",
    "analyze": "verb / فعل",
    "search": "verb / فعل",
    "submit": "verb / فعل",
    "scan": "verb / فعل",
    "visit": "verb / فعل",
    "index": "verb / فعل",
    "evaluate": "verb / فعل",
    "dating back": "phrase / عبارة فعلية",
    "simulated": "verb / فعل",
    "taught": "verb / فعل",
    "become": "verb / فعل",
    "overwhelmed": "adjective/verb / صفة أو فعل",
    "focusing": "verb / فعل",
    "suggest": "verb / فعل",
    "reduces": "verb / فعل",
    "enhances": "verb / فعل",
    "appear": "verb / فعل",
    "connected": "adjective/verb / صفة أو فعل",
    "exchange": "verb / فعل",
    "attacked": "verb / فعل",
    "signal": "verb / فعل",
    "prepare": "verb / فعل",
    "promotes": "verb / فعل",
    "bonding": "noun/verb / اسم أو فعل",
    "alleviate": "verb / فعل",
    "lower": "verb / فعل",
    "stimulating": "verb / فعل",
    "understand": "verb / فعل",
    "create": "verb / فعل",
    "save": "verb / فعل",
    "invest": "verb / فعل",
    "accumulate": "verb / فعل",

    // Adjectives
    "hot": "adjective / صفة",
    "complicated": "adjective / صفة",
    "finest": "adjective / صفة",
    "exact": "adjective / صفة",
    "deep": "adjective / صفة",
    "mysterious": "adjective / صفة",
    "unexplored": "adjective / صفة",
    "extreme": "adjective / صفة",
    "freezing": "adjective / صفة",
    "strange": "adjective / صفة",
    "marine": "adjective / صفة",
    "harsh": "adjective / صفة",
    "electric": "adjective / صفة",
    "popular": "adjective / صفة",
    "traditional": "adjective / صفة",
    "primary": "adjective / صفة",
    "greenhouse": "adjective / صفة",
    "regular": "adjective / صفة",
    "physical": "adjective / صفة",
    "essential": "adjective / صفة",
    "good": "adjective / صفة",
    "chronic": "adjective / صفة",
    "mental": "adjective / صفة",
    "spoken": "adjective / صفة",
    "earliest": "adjective / صفة",
    "ancient": "adjective / صفة",
    "clay": "adjective / صفة",
    "complex": "adjective / صفة",
    "urban": "adjective / صفة",
    "innovative": "adjective / صفة",
    "smart": "adjective / صفة",
    "digital": "adjective / صفة",
    "fossil": "adjective / صفة",
    "limited": "adjective / صفة",
    "significant": "adjective / صفة",
    "renewable": "adjective / صفة",
    "solar": "adjective / صفة",
    "wind": "adjective / صفة",
    "crucial": "adjective / صفة",
    "global": "adjective / صفة",
    "active": "adjective / صفة",
    "damaged": "adjective / صفة",
    "immune": "adjective / صفة",
    "overall": "adjective / صفة",
    "second": "adjective / صفة",
    "boiling": "adjective / صفة",
    "wonderful": "adjective / صفة",
    "pleasant": "adjective / صفة",
    "famous": "adjective / صفة",
    "prehistoric": "adjective / صفة",
    "massive": "adjective / صفة",
    "standing": "adjective / صفة",
    "circular": "adjective / صفة",
    "heavy": "adjective / صفة",
    "conscious": "adjective / صفة",
    "automatic": "adjective / صفة",
    "positive": "adjective / صفة",
    "constructive": "adjective / صفة",
    "virtual": "adjective / صفة",
    "immersive": "adjective / صفة",
    "interactive": "adjective / صفة",
    "specialized": "adjective / صفة",
    "medical": "adjective / صفة",
    "largest": "adjective / صفة",
    "living": "adjective / صفة",
    "spectacular": "adjective / صفة",
    "tiny": "adjective / صفة",
    "rising": "adjective / صفة",
    "major": "adjective / صفة",
    "natural": "adjective / صفة",
    "intelligent": "adjective / صفة",
    "voice-activated": "adjective / صفة",
    "fresh": "adjective / صفة",
    "modern": "adjective / صفة",
    "vacuum": "adjective / صفة",
    "influential": "adjective / صفة",
    "cultural": "adjective / صفة",
    "classical": "adjective / صفة",
    "iconic": "adjective / صفة",
    "powerful": "adjective / صفة",
    "psychological": "adjective / صفة",
    "specific": "adjective / صفة",
    "diverse": "adjective / صفة",
    "single": "adjective / صفة",
    "extinct": "adjective / صفة",
    "entire": "adjective / صفة",
    "ecological": "adjective / صفة",
    "healthy": "adjective / صفة",
    "late": "adjective / صفة",
    "military": "adjective / صفة",
    "subsequent": "adjective / صفة",
    "beloved": "adjective / صفة",
    "developing": "adjective / صفة",
    "unstable": "adjective / صفة",
    "molten": "adjective / صفة",
    "dangerous": "adjective / صفة",
    "surrounding": "adjective / صفة",
    "fertile": "adjective / صفة",
    "supreme": "adjective / صفة",
    "distant": "adjective / صفة",
    "close": "adjective / صفة",
    "advanced": "adjective / صفة",
    "robotic": "adjective / صفة",
    "microbial": "adjective / صفة",
    "fast-paced": "adjective / صفة",
    "present": "adjective / صفة",
    "scientific": "adjective / صفة",
    "emotional": "adjective / صفة",
    "isolated": "adjective / صفة",
    "vast": "adjective / صفة",
    "critical": "adjective / صفة",
    "emergency": "adjective / صفة",
    "oxygen-rich": "adjective / صفة",
    "universal": "adjective / صفة",
    "human": "adjective / صفة",
    "social": "adjective / صفة",
    "financial": "adjective / صفة",
    "balanced": "adjective / صفة",
    "long-term": "adjective / صفة",

    // Adverbs
    "however": "adverb / ظرف",
    "perfectly": "adverb / ظرف",
    "completely": "adverb / ظرف",
    "increasingly": "adverb / ظرف",
    "regularly": "adverb / ظرف",
    "furthermore": "adverb / ظرف",
    "solely": "adverb / ظرف",
    "rapidly": "adverb / ظرف",
    "efficiently": "adverb / ظرف",
    "never": "adverb / ظرف",
    "merely": "adverb / ظرف",
    "meanwhile": "adverb / ظرف",
    "only": "adverb / ظرف",
    "actually": "adverb / ظرف",
    "constantly": "adverb / ظرف",
    "successfully": "adverb / ظرف",
    "sadly": "adverb / ظرف",
    "instantly": "adverb / ظرف",
    "carefully": "adverb / ظرف",
    "originally": "adverb / ظرف",
    "seamlessly": "adverb / ظرف",
    "heavily": "adverb / ظرف",
    "highly": "adverb / ظرف",
    "diligently": "adverb / ظرف",
    "deeply": "adverb / ظرف",
    "entirely": "adverb / ظرف",
    "effectively": "adverb / ظرف",
    "wisely": "adverb / ظرف",

    // Prepositions / Conjunctions
    "before": "preposition/conjunction / حرف جر أو عطف",
    "within": "preposition / حرف جر",
    "without": "preposition / حرف جر",
    "beneath": "preposition / حرف جر",
    "since": "preposition/conjunction / حرف جر أو عطف",
    "although": "conjunction / حرف ربط",
    "unlike": "preposition / حرف جر",
    "yet": "conjunction / حرف عطف"
  };

  if (posMap[clean]) {
    return posMap[clean];
  }

  // Common plurals to singular lookup
  if (clean.endsWith("s")) {
    const singular = clean.slice(0, -1);
    if (posMap[singular]) {
      return posMap[singular];
    }
  }
  // Try looking up clean version ending in "es"
  if (clean.endsWith("es")) {
    const singular = clean.slice(0, -2);
    if (posMap[singular]) {
      return posMap[singular];
    }
  }
  // Try past tense mapping
  if (clean.endsWith("ed")) {
    const present = clean.slice(0, -2);
    if (posMap[present]) {
      return posMap[present];
    }
    const presentWithE = clean.slice(0, -1);
    if (posMap[presentWithE]) {
      return posMap[presentWithE];
    }
  }
  // Try gerund mapping
  if (clean.endsWith("ing")) {
    const base = clean.slice(0, -3);
    if (posMap[base]) {
      return posMap[base];
    }
    const baseWithE = clean.slice(0, -3) + "e";
    if (posMap[baseWithE]) {
      return posMap[baseWithE];
    }
  }

  // Heuristics based on word endings
  if (clean.endsWith("ly")) {
    return "adverb / ظرف";
  }
  if (clean.endsWith("tion") || clean.endsWith("ity") || clean.endsWith("ness") || clean.endsWith("ment") || clean.endsWith("er") || clean.endsWith("or") || clean.endsWith("ist")) {
    return "noun / اسم";
  }
  if (clean.endsWith("ful") || clean.endsWith("ous") || clean.endsWith("al") || clean.endsWith("ive") || clean.endsWith("ic") || clean.endsWith("able") || clean.endsWith("ible")) {
    return "adjective / صفة";
  }

  // Fallback to noun
  return "noun / اسم";
}

/* ==========================================================================
   Interactive Tooltip Popup Core Logic
   ========================================================================== */

function openTooltip(wordElement) {
  const originalWord = wordElement.getAttribute("data-word");
  const displayWord = wordElement.innerText;
  const currentDayData = challengeData[currentDayIndex];
  
  // Get translation from Dictionary mapping (fallback to lowercase word)
  let translation = currentDayData.dictionary[originalWord.toLowerCase()] || 
                    currentDayData.dictionary[originalWord] || 
                    currentDayData.dictionary[displayWord.toLowerCase()] || 
                    "مترجم قريباً";
  
  tooltipEng.innerText = displayWord;
  tooltipArb.innerText = translation;
  if (tooltipPos) {
    tooltipPos.innerText = getPartOfSpeech(displayWord);
  }
  
  // Setup Tooltip star save state
  const isSaved = isWordSaved(displayWord);
  if (isSaved) {
    tooltipSaveBtn.classList.add("saved");
    tooltipSaveText.innerText = "Word Saved";
  } else {
    tooltipSaveBtn.classList.remove("saved");
    tooltipSaveText.innerText = "Save Word";
  }
  
  // Set Tooltip Dynamic absolute coordinates relative to clicked word bounding client rect
  dictTooltip.classList.remove("hidden");
  
  const rect = wordElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  const tooltipHeight = dictTooltip.offsetHeight;
  const tooltipWidth = dictTooltip.offsetWidth;
  const arrowNode = dictTooltip.querySelector(".tooltip-arrow");
  
  // Calculate centers
  let top = rect.top + scrollTop - tooltipHeight - 12; // 12px gap
  let left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
  
  // Vertical boundary check: if the tooltip goes off the top screen boundary, display below the word
  let showBelow = false;
  if (top < scrollTop) {
    top = rect.bottom + scrollTop + 12;
    showBelow = true;
  }
  
  // Horizontal boundary checks
  const viewportPadding = 12;
  const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
  
  if (left < viewportPadding) {
    left = viewportPadding;
  } else if (left > maxLeft) {
    left = maxLeft;
  }
  
  dictTooltip.style.top = `${top}px`;
  dictTooltip.style.left = `${left}px`;
  
  // Reposition arrow relative to tooltip box to align precisely with clicked word
  const relativeWordCenter = rect.left + scrollLeft + (rect.width / 2) - left;
  arrowNode.style.left = `${relativeWordCenter}px`;
  
  if (showBelow) {
    arrowNode.style.top = "-6px";
    arrowNode.style.borderBottom = "none";
    arrowNode.style.borderRight = "none";
    arrowNode.style.borderTop = "1px solid var(--color-primary)";
    arrowNode.style.borderLeft = "1px solid var(--color-primary)";
  } else {
    arrowNode.style.top = "auto";
    arrowNode.style.bottom = "-6px";
    arrowNode.style.borderTop = "none";
    arrowNode.style.borderLeft = "none";
    arrowNode.style.borderBottom = "1px solid var(--color-primary)";
    arrowNode.style.borderRight = "1px solid var(--color-primary)";
  }
  
  // Re-bind Save event listener to this specific word/translation
  tooltipSaveBtn.onclick = (e) => {
    e.stopPropagation();
    toggleWordSave(displayWord, translation, "click-saved");
    const nowSaved = isWordSaved(displayWord);
    
    if (nowSaved) {
      tooltipSaveBtn.classList.add("saved");
      tooltipSaveText.innerText = "Word Saved";
    } else {
      tooltipSaveBtn.classList.remove("saved");
      tooltipSaveText.innerText = "Save Word";
    }
    
    updateWalletCountBadge();
    loadActiveDayContent(); // visual refresh target word highlights
  };
}

function closeTooltip() {
  dictTooltip.classList.add("hidden");
}


/* ==========================================================================
   Word Save/Delete Operations
   ========================================================================== */

function isWordSaved(word) {
  return savedWords.some(item => item.word.toLowerCase() === word.toLowerCase().trim());
}

function toggleWordSave(word, translation, source) {
  const cleanWord = word.trim();
  const index = savedWords.findIndex(item => item.word.toLowerCase() === cleanWord.toLowerCase());
  
  if (index > -1) {
    // Already saved, remove it
    savedWords.splice(index, 1);
  } else {
    // Add to wallet array
    savedWords.push({
      word: cleanWord,
      translation: translation.trim(),
      day: currentDayIndex + 1,
      source: source // click-saved | target
    });
  }
  
  saveStateToStorage();
}


/* ==========================================================================
   Native Browser Text-To-Speech (Speech Synthesis)
   ========================================================================== */

function speakWord(word) {
  if (!synth) return;
  
  // Stop active synthesis
  synth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.85; // slightly slower for learners
  utterance.pitch = 1.0;
  
  synth.speak(utterance);
}

function toggleVoiceStory() {
  if (!synth) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }
  
  if (synth.speaking) {
    stopVoice();
  } else {
    playVoiceStory();
  }
}

function playVoiceStory() {
  const activeDayData = challengeData[currentDayIndex];
  
  btnListen.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon animation-speaking-pulse"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
    <span>Stop Story</span>
  `;
  btnListen.classList.add("voice-active");
  
  currentUtterance = new SpeechSynthesisUtterance(activeDayData.story);
  currentUtterance.lang = 'en-US';
  currentUtterance.rate = 0.85; // Comfortable listening pace
  
  // Highlight words boundary callback (Only works in browsers fully supporting speechSynthesis boundary events)
  currentUtterance.onboundary = function(event) {
    if (event.name === 'word') {
      const storyText = activeDayData.story;
      const charIndex = event.charIndex;
      
      // Look up character word boundaries in text and add a temporary active highlight style class
      const remainingText = storyText.substring(charIndex);
      const wordMatch = remainingText.match(/^[\w'-]+/);
      if (wordMatch) {
        const spokenWord = wordMatch[0].toLowerCase();
        
        // Match visually rendered elements
        document.querySelectorAll(".story-word").forEach(span => {
          const w = span.innerText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
          if (w === spokenWord) {
            span.classList.add("active-speaking");
          } else {
            span.classList.remove("active-speaking");
          }
        });
      }
    }
  };
  
  currentUtterance.onend = function() {
    stopVoice();
  };
  
  currentUtterance.onerror = function() {
    stopVoice();
  };
  
  synth.speak(currentUtterance);
}

function stopVoice() {
  if (!synth) return;
  synth.cancel();
  
  btnListen.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    <span>Listen to Story</span>
  `;
  btnListen.classList.remove("voice-active");
  
  // Remove speaking style classes on completion
  document.querySelectorAll(".story-word").forEach(span => {
    span.classList.remove("active-speaking");
  });
}


/* ==========================================================================
   Milestone Navigation & Completion
   ========================================================================== */

function completeDayChallenge() {
  const currentDayData = challengeData[currentDayIndex];
  
  // Ensure the quiz has been fully graded first before enabling complete triggers
  const totalQuestions = currentDayData.quiz.length;
  const totalAnswered = Object.keys(selectedQuizAnswers).length;
  
  if (totalAnswered < totalQuestions) {
    alert("Please answer the Comprehension Check quiz questions before completing the day!");
    return;
  }
  
  // Add to completed array if not already present
  if (!completedDays.includes(currentDayData.day)) {
    completedDays.push(currentDayData.day);
  }
  
  // Streak records
  recordActivityForStreak();
  saveStateToStorage();
  
  // Progress Bar updates
  updateHeaderStats();
  renderSidebarDays();
  
  // Trigger Milestone Celebration overlay modal
  showCelebrationModal();
  
  // UI Switch
  btnCompleteDay.classList.add("hidden");
  if (currentDayIndex < 29) {
    btnNextDay.classList.remove("hidden");
  }
}

function showCelebrationModal() {
  statCompletedDays.innerText = `${completedDays.length}/30`;
  statStreakDays.innerText = streakCount.toString();
  
  const currentDayData = challengeData[currentDayIndex];
  const isFinalDay = currentDayData.day === 30;
  
  if (isFinalDay) {
    document.getElementById("celebration-title").innerText = "Congratulations!";
    document.getElementById("celebration-message").innerText = "You have fully completed the 30-Day English Reading Challenge! Your English vocabulary wallet is overflowing with knowledge. Excellent work!";
    btnCelebrationContinue.innerText = "Finish Challenge";
  } else {
    document.getElementById("celebration-title").innerText = `Day ${currentDayData.day} Completed!`;
    document.getElementById("celebration-message").innerText = `Excellent reading! Day ${currentDayData.day} is checked off. You unlocked Day ${currentDayData.day + 1} stories! Keep practicing to build your vocabulary.`;
    btnCelebrationContinue.innerText = "Unlock Next Day";
  }
  
  celebrationModal.classList.remove("hidden");
}

function transitionToNextDay() {
  celebrationModal.classList.add("hidden");
  
  if (currentDayIndex < 29) {
    currentDayIndex += 1;
    saveStateToStorage();
    loadActiveDayContent();
    renderSidebarDays();
    
    // Smooth scroll back to top of reader area
    document.querySelector(".reader-area").scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Final day completed, stay on screen and celebrate
    switchTab("wallet");
  }
}


/* ==========================================================================
   Trigger App Lifecycle Initialization
   ========================================================================== */
window.addEventListener("DOMContentLoaded", initializeApp);
