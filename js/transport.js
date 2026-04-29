// js/transport.js

// ==========================================
// 音效模組 (使用瀏覽器內建 Web Audio API)
// ==========================================
function playSuccessSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime); 
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

function playErrorSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime); 
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ==========================================
// 主程式邏輯
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  if (!transId || !transName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'transport_login.html';
    });
    return;
  }

  document.getElementById('displayUser').textContent = `${transName} (${transId})`;

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('medDate').value = today;

  const barcodeInput = document.getElementById('barcodeInput');
  const cardContainer = document.getElementById('cardContainer');
  const totalCountSpan = document.getElementById('totalCount');
  const emptyState = document.getElementById('emptyState');
  
  // ★ 核心改變：使用 Set 儲存「不重複」的領藥號關鍵字 (領藥號 + 處方日期)
  const scannedItems = new Set();
  
  barcodeInput.focus();

  document.body.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link')) {
       barcodeInput.focus();
    }
  });

  barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcodeValue = barcodeInput.value.trim();
      if (!barcodeValue) return;

      const parts = barcodeValue.split(';');
      if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
        playErrorSound(); 
        Swal.fire({
          icon: 'error',
          title: '條碼格式錯誤',
          text: '請確認是否刷對條碼，領藥號必須為 8 開頭！',
          timer: 2000
        });
        barcodeInput.value = '';
        barcodeInput.focus();
        return;
      }

      const chartNo = parts[0]; 
      const dispenseNo = parts[2]; 
      const rawDateStr = parts[4]; 
      const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
      const rxDate = dateMatch ? dateMatch[1] : '';

      // ★ 判斷是否為重複資料
      const itemKey = `${dispenseNo}-${rxDate}`;
      const isNewItem = !scannedItems.has(itemKey);

      const payload = {
        date: document.getElementById('medDate').value,
        barcode: barcodeValue,
        type: '傳送',
        staffId: transId,
        staffName: transName,
        chartNo: chartNo,
        dispenseNo: dispenseNo,
        rxDate: rxDate
      };

      const cardId = 'card_' + Date.now();
      
      // ★ 只有「第一次刷到」才更新總筆數顯示
      if (isNewItem) {
        scannedItems.add(itemKey);
        addCardToUI(payload, cardId, true); 
        totalCountSpan.textContent = scannedItems.size;
      } else {
        // 如果是重複刷，雖然不增加總數，但還是畫一張提示卡片（或更新狀態）讓人員知道有刷成功
        addCardToUI(payload, cardId, true, true); 
      }
      
      barcodeInput.value = '';
      barcodeInput.focus();

      const result = await callGAS('logDischargeMeds', { payload: payload });
      
      if (result.success) {
        playSuccessSound(); 
        const successCard = document.getElementById(cardId);
        if(successCard) successCard.classList.replace('border-warning', 'border-success');
      } else {
        playErrorSound();
        const errorCard = document.getElementById(cardId);
        if(errorCard){
          errorCard.classList.replace('border-warning', 'border-danger');
          errorCard.querySelector('.card-body').innerHTML += `<div class="text-danger mt-1 fs-6 fw-bold">寫入失敗</div>`;
        }
      }
    }
  });

  // ★ 修改 addCardToUI，增加一個 isDuplicate 參數
  function addCardToUI(data, cardId, isPending, isDuplicate = false) {
    if (emptyState) emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.id = cardId;
    // 重複刷的卡片可以用不同的樣式或標註
    card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0 text-success fw-bold">
            領藥號：${data.dispenseNo} 
            ${isDuplicate ? '<span class="badge bg-warning text-dark fs-6 ms-2">重複刷入</span>' : ''}
          </h3>
          <span class="text-muted fs-4">${timeString}</span>
        </div>
        <div class="mb-2 fs-5 text-secondary">
          病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate}
        </div>
        <div class="fs-5 text-secondary border-top pt-2">
          <span class="badge bg-success me-2 fs-6">${data.type}</span>
          由 <span class="fw-bold text-dark">${data.staffName}</span> 簽收
        </div>
      </div>
    `;

    cardContainer.insertBefore(card, cardContainer.firstChild);
  }
});

function logout() {
  sessionStorage.removeItem('transId');
  sessionStorage.removeItem('transName');
  window.location.href = 'index.html';
}
