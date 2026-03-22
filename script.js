/* ========================================
   BẦU CUA TÔM CÁ - Firebase Edition
   ======================================== */

// ==================== FIREBASE INIT ====================
const firebaseConfig = {
    apiKey: "AIzaSyCzK8lqbESqWOGqcrg3PwHzc_z7TPyfhP4",
    authDomain: "baucua-game.firebaseapp.com",
    projectId: "baucua-game",
    storageBucket: "baucua-game.firebasestorage.app",
    messagingSenderId: "171172610418",
    appId: "1:171172610418:web:7ede251509fb1082bb1deb",
    measurementId: "G-HQSFWGFQS3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== CONSTANTS ====================
const SYMBOLS = {
    bau: { name: 'Bầu', emoji: '🍐' },
    cua: { name: 'Cua', emoji: '🦀' },
    tom: { name: 'Tôm', emoji: '🦐' },
    ca:  { name: 'Cá', emoji: '🐟' },
    ga:  { name: 'Gà', emoji: '🐓' },
    nai: { name: 'Nai', emoji: '🦌' }
};
const SYMBOL_KEYS = Object.keys(SYMBOLS);
const DEFAULT_BALANCE = 1000000;

// ==================== GAME STATE ====================
let currentUser = null; // Firebase user
let userProfile = null; // { displayName, ... }
let soundEnabled = true;
let isSaving = false;

let currentGameTab = 'baucua';

let gameState = {
    balance: DEFAULT_BALANCE,
    bets: { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 },
    currentChip: 10000,
    isRolling: false,
    roundNumber: 0,
    history: [],
    gameResults: [],
    stats: {
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalBetAmount: 0,
        totalWinAmount: 0,
        totalLostAmount: 0,
        biggestWin: 0,
        biggestLoss: 0,
        currentStreak: 0,
        bestStreak: 0,
    },
    // Tài Xỉu state
    txBets: { tai: 0, xiu: 0 },
    txCurrentChip: 10000,
    txIsRolling: false,
    txRoundNumber: 0,
    txGameResults: [],
};

function createFreshGameState() {
    return {
        balance: DEFAULT_BALANCE,
        bets: { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 },
        currentChip: 10000,
        isRolling: false,
        roundNumber: 0,
        history: [],
        gameResults: [],
        stats: {
            totalGames: 0, totalWins: 0, totalLosses: 0, totalDraws: 0,
            totalBetAmount: 0, totalWinAmount: 0, totalLostAmount: 0,
            biggestWin: 0, biggestLoss: 0, currentStreak: 0, bestStreak: 0,
        },
        txBets: { tai: 0, xiu: 0 },
        txCurrentChip: 10000,
        txIsRolling: false,
        txRoundNumber: 0,
        txGameResults: [],
    };
}

// ==================== AUTH FUNCTIONS (FIREBASE) ====================
function switchAuthForm(type) {
    if (type === 'register') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    } else {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showToast('Vui lòng nhập đầy đủ thông tin!', 'error');
        return;
    }

    const email = username + '@baucua.game';
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    loginBtn.textContent = 'Đang đăng nhập...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        let msg = 'Đăng nhập thất bại!';
        if (error.code === 'auth/user-not-found') msg = 'Tài khoản không tồn tại!';
        else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Tên đăng nhập hoặc mật khẩu không đúng!';
        showToast(msg, 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        loginBtn.textContent = 'Đăng Nhập';
    }
}

async function handleRegister() {
    const displayName = document.getElementById('regDisplayName').value.trim();
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    if (!displayName || !username || !password) {
        showToast('Vui lòng nhập đầy đủ thông tin!', 'error');
        return;
    }

    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
        showToast('Tên đăng nhập: tối thiểu 3 ký tự, chỉ chữ thường, số, dấu gạch dưới!', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('Mật khẩu xác nhận không khớp!', 'error');
        return;
    }

    const email = username + '@baucua.game';
    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.classList.add('loading');
    registerBtn.textContent = 'Đang tạo tài khoản...';

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Save display name to Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            displayName: displayName,
            username: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save initial game state
        const freshState = createFreshGameState();
        await db.collection('gameData').doc(userCredential.user.uid).set({
            balance: freshState.balance,
            roundNumber: freshState.roundNumber,
            history: [],
            gameResults: [],
            stats: freshState.stats,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`Đăng ký thành công! Chào mừng ${displayName}! 🎉`, 'success');
        // Auth state listener will handle the rest
    } catch (error) {
        let msg = 'Đăng ký thất bại!';
        if (error.code === 'auth/email-already-in-use') msg = 'Email đã được sử dụng!';
        else if (error.code === 'auth/weak-password') msg = 'Mật khẩu quá yếu (tối thiểu 6 ký tự)!';
        else if (error.code === 'auth/invalid-email') msg = 'Email không hợp lệ!';
        showToast(msg, 'error');
    } finally {
        registerBtn.disabled = false;
        registerBtn.classList.remove('loading');
        registerBtn.textContent = 'Tạo Tài Khoản';
    }
}

async function handleLogout() {
    closeUserDropdown();
    try {
        await saveUserState(); // Save before logout
        await auth.signOut();
        showToast('Đã đăng xuất thành công!', 'info');
    } catch (error) {
        showToast('Lỗi khi đăng xuất!', 'error');
    }
}

