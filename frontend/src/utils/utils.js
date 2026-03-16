export function toQueryString(params) { 
  const queryString = new URLSearchParams();
    
    // 添加所有参数
    Object.keys(params).forEach(key => {
      const value = params[key];
      
      // 处理数组类型参数
      if (Array.isArray(value)) {
        value.forEach(item => {
          queryString.append(key, item);
        });
      } else if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, value.toString());
      }
    });
    return queryString
}