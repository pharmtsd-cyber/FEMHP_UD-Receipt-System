// js/pharmacist.js
let docTypeOptionsData = []; // 用來存文件類型
let currentPharmaId = sessionStorage.getItem('pharmaId');
let currentPharmaName = sessionStorage.getItem('pharmaName');
let replyOptionsData = []; 
let allPharmaData = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!currentPharmaId || !currentPharmaName) {
    window.location.href = 'pharmacist_login.html';
    return;
  }
  document.getElementById('displayPharma').textContent = `${currentPharmaName} 藥師`;
  
  // 呼叫 API 取得處置選項
  const optResult = await callGAS('getPharmaReplyOptions');
  if (optResult.success) {
    replyOptionsData = optResult.data.map(opt => opt.Title || opt['送件類型名稱']);
  }

  // ★ 呼叫 API 取得文件類型 (供修改視窗的下拉選單使用)
  const typeResult = await callGAS('getConfigData');
  if (typeResult.success) {
    docTypeOptionsData = typeResult.data.map(opt => opt['送件類型名稱'] || opt.Title);
  }
  
  refreshPharmaDocs();
});

// === 動態生成文件類型下拉選單 ===
function populatePharmaDocTypes() {
  const select = document.getElementById('filterPharmaDocType');
  if (!select) return;
  const currentVal = select.value;
  const uniqueTypes = [...new Set(allPharmaData.map(r => r.DocType))].filter(Boolean);

  let optionsHtml = '<option value="">📁 所有文件類型</option>';
  uniqueTypes.forEach(type => {
    optionsHtml += `<option value="${type}">${type}</option>`;
  });
  select.innerHTML = optionsHtml;
  if (uniqueTypes.includes(currentVal)) select.value = currentVal;
}

// === 藥師端：抓取資料 (改為只負責向伺服器要資料) ===
async function refreshPharmaDocs() {
  const pendingBox = document.getElementById('pendingContainer');
  const completedBox = document.getElementById('completedContainer');

  if(pendingBox) pendingBox.innerHTML = '<div class="text-center py-3">載入中...</div>';
  if(completedBox) completedBox.innerHTML = '<div class="text-center py-3">載入中...</div>';

  const result = await callGAS('getPharmaDocRecords');
  if (!result.success) return;

  allPharmaData = result.data; // ★ 將資料存入全域變數
  populatePharmaDocTypes();    // 更新下拉選單
  renderPharmaDocs();          // 進行過濾與畫面渲染
}

// === 藥師端：升級版清單渲染 (負責過濾與畫卡片) ===
// ★ 加入：切換子頁籤時自動重整資料 (寫在檔案最外層)
document.addEventListener('DOMContentLoaded', () => {
  const pharmaTabs = document.querySelectorAll('button[data-bs-toggle="tab"], button[data-bs-toggle="pill"]');
  pharmaTabs.forEach(tab => {
    tab.addEventListener('shown.bs.tab', (e) => {
      if (['doc-receive-tab', 'pharma-unresolved-tab', 'pharma-resolved-tab'].includes(e.target.id)) {
        refreshPharmaDocs();
      }
    });
  });
});

// 在原本的 refreshPharmaDocs 中，更新容器 ID
async function refreshPharmaDocs() {
  const pendingBox = document.getElementById('pharmaUnresolved'); // ★ 更新 ID
  const completedBox = document.getElementById('pharmaResolved'); // ★ 更新 ID

  if(pendingBox) pendingBox.innerHTML = '<div class="text-center py-3">載入中...</div>';
  if(completedBox) completedBox.innerHTML = '<div class="text-center py-3">載入中...</div>';

  const result = await callGAS('getPharmaDocRecords');
  if (!result.success) return;

  allPharmaData = result.data; 
  populatePharmaDocTypes();    
  renderPharmaDocs();          
}

// 在原本的 renderPharmaDocs 中，更新容器 ID
function renderPharmaDocs() {
  const pendingBox = document.getElementById('pharmaUnresolved'); // ★ 更新 ID
  const completedBox = document.getElementById('pharmaResolved'); // ★ 更新 ID
  const countBadge = document.getElementById('pendingDocCount');
  if (!pendingBox || !completedBox) return;

  // ... (保留您原本的過濾邏輯 filteredData、pendingData、completedData 不變) ...

  if(countBadge) countBadge.textContent = pendingData.length;

  // ... (保留您原本的 renderCard 函數不變) ...

  pendingBox.innerHTML = pendingData.length ? pendingData.map(item => renderCard(item, true)).join('') : '<div class="text-muted text-center py-4">無待處理的單據</div>';
  completedBox.innerHTML = completedData.length ? completedData.map(item => renderCard(item, false)).join('') : '<div class="text-muted text-center py-4">今日無已處理的紀錄</div>';
}

