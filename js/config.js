// js/config.js

// ★ 將這裡替換為您剛剛在 Power Automate 複製的那一長串 URL
const MS_FLOW_API_URL = "https://prod-XX.westus.logic.azure.com:443/workflows/https://defaultf611cf53b6864814b03558908d4900.be.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b8885468ce9e4e91bd513632ce0c9bb2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-utvV9pjf3BeN987pdFfQjkB7OdCoYWUbj2c9hrUv6E";

// 封裝與 Power Automate 溝通的共用函數
async function callGAS(action, dataObj) {
  const payload = { action: action, ...dataObj };
  
  try {
    const response = await fetch(MS_FLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
    
  } catch (error) {
    console.error("API 請求錯誤:", error);
    
    // 網路防呆機制保留
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      Swal.fire({
        icon: 'error',
        title: '網路連線遭阻擋',
        html: `系統無法連接至後端資料庫。<br><br>請聯絡資訊處確認此電腦是否允許存取 Microsoft Power Automate 服務。`,
        confirmButtonColor: '#2C5343'
      });
    } else {
      Swal.fire('系統錯誤', '發生未知的連線問題，請稍後再試。', 'error');
    }
    
    return { success: false, message: '網路連線異常' };
  }
}
