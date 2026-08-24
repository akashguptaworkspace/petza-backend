/** For OTP-send responses — avoids echoing the full identifier back verbatim. */
export function maskEmail(email) {
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

export function maskPhone(phone) {
  return phone.replace(/^(.{3}).*(.{2})$/, '$1***$2');
}
