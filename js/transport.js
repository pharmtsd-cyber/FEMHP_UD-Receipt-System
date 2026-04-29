// js/transport.js

// ==========================================
// 音效模組
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
// 出院帶藥簽收邏輯
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
  
  const scannedItems = new Set();
  if(barcodeInput) barcodeInput.focus();

  document.body.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link')) {
       if(barcodeInput) barcodeInput.focus();
    }
  });

  if(barcodeInput) {
    barcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = barcodeInput.value.trim();
        if (!barcodeValue) return;

        const parts = barcodeValue.split(';');
        if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
          playErrorSound(); 
          Swal.fire({ icon: 'error', title: '條碼格式錯誤', text: '請確認是否刷對條碼，領藥號必須為 8 開頭！', timer: 2000 });
          barcodeInput.value = '';
          barcodeInput.focus();
          return;
        }

        const chartNo = parts[0]; 
        const dispenseNo = parts[2]; 
        const rawDateStr = parts[4]; 
        const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
        const rxDate = dateMatch ? dateMatch[1] : '';

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
        
        if (isNewItem) {
          scannedItems.add(itemKey);
          addCardToUI(payload, cardId, true); 
          totalCountSpan.textContent = scannedItems.size;
        } else {
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
  }

  function addCardToUI(data, cardId, isPending, isDuplicate = false) {
    if (emptyState) emptyState.style.display = 'none';
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
        <div class="fs-5 text-secondary border-top pt-2"><span class="badge bg-success me-2 fs-6">${data.type}</span>由 <span class="fw-bold text-dark">${data.staffName}</span> 簽收</div>
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

// ==========================================
// 文件送件給藥局 邏輯
// ==========================================
let docConfigs = []; 

async function loadDocConfig() {
  const select = document.getElementById('docTypeSelect');
  if(!select) return; // 保護機制，如果不在送件頁籤就跳過
  select.innerHTML = '<option value="">資料載入中...</option>';

  try {
    const result = await callGAS('getConfigData', {}); 
    if (result && result.length > 0) {
      docConfigs = result;
      select.innerHTML = '<option value="">請選擇類型...</option>';
      docConfigs.forEach(config => {
        if (config['送件類型名稱']) {
          const opt = document.createElement('option');
          opt.value = config['送件類型名稱'];
          opt.textContent = config['送件類型名稱'];
          select.appendChild(opt);
        }
      });
    } else {
      select.innerHTML = '<option value="">無法取得類型(清單為空)</option>';
    }
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">伺服器連線失敗</option>';
  }
}
// 如果頁面上存在此元素再載入
if(document.getElementById('docTypeSelect')) {
  loadDocConfig();
  
  document.getElementById('docTypeSelect').addEventListener('change', (e) => {
    const selectedType = e.target.value;
    const container = document.getElementById('dynamicFieldsContainer');
    container.innerHTML = ''; 

    if (!selectedType) {
      container.innerHTML = '<div class="text-muted text-center py-4 fs-5">請先選擇送件類型</div>';
      return;
    }

    const config = docConfigs.find(c => c['送件類型名稱'] === selectedType);
    if (!config) return;

    let hasFields = false;
    for (const key in config) {
      if (key !== '送件類型名稱') {
        const fieldSetting = config[key] ? config[key].toString().trim() : '';
        if (fieldSetting !== '隱藏' && fieldSetting !== '') {
          hasFields = true;
          const isRequired = (fieldSetting === '必填');
          const div = document.createElement('div');
          div.className = 'mb-4';
          div.innerHTML = `
            <label class="form-label fw-bold fs-4">${key} ${isRequired ? '<span class="text-danger">*</span>' : ''}</label>
            <input type="text" class="form-control form-control-lg dynamic-input fs-4" name="${key}" placeholder="請輸入${key}" ${isRequired ? 'required' : ''}>
          `;
          container.appendChild(div);
        }
      }
    }

    if (!hasFields) container.innerHTML = '<div class="text-muted text-center py-4 fs-5">此類型無需填寫額外資訊</div>';
  });

  document.getElementById('docForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const docType = document.getElementById('docTypeSelect').value;
    if (!docType) return;

    const currentTransId = sessionStorage.getItem('transId') || '未知編號';
    const currentTransName = sessionStorage.getItem('transName') || '未知人員';

    const dynamicData = {};
    document.querySelectorAll('.dynamic-input').forEach(input => {
      dynamicData[input.name] = input.value.trim();
    });

    const payload = {
      '送件類型': docType,
      '送件備註': document.getElementById('docNote').value.trim(),
      '送件傳送員工編號': currentTransId,
      '送件傳送名稱': currentTransName,
      ...dynamicData 
    };

    Swal.fire({ title: '傳送中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const result = await callGAS('submitDocTransfer', { payload: payload });

    if (result.success) {
      playSuccessSound();
      Swal.fire({ icon: 'success', title: '送件成功！', html: `單號：<span class="text-primary fw-bold">${result.signId}</span>`, timer: 2000, showConfirmButton: false });
      document.getElementById('docForm').reset();
      document.getElementById('dynamicFieldsContainer').innerHTML = '<div class="text-muted text-center py-5 fs-4">請先選擇送件類型</div>';
      refreshDocProgress();
    } else {
      playErrorSound();
      Swal.fire('失敗', result.message, 'error');
    }
  });
}

// === 渲染文件進度卡片 (傳送端) ===
async function refreshDocProgress() {
  const container = document.getElementById('docRecordContainer');
  if(!container) return; // 保護機制

  container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 fs-4">讀取進度中...</p></div>';
  const result = await callGAS('getTodayDocRecords', {});

  if (result.success) {
    container.innerHTML = '';
    if (result.data.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-5 fs-4">目前無處理中的單據，已全部結案！</div>';
      return;
    }

    result.data.forEach(item => {
      const card = document.createElement('div');
      
      let statusClass = "bg-warning text-dark"; 
      let borderClass = "border-warning";
      let needsAction = false; 

      if (item.status === "藥師已收單") {
        if (item.replyOption === '掛牌待傳送領回' || item.replyOption === '退件') {
          statusClass = "bg-danger text-white"; // 變成紅色提醒
          borderClass = "border-danger";
          needsAction = true;
        } else {
          statusClass = "bg-primary text-white";
          borderClass = "border-primary";
        }
      }

      card.className = `card mb-3 shadow-sm ${borderClass} border-2`;
      
      // 動態生成按鈕 HTML
      const actionBtnHtml = needsAction 
        ? `<button class="btn btn-success btn-lg fw-bold w-100 mt-3 shadow-sm" onclick="acknowledgeReturn('${item.signId}')"><i class="bi bi-check2-circle me-1"></i> 點我確認領回 (歸檔)</button>` 
        : '';

      card.innerHTML = `
        <div class="card-body py-3 px-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge ${statusClass} fs-5 px-3 py-2">${item.status} ${item.replyOption ? ` - ${item.replyOption}` : ''}</span>
            <span class="text-muted fs-5">${item.sendTime} 送出</span>
          </div>
          <div class="row align-items-center mt-3">
            <div class="col-7">
              <h3 class="fw-bold text-dark mb-2">${item.type}</h3>
              <p class="fs-4 mb-1 text-secondary">病房：<span class="text-primary fw-bold">${item.ward || '無'}</span></p>
              <p class="fs-4 mb-0 text-secondary">病歷號：<span class="text-dark font-monospace">${item.chartNo || '無'}</span></p>
            </div>
            <div class="col-5 text-end border-start">
              <p class="mb-1 fs-5 text-muted">收單藥師</p>
              <p class="mb-0 fs-4 fw-bold ${item.pharmaName ? 'text-primary' : 'text-warning'}">${item.pharmaName || '等待中'}</p>
            </div>
          </div>
          ${actionBtnHtml}
        </div>
      `;
      container.appendChild(card);
    });
  }
}

// === 傳送人員點擊「確認領回」===
async function acknowledgeReturn(signId) {
  const confirm = await Swal.fire({
    title: '確認已領回文件？',
    text: "確認後，這筆單據將結案並從清單中移除。",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#198754',
    confirmButtonText: '是的，已領回'
  });

  if (confirm.isConfirmed) {
    Swal.fire({ title: '歸檔中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const payload = {
      signId: signId,
      transId: sessionStorage.getItem('transId'),
      transName: sessionStorage.getItem('transName')
    };
    const res = await callGAS('acknowledgeDocReturn', { payload: payload });
    if (res.success) {
      playSuccessSound();
      Swal.fire({ icon: 'success', title: '已結案歸檔', timer: 1000, showConfirmButton: false }); // ★ 蓋掉轉圈圈
      refreshDocProgress(); 
    } else {
      playErrorSound();
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

if(document.getElementById('btnRefreshDoc')) {
  document.getElementById('btnRefreshDoc').addEventListener('click', refreshDocProgress);
}
if(document.getElementById('doc-tab')) {
  document.getElementById('doc-tab').addEventListener('shown.bs.tab', refreshDocProgress);
}
