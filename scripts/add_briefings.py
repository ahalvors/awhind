#!/usr/bin/env python3
"""Add the four approved briefings to posts.json"""
import json
from pathlib import Path

# Manually constructed entries from the approved markdown files
new_briefings = [
    {
        "date": "2026-11-06",
        "tag": "Patch",
        "read": "3 min",
        "title": "There's no patch yet for D-Link's DGS-3130 Discovery Protocol flaws. Disable DDP, drop default SNMP, and keep management off the internet",
        "dek": "D-Link published an interim advisory for unpatched flaws in the DGS-3130-30TS managed switch's Discovery Protocol. Until firmware ships, disable DDP, remove default SNMP community strings, and keep SSH, the web page and SNMP on a management network only. Separately, DigiCert says an exposed archive let outsiders read business contacts, and for some customers, ID documents used in validation.",
        "body": [
            "On Nov 6, D-Link published an interim security advisory for multiple unpatched flaws in its DGS-3130-30TS managed switch, found in the D-Link Discovery Protocol (DDP) and parts of the firmware, per <a href=\"https://www.bleepingcomputer.com/news/security/d-link-warns-of-multiple-zero-days-in-dgs-3130-series-switches/\" target=\"_blank\" rel=\"noopener\">BleepingComputer</a> and D-Link's <a href=\"https://supportannouncement.us.dlink.com/security/publication.aspx?name=SAP10523\" target=\"_blank\" rel=\"noopener\">SAP10523</a>. The company has not released fixed firmware yet, and CVE identifiers are not public. Other DGS-3130 models and other D-Link switch lines are still under investigation.",
            "<strong>What the flaws can do.</strong> An attacker who can reach the switch on the network may be able to read device and network settings, change admin credentials, expose SNMP community strings, reset the switch, or disrupt service. Separate findings cover SSH configuration, how the device protects operating-system credentials, and firmware encryption. Disabling DDP cuts the main known DDP attack path, but D-Link says it does not fix those other firmware issues.",
            "<strong>Why small businesses should care.</strong> The DGS-3130 is aimed at small and mid-size offices and metro Ethernet setups. Like the Zyxel GS1900 story earlier this week, a managed switch that sits forgotten in a closet is still in the middle of every office conversation. There is no patch to install today, so the interim steps matter.",
            "<strong>Action item: Mitigate until firmware ships.</strong><br>1. <strong>Check the label.</strong> Look for \"DGS-3130,\" especially a DGS-3130-30TS. Note the hardware revision and firmware version before you change anything.<br>2. <strong>Disable DDP.</strong> On the switch CLI, use <code>no ddp</code> in global and interface configuration, confirm with <code>show ddp</code>, then save so the setting survives a reboot. D-Link says this is the primary interim step for the DDP findings.<br>3. <strong>Remove default SNMP communities.</strong> Delete <code>public</code> and <code>private</code> (and any other unused communities). If you still need SNMP, prefer SNMPv3 with authentication, limited to known admin hosts.<br>4. <strong>Keep management off the internet.</strong> Restrict SSH, the web UI and SNMP to a small management network or named admin machines. Save an offline config backup, and watch logs for unexpected reboots, config changes or factory resets.<br>5. <strong>Watch for the real fix.</strong> Follow D-Link's <a href=\"https://supportannouncement.us.dlink.com/security/publication.aspx?name=SAP10523\" target=\"_blank\" rel=\"noopener\">SAP10523</a> advisory. When firmware ships, match model and hardware revision before you install it.",
            "Not sure what's in your network closet? Call us at +1 (689) 225-0286, or start with the free <a href=\"https://awhind.com/security-checklist/\" target=\"_blank\" rel=\"noopener\">security checklist</a>.",
            "<strong>Second item: DigiCert customers, expect fake \"re-upload your ID\" emails.</strong> DigiCert says an archive system that held business customer records was left reachable from the internet after a network move, and an attacker used a self-registration feature (no MFA) to create a read-only account, per <a href=\"https://www.securityweek.com/digicert-data-breach-impacts-business-customer-information/\" target=\"_blank\" rel=\"noopener\">SecurityWeek</a>. That account could read names, emails, phones and business addresses between June 27 and July 2. For some customers, driver's licenses, passports or utility bills used in validation were also exposed. DigiCert says certificate systems were not affected and certificates still work.",
            "&bull; <strong>Open CertCentral by typing the address</strong>, not from a scary message asking you to re-upload an ID or \"fix validation.\"<br>&bull; <strong>Treat unexpected DigiCert mail as phishing</strong> until you check it inside the real portal."
        ],
        "sources": [
            ["BleepingComputer: D-Link DGS-3130 (Nov 6)", "https://www.bleepingcomputer.com/news/security/d-link-warns-of-multiple-zero-days-in-dgs-3130-series-switches/"],
            ["D-Link SAP10523", "https://supportannouncement.us.dlink.com/security/publication.aspx?name=SAP10523"],
            ["SecurityWeek: DigiCert (Nov 6)", "https://www.securityweek.com/digicert-data-breach-impacts-business-customer-information/"]
        ]
    },
    {
        "date": "2026-11-05",
        "tag": "Patch",
        "read": "2 min",
        "title": "The Zyxel switch fix everyone installed didn't stop the hack. Update GS1900 switches again and lock down their web page",
        "dek": "About 1,000 Zyxel GS1900 switches were hacked in August through a flaw nobody knew about, not the older bug that got the blame and the patch. Zyxel shipped the real fix on Oct 23.",
        "body": [
            "In September, GreyNoise reported that attackers had hacked roughly 1,000 Zyxel GS1900 network switches in August, and blamed CVE-2026-7273, a bug Zyxel patched in June. CISA added that bug to its exploited list. Now Binarly says the attackers were actually using a different, unknown flaw, so the June patch did nothing to stop them, per <a href=\"https://www.securityweek.com/zyxel-switch-hacks-blamed-on-patched-flaw-actually-exploited-a-zero-day/\" target=\"_blank\" rel=\"noopener\">SecurityWeek</a>.",
            "<strong>What the flaw does.</strong> The new bug, CVE-2026-107441 (CVSS 8.8), lets an attacker who hasn't logged in run commands on the switch by sending crafted web requests. It affects 10 GS1900 models. Zyxel released fixes on Oct 23 and published its advisory on Nov 3. The attacks have been linked to a Chinese group GreyNoise calls Red Heron.",
            "<strong>Why small businesses should care.</strong> The GS1900 is an affordable managed switch, the kind that ends up in a small office closet and gets forgotten. If you patched in June and thought you were done, you weren't. A hacked switch sits in the middle of all your office traffic.",
            "<strong>Action item: Check your switch this week.</strong><br>1. <strong>Find out if you have one.</strong> Look at the label on the switches in your network closet, or ask whoever set up your network. You're looking for \"GS1900.\"<br>2. <strong>Install firmware released on or after Oct 23.</strong> Check Zyxel's Nov 3 advisory for your exact model and fixed version.<br>3. <strong>Keep the switch's web page off the internet.</strong> Its management page should be reachable only from inside your office, never from outside.<br>4. <strong>If it was ever exposed online,</strong> assume it may have been touched. Update it, change its admin password, and consider a factory reset.",
            "Not sure what's in your network closet? Call us at +1 (689) 225-0286."
        ],
        "sources": [
            ["SecurityWeek (Nov 5)", "https://www.securityweek.com/zyxel-switch-hacks-blamed-on-patched-flaw-actually-exploited-a-zero-day/"]
        ]
    },
    {
        "date": "2026-11-04",
        "tag": "Threat",
        "read": "3 min",
        "title": "A Google Calendar invite from someone you know got past MFA. Move key accounts to passkeys, and mSecure users should reset now",
        "dek": "A phishing operation sent calendar invites from real, hacked accounts that led to a live copy of Google's sign-in page, relaying text codes, app codes and push approvals to steal whole sessions. Separately, mSecure told current and former customers to change passwords after an encrypted vault database was reportedly stolen.",
        "body": [
            "Since mid-August, a phishing operation has been stealing live Google sessions from corporate users, per <a href=\"https://www.bleepingcomputer.com/news/security/google-calendar-phishing-campaign-hijacks-sessions-bypasses-mfa/\" target=\"_blank\" rel=\"noopener\">BleepingComputer</a>, reporting on research by Material Security. The lures arrived as Google Calendar invites, often from an organization the victim had already emailed with. The pretexts were boring on purpose: voicemail notices, RFP requests, court summonses, missed payments.",
            "<strong>How it beat MFA.</strong> The links mostly pointed at Google's own redirector, Google Drive or share.google, so every reputation check came back clean. Behind them sat a live relay in front of the real Google sign-in page. Victims typed their password, got a real prompt, approved it, and the attacker passed every code to Google in real time: text codes, authenticator codes, number matching, even phone-based recovery. The attacker walked away with the signed-in session, which reaches mail, Drive, and the power to grant app access in the victim's name. Material counted 8,570 hacked sender addresses across 6,354 domains in one month, and says the operator has an unused Microsoft 365 version ready to go.",
            "<strong>Why small businesses should care.</strong> Your team trusts invites from customers and vendors. In this campaign, those were exactly the accounts sending the bait. And MFA codes and push prompts, the protection most small offices rely on, didn't stop it.",
            "<strong>Action item: Close the gap MFA left open.</strong><br>1. <strong>Move key accounts to passkeys or security keys.</strong> Start with owners, whoever pays bills, and whoever runs IT. A passkey won't sign in to a lookalike page, so it can't be relayed.<br>2. <strong>Tell staff the rule:</strong> a sign-in prompt you didn't expect gets a \"no,\" and a sign-in page reached from an invite link gets closed. Go to the site directly instead.<br>3. <strong>Limit who can drop events on your calendar.</strong> In Google Calendar on a computer: Settings, Event settings, \"Add invitations to my calendar,\" then \"Only if the sender is known.\"<br>4. <strong>Know how to kill a session.</strong> If someone thinks they signed in through a strange link, sign them out everywhere, reset the password, and check which apps have access. Practice doing it in under an hour.",
            "Want help switching your office to passkeys? Call us at +1 (689) 225-0286, or start with the free <a href=\"https://awhind.com/security-checklist/\" target=\"_blank\" rel=\"noopener\">security checklist</a>.",
            "<strong>Second item: mSecure users, reset your passwords.</strong> mSeven Software told current and former mSecure customers on Nov 3 to change passwords, reset two-factor, and remove passkeys stored in the app, per <a href=\"https://www.bleepingcomputer.com/news/security/msecure-password-manager-hack-prompts-password-reset-warnings/\" target=\"_blank\" rel=\"noopener\">BleepingComputer</a>. Support replies shared by customers say a hacker stole an encrypted database from mSecure Cloud, affecting users who synced through it. The company says it has no evidence the encrypted contents were accessed. But a stolen vault can be attacked offline for as long as the attacker likes, and a new master password doesn't change the copy they already have.",
            "&bull; <strong>If you synced mSecure to its cloud,</strong> change your most important passwords first: email, bank, payroll, and your domain registrar.<br>&bull; <strong>Then reset two-factor</strong> on those accounts, and replace any passkeys stored in mSecure."
        ],
        "sources": [
            ["BleepingComputer: Calendar phishing (Nov 4)", "https://www.bleepingcomputer.com/news/security/google-calendar-phishing-campaign-hijacks-sessions-bypasses-mfa/"],
            ["BleepingComputer: mSecure (Nov 4)", "https://www.bleepingcomputer.com/news/security/msecure-password-manager-hack-prompts-password-reset-warnings/"]
        ]
    },
    {
        "date": "2026-11-03",
        "tag": "AI Safety",
        "read": "3 min",
        "title": "Stolen AI keys are running up bills of $100,000 a day. Find yours, cap them, and turn on billing alerts",
        "dek": "Google says attackers are stealing AI API keys and cloud tokens and burning through victims' AI budgets, with charges topping $100,000 in a single day and reaching $1 million at some organizations. If anyone on your team built something with an AI key, this week is the week to find out where it lives.",
        "body": [
            "On Nov 3, Google Threat Intelligence Group and Mandiant warned about \"LLMjacking,\" per <a href=\"https://thehackernews.com/2026/11/google-warns-llmjacking-attacks-are.html\" target=\"_blank\" rel=\"noopener\">The Hacker News</a>. An attacker gets hold of an organization's AI API key or cloud login, then uses its AI services while the real owner pays the bill. Google says it saw fraudulent charges above $100,000 in a single day, and cumulative charges at some organizations reached $1 million before access was revoked.",
            "<strong>How the keys get out.</strong> Google says the most common way in was exposed or stolen cloud credentials: service account keys, GitHub personal access tokens, and live session tokens. It also found AI keys picked up from public GitHub repositories, and keys exposed through phishing, misconfigured setups, and code that runs in the browser. Unlike cryptomining, which drains resources slowly, Google says this can spike a bill \"in a matter of hours.\" The stolen access is then resold on underground services, one of which offers \"unlimited\" access to a top AI model for about $60 a month.",
            "<strong>Why small businesses should care.</strong> You don't need a data science team to be exposed. A contractor who built your chatbot, a staffer who connected an AI tool to a spreadsheet, or a developer who pasted a key into a website's code can all leave a key that bills your card. I wire AI services into a lot of builds, and the key is always the part I check first.",
            "<strong>Action item: Find and fence your AI keys.</strong><br>1. <strong>Make a list.</strong> Ask everyone, including outside developers, which AI services (OpenAI, Anthropic, Google, and so on) they've set up with a company card, and where each key is stored.<br>2. <strong>Set a spending cap and a billing alert</strong> on every AI and cloud account. A $50 alert you get today beats a $50,000 invoice next month.<br>3. <strong>Get keys out of code.</strong> Keys should never sit in a website's front-end code or a public GitHub repo. If one ever did, delete it and create a new one.<br>4. <strong>Delete what you don't use.</strong> Old keys and unused service accounts are free doors for an attacker.",
            "Want a one-page list of the rest? Our free <a href=\"https://awhind.com/security-checklist/\" target=\"_blank\" rel=\"noopener\">security checklist</a> covers it.",
            "<strong>Also today</strong>",
            "&bull; <strong>Only install AI coding tools from the vendor.</strong> Symantec and Carbon Black described a gray-market service that installs the real Codex and Claude Code tools, then rewrites their settings to switch off safety sandboxing and route every request through its own servers, per the same <a href=\"https://thehackernews.com/2026/11/google-warns-llmjacking-attacks-are.html\" target=\"_blank\" rel=\"noopener\">Hacker News report</a>. It mainly targets regions where those vendors don't operate, but the lesson travels: don't run a one-line setup command from an unofficial site."
        ],
        "sources": [
            ["The Hacker News (Nov 3)", "https://thehackernews.com/2026/11/google-warns-llmjacking-attacks-are.html"]
        ]
    }
]

def main():
    # Load existing posts.json
    posts_path = Path(__file__).parent.parent / 'posts.json'
    with open(posts_path) as f:
        posts = json.load(f)
    
    # Add new entries at the beginning (most recent first)
    posts = new_briefings + posts
    
    # Save back to posts.json
    with open(posts_path, 'w') as f:
        json.dump(posts, f, indent=2, ensure_ascii=False)
    
    print(f"Added {len(new_briefings)} entries to posts.json:")
    for b in new_briefings:
        print(f"  - {b['date']}: {b['title'][:60]}...")

if __name__ == '__main__':
    main()
