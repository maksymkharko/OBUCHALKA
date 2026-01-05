// Set dark theme as default (unless in Telegram)
document.body.classList.add('force-dark');

// Telegram Mini App Integration
let tg = null;
let isTelegram = false;

if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    isTelegram = true;
    tg.ready();
    tg.expand();
    
    // Remove force-dark when in Telegram to allow Telegram theme
    document.body.classList.remove('force-dark');
    
    // Apply Telegram theme
    const theme = tg.colorScheme;
    if (theme === 'light') {
        document.body.classList.add('telegram-light');
    } else {
        document.body.classList.add('telegram-dark');
    }
    
    // Listen for theme changes
    tg.onEvent('themeChanged', () => {
        const newTheme = tg.colorScheme;
        document.body.classList.remove('telegram-light', 'telegram-dark');
        if (newTheme === 'light') {
            document.body.classList.add('telegram-light');
        } else {
            document.body.classList.add('telegram-dark');
        }
    });
}

// Haptic Feedback utility
function hapticFeedback(type = 'light') {
    if (isTelegram && tg) {
        // Telegram haptic feedback
        const patterns = {
            light: 'impact',
            medium: 'impact',
            heavy: 'impact'
        };
        tg.HapticFeedback.impactOccurred(patterns[type] || 'light');
    } else if ('vibrate' in navigator) {
        // Browser haptic feedback
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30
        };
        navigator.vibrate(patterns[type] || patterns.light);
    }
}

// Parse time input (supports 1:30, 1.5, 1,5 formats)
function parseTimeInput(input) {
    if (!input || !input.trim()) return 0;
    
    const cleaned = input.trim().replace(/,/g, '.');
    
    // Check if it contains colon (hours:minutes format)
    if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        const hours = parseFloat(parts[0]) || 0;
        const minutes = parseFloat(parts[1]) || 0;
        return hours + (minutes / 60);
    }
    
    // Otherwise treat as decimal hours
    return parseFloat(cleaned) || 0;
}

// Storage utility with Telegram Cloud Storage support
const Storage = {
    async getActivities() {
        if (isTelegram && tg && tg.CloudStorage) {
            try {
                const data = await tg.CloudStorage.getItem('activities');
                return data ? JSON.parse(data) : [];
            } catch (error) {
                console.error('Telegram Cloud Storage error:', error);
                // Fallback to localStorage
                const data = localStorage.getItem('activities');
                return data ? JSON.parse(data) : [];
            }
        } else {
            const data = localStorage.getItem('activities');
            return data ? JSON.parse(data) : [];
        }
    },

    async saveActivities(activities) {
        if (isTelegram && tg && tg.CloudStorage) {
            try {
                await tg.CloudStorage.setItem('activities', JSON.stringify(activities));
            } catch (error) {
                console.error('Telegram Cloud Storage error:', error);
                // Fallback to localStorage
                localStorage.setItem('activities', JSON.stringify(activities));
            }
        } else {
            localStorage.setItem('activities', JSON.stringify(activities));
        }
    },

    async getHistory() {
        if (isTelegram && tg && tg.CloudStorage) {
            try {
                const data = await tg.CloudStorage.getItem('history');
                return data ? JSON.parse(data) : [];
            } catch (error) {
                console.error('Telegram Cloud Storage error:', error);
                const data = localStorage.getItem('history');
                return data ? JSON.parse(data) : [];
            }
        } else {
            const data = localStorage.getItem('history');
            return data ? JSON.parse(data) : [];
        }
    },

    async saveHistory(history) {
        if (isTelegram && tg && tg.CloudStorage) {
            try {
                await tg.CloudStorage.setItem('history', JSON.stringify(history));
            } catch (error) {
                console.error('Telegram Cloud Storage error:', error);
                localStorage.setItem('history', JSON.stringify(history));
            }
        } else {
            localStorage.setItem('history', JSON.stringify(history));
        }
    }
};

// App state
let activities = [];
let history = [];
let currentActivityId = null;
let deleteActivityId = null;
let deleteHistoryId = null;