// ==================== FIREBASE AUTH STATE LISTENER ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile();
        await loadUserState();
        showGameScreen();
        const name = userProfile?.displayName || user.email.split('@')[0];
        showToast(`Chào mừng ${name}! 🎲`, 'success');
    } else {
        currentUser = null;
        userProfile = null;
        gameState = createFreshGameState();
        document.getElementById('authScreen').style.display = '';
        document.getElementById('gameScreen').style.display = 'none';
    }
});

async function loadUserProfile() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
        } else {
            userProfile = { displayName: currentUser.email.split('@')[0] };
        }
    } catch (err) {
        console.error('Error loading profile:', err);
        userProfile = { displayName: currentUser.email.split('@')[0] };
    }
}

async function loadUserState() {
    try {
        const doc = await db.collection('gameData').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            gameState.balance = data.balance ?? DEFAULT_BALANCE;
            gameState.history = data.history || [];
            gameState.gameResults = data.gameResults || [];
            gameState.roundNumber = data.roundNumber || 0;
            gameState.stats = data.stats || createFreshGameState().stats;
            // Tài Xỉu data
            gameState.txGameResults = data.txGameResults || [];
            gameState.txRoundNumber = data.txRoundNumber || 0;
        } else {
            gameState = createFreshGameState();
        }
    } catch (err) {
        console.error('Error loading game state:', err);
        gameState = createFreshGameState();
    }
    // Reset bets on login
    gameState.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
    gameState.isRolling = false;
    gameState.txBets = { tai: 0, xiu: 0 };
    gameState.txIsRolling = false;
}

async function saveUserState() {
    if (!currentUser || isSaving) return;
    isSaving = true;
    try {
        await db.collection('gameData').doc(currentUser.uid).set({
            balance: gameState.balance,
            roundNumber: gameState.roundNumber,
            history: gameState.history.slice(-200),
            gameResults: gameState.gameResults.slice(-100),
            stats: gameState.stats,
            txRoundNumber: gameState.txRoundNumber,
            txGameResults: gameState.txGameResults.slice(-100),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.error('Error saving game state:', err);
    } finally {
        isSaving = false;
    }
}

// Debounced save - avoid too many writes
let saveTimeout = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveUserState(), 1500);
}

// ==================== GAME SCREEN ====================
function showGameScreen() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';

    const displayName = userProfile?.displayName || currentUser.email.split('@')[0];
    const username = userProfile?.username || currentUser.email.split('@')[0];
    document.getElementById('userName').textContent = displayName;
    document.getElementById('dropdownUsername').textContent = '@' + username;
    updateBalanceDisplay();
    updateRecentResults();
    updateTxRecentResults();
}

// ==================== GAME TAB SWITCHING ====================
function switchGameTab(tab) {
    currentGameTab = tab;
    const baucuaPanel = document.getElementById('baucuaPanel');
    const taixiuPanel = document.getElementById('taixiuPanel');
    const tabBauCua = document.getElementById('tabBauCua');
    const tabTaiXiu = document.getElementById('tabTaiXiu');

    if (tab === 'baucua') {
        baucuaPanel.style.display = 'block';
        baucuaPanel.classList.add('active');
        taixiuPanel.style.display = 'none';
        taixiuPanel.classList.remove('active');
        tabBauCua.classList.add('active');
        tabTaiXiu.classList.remove('active');
    } else {
        baucuaPanel.style.display = 'none';
        baucuaPanel.classList.remove('active');
        taixiuPanel.style.display = 'block';
        taixiuPanel.classList.add('active');
        tabBauCua.classList.remove('active');
        tabTaiXiu.classList.add('active');
    }
}

// ==================== USER MENU ====================
function toggleUserDropdown() {
    document.getElementById('userDropdown').classList.toggle('active');
}

function closeUserDropdown() {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('active');
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundIcon').textContent = soundEnabled ? '🔊' : '🔇';
    showToast(soundEnabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh', 'info');
    closeUserDropdown();
}

async function updateDisplayName() {
    const newName = document.getElementById('newDisplayName').value.trim();
    if (!newName) {
        showToast('Vui lòng nhập tên hiển thị mới!', 'error');
        return;
    }

    try {
        await db.collection('users').doc(currentUser.uid).update({
            displayName: newName
        });
        userProfile.displayName = newName;
        document.getElementById('userName').textContent = newName;
        document.getElementById('profileDisplayName').textContent = newName;
        document.getElementById('newDisplayName').value = '';
        showToast('Đã cập nhật tên hiển thị!', 'success');
    } catch (err) {
        showToast('Lỗi khi cập nhật!', 'error');
    }
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;

    if (!current || !newPwd) {
        showToast('Vui lòng nhập đầy đủ thông tin!', 'error');
        return;
    }

    if (newPwd.length < 6) {
        showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'error');
        return;
    }

    try {
        // Re-authenticate first
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            current
        );
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPwd);

        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        showToast('Đổi mật khẩu thành công!', 'success');
    } catch (err) {
        if (err.code === 'auth/wrong-password') {
            showToast('Mật khẩu hiện tại không đúng!', 'error');
        } else {
            showToast('Lỗi đổi mật khẩu: ' + err.message, 'error');
        }
    }
}

