/** One password rule for the whole app (server and browser): 8 to 200 characters, and not an obvious password. */
export const PASSWORD_MIN=8,PASSWORD_MAX=200;
export const PASSWORD_RULE='Use a password of 8–200 characters.';
const COMMON=new Set(['12345678','123456789','1234567890','11111111','00000000','87654321','password','password1','password12','password123','passw0rd','qwertyui','qwerty123','qwertyuiop','iloveyou','letmein1','welcome1','admin123','abc12345','football','unitedgaming','uniongaming','costarica','pura vida','puravida']);
/** Returns a message when the password is not allowed, or null when it is fine. */
export function passwordProblem(password:string,username?:string):string|null{
  if(password.length<PASSWORD_MIN||password.length>PASSWORD_MAX)return PASSWORD_RULE;
  const lower=password.toLowerCase();
  if(COMMON.has(lower)||/^(.)\1+$/.test(password))return 'That password is too easy to guess. Pick something less common.';
  if(username&&username.length>=4&&lower===username.toLowerCase())return 'Your password cannot be the same as your username.';
  return null;
}
