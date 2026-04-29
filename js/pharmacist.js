// js/pharmacist.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. 檢查是否已登入 (讀取 sessionStorage，這次是讀藥師的)
  const pharmaId = sessionStorage.getItem('pharmaId');
  const pharmaName = sessionStorage.getItem('pharmaName');

  if (!pharmaId || !pharmaName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'pharmacist_login.html';
    });
    return;
  }

  // 顯示登入藥師名稱
  document.getElementById('displayPharma').textContent = `${pharmaName} 藥師 (${pharmaId})`;

  // (待續：撈取待收單與已收單資料的邏輯)
});

// 全域登出函數
function logout() {
  sessionStorage.removeItem('pharmaId');
  sessionStorage.removeItem('pharmaName');
  window.location.href = 'index.html';
}
