// js/pharmacist.js
let docTypeOptionsData = []; // 用來存文件類型
let currentPharmaId = sessionStorage.getItem('pharmaId');
let currentPharmaName = sessionStorage.getItem('pharmaName');
let replyOptionsData = []; 

document.addEventListener('DOMContentLoaded', async () => {
  if (!currentPharmaId || !currentPharmaName) {
    window.location.href = 'pharmacist_login.html';
    return;
  }
  document.getElementById('displayPharma').textContent = `${currentPharmaName} 藥師`;
  
  // 呼叫 API 取得選項
  const optResult = await callGAS('getPharmaReplyOptions');
  
  if (optResult.success) {
    // ★ 加上 map 幫忙把 SharePoint JSON 裡面的選項名稱抽成單純的陣列
    replyOptionsData = optResult.data.map(opt => opt.Title || opt['送件類型名稱']);
  }
  
  refreshPharmaDocs();
});

// === 渲染藥師緊湊版介面 (SharePoint 版本) ===
async function refreshPharmaDocs() {
  const pendingBox = document.getElementById('pendingContainer');
  const completedBox = document.getElementById('completedContainer');
  const countBadge = document.getElementById('pendingDocCount');

  pendingBox.innerHTML = '<div class="text-center py-3">讀取中...</div>';
  completedBox.innerHTML = '<div class="text-center py-3">讀取中...</div>';

  const result = await callGAS('getPharmaDocRecords');

  if (result.success) {
    // 取得今天的日期字串 (用來過濾今日已收單)
    const todayStr = new Date().toISOString().split('T')[0];

    // ★ 核心分類魔法：將 SharePoint 傳來的資料分為「待收單」與「今日已完成」
    const pendingData = result.data.filter(item => !item.IsReceived && !item.IsClosed);
    const completedData = result.data.filter(item => item.IsReceived && item.ReceiveTime && item.ReceiveTime.startsWith(todayStr));

    // 更新未處理徽章數字
    countBadge.textContent = pendingData.length; 
    
    // === 左側：待收單 ===
    if (pendingData.length === 0) {
      pendingBox.innerHTML = '<div class="text-muted text-center py-4">無待處理單據</div>';
    } else {
      pendingBox.innerHTML = pendingData.map(item => {
        // 組合詳細資訊 (取代以前 GAS 的動態 HTML)
        let detailsHtml = `病房床號: <span class="text-primary fw-bold">${item.Ward || '-'}</span> | 病歷號: <span class="text-primary fw-bold">${item.ChartNo || '-'}</span>`;
        let sendTimeStr = item.SendTime ? new Date(item.SendTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'}) : '';

        return `
        <div class="card mb-2 shadow-sm border-warning border-start border-4">
          <div class="card-body p-2">
            <div class="mb-1"><strong class="text-dark fs-5">${item.DocType}</strong></div>
            <div class="fs-6 mb-2">
              ${detailsHtml}
              <!-- 暫時隱藏修改按鈕，後續實作 -->
            </div>
            ${item.SendNote ? `<div class="text-danger small mb-2 bg-light p-1 rounded"><i class="bi bi-exclamation-triangle-fill me-1"></i>送件備註: ${item.SendNote}</div>` : ''}
            
            <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
              <div class="small text-muted">
                <i class="bi bi-person-walking"></i> 送件人: <strong class="text-dark">${item.SenderName}</strong>
                <span class="ms-2">時間: <strong>${sendTimeStr}</strong></span>
              </div>
              <button class="btn btn-warning btn-sm fw-bold" onclick="receiveDoc('${item.Title}')">進行收單</button>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    // === 右側：已收單 ===
    if (completedData.length === 0) {
      completedBox.innerHTML = '<div class="text-muted text-center py-4">今日無收單紀錄</div>';
    } else {
      completedBox.innerHTML = completedData.map(item => {
        let detailsHtml = `病房床號: <span class="text-dark fw-bold">${item.Ward || '-'}</span> | 病歷號: <span class="text-dark fw-bold">${item.ChartNo || '-'}</span>`;
        let badgeClass = 'bg-danger'; 
        let borderClass = 'border-primary';
        
        if (item.ReplyOption === '收下不歸還') { badgeClass = 'bg-success'; borderClass = 'border-success'; } 
        else if (item.IsClosed) { badgeClass = 'bg-secondary'; borderClass = 'border-secondary'; }

        let sendTimeStr = item.SendTime ? new Date(item.SendTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'}) : '';
        let receiveTimeStr = item.ReceiveTime ? new Date(item.ReceiveTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'}) : '';
        let returnTimeStr = item.ReturnTime ? new Date(item.ReturnTime).toLocaleTimeString('zh-TW', {hour: '2-digit', minute:'2-digit'}) : '';

        return `
        <div class="card mb-2 shadow-sm border-start border-4 ${borderClass}">
          <div class="card-body p-2">
            <div class="mb-1"><strong class="text-primary fs-5">${item.DocType}</strong></div>
            <div class="small text-secondary mb-1">${detailsHtml}</div>
            
            ${(item.SendNote || item.ReceiveNote) ? `
            <div class="bg-light p-2 my-2 rounded border small">
              ${item.SendNote ? `<div class="text-danger mb-1"><i class="bi bi-person-walking me-1"></i>備註: <span class="fw-bold">${item.SendNote}</span></div>` : ''}
              ${item.ReceiveNote ? `<div class="text-primary"><i class="bi bi-capsule me-1"></i>藥師回覆: <span class="fw-bold">${item.ReceiveNote}</span></div>` : ''}
            </div>` : ''}

            <div class="d-flex justify-content-between align-items-end mt-2 border-top pt-2">
              <div class="small text-muted">
                <div class="mb-1"><i class="bi bi-person-walking me-1"></i>送件: <strong class="text-dark">${item.SenderName}</strong> (${sendTimeStr})</div>
                <div class="mb-1"><i class="bi bi-capsule me-1"></i>收單: <strong class="text-primary">${item.PharmaName}</strong> (${receiveTimeStr})</div>
                ${item.ReturnerName ? `<div><i class="bi bi-check2-circle me-1"></i>領回: <strong class="text-success">${item.ReturnerName}</strong> (${returnTimeStr})</div>` : ''}
              </div>
              <div class="text-end">
                <span class="badge ${badgeClass} mb-2 d-block fs-6">${item.IsClosed && item.ReplyOption !== '收下不歸還' ? '已領回' : item.ReplyOption}</span>
                <button class="btn btn-outline-primary btn-sm py-0 w-100" onclick="editDocInfo('${item.Title}', '${item.ReplyOption}', '${item.ReceiveNote || ''}', '${item.DocType}', '${item.Ward || ''}', '${item.ChartNo || ''}', '${item.SenderName}', '${item.SendNote || ''}')">修改全部資料</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }
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

async function editDocInfo(signId, currentOption, currentNote, currentType, currentWard, currentChartNo, currentSender, currentSendNote) {
  const safeNote = (currentNote === 'undefined' || currentNote === 'null' || !currentNote) ? '' : currentNote;
  const safeSendNote = (currentSendNote === 'undefined' || currentSendNote === 'null' || !currentSendNote) ? '' : currentSendNote;
  const safeWard = (currentWard === 'undefined' || currentWard === 'null' || !currentWard) ? '' : currentWard;
  const safeChartNo = (currentChartNo === 'undefined' || currentChartNo === 'null' || !currentChartNo) ? '' : currentChartNo;

  const optionsHtml = replyOptionsData.map(opt => `<option value="${opt}" ${opt === currentOption ? 'selected' : ''}>${opt}</option>`).join('');

  const { value: formValues } = await Swal.fire({
    title: '修改單據詳細資料',
    html: `
      <div class="row text-start g-2 mb-3 bg-light p-2 rounded">
        <div class="col-6"><label class="small fw-bold text-muted">文件類型</label><input id="swal-type" class="form-control form-control-sm" value="${currentType}"></div>
        <div class="col-6"><label class="small fw-bold text-muted">送件人</label><input id="swal-sender" class="form-control form-control-sm" value="${currentSender}"></div>
        <div class="col-6"><label class="small fw-bold text-muted">病房床號</label><input id="swal-ward" class="form-control form-control-sm" value="${safeWard}"></div>
        <div class="col-6"><label class="small fw-bold text-muted">病歷號</label><input id="swal-chart" class="form-control form-control-sm" value="${safeChartNo}"></div>
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
      return {
        type: document.getElementById('swal-type').value,
        ward: document.getElementById('swal-ward').value,
        chartNo: document.getElementById('swal-chart').value,
        senderName: document.getElementById('swal-sender').value,
        sendNote: document.getElementById('swal-sendnote').value,
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

// === 確認收單 (保留下拉選單) ===
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

// === 3. 確認收單 === (修改這部分)
  if (isConfirmed && formValues) {
    Toast.fire({ icon: 'info', title: '背景收單中...', timer: 3000 }); // ★ 替換原本的轉圈圈
    const payload = { signId, pharmaId: currentPharmaId, pharmaName: currentPharmaName, replyOption: formValues.replyOption, note: formValues.note };
    const res = await callGAS('receiveDocTransfer', payload);
    if (res.success) {
      Toast.fire({ icon: 'success', title: '收單成功' });
      refreshPharmaDocs();
    } else {
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

document.getElementById('btnRefreshPending').addEventListener('click', refreshPharmaDocs);
function logout() { sessionStorage.removeItem('pharmaId'); sessionStorage.removeItem('pharmaName'); window.location.href = 'index.html'; }

// ==========================================
// 氣送作業管理模組 (比照傳送端出院帶藥)
// ==========================================

// --- 音效模組 ---
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
  const today = new Date().toISOString().split('T')[0];
  const pDateInput = document.getElementById('pneumaticDate');
  if(pDateInput) pDateInput.value = today;

  const pBarcodeInput = document.getElementById('pneumaticBarcodeInput');
  const pCardContainer = document.getElementById('pneumaticCardContainer');
  const pTotalCountSpan = document.getElementById('pneumaticTotalCount');
  const pEmptyState = document.getElementById('pneumaticEmptyState');
  
  // 使用 Set 防止重複計數 (與傳送端邏輯相同)
  const pScannedItems = new Set();

  // --- 強制焦點控制 ---
  // 當切換到氣送頁籤時，自動對焦
  const pneumaticTab = document.getElementById('pneumatic-tab');
  if(pneumaticTab) {
    pneumaticTab.addEventListener('shown.bs.tab', () => {
      if(pBarcodeInput) pBarcodeInput.focus();
    });
  }
  // 在氣送頁籤點擊空白處時，確保游標不會跑掉
  document.body.addEventListener('click', (e) => {
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab && activeTab.id === 'pneumatic-tab') {
      if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link') && e.target.tagName !== 'INPUT') {
         if(pBarcodeInput) pBarcodeInput.focus();
      }
    }
  });

  // --- 條碼掃描事件 ---
  if(pBarcodeInput) {
    pBarcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = pBarcodeInput.value.trim();
        if (!barcodeValue) return;

        // 驗證條碼格式
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

        // 檢查是否為重複刷入
        const itemKey = `${dispenseNo}-${rxDate}`;
        const isNewItem = !pScannedItems.has(itemKey);

        const payload = {
          date: pDateInput.value,
          barcode: barcodeValue,
          type: '氣送', // ★ 關鍵差異：送去 GAS 時自動寫為「氣送」
          staffId: currentPharmaId,
          staffName: currentPharmaName,
          chartNo: chartNo,
          dispenseNo: dispenseNo,
          rxDate: rxDate
        };

        const cardId = 'p_card_' + Date.now();
        
        // 渲染畫面卡片
        if (isNewItem) {
          pScannedItems.add(itemKey);
          addPneumaticCardToUI(payload, cardId, true); 
          pTotalCountSpan.textContent = pScannedItems.size;
        } else {
          addPneumaticCardToUI(payload, cardId, true, true); 
        }
        
        pBarcodeInput.value = '';
        pBarcodeInput.focus();

        // 呼叫 GAS 寫入同一張 Discharge_Meds_Log 表
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
  }

  // --- 渲染卡片 UI 函數 ---
  function addPneumaticCardToUI(data, cardId, isPending, isDuplicate = false) {
    if (pEmptyState) pEmptyState.style.display = 'none';
    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0 text-success fw-bold">領藥號：${data.dispenseNo} ${isDuplicate ? '<span class="badge bg-warning text-dark fs-6 ms-2">重複刷入</span>' : ''}</h3>
          <span class="text-muted fs-4">${timeString}</span>
        </div>
        <div class="mb-2 fs-5 text-secondary">病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate}</div>
        <div class="fs-5 text-secondary border-top pt-2">
          <span class="badge bg-primary me-2 fs-6"><i class="bi bi-rocket-takeoff me-1"></i>${data.type}</span>
          由 <span class="fw-bold text-primary">${data.staffName} 藥師</span> 處理
        </div>
      </div>
    `;
    pCardContainer.insertBefore(card, pCardContainer.firstChild);
  }
});

// 當藥師點擊「文件收單作業」頁籤時，自動抓取最新資料
const docReceiveTab = document.getElementById('doc-receive-tab');
if(docReceiveTab) {
  docReceiveTab.addEventListener('shown.bs.tab', refreshPharmaDocs);
}