// ==================== UI UPDATES ====================
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

function updateBalanceDisplay() {
    const el = document.getElementById('balanceAmount');
    if (!el) return;
    el.textContent = formatMoney(gameState.balance);

    el.style.transform = 'scale(1.2)';
    el.style.transition = 'transform 0.3s ease';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 300);
}

function updateBetDisplay(symbol) {
    const betEl = document.getElementById(`bet-${symbol}`);
    if (!betEl) return;
    const amount = gameState.bets[symbol];
    const amountEl = betEl.querySelector('.bet-amount');
    const cell = betEl.closest('.board-cell');

    if (amount > 0) {
        amountEl.textContent = formatMoney(amount);
        betEl.classList.add('visible');
        cell.classList.add('has-bet');
    } else {
        betEl.classList.remove('visible');
        cell.classList.remove('has-bet');
    }
}

function updateTotalBet() {
    const total = Object.values(gameState.bets).reduce((sum, val) => sum + val, 0);
    const el = document.getElementById('totalBet');
    if (el) el.textContent = formatMoney(total);
}

// ==================== BETTING ====================
function selectChip(chipEl) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
    chipEl.classList.add('chip-active');
    gameState.currentChip = parseInt(chipEl.dataset.value);
}

function placeBet(symbol) {
    if (gameState.isRolling) return;
    const chipValue = gameState.currentChip;
    const totalBets = Object.values(gameState.bets).reduce((sum, val) => sum + val, 0);

    if (totalBets + chipValue > gameState.balance) {
        showToast('Số dư không đủ để đặt cược!', 'error');
        return;
    }

    gameState.bets[symbol] += chipValue;
    updateBetDisplay(symbol);
    updateTotalBet();

    const cell = document.querySelector(`[data-symbol="${symbol}"]`);
    cell.style.transform = 'scale(0.95)';
    setTimeout(() => { cell.style.transform = ''; }, 150);
}

function removeBet(symbol) {
    if (gameState.isRolling) return;
    if (gameState.bets[symbol] <= 0) return;
    gameState.bets[symbol] = Math.max(0, gameState.bets[symbol] - gameState.currentChip);
    updateBetDisplay(symbol);
    updateTotalBet();
}

function clearBets() {
    if (gameState.isRolling) return;
    const hasBets = Object.values(gameState.bets).some(v => v > 0);
    if (!hasBets) return;

    Object.keys(gameState.bets).forEach(symbol => {
        gameState.bets[symbol] = 0;
        updateBetDisplay(symbol);
    });
    updateTotalBet();
    showToast('Đã xoá tất cả cược', 'info');
}

