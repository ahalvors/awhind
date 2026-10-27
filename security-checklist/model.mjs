// Small-Business IT Security Checklist: pure data + scoring. No storage, no network.
export const areas = ['Accounts & MFA','Passwords','Backups','Updates & patching','Email security','Devices','Wi-Fi & network','Admin accounts','People','Incident readiness'];
// [id, areaIndex, question, fix-if-no]
export const questions = [
['mfa-email',0,'Is multi-factor authentication (MFA) turned on for every email account?','Turn on MFA for every mailbox in Microsoft 365 or Google Workspace. Use an authenticator app or security key rather than text messages where you can. Email is the master key to everything else.'],
['mfa-other',0,'Is MFA on for banking, payroll, cloud storage and other key business apps?','List the apps that hold money or customer data (bank, payroll, accounting, file storage) and switch on MFA in each one’s security settings.'],
['pw-manager',1,'Does everyone use a password manager for work accounts?','Roll out a business password manager (such as Bitwarden or 1Password) and have staff move work logins into it. It makes long, unique passwords effortless.'],
['pw-unique',1,'Are work passwords unique, never reused across sites or shared on sticky notes?','Use the password manager to replace reused or shared passwords, starting with email, banking and admin accounts. Give shared logins their own vault entry instead of passing them around.'],
['backup-auto',2,'Are important files and systems backed up automatically?','Set up automatic daily backups for file shares, laptops and cloud data (Microsoft 365 and Google data are not fully backed up by default).'],
['backup-offsite',2,'Is at least one backup copy kept offline or offsite, out of ransomware’s reach?','Follow the 3-2-1 rule: three copies, two kinds of storage, one copy offsite or immutable so ransomware can’t encrypt it.'],
['backup-test',2,'Have you actually restored something from backup to prove it works?','Pick a file and a full system and do a test restore now, then repeat on a regular schedule. An untested backup is a guess.'],
['updates-auto',3,'Are operating system and app updates installed automatically on all computers and phones?','Turn on automatic updates for Windows, macOS, phones and browsers, and set a short deadline for restarts so updates actually finish.'],
['updates-network',3,'Are routers, firewalls and other network gear kept on current firmware?','Log in to your router and firewall, apply available firmware updates, and replace any device that no longer gets security updates.'],
['email-auth',4,'Is your email domain protected with SPF, DKIM and DMARC records?','Ask your email or DNS provider to publish SPF and DKIM records and a DMARC policy. Start DMARC at monitoring, then move to quarantine or reject so others can’t spoof your domain.'],
['email-filter',4,'Is spam and malicious-link filtering turned on for your email?','Enable the built-in protection in Microsoft 365 (Defender) or Google Workspace, including attachment scanning and safe-link checks.'],
['device-encrypt',5,'Are laptops and desktops encrypted (BitLocker or FileVault)?','Turn on BitLocker (Windows) or FileVault (Mac) on every computer and store the recovery keys somewhere safe that isn’t the laptop itself.'],
['device-lock',5,'Do all devices lock automatically and require a PIN, password or biometric?','Set screens to lock after a few minutes of inactivity and require a PIN or password on every phone and computer that touches work data.'],
['wifi-secure',6,'Is office Wi-Fi protected with WPA2/WPA3 and a strong, non-default password?','Change the router’s default admin and Wi-Fi passwords, use WPA2 or WPA3 encryption, and turn off WPS.'],
['wifi-guest',6,'Do guests and personal gadgets use a separate guest network?','Create a guest Wi-Fi network that’s isolated from your business computers, printers and file shares.'],
['admin-separate',7,'Do staff use everyday accounts without admin rights for normal work?','Remove local admin rights from daily-use accounts and keep a separate admin account for installs and changes. Most malware can only do what the logged-in user can.'],
['admin-offboard',7,'When someone leaves, are their accounts and access removed the same day?','Write a short offboarding checklist (email, apps, shared passwords, devices) and run it on the person’s last day.'],
['phishing-training',8,'Has your team had phishing awareness training recently, with a clear way to report suspicious email?','Run short, regular phishing training and give staff one simple way to report a suspicious message — and thank them when they do.'],
['incident-plan',9,'Do you have a written plan for what to do if you’re hacked, including who to call?','Write a one-page incident plan: who decides, who to call (IT help, bank, insurer), how to disconnect affected machines, and where offline copies of key contacts live.'],
];
export const VALID = new Set(['yes','no']);
export function score(answers = {}) {
  let yes = 0, answered = 0; const fixes = [];
  for (const [id, area, q, fix] of questions) {
    const a = answers[id];
    if (!VALID.has(a)) continue;
    answered++;
    if (a === 'yes') yes++; else fixes.push({ id, area: areas[area], question: q, fix });
  }
  const total = questions.length;
  const percent = Math.round((yes / total) * 100);
  let rating = 'Not started';
  if (answered > 0) rating = percent >= 90 ? 'Strong' : percent >= 70 ? 'Solid, with gaps' : percent >= 40 ? 'Needs attention' : 'High risk';
  return { yes, answered, total, percent, rating, fixes };
}
