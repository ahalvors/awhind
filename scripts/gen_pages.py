#!/usr/bin/env python3
import os

CSS = '''
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  :root{
    --bg:#F1F2ED; --bg-elevated:#FFFFFF; --bg-sunken:#E7E8E1;
    --text:#0B0F17; --text-secondary:#566072; --text-tertiary:#848d9b;
    --line:#D9DAD2; --line-strong:#c2c4ba; --accent:#DD4E1E; --accent-contrast:#FFFFFF;
    --shadow: 0 1px 2px rgba(11,15,23,.04), 0 8px 24px rgba(11,15,23,.06);
    --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
    --sans: 'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0A0D14; --bg-elevated:#12161F; --bg-sunken:#080A10;
      --text:#EEF0F4; --text-secondary:#9AA3B4; --text-tertiary:#6d7688;
      --line:#232838; --line-strong:#323951; --accent:#FF7A47; --accent-contrast:#0A0D14;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
    }
  }
  :root[data-theme="dark"]{
    --bg:#0A0D14; --bg-elevated:#12161F; --bg-sunken:#080A10;
    --text:#EEF0F4; --text-secondary:#9AA3B4; --text-tertiary:#6d7688;
    --line:#232838; --line-strong:#323951; --accent:#FF7A47; --accent-contrast:#0A0D14;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0; background:var(--bg); color:var(--text); font-family:var(--sans); font-size:16px; line-height:1.55; -webkit-font-smoothing:antialiased;}
  a{color:inherit;}
  h1,h2,h3{font-family:var(--serif); font-weight:500; margin:0; text-wrap:balance; letter-spacing:-0.01em;}
  .mono{font-family:var(--mono);}
  .eyebrow{font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-secondary);}
  .wrap{max-width:1120px; margin:0 auto; padding:0 28px;}
  .btn{display:inline-flex; align-items:center; gap:8px; font-family:var(--mono); font-size:13px; letter-spacing:.04em; text-transform:uppercase; padding:12px 20px; border-radius:2px; text-decoration:none; cursor:pointer; border:1px solid transparent;}
  .btn-primary{background:var(--accent); color:var(--accent-contrast);}
  .btn-primary:hover{filter:brightness(1.06);}
  .btn-ghost{border-color:var(--line-strong); color:var(--text);}
  .btn-ghost:hover{border-color:var(--accent); color:var(--accent);}
  .btn-sm{padding:8px 14px; font-size:11px;}
  nav.wrap{display:flex; align-items:center; justify-content:space-between; padding-top:18px; padding-bottom:18px;}
  .brand{font-family:var(--serif); font-weight:600; font-size:21px; letter-spacing:-.01em; text-decoration:none; color:var(--text); display:flex; align-items:center; gap:9px;}
  .brand .mark{width:9px;height:9px;background:var(--accent);display:inline-block;}
  header.page-hero{padding:52px 0 44px; border-bottom:1px solid var(--line);}
  header.page-hero h1{font-size:38px; line-height:1.14; margin-top:14px; max-width:820px;}
  header.page-hero .lede{font-size:17px; color:var(--text-secondary); max-width:640px; margin-top:16px;}
  article{max-width:720px; margin:0 auto; padding:44px 28px 20px;}
  article section{margin-bottom:36px;}
  article h2{font-size:24px; margin-bottom:14px;}
  article p{margin:0 0 16px; font-size:15.5px; color:var(--text);}
  article p.dek{font-size:16px; color:var(--text-secondary); font-family:var(--serif); font-style:italic; margin-bottom:8px;}
  article strong{font-weight:600;}
  article .stat-inline{font-family:var(--mono); color:var(--accent); font-weight:600;}
  article ul, article ol{padding-left:22px; margin:0 0 16px;}
  article li{margin-bottom:8px; font-size:15.5px;}
  .related-row{display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;}
  .cta-band{background:var(--bg-elevated); border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:40px 0; margin:44px 0;}
  .cta-band .wrap{max-width:720px;}
  footer{padding:40px 0; }
  footer .wrap{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;}
  footer .copy{font-size:12px; color:var(--text-tertiary); font-family:var(--mono);}
  footer a{font-size:12px; color:var(--text-secondary); text-decoration:none; margin-right:16px;}
  footer a:hover{color:var(--accent);}
'''

