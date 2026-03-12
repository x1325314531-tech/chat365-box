// phone-identifier.js
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { countryNameMap, localCarrierRules } from './phone-data.js';

/**
 * 全球手机号识别引擎
 * @param {string} input - 原始手机号 (建议带 + 号)
 */
export function getGlobalIdentification(input) {
  // 1. 解析号码
  const phoneNumber = parsePhoneNumberFromString(input);

  if (!phoneNumber || !phoneNumber.isValid()) {
    return { success: false, message: "无效号码" };
  }

  const isoCode = phoneNumber.country; // 例如: "CN"
  const nationalNumber = phoneNumber.nationalNumber;
  
  // 2. 获取国家中文名
  const countryName = countryNameMap[isoCode] || `其他国家/地区 (${isoCode})`;

  // 3. 识别运营商 (仅对有规则定义的国家执行)
  let carrier = "国际运营商";
  const rules = localCarrierRules[isoCode];
  
  if (rules) {
    for (const rule of rules) {
      if (rule.reg.test(nationalNumber)) {
        carrier = rule.name;
        break;
      }
    }
  }

  return {
    success: true,
    data: {
      location: countryName,          // 归属国家
      carrier: carrier,               // 运营商
      e164: phoneNumber.format('E.164'),
      international: phoneNumber.formatInternational(), // +86 138 0000 0000
      type: phoneNumber.getType()     // MOBILE / FIXED_LINE
    }
  };
}