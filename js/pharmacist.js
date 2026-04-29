// js/pharmacist.js

let currentPharmaId = '';
let currentPharmaName = '';

document.addEventListener('DOMContentLoaded', () => {
  // 1. 驗證登入
  currentPharmaId = sessionStorage.getItem('pharmaId');
  currentPharmaName = sessionStorage.getItem('pharmaName');

  if (!currentPharmaId || !currentPharmaName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'pharmacist_login.html';
    });
    return;
  }

  document.getElementById('displayPharma').textContent = `${currentPharmaName} 藥師 (${currentPharmaId})`;

  // 2. 初始化載入資料
  refreshPharmaDocs();
});

// === 取得並渲染收單列表 ===
async function refreshPharmaDocs() {
  const pendingBox = document.getElementById('pendingContainer');
  const completedBox = document.getElementById('completedContainer');
  const countBadge = document.getElementById('pendingDocCount');

  pendingBox.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div><p class="mt-2 fs-4">抓取單據中...</p></div>';
  completedBox.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 fs-4">抓取紀錄中...</p></div>';

  const result = await callGAS('getPharmaDocRecords', {});

  if (result.success) {
    // 渲染左側：待收單
    const pendingData = result.data.pending;
    countBadge.textContent = pendingData.length; // 更新上方紅色角標
    
    if (pendingData.length === 0) {
      pendingBox.innerHTML = '<div class="text-muted text-center py-5 fs-4">太棒了！目前沒有待處理的單據。</div>';
    } else {
      pendingBox.innerHTML = '';
      pendingData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-warning border-2';
        card.innerHTML = `
          <div class="card-body p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h3 class="fw-bold text-dark m-0">${item.type}</h3>
              <span class="text-danger fw-bold fs-5"><i class="bi bi-clock me-1"></i>${item.sendTime} 送達</span>
            </div>
            <p class="fs-4 mb-1">病房：<span class="text-primary fw-bold">${item.ward || '無'}</span></p>
            <p class="fs-4 mb-2">病歷號：<span class="font-monospace">${item.chartNo || '無'}</span></p>
            ${item.sendNote ? `<div class="alert alert-danger py-2 mb-3 fs-5"><i class="bi bi-exclamation-triangle-fill me-2"></i>傳送備註：${item.sendNote}</div>` : ''}
            
            <div class="d-flex justify-content-between align-items-end mt-3 border-top pt-3">
              <span class="text-muted fs-5">送件員：${item.sender}</span>
              <button class="btn btn-warning btn-lg fw-bold px-4" onclick="receiveDoc('${item.signId}')">
                <i class="bi bi-box-arrow-in-down me-2"></i>確認收單
              </button>
            </div>
          </div>
        `;
        pendingBox.appendChild(card);
      });
    }

    // 渲染右側：已收單
    const completedData = result.data.completed;
    if (completedData.length === 0) {
      completedBox.innerHTML = '<div class="text-muted text-center py-5 fs-4">今日尚未有收單紀錄</div>';
    } else {
      completedBox.innerHTML = '';
      completedData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-primary border-2';
        card.innerHTML = `
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <h4 class="fw-bold text-primary m-0">${item.type}</h4>
              <span class="text-muted fs-5">${item.receiveTime} 已收</span>
            </div>
            <p class="fs-5 mb-1 text-secondary">病房：${item.ward || '無'} | 病歷號：${item.chartNo || '無'}</p>
            <div class="text-end mt-2">
              <span class="badge bg-primary fs-6">收單人：${item.pharmaName}</span>
            </div>
          </div>
        `;
        completedBox.appendChild(card);
      });
    }
  } else {
    pendingBox.innerHTML = '<div class="alert alert-danger fs-4 m-3">資料載入失敗</div>';
    completedBox.innerHTML = '<div class="alert alert-danger fs-4 m-3">資料載入失敗</div>';
  }
}

// === 點擊確認收單的彈出邏輯 ===
async function receiveDoc(signId) {
  const { value: note, isConfirmed } = await Swal.fire({
    title: '確認收單',
    text: '您可以在此填寫給傳送人員的備註 (選填)',
    input: 'text',
    inputPlaceholder: '例如：藥品已備妥，請核對...',
    showCancelButton: true,
    confirmButtonText: '確定收單',
    cancelButtonText: '取消',
    confirmButtonColor: '#0d6efd'
  });

  if (isConfirmed) {
    Swal.fire({ title: '處理中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = {
      signId: signId,
      pharmaId: currentPharmaId,
      pharmaName: currentPharmaName,
      note: note || ''
    };

    const result = await callGAS('receiveDocTransfer', { payload: payload });

    if (result.success) {
      Swal.fire({ icon: 'success', title: '收單成功！', timer: 1500, showConfirmButton: false });
      refreshPharmaDocs(); // 重新整理列表
    } else {
      Swal.fire('失敗', result.message, 'error');
    }
  }
}

document.getElementById('btnRefreshPending').addEventListener('click', refreshPharmaDocs);

function logout() {
  sessionStorage.removeItem('pharmaId');
  sessionStorage.removeItem('pharmaName');
  window.location.href = 'index.html';
}
