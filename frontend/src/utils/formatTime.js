/**
 * 更健壮的时间格式化函数
 * @param {any} date - 任何可被 Date 解析的值
 * @param {string} format - 格式，默认 YYYY-MM-DD HH:mm:ss
 * @returns {string} 格式化后的时间
 */
 export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    
    // 验证日期是否有效
    if (isNaN(d.getTime())) {
      console.warn('无效的日期:', date);
      return '';
    }
    
    const pad = (n) => n.toString().padStart(2, '0');
    
    const replacements = {
      'YYYY': d.getFullYear(),
      'MM': pad(d.getMonth() + 1),
      'DD': pad(d.getDate()),
      'HH': pad(d.getHours()),
      'mm': pad(d.getMinutes()),
      'ss': pad(d.getSeconds()),
      'hh': pad(d.getHours() % 12 || 12), // 12小时制
      'A': d.getHours() < 12 ? 'AM' : 'PM',
    };
    
    return format.replace(/YYYY|MM|DD|HH|hh|mm|ss|A/g, match => replacements[match]);
  } catch (error) {
    console.error('格式化日期时出错:', error, date);
    return '';
  }
}

// 转换为 ISO 8601 格式（YYYY-MM-DDTHH:mm:ss）
 export function    formatToISO (date)  {
        const d = new Date(date)
        const pad = n => n.toString().padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      }
//判断时间是今天
 export function isToday(dateString) {
    const inputDate = new Date(dateString);
    const today = new Date();
    const isToday =inputDate.getFullYear() === today.getFullYear() &&
           inputDate.getMonth() === today.getMonth() &&
           inputDate.getDate() === today.getDate();
           console.log('是否今天', isToday);
           
    return  isToday
}
     