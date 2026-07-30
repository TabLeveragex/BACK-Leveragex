/**
 * Basic check for a Gmail / Googlemail address (not Google account verification).
 */
function isLegitGmailAddress(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) {
    return false;
  }

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    return false;
  }

  if (local.length < 1 || local.length > 64) {
    return false;
  }

  return /^[a-z0-9](?:[a-z0-9.+]*[a-z0-9])?$/.test(local);
}

module.exports = {
  isLegitGmailAddress,
};
