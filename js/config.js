// === 系統共用設定檔 (config.js) ===

// 1. 微軟 Power Automate 的 API 總機網址 (請填入您的真實網址)
const API_URL = "https://defaultf611cf53b6864814b03558908d4900.be.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b8885468ce9e4e91bd513632ce0c9bb2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-utvV9pjf3BeN987pdFfQjkB7OdCoYWUbj2c9hrUv6E";

// 2. 封裝與後端溝通的非同步函數
async function callGAS(action, dataObj = {}) {
  // 【升級核心】：系統會自動幫您把舊有的平整資料，裝進 payload 箱子裡！
  const payload = { action: action, payload: dataObj };
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload) // 送出標準化的包裹
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error(`[${action}] API 請求錯誤:`, error);
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      Swal.fire({
        icon: 'error',
        title: '網路連線遭阻擋',
        html: `系統無法連接至後端資料庫。<br>請確認網路連線。`,
        confirmButtonColor: '#2C5343'
      });
    } else {
      Swal.fire('系統錯誤', '發生未知的連線問題，請稍後再試。', 'error');
    }
    return { success: false, message: '網路連線異常' };
  }
}

// 3. 全局共用的 Toast 提示工具 (保留您原本的設定)
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});