// ==================== DICE ROLLING ====================
function rollDice() {
    const totalBets = Object.values(gameState.bets).reduce((sum, val) => sum + val, 0);
    if (totalBets === 0) {
        showToast('Vui lòng đặt cược trước khi lắc!', 'warning');
        return;
    }
    if (gameState.isRolling) return;

    gameState.isRolling = true;
    gameState.roundNumber++;

    document.getElementById('rollBtn').disabled = true;

    gameState.balance -= totalBets;
    updateBalanceDisplay();

    document.querySelectorAll('.board-cell').forEach(c => c.classList.remove('cell-winner'));
    document.querySelectorAll('.dice').forEach(d => d.classList.remove('winner'));
    document.getElementById('resultMessage').textContent = '';
    document.getElementById('resultMessage').className = 'result-message';

    const dice = [
        document.getElementById('dice1'),
        document.getElementById('dice2'),
        document.getElementById('dice3')
    ];

    dice.forEach(d => d.classList.add('rolling'));

    // Auto-scroll to dice results
    const diceSection = document.getElementById('diceSection');
    if (diceSection) {
        setTimeout(() => {
            diceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }

    const results = [
        SYMBOL_KEYS[Math.floor(Math.random() * 6)],
        SYMBOL_KEYS[Math.floor(Math.random() * 6)],
        SYMBOL_KEYS[Math.floor(Math.random() * 6)]
    ];

    // Deceleration roll - starts fast, slows down
    const totalDuration = 2800; // total rolling time ms
    const startInterval = 60;
    const endInterval = 280;
    let elapsed = 0;

    function rollCycle() {
        // Calculate current interval based on progress (ease-out deceleration)
        const progress = elapsed / totalDuration;
        const currentInterval = startInterval + (endInterval - startInterval) * Math.pow(progress, 1.5);

        dice.forEach(d => {
            const rs = SYMBOL_KEYS[Math.floor(Math.random() * 6)];
            d.querySelector('.dice-face').textContent = SYMBOLS[rs].emoji;
        });

        // Add slowing class when nearing end
        if (progress > 0.6) {
            dice.forEach(d => d.classList.add('slowing'));
        }

        elapsed += currentInterval;

        if (elapsed < totalDuration) {
            setTimeout(rollCycle, currentInterval);
        } else {
            // Stop - reveal dice one by one with landing effect
            dice.forEach(d => {
                d.classList.remove('rolling', 'slowing');
            });
            revealDice(dice, results, 0, totalBets);
        }
    }
    rollCycle();
}

function revealDice(diceEls, results, index, totalBets) {
    if (index >= 3) {
        setTimeout(() => calculateResults(results, totalBets), 500);
        return;
    }
    const delay = index === 0 ? 200 : 500;
    setTimeout(() => {
        diceEls[index].classList.add('landing');
        diceEls[index].querySelector('.dice-face').textContent = SYMBOLS[results[index]].emoji;
        const cell = document.querySelector(`[data-symbol="${results[index]}"]`);
        if (gameState.bets[results[index]] > 0) {
            cell.classList.add('cell-winner');
        }
        // After landing animation, switch to winner if applicable
        setTimeout(() => {
            diceEls[index].classList.remove('landing');
            if (gameState.bets[results[index]] > 0) {
                diceEls[index].classList.add('winner');
            }
        }, 500);
        revealDice(diceEls, results, index + 1, totalBets);
    }, delay);
}

function calculateResults(results, totalBets) {
    const counts = {};
    results.forEach(r => { counts[r] = (counts[r] || 0) + 1; });

    let totalWinnings = 0;
    Object.keys(gameState.bets).forEach(symbol => {
        if (gameState.bets[symbol] > 0 && counts[symbol]) {
            totalWinnings += gameState.bets[symbol] * (counts[symbol] + 1);
        }
    });

    const netProfit = totalWinnings - totalBets;
    const resultMsg = document.getElementById('resultMessage');

    gameState.stats.totalGames++;
    gameState.stats.totalBetAmount += totalBets;

    if (netProfit > 0) {
        gameState.balance += totalWinnings;
        resultMsg.textContent = `🎉 Thắng lớn! Nhận về ${formatMoney(totalWinnings)} VNĐ (Lãi: +${formatMoney(netProfit)} VNĐ)`;
        resultMsg.className = 'result-message win';
        showToast(`🎉 Bạn thắng +${formatMoney(netProfit)} VNĐ!`, 'success');
        createConfetti();
        gameState.stats.totalWins++;
        gameState.stats.totalWinAmount += netProfit;
        if (netProfit > gameState.stats.biggestWin) gameState.stats.biggestWin = netProfit;
        gameState.stats.currentStreak = Math.max(1, gameState.stats.currentStreak + 1);
        if (gameState.stats.currentStreak > gameState.stats.bestStreak) gameState.stats.bestStreak = gameState.stats.currentStreak;
    } else if (netProfit === 0 && totalWinnings > 0) {
        gameState.balance += totalWinnings;
        resultMsg.textContent = `😐 Hoà vốn! Nhận lại ${formatMoney(totalWinnings)} VNĐ`;
        resultMsg.className = 'result-message win';
        showToast(`Hoà vốn - nhận lại ${formatMoney(totalWinnings)} VNĐ`, 'info');
        gameState.stats.totalDraws++;
        gameState.stats.currentStreak = 0;
    } else if (totalWinnings > 0) {
        gameState.balance += totalWinnings;
        resultMsg.textContent = `😅 Lỗ nhẹ! Nhận về ${formatMoney(totalWinnings)} VNĐ (Lỗ: ${formatMoney(Math.abs(netProfit))} VNĐ)`;
        resultMsg.className = 'result-message lose';
        showToast(`Lỗ ${formatMoney(Math.abs(netProfit))} VNĐ`, 'warning');
        gameState.stats.totalLosses++;
        gameState.stats.totalLostAmount += Math.abs(netProfit);
        if (Math.abs(netProfit) > gameState.stats.biggestLoss) gameState.stats.biggestLoss = Math.abs(netProfit);
        gameState.stats.currentStreak = Math.min(-1, gameState.stats.currentStreak - 1);
    } else {
        resultMsg.textContent = `😢 Thua ${formatMoney(totalBets)} VNĐ... Chúc may mắn lần sau!`;
        resultMsg.className = 'result-message lose';
        showToast(`Thua ${formatMoney(totalBets)} VNĐ`, 'error');
        gameState.stats.totalLosses++;
        gameState.stats.totalLostAmount += totalBets;
        if (totalBets > gameState.stats.biggestLoss) gameState.stats.biggestLoss = totalBets;
        gameState.stats.currentStreak = Math.min(-1, gameState.stats.currentStreak - 1);
    }

    updateBalanceDisplay();

    gameState.gameResults.unshift({
        round: gameState.roundNumber,
        dice: results.map(r => SYMBOLS[r].emoji),
        totalBets, totalWinnings, netProfit,
        timestamp: new Date().toISOString()
    });

    if (netProfit > 0) {
        addTransaction('game-win', netProfit, `Ván #${gameState.roundNumber} - Thắng`);
    } else if (netProfit === 0 && totalWinnings > 0) {
        addTransaction('game-win', 0, `Ván #${gameState.roundNumber} - Hoà`);
    } else {
        addTransaction('game-lose', Math.abs(netProfit), `Ván #${gameState.roundNumber} - Thua`);
    }

    updateRecentResults();

    Object.keys(gameState.bets).forEach(symbol => {
        gameState.bets[symbol] = 0;
        updateBetDisplay(symbol);
    });
    updateTotalBet();

    gameState.isRolling = false;
    document.getElementById('rollBtn').disabled = false;

    // Save to Firebase (debounced)
    debouncedSave();
}

// ==================== RECENT RESULTS ====================
function updateRecentResults() {
    const container = document.getElementById('recentResults');
    if (!container) return;

    if (gameState.gameResults.length === 0) {
        container.innerHTML = '<div class="no-results">Chưa có ván chơi nào</div>';
        return;
    }

    container.innerHTML = gameState.gameResults.slice(0, 20).map(result => {
        let outcomeClass, prefix;
        if (result.netProfit > 0) { outcomeClass = 'win'; prefix = '+'; }
        else if (result.netProfit === 0 && result.totalWinnings > 0) { outcomeClass = 'win'; prefix = '±'; }
        else { outcomeClass = 'lose'; prefix = '-'; }
        return `
        <div class="result-row">
            <span class="result-round">Ván #${result.round}</span>
            <span class="result-dice">${result.dice.join(' ')}</span>
            <span class="result-outcome ${outcomeClass}">
                ${prefix}${formatMoney(Math.abs(result.netProfit))} VNĐ
            </span>
        </div>`;
    }).join('');
}

// ==================== MODALS ====================
function openModal(type) {
    const overlay = document.getElementById('modalOverlay');
    document.querySelectorAll('.modal-content').forEach(m => m.style.display = 'none');
    document.getElementById(`${type}Modal`).style.display = 'block';

    if (type === 'withdraw') {
        document.getElementById('modalBalance').textContent = formatMoney(gameState.balance);
    }
    if (type === 'history') renderHistory('all');
    if (type === 'stats') renderStats();
    if (type === 'profile') {
        const dn = userProfile?.displayName || currentUser.email.split('@')[0];
        const un = userProfile?.username || currentUser.email.split('@')[0];
        document.getElementById('profileDisplayName').textContent = dn;
        document.getElementById('profileUsername').textContent = '@' + un;
    }

    overlay.classList.add('active');
    closeUserDropdown();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function setAmount(inputId, amount) {
    document.getElementById(inputId).value = amount;
}

async function deposit() {
    const input = document.getElementById('depositAmount');
    const amount = parseInt(input.value);

    if (!amount || amount < 10000) {
        showToast('Số tiền nạp tối thiểu là 10,000 VNĐ', 'error');
        return;
    }
    if (amount > 100000000) {
        showToast('Số tiền nạp tối đa là 100,000,000 VNĐ', 'error');
        return;
    }

    gameState.balance += amount;
    updateBalanceDisplay();
    addTransaction('deposit', amount, 'Nạp tiền vào tài khoản');
    debouncedSave();

    showToast(`Nạp thành công ${formatMoney(amount)} VNĐ!`, 'success');
    input.value = '';
    closeModal();
}

async function withdraw() {
    const input = document.getElementById('withdrawAmount');
    const amount = parseInt(input.value);

    if (!amount || amount < 10000) {
        showToast('Số tiền rút tối thiểu là 10,000 VNĐ', 'error');
        return;
    }
    if (amount > gameState.balance) {
        showToast('Số dư không đủ để rút!', 'error');
        return;
    }

    gameState.balance -= amount;
    updateBalanceDisplay();
    addTransaction('withdraw', amount, 'Rút tiền từ tài khoản');
    debouncedSave();

    showToast(`Rút thành công ${formatMoney(amount)} VNĐ!`, 'success');
    input.value = '';
    closeModal();
}

// ==================== TRANSACTION HISTORY ====================
function addTransaction(type, amount, description) {
    gameState.history.unshift({
        type, amount, description,
        timestamp: new Date().toISOString(),
        balanceAfter: gameState.balance
    });
}

function renderHistory(filter) {
    const list = document.getElementById('historyList');
    let filtered = gameState.history;

    if (filter === 'deposit') filtered = filtered.filter(h => h.type === 'deposit');
    else if (filter === 'withdraw') filtered = filtered.filter(h => h.type === 'withdraw');
    else if (filter === 'game') filtered = filtered.filter(h => h.type === 'game-win' || h.type === 'game-lose');

    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-history">Chưa có giao dịch nào</div>';
        return;
    }

    const typeLabels = { 'deposit': 'Nạp tiền', 'withdraw': 'Rút tiền', 'game-win': 'Thắng cược', 'game-lose': 'Thua cược' };

    list.innerHTML = filtered.slice(0, 50).map(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const isPositive = item.type === 'deposit' || item.type === 'game-win';
        return `
            <div class="history-item">
                <div class="history-item-left">
                    <span class="history-item-type ${item.type}">${typeLabels[item.type]}</span>
                    <span class="history-item-time">${timeStr}</span>
                </div>
                <span class="history-item-amount ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : '-'}${formatMoney(item.amount)} VNĐ
                </span>
            </div>`;
    }).join('');
}

function filterHistory(filter, btnEl) {
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');
    renderHistory(filter);
}

// ==================== STATS ====================
function renderStats() {
    const s = gameState.stats;
    const winRate = s.totalGames > 0 ? Math.round((s.totalWins / s.totalGames) * 100) : 0;
    const netPL = s.totalWinAmount - s.totalLostAmount;

    document.getElementById('statsGrid').innerHTML = `
        <div class="stats-card">
            <div class="stats-icon">🎮</div>
            <div class="stats-value blue">${s.totalGames}</div>
            <div class="stats-label">Tổng ván chơi</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">🏆</div>
            <div class="stats-value positive">${s.totalWins}</div>
            <div class="stats-label">Số ván thắng</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">💔</div>
            <div class="stats-value negative">${s.totalLosses}</div>
            <div class="stats-label">Số ván thua</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">📊</div>
            <div class="stats-value gold">${winRate}%</div>
            <div class="stats-label">Tỷ lệ thắng</div>
            <div class="stats-bar">
                <div class="stats-bar-fill" style="width: ${winRate}%; background: linear-gradient(90deg, var(--accent-green), #34d399);"></div>
            </div>
        </div>
        <div class="stats-card full-width">
            <div class="stats-icon">${netPL >= 0 ? '📈' : '📉'}</div>
            <div class="stats-value ${netPL >= 0 ? 'positive' : 'negative'}">
                ${netPL >= 0 ? '+' : ''}${formatMoney(netPL)} VNĐ
            </div>
            <div class="stats-label">Lãi/Lỗ ròng</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">🎯</div>
            <div class="stats-value positive">+${formatMoney(s.biggestWin)}</div>
            <div class="stats-label">Thắng lớn nhất</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">💸</div>
            <div class="stats-value negative">-${formatMoney(s.biggestLoss)}</div>
            <div class="stats-label">Thua lớn nhất</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">🔥</div>
            <div class="stats-value purple">${s.bestStreak}</div>
            <div class="stats-label">Chuỗi thắng cao nhất</div>
        </div>
        <div class="stats-card">
            <div class="stats-icon">💰</div>
            <div class="stats-value gold">${formatMoney(s.totalBetAmount)}</div>
            <div class="stats-label">Tổng tiền đã cược</div>
        </div>`;
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.onclick = () => removeToast(toast);
    container.appendChild(toast);
    setTimeout(() => removeToast(toast), 3500);
}

function removeToast(toast) {
    if (!toast.parentElement) return;
    toast.classList.add('toast-out');
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
}

// ==================== CONFETTI ====================
function createConfetti() {
    const colors = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.style.cssText = `
                position: fixed; width: ${Math.random()*10+5}px; height: ${Math.random()*10+5}px;
                background: ${colors[Math.floor(Math.random()*colors.length)]};
                left: ${Math.random()*100}vw; top: -20px;
                border-radius: ${Math.random()>0.5?'50%':'2px'};
                pointer-events: none; z-index: 9999;
                animation: confetti-fall ${Math.random()*2+2}s linear forwards;
            `;
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4000);
        }, i * 50);
    }
}

