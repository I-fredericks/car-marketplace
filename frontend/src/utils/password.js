// Client-side mirror of the backend password policy (min 8 + common list):
// keeps the UX instant while the server remains the enforcer.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', 'abc12345', 'passw0rd',
]);

/**
 * Returns an error string for invalid passwords, or '' when acceptable.
 */
export function passwordProblem(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common — choose something less guessable.';
  }
  return '';
}
