// js/pharmacist.js

let currentPharmaId = '';
let currentPharmaName = '';
let replyOptionsData = []; // 儲存從資料庫抓來的回覆選項

document.addEventListener('DOMContentLoaded', async () => {
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

  // 2. 載入藥師回覆選項下拉清單
  const optResult = await callGAS('getPharmaReplyOptions', {});
  if (optResult.success) {
    replyOptionsData = optResult.data;
  }

  // 3. 初始化載入資料
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
    const pendingData = result.data.pending;
    countBadge.textContent = pendingData.length; 
    
    // 渲染待收單
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
                <i class="bi bi-box-arrow-in-down me-2"></i>進行收單
              </button>
            </div>
          </div>
        `;
        pendingBox.appendChild(card);
      });
    }

    // 渲染已收單 (加入回覆狀態顯示)
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
            
            <!-- ★ 顯示藥師的回覆狀態與備註 -->
            <div class="bg-light p-2 mt-2 rounded border">
              <span class="badge ${item.replyOption === '收下不歸還' ? 'bg-success' : 'bg-danger'} fs-6 me-2">${item.replyOption}</span>
              <span class="text-dark fs-5">${item.receiveNote || '無備註'}</span>
            </div>

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

// === 點擊確認收單的彈出邏輯 (改為自訂表單含下拉選單) ===
async function receiveDoc(signId) {
  // 生成下拉選單的 HTML
  let optionsHtml = replyOptionsData.map(opt => `<option value="${opt}">${opt}</option>`).join('');

  const { value: formValues, isConfirmed } = await Swal.fire({
    title: '處理收件單',
    html: `
      <div class="mb-4 text-start">
        <label class="form-label fw-bold fs-5">後續處置方式 <span class="text-danger">*</span></label>
        <select id="swal-reply-opt" class="form-select form-select-lg border-primary">
          <option value="">請選擇處置方式...</option>
          ${optionsHtml}
        </select>
      </div>
      <div class="mb-2 text-start">
        <label class="form-label fw-bold fs-5">給傳送的備註 (選填)</label>
        <input id="swal-note" class="form-control form-control-lg" placeholder="例如：藥品已備妥，請核對...">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="bi bi-check-circle me-1"></i> 確定收單',
    cancelButtonText: '取消',
    confirmButtonColor: '#0d6efd',
    // 驗證必填選項
    preConfirm: () => {
      const replyOpt = document.getElementById('swal-reply-opt').value;
      if (!replyOpt) {
        Swal.showValidationMessage('請務必選擇後續處置方式！');
        return false;
      }
      return {
        replyOption: replyOpt,
        note: document.getElementById('swal-note').value.trim()
      }
    }
  });

  if (isConfirmed && formValues) {
    Swal.fire({ title: '寫入資料庫中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = {
      signId: signId,
      pharmaId: currentPharmaId,
      pharmaName: currentPharmaName,
      replyOption: formValues.replyOption,
      note: formValues.note
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