const confettiStyle = document.createElement('style');
confettiStyle.textContent = `@keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`;
document.head.appendChild(confettiStyle);

// ==================== PARTICLES ====================
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const emojis = ['🎲', '🍐', '🦀', '🦐', '🐟', '🐓', '🦌', '✨', '💰'];
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.cssText = `left:${Math.random()*100}%;font-size:${Math.random()*16+12}px;animation-duration:${Math.random()*15+15}s;animation-delay:${Math.random()*10}s;opacity:0.15;`;
        container.appendChild(p);
    }
}

// ==================== TÀI XỈU GAME ====================
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function selectTxChip(chipEl) {
    document.querySelectorAll('.tx-chip').forEach(c => c.classList.remove('chip-active'));
    chipEl.classList.add('chip-active');
    gameState.txCurrentChip = parseInt(chipEl.dataset.value);
}

function placeTxBet(side) {
    if (gameState.txIsRolling) return;
    const chipValue = gameState.txCurrentChip;
    const totalBets = gameState.txBets.tai + gameState.txBets.xiu;

    if (totalBets + chipValue > gameState.balance) {
        showToast('Số dư không đủ để đặt cược!', 'error');
        return;
    }

    gameState.txBets[side] += chipValue;
    updateTxBetDisplay(side);
    updateTxTotalBet();

    const zone = document.getElementById(side === 'tai' ? 'txTaiZone' : 'txXiuZone');
    zone.style.transform = 'scale(0.97)';
    setTimeout(() => { zone.style.transform = ''; }, 150);
}

