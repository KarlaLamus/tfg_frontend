export const DEFAULT_CLIENT_COUNTRY_CODE = '34';

const LETTERS_ONLY_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const normalizeClientCountryCode = (value: string) => digitsOnly(value).slice(0, 4);

export const normalizeClientPhoneNumber = (value: string) => digitsOnly(value).slice(0, 9);

export const buildClientPhoneValue = (countryCode: string, phoneNumber: string) => {
  const normalizedCountryCode =
    normalizeClientCountryCode(countryCode) || DEFAULT_CLIENT_COUNTRY_CODE;
  const normalizedPhoneNumber = normalizeClientPhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return `+${normalizedCountryCode}`;
  }

  return `+${normalizedCountryCode} ${normalizedPhoneNumber}`;
};

export const parseClientPhoneValue = (phone: string) => {
  const normalizedDigits = digitsOnly(phone);

  if (!normalizedDigits) {
    return {
      countryCode: DEFAULT_CLIENT_COUNTRY_CODE,
      phoneNumber: '',
    };
  }

  if (normalizedDigits.length <= 9) {
    return {
      countryCode: DEFAULT_CLIENT_COUNTRY_CODE,
      phoneNumber: normalizedDigits,
    };
  }

  return {
    countryCode: normalizedDigits.slice(0, -9) || DEFAULT_CLIENT_COUNTRY_CODE,
    phoneNumber: normalizedDigits.slice(-9),
  };
};

export const isClientTextOnly = (value: string) => LETTERS_ONLY_PATTERN.test(value.trim());