NAV = '''<nav class="wrap">
  <a href="/" class="brand"><span class="mark"></span>AWHIND</a>
  <div>
    <a href="/#services" class="btn btn-ghost btn-sm" style="margin-right:8px;">Capabilities</a>
    <a href="/#contact" class="btn btn-ghost btn-sm">Talk to Us</a>
  </div>
</nav>'''

def footer():
    return '''<footer>
  <div class="wrap">
    <div>
      <a href="/">Home</a><a href="/#briefing">Daily Briefing</a><a href="/shadow-ai">What Is Shadow AI?</a><a href="/#contact">Contact</a>
    </div>
    <div class="copy">&copy; 2026 AWHIND. All rights reserved.</div>
  </div>
</footer>'''

def page(slug, title_tag, meta_desc, eyebrow, h1, lede, sections, related, canonical_path):
    canonical = f"https://awhind.com{canonical_path}"
    sections_html = ""
    for sec in sections:
        sections_html += f'    <section>\n      <h2>{sec["h2"]}</h2>\n'
        for p in sec["body"]:
            sections_html += f'      <p>{p}</p>\n'
        if "list" in sec:
            tag = sec.get("list_tag", "ul")
            sections_html += f'      <{tag}>\n'
            for item in sec["list"]:
                sections_html += f'        <li>{item}</li>\n'
            sections_html += f'      </{tag}>\n'
        sections_html += '    </section>\n'

    related_html = "\n".join(
        f'      <a class="btn btn-ghost btn-sm" href="{href}">{label}</a>' for label, href in related
    )

    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{meta_desc}">
<title>{title_tag}</title>
<link rel="canonical" href="{canonical}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='16' fill='%230B0F17'/%3E%3Ccircle cx='50' cy='50' r='16' fill='%23DD4E1E'/%3E%3C/svg%3E">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="AWHIND">
<meta property="og:title" content="{title_tag}">
<meta property="og:description" content="{meta_desc}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{title_tag}">
<meta name="twitter:description" content="{meta_desc}">

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{h1_json_safe(h1)}",
  "description": "{meta_desc}",
  "url": "{canonical}",
  "publisher": {{
    "@type": "Organization",
    "name": "AWHIND",
    "url": "https://awhind.com"
  }}
}}
</script>

<style>{CSS}</style>
</head>
<body>

{NAV}

<header class="page-hero">
  <div class="wrap">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>
  </div>
</header>

<article>
{sections_html}
</article>

<div class="cta-band">
  <div class="wrap">
    <p class="eyebrow" style="margin-bottom:10px;">Related</p>
    <div class="related-row">
{related_html}
    </div>
  </div>
</div>

<div class="cta-band" style="border-top:none; margin-top:0; padding-top:0;">
  <div class="wrap">
    <h2 style="font-size:22px; margin-bottom:10px;">Tell us what's actually on fire.</h2>
    <p style="color:var(--text-secondary); font-size:14.5px; margin-bottom:18px;">One conversation, no deck required.</p>
    <a href="mailto:hello@awhind.com?subject=Readiness%20Assessment%20Request" class="btn btn-primary">Email hello@awhind.com</a>
  </div>
</div>

{footer()}