// DOM elements
const activitiesList = document.getElementById('activities-list');
const historyList = document.getElementById('history-list');
const addButton = document.getElementById('add-activity-btn');
const createModal = document.getElementById('create-modal');
const timeModal = document.getElementById('time-modal');
const deleteModal = document.getElementById('delete-modal');
const deleteHistoryModal = document.getElementById('delete-history-modal');
const createForm = document.getElementById('create-form');
const timeForm = document.getElementById('time-form');
const cancelBtn = document.getElementById('cancel-btn');
const cancelTimeBtn = document.getElementById('cancel-time-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteHistoryBtn = document.getElementById('cancel-delete-history-btn');
const confirmDeleteHistoryBtn = document.getElementById('confirm-delete-history-btn');
const timeModalTitle = document.getElementById('time-modal-title');
const deleteActivityName = document.getElementById('delete-activity-name');
const deleteHistoryText = document.getElementById('delete-history-text');

// Initialize app
async function init() {
    activities = await Storage.getActivities();
    history = await Storage.getHistory();
    // Migrate old activities without createdAt
    let needsSave = false;
    activities.forEach(activity => {
        if (!activity.createdAt) {
            activity.createdAt = new Date().toISOString();
            needsSave = true;
        }
    });
    if (needsSave) {
        await Storage.saveActivities(activities);
    }
    renderActivities();
    renderHistory();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    addButton.addEventListener('click', () => {
        hapticFeedback('medium');
        openCreateModal();
    });

    createForm.addEventListener('submit', handleCreateActivity);
    timeForm.addEventListener('submit', handleAddTime);

    cancelBtn.addEventListener('click', closeCreateModal);
    cancelTimeBtn.addEventListener('click', closeTimeModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', handleDeleteActivity);
    cancelDeleteHistoryBtn.addEventListener('click', closeDeleteHistoryModal);
    confirmDeleteHistoryBtn.addEventListener('click', handleDeleteHistory);

    // Close modals when clicking outside
    createModal.addEventListener('click', (e) => {
        if (e.target === createModal) {
            closeCreateModal();
        }
    });

    timeModal.addEventListener('click', (e) => {
        if (e.target === timeModal) {
            closeTimeModal();
        }
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });

    deleteHistoryModal.addEventListener('click', (e) => {
        if (e.target === deleteHistoryModal) {
            closeDeleteHistoryModal();
        }
    });

    // Hide keyboard when clicking outside inputs or pressing Escape
    document.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.blur();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.blur();
            }
            closeCreateModal();
            closeTimeModal();
            closeDeleteModal();
        }
    });
}

// Modal functions
function openCreateModal() {
    createModal.classList.add('active');
    document.getElementById('activity-name').focus();
}

function closeCreateModal() {
    createModal.classList.remove('active');
    createForm.reset();
}

function openTimeModal(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    currentActivityId = activityId;
    timeModalTitle.textContent = `Добавить время: ${activity.name}`;
    timeModal.classList.add('active');
    document.getElementById('time-input').focus();
    hapticFeedback('light');
}

function closeTimeModal() {
    timeModal.classList.remove('active');
    timeForm.reset();
    currentActivityId = null;
}

function openDeleteModal(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    deleteActivityId = activityId;
    deleteActivityName.textContent = activity.name;
    deleteModal.classList.add('active');
    hapticFeedback('medium');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deleteActivityId = null;
}

function openDeleteHistoryModal(historyId) {
    const historyItem = history.find(h => h.id === historyId);
    if (!historyItem) return;

    deleteHistoryId = historyId;
    const activity = activities.find(a => a.id === historyItem.activityId);
    const activityName = activity ? activity.name : 'Неизвестная активность';
    deleteHistoryText.textContent = `${activityName} - ${formatHours(historyItem.hours)} (${formatDate(historyItem.date)})`;
    deleteHistoryModal.classList.add('active');
    hapticFeedback('medium');
}

function closeDeleteHistoryModal() {
    deleteHistoryModal.classList.remove('active');
    deleteHistoryId = null;
}

// Handle create activity
async function handleCreateActivity(e) {
    e.preventDefault();
    hapticFeedback('medium');

    const name = document.getElementById('activity-name').value.trim();
    const targetHours = parseFloat(document.getElementById('target-hours').value);
    const initialTimeInput = document.getElementById('initial-time').value.trim();
    const initialHours = parseTimeInput(initialTimeInput);

    if (!name || targetHours < 0) {
        return;
    }

    const newActivity = {
        id: Date.now().toString(),
        name: name,
        targetHours: targetHours,
        spentHours: initialHours,
        createdAt: new Date().toISOString()
    };

    activities.push(newActivity);
    await Storage.saveActivities(activities);
    renderActivities();
    closeCreateModal();
}