// === 藥師修改單據詳細資料 ===
async function editDocInfo(signId, currentOption, currentNote, currentType, currentWard, currentChartNo, currentQty, currentPickup, currentSender, currentSendNote) {
  const safeNote = (!currentNote || currentNote === 'undefined' || currentNote === 'null') ? '' : currentNote;
  const safeSendNote = (!currentSendNote || currentSendNote === 'undefined' || currentSendNote === 'null') ? '' : currentSendNote;
  const safeWard = (!currentWard || currentWard === 'undefined' || currentWard === 'null') ? '' : currentWard;
  const safeChartNo = (!currentChartNo || currentChartNo === 'undefined' || currentChartNo === 'null') ? '' : currentChartNo;
  const safeQty = (!currentQty || currentQty === 'undefined' || currentQty === 'null') ? '' : currentQty;
  const safePickup = (!currentPickup || currentPickup === 'undefined' || currentPickup === 'null') ? '' : currentPickup;

  const optionsHtml = replyOptionsData.map(opt => `<option value="${opt}" ${opt === currentOption ? 'selected' : ''}>${opt}</option>`).join('');
  const typeHtml = docTypeOptionsData.map(opt => `<option value="${opt}" ${opt === currentType ? 'selected' : ''}>${opt}</option>`).join('');

  const { value: formValues } = await Swal.fire({
    title: '修改單據詳細資料',
    html: `
      <div class="row text-start g-2 mb-3 bg-light p-2 rounded">
        <div class="col-6"><label class="small fw-bold text-muted">文件類型</label><select id="swal-type" class="form-select form-select-sm">${typeHtml}</select></div>
        <div class="col-6"><label class="small fw-bold text-muted">送件人</label><input id="swal-sender" class="form-control form-control-sm" value="${currentSender}" readonly></div>
        <div class="col-6"><label class="small fw-bold text-muted">病房床號(6碼)</label><input id="swal-ward" class="form-control form-control-sm" value="${safeWard}" maxlength="6"></div>
        <div class="col-6"><label class="small fw-bold text-muted">病歷號</label><input id="swal-chart" class="form-control form-control-sm" value="${safeChartNo}"></div>
        <div class="col-6"><label class="small fw-bold text-muted">數量/張數</label><input id="swal-qty" class="form-control form-control-sm" value="${safeQty}"></div>
        <div class="col-6"><label class="small fw-bold text-muted">領藥號</label><input id="swal-pickup" class="form-control form-control-sm" value="${safePickup}"></div>
        <div class="col-12"><label class="small fw-bold text-muted">送件備註</label><input id="swal-sendnote" class="form-control form-control-sm" value="${safeSendNote}"></div>
      </div>
      <hr>
      <div class="text-start mb-2">
        <label class="small fw-bold text-primary">處置狀態</label>
        <select id="swal-edit-option" class="form-select">${optionsHtml}</select>
      </div>
      <div class="text-start">
        <label class="small fw-bold text-primary">藥師備註</label>
        <input id="swal-edit-note" class="form-control" value="${safeNote}">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認儲存',
    width: '500px',
    preConfirm: () => {
      const wardVal = document.getElementById('swal-ward').value.trim();
      if (wardVal !== '' && !/^[A-Za-z0-9]{6}$/.test(wardVal)) {
        Swal.showValidationMessage('病房床號格式錯誤，必須是 6 位數的英文與數字組合');
        return false;
      }
      return {
        type: document.getElementById('swal-type').value,
        ward: wardVal,
        chartNo: document.getElementById('swal-chart').value.trim(),
        quantity: document.getElementById('swal-qty').value.trim(),
        pickupNo: document.getElementById('swal-pickup').value.trim(),
        senderName: document.getElementById('swal-sender').value.trim(),
        sendNote: document.getElementById('swal-sendnote').value.trim(),
        replyOption: document.getElementById('swal-edit-option').value,
        note: document.getElementById('swal-edit-note').value
      }
    }
  });

  if (formValues) {
    const res = await callGAS('editDocRecord', { signId: signId, ...formValues });
    if (res.success) {
      Swal.fire({ icon: 'success', title: '修改成功', timer: 1500, showConfirmButton: false });
      refreshPharmaDocs(); 
    }
  }
}

// === 確認收單 ===
async function receiveDoc(signId) {
  let optionsHtml = replyOptionsData.map(opt => `<option value="${opt}">${opt}</option>`).join('');
  const { value: formValues, isConfirmed } = await Swal.fire({
    title: '處理收件單',
    html: `
      <div class="mb-3 text-start">
        <label class="form-label fw-bold">處置方式 <span class="text-danger">*</span></label>
        <select id="swal-reply-opt" class="form-select">${optionsHtml}</select>
      </div>
      <div class="text-start">
        <label class="form-label fw-bold">備註 (選填)</label>
        <input id="swal-note" class="form-control" placeholder="給傳送的備註...">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定',
    preConfirm: () => {
      const replyOpt = document.getElementById('swal-reply-opt').value;
      if (!replyOpt) { Swal.showValidationMessage('請選擇處置方式！'); return false; }
      return { replyOption: replyOpt, note: document.getElementById('swal-note').value.trim() }
    }
  });

  if (isConfirmed && formValues) {
    Toast.fire({ icon: 'info', title: '背景收單中...', timer: 3000 });
    const payload = { signId, pharmaId: currentPharmaId, pharmaName: currentPharmaName, replyOption: formValues.replyOption, note: formValues.note };
    const res = await callGAS('receiveDocTransfer', payload);
    if (res.success) {
      Toast.fire({ icon: 'success', title: '收單成功' });
      // 延遲 1.5 秒再向伺服器要資料，確保狀態已更新
      setTimeout(() => {
        refreshPharmaDocs();
      }, 1500);
    } else {
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

document.getElementById('btnRefreshPending').addEventListener('click', refreshPharmaDocs);
function logout() { sessionStorage.removeItem('pharmaId'); sessionStorage.removeItem('pharmaName'); window.location.href = 'index.html'; }

// ==========================================
// 氣送作業管理模組
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

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const pDateInput = document.getElementById('pneumaticDate');
  if(pDateInput) pDateInput.value = today;

  const pBarcodeInput = document.getElementById('pneumaticBarcodeInput');
  const pCardContainer = document.getElementById('pneumaticCardContainer');
  const pTotalCountSpan = document.getElementById('pneumaticTotalCount');
  const pEmptyState = document.getElementById('pneumaticEmptyState');
  
  const pScannedItems = new Set();
  // ★ 新增：LocalStorage 記憶功能 (藥師氣送端)
  const localKeyPharma = `medLog_pharma_${currentPharmaId}`;
  let localDataPharma = JSON.parse(localStorage.getItem(localKeyPharma) || '{"date":"","items":[]}');

  if (localDataPharma.date !== today) {
    localDataPharma = { date: today, items: [] };
    localStorage.setItem(localKeyPharma, JSON.stringify(localDataPharma));
  } else {
    localDataPharma.items.forEach(item => {
      pScannedItems.add(`${item.payload.dispenseNo}-${item.payload.rxDate}`);
      addPneumaticCardToUI(item.payload, item.cardId, true, item.isDuplicateLabel, item.isCancelDispense);
    });
    if(pTotalCountSpan) pTotalCountSpan.textContent = pScannedItems.size;
  }
  
  const pneumaticTab = document.getElementById('pneumatic-tab');
  if(pneumaticTab) {
    pneumaticTab.addEventListener('shown.bs.tab', () => {
      if(pBarcodeInput) pBarcodeInput.focus();
    });
  }
  
  document.body.addEventListener('click', (e) => {
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab && activeTab.id === 'pneumatic-tab') {
      if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link') && e.target.tagName !== 'INPUT') {
         if(pBarcodeInput) pBarcodeInput.focus();
      }
    }
  });

  if(pBarcodeInput) {
    pBarcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = pBarcodeInput.value.trim();
        if (!barcodeValue) return;

        const parts = barcodeValue.split(';');
        if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
          playErrorSound(); 
          Swal.fire({ icon: 'error', title: '條碼格式錯誤', text: '請確認是否刷對條碼，領藥號必須為 8 開頭！', timer: 2000 });
          pBarcodeInput.value = '';
          pBarcodeInput.focus();
          return;
        }

        const chartNo = parts[0]; 
        const dispenseNo = parts[2]; 
        const rawDateStr = parts[4]; 
        const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
        const rxDate = dateMatch ? dateMatch[1] : '';

        const itemKey = `${dispenseNo}-${rxDate}`;
        const isNewItem = !pScannedItems.has(itemKey);
        
        let finalTaskType = '氣送'; // 預設狀態
        let isDuplicateLabel = false;
        let isCancelDispense = false;

        if (isNewItem) {
          pScannedItems.add(itemKey);
        } else {
          playErrorSound();
          const { value: userChoice } = await Swal.fire({
            title: '⚠️ 重複刷入提示',
            text: `領藥號 ${dispenseNo} 剛剛已經刷入過了！請問您要：`,
            icon: 'warning',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '覆蓋重刷 (維持氣送)',
            denyButtonText: '取消領藥',
            cancelButtonText: '取消動作 (不記錄)',
            confirmButtonColor: '#198754',
            denyButtonColor: '#dc3545',
            allowOutsideClick: false
          });

          if (userChoice === true) {
            finalTaskType = '氣送';
            isDuplicateLabel = true;
          } else if (userChoice === false) {
            finalTaskType = '取消領藥';
            isDuplicateLabel = true;
            isCancelDispense = true;
          } else {
            pBarcodeInput.value = '';
            pBarcodeInput.focus();
            return;
          }
        }

        const payload = {
          date: pDateInput.value,
          barcode: barcodeValue,
          type: finalTaskType, 
          staffId: currentPharmaId,
          staffName: currentPharmaName,
          chartNo: chartNo,
          dispenseNo: dispenseNo,
          rxDate: rxDate
        };

        // ★ 記錄刷入的當下時間
        const now = new Date();
        payload.timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

        const cardId = 'p_card_' + Date.now();
        
        if (isNewItem) {
          addPneumaticCardToUI(payload, cardId, true); 
          pTotalCountSpan.textContent = pScannedItems.size;
        } else {
          addPneumaticCardToUI(payload, cardId, true, isDuplicateLabel, isCancelDispense); 
        }

        // ★ 將氣送紀錄推入 LocalStorage 儲存
        localDataPharma.items.push({
          payload: payload,
          cardId: cardId,
          isDuplicateLabel: isDuplicateLabel,
          isCancelDispense: isCancelDispense
        });
        localStorage.setItem(localKeyPharma, JSON.stringify(localDataPharma));
        
        pBarcodeInput.value = '';
        pBarcodeInput.focus();

        const result = await callGAS('logDischargeMeds', payload);
        
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
  }