function removeTxBet(side) {
    if (gameState.txIsRolling) return;
    if (gameState.txBets[side] <= 0) return;
    gameState.txBets[side] = Math.max(0, gameState.txBets[side] - gameState.txCurrentChip);
    updateTxBetDisplay(side);
    updateTxTotalBet();
}

function clearTxBets() {
    if (gameState.txIsRolling) return;
    const hasBets = gameState.txBets.tai > 0 || gameState.txBets.xiu > 0;
    if (!hasBets) return;

    gameState.txBets.tai = 0;
    gameState.txBets.xiu = 0;
    updateTxBetDisplay('tai');
    updateTxBetDisplay('xiu');
    updateTxTotalBet();
    showToast('Đã xoá tất cả cược Tài Xỉu', 'info');
}

function updateTxBetDisplay(side) {
    const zone = document.getElementById(side === 'tai' ? 'txTaiZone' : 'txXiuZone');
    const display = document.getElementById(side === 'tai' ? 'txTaiBet' : 'txXiuBet');
    const amount = gameState.txBets[side];

    if (amount > 0) {
        display.querySelector('.tx-bet-value').textContent = formatMoney(amount);
        display.classList.add('visible');
        zone.classList.add('has-bet');
    } else {
        display.classList.remove('visible');
        zone.classList.remove('has-bet');
    }
}