// Handle add time
async function handleAddTime(e) {
    e.preventDefault();
    hapticFeedback('medium');

    const timeInput = document.getElementById('time-input').value.trim();
    const totalHours = parseTimeInput(timeInput);

    if (totalHours <= 0 || !currentActivityId) {
        return;
    }

    const activity = activities.find(a => a.id === currentActivityId);
    if (activity) {
        activity.spentHours += totalHours;
        
        // Add to history
        const historyEntry = {
            id: Date.now().toString(),
            activityId: currentActivityId,
            activityName: activity.name,
            hours: totalHours,
            date: new Date().toISOString()
        };
        history.unshift(historyEntry); // Add to beginning
        // Keep only last 100 entries
        if (history.length > 100) {
            history = history.slice(0, 100);
        }
        
        await Storage.saveActivities(activities);
        await Storage.saveHistory(history);
        renderActivities();
        renderHistory();
        closeTimeModal();
    }
}

// Handle delete activity
async function handleDeleteActivity() {
    if (!deleteActivityId) return;

    hapticFeedback('heavy');
    
    // Remove from activities
    activities = activities.filter(a => a.id !== deleteActivityId);
    // Remove from history
    history = history.filter(h => h.activityId !== deleteActivityId);
    
    await Storage.saveActivities(activities);
    await Storage.saveHistory(history);
    renderActivities();
    renderHistory();
    closeDeleteModal();
}

// Handle delete history item
async function handleDeleteHistory() {
    if (!deleteHistoryId) return;

    hapticFeedback('heavy');
    
    const historyItem = history.find(h => h.id === deleteHistoryId);
    if (historyItem) {
        // Remove from history
        history = history.filter(h => h.id !== deleteHistoryId);
        
        // Update activity spent hours
        const activity = activities.find(a => a.id === historyItem.activityId);
        if (activity) {
            activity.spentHours = Math.max(0, activity.spentHours - historyItem.hours);
        }
        
        await Storage.saveActivities(activities);
        await Storage.saveHistory(history);
        renderActivities();
        renderHistory();
    }
    
    closeDeleteHistoryModal();
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Сегодня';
    } else if (diffDays === 1) {
        return 'Вчера';
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
}