function addPneumaticCardToUI(data, cardId, isPending, isDuplicate = false, isCancel = false) {
    if (pEmptyState) pEmptyState.style.display = 'none';
    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
    
    const now = new Date();
    const timeString = data.timeString || `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0 ${isCancel ? 'text-danger' : 'text-success'} fw-bold">領藥號：${data.dispenseNo} 
            ${isDuplicate && !isCancel ? '<span class="badge bg-warning text-dark fs-6 ms-2">重複刷入</span>' : ''}
            ${isCancel ? '<span class="badge bg-danger text-white fs-6 ms-2">取消領藥</span>' : ''}
          </h3>
          <span class="text-muted fs-4">${timeString}</span>
        </div>
        <div class="mb-2 fs-5 text-secondary">病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate}</div>
        <div class="fs-5 text-secondary border-top pt-2">
          <span class="badge ${isCancel ? 'bg-danger' : 'bg-primary'} me-2 fs-6">
            <i class="bi ${isCancel ? 'bi-x-circle' : 'bi-rocket-takeoff'} me-1"></i>${data.type}
          </span>
          由 <span class="fw-bold text-primary">${data.staffName} 藥師</span> 處理
        </div>
      </div>
    `;
    pCardContainer.insertBefore(card, pCardContainer.firstChild);
  }
});

const docReceiveTab = document.getElementById('doc-receive-tab');
if(docReceiveTab) {
  docReceiveTab.addEventListener('shown.bs.tab', refreshPharmaDocs);
}

// === 綁定藥師端篩選器事件 ===
document.addEventListener('DOMContentLoaded', () => {
  const pType = document.getElementById('filterPharmaDocType');
  const pChart = document.getElementById('filterPharmaChart');
  const pWard = document.getElementById('filterPharmaWard');
  const pDisp = document.getElementById('filterPharmaDisp');

  if(pType) pType.addEventListener('change', renderPharmaDocs);
  if(pChart) pChart.addEventListener('input', renderPharmaDocs);
  if(pWard) pWard.addEventListener('input', renderPharmaDocs);
  if(pDisp) pDisp.addEventListener('input', renderPharmaDocs);
});