function updateTxTotalBet() {
    const total = gameState.txBets.tai + gameState.txBets.xiu;
    const el = document.getElementById('txTotalBet');
    if (el) el.textContent = formatMoney(total);
}

function rollTxDice() {
    const totalBets = gameState.txBets.tai + gameState.txBets.xiu;
    if (totalBets === 0) {
        showToast('Vui lòng đặt cược Tài hoặc Xỉu!', 'warning');
        return;
    }
    if (gameState.txIsRolling) return;

    gameState.txIsRolling = true;
    gameState.txRoundNumber++;

    document.getElementById('txRollBtn').disabled = true;

    gameState.balance -= totalBets;
    updateBalanceDisplay();

    // Reset previous results
    document.getElementById('txTaiZone').classList.remove('tx-winner');
    document.getElementById('txXiuZone').classList.remove('tx-winner');
    document.getElementById('txResultMessage').textContent = '';
    document.getElementById('txResultMessage').className = 'result-message';
    document.getElementById('txTotalValue').textContent = '?';
    document.getElementById('txTotalValue').className = 'tx-total-value';

    const dice = [
        document.getElementById('txDice1'),
        document.getElementById('txDice2'),
        document.getElementById('txDice3')
    ];
    const plate = document.getElementById('txPlate');

    // Auto-scroll to dice
    const diceSection = document.getElementById('txDiceSection');
    if (diceSection) {
        setTimeout(() => {
            diceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    // Generate random results (1-6)
    const results = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];

    // ===== PHASE 1: Drop plate to cover dice =====
    dice.forEach(d => {
        d.classList.remove('revealing', 'winner-glow');
        d.classList.add('hidden');
    });
    plate.className = 'tx-plate dropping';

    // ===== PHASE 2: Intense shaking (after plate drops) =====
    setTimeout(() => {
        plate.className = 'tx-plate shaking';
    }, 400);

    // ===== PHASE 3: Slowing down =====
    setTimeout(() => {
        plate.className = 'tx-plate slowing';
    }, 2200);

    // ===== PHASE 4: Lift plate to reveal =====
    setTimeout(() => {
        plate.className = 'tx-plate lifting';

        // Set final dice values
        dice.forEach((d, i) => {
            renderPipFace(d, results[i]);
        });

        // ===== PHASE 5: Pop dice into view =====
        setTimeout(() => {
            dice.forEach(d => {
                d.classList.remove('hidden');
                d.classList.add('revealing');
            });
        }, 300);

        // ===== PHASE 6: Calculate results =====
        setTimeout(() => {
            plate.className = 'tx-plate';
            dice.forEach(d => d.classList.remove('revealing'));
            calculateTxResults(results, totalBets);
        }, 1200);
    }, 2800);
}

function renderPipFace(diceEl, value) {
    const face = diceEl.querySelector('.pip-face');
    face.setAttribute('data-value', value);
    let pips = '';
    for (let i = 0; i < value; i++) {
        pips += '<div class="pip"></div>';
    }
    face.innerHTML = pips;
}

function calculateTxResults(results, totalBets) {
    const total = results[0] + results[1] + results[2];
    const isTai = total >= 11;
    const resultSide = isTai ? 'tai' : 'xiu';

    // Display total
    const totalValueEl = document.getElementById('txTotalValue');
    totalValueEl.textContent = total;
    totalValueEl.className = 'tx-total-value ' + resultSide;

    // Highlight winning zone
    const winZone = document.getElementById(isTai ? 'txTaiZone' : 'txXiuZone');
    winZone.classList.add('tx-winner');

    const resultMsg = document.getElementById('txResultMessage');
    const betOnWinner = gameState.txBets[resultSide];
    const betOnLoser = gameState.txBets[resultSide === 'tai' ? 'xiu' : 'tai'];

    let totalWinnings = 0;
    let netProfit = 0;

    gameState.stats.totalGames++;
    gameState.stats.totalBetAmount += totalBets;

    if (betOnWinner > 0) {
        totalWinnings = betOnWinner * 2; // 1:1 payout
        gameState.balance += totalWinnings;
        netProfit = totalWinnings - totalBets;
    }

    const sideLabel = isTai ? 'TÀI' : 'XỈU';

    if (netProfit > 0) {
        resultMsg.textContent = `🎉 ${sideLabel} (${total} điểm)! Thắng +${formatMoney(netProfit)} VNĐ!`;
        resultMsg.className = 'result-message win';
        showToast(`🎉 ${sideLabel}! Thắng +${formatMoney(netProfit)} VNĐ!`, 'success');
        createConfetti();
        gameState.stats.totalWins++;
        gameState.stats.totalWinAmount += netProfit;
        if (netProfit > gameState.stats.biggestWin) gameState.stats.biggestWin = netProfit;
        gameState.stats.currentStreak = Math.max(1, gameState.stats.currentStreak + 1);
        if (gameState.stats.currentStreak > gameState.stats.bestStreak) gameState.stats.bestStreak = gameState.stats.currentStreak;
    } else if (netProfit === 0 && totalWinnings > 0) {
        gameState.balance += totalWinnings;
        resultMsg.textContent = `😐 ${sideLabel} (${total} điểm)! Hoà vốn!`;
        resultMsg.className = 'result-message win';
        showToast(`Hoà vốn - ${sideLabel}`, 'info');
        gameState.stats.totalDraws++;
        gameState.stats.currentStreak = 0;
    } else {
        const loss = totalBets;
        resultMsg.textContent = `😢 ${sideLabel} (${total} điểm)! Thua ${formatMoney(loss)} VNĐ`;
        resultMsg.className = 'result-message lose';
        showToast(`Thua ${formatMoney(loss)} VNĐ - Kết quả: ${sideLabel}`, 'error');
        gameState.stats.totalLosses++;
        gameState.stats.totalLostAmount += loss;
        if (loss > gameState.stats.biggestLoss) gameState.stats.biggestLoss = loss;
        gameState.stats.currentStreak = Math.min(-1, gameState.stats.currentStreak - 1);
    }

    updateBalanceDisplay();

    // Save game result
    gameState.txGameResults.unshift({
        round: gameState.txRoundNumber,
        dice: results,
        total: total,
        side: resultSide,
        totalBets, totalWinnings, netProfit,
        betTai: gameState.txBets.tai,
        betXiu: gameState.txBets.xiu,
        timestamp: new Date().toISOString()
    });

    // Add transaction
    if (netProfit > 0) {
        addTransaction('game-win', netProfit, `TX Ván #${gameState.txRoundNumber} - Thắng (${sideLabel} ${total})`);
    } else if (netProfit === 0 && totalWinnings > 0) {
        addTransaction('game-win', 0, `TX Ván #${gameState.txRoundNumber} - Hoà (${sideLabel} ${total})`);
    } else {
        addTransaction('game-lose', totalBets, `TX Ván #${gameState.txRoundNumber} - Thua (${sideLabel} ${total})`);
    }

    updateTxRecentResults();

    // Reset bets
    gameState.txBets.tai = 0;
    gameState.txBets.xiu = 0;
    updateTxBetDisplay('tai');
    updateTxBetDisplay('xiu');
    updateTxTotalBet();

    gameState.txIsRolling = false;
    document.getElementById('txRollBtn').disabled = false;

    debouncedSave();
}

function updateTxRecentResults() {
    // History bar (dots)
    const bar = document.getElementById('txHistoryBar');
    if (bar) {
        if (gameState.txGameResults.length === 0) {
            bar.innerHTML = '';
        } else {
            bar.innerHTML = gameState.txGameResults.slice(0, 30).map(r =>
                `<div class="tx-history-dot ${r.side}" title="Ván #${r.round}: ${r.total} (${r.side === 'tai' ? 'Tài' : 'Xỉu'})">${r.total}</div>`
            ).join('');
        }
    }

    // Results list
    const container = document.getElementById('txRecentResults');
    if (!container) return;

    if (gameState.txGameResults.length === 0) {
        container.innerHTML = '<div class="no-results">Chưa có ván chơi nào</div>';
        return;
    }

    container.innerHTML = gameState.txGameResults.slice(0, 20).map(result => {
        const sideLabel = result.side === 'tai' ? 'TÀI' : 'XỈU';
        let outcomeClass, prefix;
        if (result.netProfit > 0) { outcomeClass = 'win'; prefix = '+'; }
        else if (result.netProfit === 0 && result.totalWinnings > 0) { outcomeClass = 'win'; prefix = '±'; }
        else { outcomeClass = 'lose'; prefix = '-'; }
        return `
        <div class="result-row">
            <span class="result-round">Ván #${result.round}</span>
            <span class="result-dice">${result.dice.map(d => DICE_FACES[d-1]).join(' ')}</span>
            <span class="tx-result-side ${result.side}">${sideLabel} ${result.total}</span>
            <span class="result-outcome ${outcomeClass}">
                ${prefix}${formatMoney(Math.abs(result.netProfit))} VNĐ
            </span>
        </div>`;
    }).join('');
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    if (userMenu && !userMenu.contains(e.target)) closeUserDropdown();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeUserDropdown(); }
    if (e.key === ' ' && !e.target.matches('input') && document.getElementById('gameScreen').style.display !== 'none') {
        e.preventDefault();
        if (currentGameTab === 'baucua') rollDice();
        else rollTxDice();
    }
    if (e.key === 'Enter' && !e.target.matches('button')) {
        const authScreen = document.getElementById('authScreen');
        if (authScreen && authScreen.style.display !== 'none') {
            const loginForm = document.getElementById('loginForm');
            if (loginForm && loginForm.style.display !== 'none') handleLogin();
            else handleRegister();
        }
    }
});

// Save on page close
window.addEventListener('beforeunload', () => {
    if (currentUser) saveUserState();
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    // Firebase auth state listener handles the rest
});