</body>
</html>
'''

def h1_json_safe(s):
    return s.replace('"', '\\"')

# ---------------------------------------------------------------------------
# CONTENT
# ---------------------------------------------------------------------------

PAGES = []

PAGES.append(dict(
    slug="capabilities/service-desk",
    title_tag="Service Desk Operations with AI Oversight | AWHIND",
    meta_desc="AWHIND runs your service desk as an operating team, not a ticket queue — with shadow AI visibility built into every interaction, not bolted on after.",
    eyebrow="Capability 01 — Service Desk",
    h1="Your Service Desk Sees Everything First. It Should Be Watching for Shadow AI Too.",
    lede="Every unapproved AI tool starts as a conversation that touches the service desk eventually. Most desks are built to close tickets, not notice patterns. AWHIND's is built to do both.",
    sections=[
        dict(h2="What we actually run", body=[
            "Tier 1/2 support run to the SLAs you set — access issues, hardware, software troubleshooting, onboarding and offboarding — not a generic vendor default.",
        ], list=[
            "Ticket triage with context, not just category tags",
            "Shadow AI signal built into intake — flagged as part of the normal workflow, not discovered six months later in a security review",
            "Escalation paths that reach AI Governance and Endpoint Ops directly when a ticket turns out to be bigger than a ticket",
        ]),
        dict(h2="Why this is different from a standard outsourced desk", body=[
            "Most outsourced service desks are optimized for one number: time to close. That's fine for a password reset. It's the wrong metric for &ldquo;an employee just described using a tool nobody in IT has heard of.&rdquo;",
            "<strong>47% of enterprises name IT itself as the top source of shadow AI</strong> (WitnessAI, 2026) — which means the team running your desk needs to be watching itself too, not just the rest of the company.",
        ]),
        dict(h2="What you get", body=[], list=[
            "A service desk that resolves day-to-day volume without you thinking about it",
            "Ongoing visibility into what AI tools are actually showing up in employee requests",
            "A direct operational link between support tickets and your broader AI governance posture",
            "Reporting your audit committee can actually use, built from what's really happening",
        ]),
    ],
    related=[("AI Governance", "/capabilities/ai-governance"), ("Endpoint Ops", "/capabilities/endpoint-ops"), ("What Is Shadow AI?", "/shadow-ai")],
))

PAGES.append(dict(
    slug="capabilities/ai-governance",
    title_tag="AI Governance Framework for Enterprise IT | AWHIND",
    meta_desc="AWHIND builds and runs AI governance operationally — inventory, policy, and ongoing oversight — so your board hears about AI risk from you first.",
    eyebrow="Capability 02 — AI Governance",
    h1="AI Governance That Runs Day to Day, Not a Framework That Sits in a Binder",
    lede="Most AI governance work produces a document. AWHIND builds that foundation, but the actual product is operational — governance wired into service desk, endpoint, and network signal as it happens.",
    sections=[
        dict(h2="What we actually run", body=[], list=[
            "AI tool inventory, continuously maintained — not a one-time audit that goes stale next quarter",
            "Policy specific enough to act on — concrete boundaries on what data categories can and can't go into third-party AI tools",
            "Approval pathways fast enough to actually use — the biggest driver of shadow AI is a slow or missing approval process",
            "Audit committee and board reporting, built from operational reality and delivered on a cadence that means no surprises",
            "Agentic AI oversight — as agents move from chat tools to systems that take actions, governance has to extend to what they're authorized to touch",
        ]),
        dict(h2="Why this sits with operations, not just policy", body=[
            "<strong>80% of enterprises lack a mature governance model for agentic AI</strong> (Deloitte, State of AI in the Enterprise, 2026) — and the gap between &ldquo;we have a policy&rdquo; and &ldquo;we know what's actually happening&rdquo; is exactly where shadow AI lives.",
            "It's usually IT operations, not the policy team, that has the visibility to close that gap — which is why AWHIND runs governance as part of the same operating team handling your service desk, endpoint management, and NOC.",
        ]),
        dict(h2="What you get", body=[], list=[
            "A defensible, current answer when a client, auditor, or board member asks what AI is actually running",
            "Policy your employees follow because it's specific, not a policy they route around because it's vague",
            "Ongoing monitoring instead of an annual point-in-time review",
            "A direct line from operational signal to governance action — no handoff gap",
        ]),
    ],
    related=[("Service Desk", "/capabilities/service-desk"), ("What Is Shadow AI?", "/shadow-ai"), ("Global NOC", "/capabilities/global-noc")],
))

PAGES.append(dict(
    slug="capabilities/endpoint-ops",
    title_tag="Endpoint Management &amp; Modernization Services | AWHIND",
    meta_desc="AWHIND manages and modernizes your fleet with AI-tool visibility built into endpoint monitoring — so shadow AI shows up in telemetry, not a surprise audit.",
    eyebrow="Capability 03 — Endpoint Ops",
    h1="Every Device Is a Window Into What's Actually Running in Your Company",
    lede="Endpoints are where shadow AI actually leaves a trail. AWHIND manages and modernizes your fleet with that visibility built into the baseline, not layered on as a separate security project.",
    sections=[
        dict(h2="What we actually run", body=[], list=[
            "Fleet management and modernization — provisioning, patching, lifecycle management, standardization",
            "Application and extension visibility — including the browser extensions and background AI integrations a standard software inventory misses",
            "Policy enforcement that's practical, not theoretical — device-level controls that reflect your actual AI data-handling policy",
            "Signal routing into governance — endpoint telemetry flows into the same operational loop as service desk and NOC signal",
        ]),
        dict(h2="Why this matters more than it used to", body=[
            "The average enterprise employee now uses roughly <strong>14 AI tools</strong>, while IT is typically aware of only <strong class='stat-inline'>4 to 5</strong> of them. Endpoints are the earliest, most reliable place that gap actually closes — because AI tools mostly arrive as a browser extension or desktop app before anyone files a ticket.",
        ]),
        dict(h2="What you get", body=[], list=[
            "A modernized, well-managed fleet without the operational overhead landing on your internal team",
            "Real visibility into what's installed and running — including the AI tools nobody formally requested",
            "Endpoint signal that feeds directly into AI governance and service desk operations",
            "Fewer surprises, because the earliest indicator of shadow AI usage is being watched, not ignored",
        ]),
    ],
    related=[("AI Governance", "/capabilities/ai-governance"), ("Global NOC", "/capabilities/global-noc"), ("Service Desk", "/capabilities/service-desk")],
))

PAGES.append(dict(
    slug="capabilities/global-noc",
    title_tag="Global Network Operations Center (NOC) Services | AWHIND",
    meta_desc="AWHIND's global NOC monitors your network around the clock — and watches for the traffic patterns that mean AI tools are moving your data somewhere new.",
    eyebrow="Capability 04 — Global NOC",
    h1="Round-the-Clock Network Operations — With an Eye on Where Your Data Is Actually Going",
    lede="A global NOC is table stakes for enterprise IT. AWHIND runs that as the baseline and layers in visibility into the traffic patterns that indicate AI tool usage nobody provisioned.",
    sections=[
        dict(h2="What we actually run", body=[], list=[
            "24/7 network monitoring across time zones — real coverage, not a follow-the-sun handoff with gaps",
            "Incident detection and response — network health, outages, and anomalies triaged before they become business-impacting",
            "Traffic pattern analysis for unauthorized AI usage — API traffic to known and emerging AI services, tracked as standard monitoring",
            "Coordinated escalation — findings connect back to service desk, endpoint ops, and AI governance rather than dead-ending in a NOC dashboard",
        ]),
        dict(h2="Why this matters more than a standard NOC contract", body=[
            "Most NOC providers monitor for what they were told to monitor for. Shadow AI traffic doesn't look like an outage or a breach — it looks like normal, if unfamiliar, outbound traffic to a legitimate service. A NOC that isn't specifically watching for this pattern monitors right past it.",
        ]),
        dict(h2="What you get", body=[], list=[
            "Full network operations coverage, around the clock, without building an internal NOC team",
            "Traffic-level visibility into AI tool usage that endpoint and service desk signal alone can miss",
            "One coordinated operating picture instead of three separate reports that never get cross-referenced",
            "Faster answers when leadership asks whether you actually know what's touching your network",
        ]),
    ],
    related=[("Endpoint Ops", "/capabilities/endpoint-ops"), ("AI Governance", "/capabilities/ai-governance"), ("What Is Shadow AI?", "/shadow-ai")],
))

PAGES.append(dict(
    slug="shadow-ai",
    title_tag="What Is Shadow AI? Enterprise Risk &amp; Governance | AWHIND",
    meta_desc="Shadow AI is every AI tool your employees use that IT never approved. Here's how it happens, what it costs you, and how to govern it without banning it.",
    eyebrow="Glossary",
    h1="Shadow AI Is Already Inside Your Company. Here's What That Actually Means.",
    lede="Shadow AI is any AI tool an employee uses for work that IT never approved, never inventoried, and never assessed for what it's doing with your data.",
    sections=[
        dict(h2="How shadow AI actually shows up", body=[
            "It rarely looks like defiance. It's a marketing coordinator pasting a client brief into a free AI writing tool to save an hour. A developer running an unapproved coding assistant against a private repo. A finance analyst uploading a spreadsheet to summarize it, not thinking about where that data goes next.",
        ], list=[
            "Free-tier AI tools substituting for missing enterprise ones",
            "Browser extensions that quietly route data through a third-party AI backend",
            "&ldquo;Just this once&rdquo; exceptions that never get walked back",
            "AI features bundled into tools you already pay for, opted in by default",
        ]),
        dict(h2="What it actually costs you", body=[
            "<strong>47% of enterprises name IT itself as the top source of shadow AI</strong> (WitnessAI, 2026). Data leaves the building without a paper trail. Compliance frameworks like SOC 2 and ISO 27001 assume you know what's running — shadow AI usage makes that attestation false, whether or not anyone realizes it at the time. And <strong>80% of enterprises still lack a mature governance model for agentic AI</strong> (Deloitte), which means most boards find out about this at the worst possible moment: during an audit, an incident, or a client's security review.",
        ]),
        dict(h2="Why &ldquo;just ban it&rdquo; doesn't work", body=[
            "Block access without replacing the capability, and usage doesn't stop — it moves to personal devices and personal accounts, which is strictly worse for visibility.",
        ], list=[
            "Inventory what's actually being used, not what's officially sanctioned",
            "Provide a fast, approved path for the legitimate use cases driving shadow adoption",
            "Set data-handling boundaries specific enough to act on",
            "Put ownership somewhere real, operationally — not split across IT, security, and legal with no one accountable",
            "Make this visible on an ongoing basis, not a one-time audit",
        ]),
        dict(h2="Where this fits into IT operations, not just policy", body=[
            "Governance without operational teeth is a document nobody reads twice. Shadow AI visibility has to live inside the systems that already touch every endpoint and every ticket — service desk, endpoint management, network operations — because that's where the actual signal is.",
            "That's the operating model AWHIND is built around: governance wired into service desk, endpoint ops, and NOC monitoring day to day, not a framework that sits in a binder next to the acceptable use policy.",
        ]),
    ],
    related=[("Service Desk", "/capabilities/service-desk"), ("AI Governance", "/capabilities/ai-governance"), ("The Daily Briefing", "/#briefing")],
))

# ---------------------------------------------------------------------------
# WRITE FILES
# ---------------------------------------------------------------------------

base = os.path.dirname(os.path.abspath(__file__))
root = os.environ.get("AWHIND_ROOT", ".")

for p in PAGES:
    out_dir = os.path.join(root, p["slug"])
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "index.html")
    html = page(
        slug=p["slug"],
        title_tag=p["title_tag"],
        meta_desc=p["meta_desc"],
        eyebrow=p["eyebrow"],
        h1=p["h1"],
        lede=p["lede"],
        sections=p["sections"],
        related=p["related"],
        canonical_path="/" + p["slug"],
    )
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {out_path} ({len(html)} bytes)")