// Render activities
function renderActivities() {
    if (activities.length === 0) {
        activitiesList.innerHTML = `
            <div class="empty-state">
                <p>Нет активностей</p>
                <p style="margin-top: 8px; font-size: 14px;">Нажмите "+" чтобы создать новую</p>
            </div>
        `;
        return;
    }

    activitiesList.innerHTML = activities.map(activity => {
        const percentage = activity.targetHours > 0 
            ? Math.min((activity.spentHours / activity.targetHours) * 100, 100) 
            : 0;
        
        const formattedSpent = formatHours(activity.spentHours);
        const formattedTarget = formatHours(activity.targetHours);
        const createdDate = activity.createdAt ? formatDate(activity.createdAt) : '';

        return `
            <div class="activity-card-wrapper">
                <div class="swipe-delete-background"></div>
                <div class="activity-card" data-id="${activity.id}">
                    <div class="activity-header">
                        <div class="activity-name">${escapeHtml(activity.name)}</div>
                    </div>
                    ${createdDate ? `<div class="activity-date">${createdDate}</div>` : ''}
                    <div class="stats-container">
                        <div class="stat-box target">
                            <div class="stat-label">Цель</div>
                            <div class="stat-value">${formattedTarget}</div>
                        </div>
                        <div class="stat-box spent">
                            <div class="stat-label">Потрачено</div>
                            <div class="stat-value">${formattedSpent}</div>
                        </div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${percentage < 10 ? 'low' : ''}" style="width: ${Math.max(percentage, 0)}%">
                            <span class="progress-percentage">${percentage.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners - click on card to add time
    document.querySelectorAll('.activity-card').forEach(card => {
        const activityId = card.dataset.id;
        
        card.addEventListener('click', () => {
            openTimeModal(activityId);
        });
    });

    // Swipe to delete
    setupSwipeToDelete();
}

// Setup swipe to delete - iOS style
function setupSwipeToDelete() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    let currentWrapper = null;
    let startTime = 0;

    document.querySelectorAll('.activity-card-wrapper').forEach(wrapper => {
        const card = wrapper.querySelector('.activity-card');
        
        card.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
            currentWrapper = wrapper;
            startTime = Date.now();
        });

        card.addEventListener('touchmove', (e) => {
            if (!currentWrapper) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const diffX = touchStartX - touchX;
            const diffY = Math.abs(touchStartY - touchY);

            // Check if horizontal swipe is dominant
            if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
                isSwiping = true;
                e.preventDefault();
                
                // Only allow left swipe (reveal delete)
                if (diffX > 0) {
                    const translateX = Math.min(diffX, 80);
                    currentWrapper.classList.add('swiping');
                    card.style.transform = `translateX(-${translateX}px)`;
                } else if (diffX < -10) {
                    // Swipe right - reset
                    currentWrapper.classList.remove('swiping');
                    card.style.transform = '';
                }
            }
        });

        card.addEventListener('touchend', (e) => {
            if (!currentWrapper) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;
            const swipeTime = Date.now() - startTime;
            
            if (isSwiping) {
                if (diffX > 50 || (diffX > 30 && swipeTime < 200)) {
                    // Swipe threshold met, delete activity
                    const activityId = card.dataset.id;
                    hapticFeedback('medium');
                    openDeleteModal(activityId);
                }
                
                // Reset position
                currentWrapper.classList.remove('swiping');
                card.style.transform = '';
            }
            
            isSwiping = false;
            currentWrapper = null;
        });
    });
}

// Render history
function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <p>История пуста</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = history.map(item => {
        const formattedTime = formatHours(item.hours);
        const formattedDate = formatDate(item.date);
        const activity = activities.find(a => a.id === item.activityId);
        const activityName = activity ? activity.name : item.activityName || 'Удаленная активность';

        return `
            <div class="history-item-wrapper">
                <div class="swipe-delete-background"></div>
                <div class="history-item" data-id="${item.id}">
                    <div class="history-item-content">
                        <div class="history-item-name">${escapeHtml(activityName)}</div>
                        <div class="history-item-meta">
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    <div class="history-item-time">+${formattedTime}</div>
                </div>
            </div>
        `;
    }).join('');

    // Setup swipe to delete for history
    setupHistorySwipeToDelete();
}

// Setup swipe to delete for history - iOS style
function setupHistorySwipeToDelete() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    let currentWrapper = null;
    let startTime = 0;
    let hasSwiped = false;

    document.querySelectorAll('.history-item-wrapper').forEach(wrapper => {
        const item = wrapper.querySelector('.history-item');
        
        item.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
            hasSwiped = false;
            currentWrapper = wrapper;
            startTime = Date.now();
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!currentWrapper) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const diffX = touchStartX - touchX;
            const diffY = Math.abs(touchStartY - touchY);

            // Check if horizontal swipe is dominant
            if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
                isSwiping = true;
                hasSwiped = true;
                e.preventDefault();
                
                // Only allow left swipe (reveal delete)
                if (diffX > 0) {
                    const translateX = Math.min(diffX, 80);
                    currentWrapper.classList.add('swiping');
                    item.style.transform = `translateX(-${translateX}px)`;
                } else if (diffX < -10) {
                    // Swipe right - reset
                    currentWrapper.classList.remove('swiping');
                    item.style.transform = '';
                }
            }
        }, { passive: false });

        item.addEventListener('touchend', (e) => {
            if (!currentWrapper) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;
            const swipeTime = Date.now() - startTime;
            
            if (isSwiping || hasSwiped) {
                if (diffX > 50 || (diffX > 30 && swipeTime < 200)) {
                    // Swipe threshold met, delete history item
                    const historyId = item.dataset.id;
                    hapticFeedback('medium');
                    openDeleteHistoryModal(historyId);
                } else {
                    // Animate back if not enough swipe
                    item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    item.style.transform = '';
                    setTimeout(() => {
                        item.style.transition = '';
                    }, 300);
                }
                
                // Reset position
                currentWrapper.classList.remove('swiping');
            }
            
            isSwiping = false;
            hasSwiped = false;
            currentWrapper = null;
        }, { passive: true });
    });
}

// Format hours to readable string
function formatHours(hours) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0 && minutes === 0) {
        return '0ч';
    }
    
    if (wholeHours === 0) {
        return `${minutes}м`;
    }
    
    if (minutes === 0) {
        return `${wholeHours}ч`;
    }
    
    return `${wholeHours}ч ${minutes}м`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
