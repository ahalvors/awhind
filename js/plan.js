const NoPlanHeader = {
  // The following method is not used,
  // but if it is common for the header to overap the banner, we can use this.
  set: function() {
    const _this = this;
    let classFound = false;
    const headers = document.querySelectorAll("header");
    headers.forEach(header => {
      const hClass = header.getAttribute('class');
      if (hClass.includes('sticky')) classFound = true;
      header.classList.remove('sticky');
      header.classList.remove('top-0');
    });
    // DomContentLoaded did not work due to delayed vue template loading
    // so we use a timeout
    if (!classFound) {
      setTimeout(() => {
        _this.set();
      }, 500);
    }
  },
  // Intialize null, set later to keep the code a little cleaner.
  html: null,
}

/**
 * Run the check after the page has loaded and the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', async function () {
  const domainName = window.location.hostname.replace(/^www./, '');
  let data = null;
  // Do not check SitesGPT subdomains, which is the majority of traffic
  if(/.*\.(sitesgpt\.com|oursite\.co)/.test(domainName)) return false;

  const url = document.getElementById('api_base_url').value
    + '/api/v1/domain/plan-valid?name=' + domainName;
  const res = await fetch(url);
  try {
    data = await res.json();
  } catch (error) { data = null; }
  // data.ref_domain ensures that a referrer was sent to the API.
  // The referrer provides light validation that the endpoint accessed properly.
  if(data && data.ref_domain && !data.valid) {
    const homeUrl = document.getElementById('web_app_base_url').value
      + '?utm_source=customer_site&utm_medium=banner&utm_campaign=home';
    const cartUrl = data.site_uid ?
      document.getElementById('web_app_base_url').value
        + 'cart/' + data.site_uid
        + '?utm_source=customer_site&utm_medium=banner&utm_campaign=checkout'
        : homeUrl;
    const noPlanDiv = document.createElement('div');
    noPlanDiv.innerHTML = NoPlanHeader.html;
    noPlanDiv.querySelector('#upgrade_home_url').href = homeUrl;
    noPlanDiv.querySelector('#upgrade_cart_url').href = cartUrl;
    document.body.insertAdjacentHTML('afterbegin', noPlanDiv.outerHTML);
  }
});


NoPlanHeader.html = `
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap" rel="stylesheet">
<style>
  .no-plan-header {
    background-color:#01233ee6;
    padding:10px 1.5rem;
    display: flex;
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    font-family: 'Arial', sans-serif;
    justify-content: space-between;
    /*background: linear-gradient(45deg, #023f, #60af);*/
    /*background: linear-gradient(45deg, #023e, #206f);*/
    background: linear-gradient(45deg, #023, #206);
    position: sticky;
    top: 0;
    z-index:60;
    height: 80px;
  }
  .no-plan-header a {
    display:flex;
    align-items: center;
    gap: 1rem;
    font-family: 'Inter', sans-serif;
  }
  .no-plan-header a div {
    padding-right: 20px;
  }
  .no-plan-header-right-menu {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1rem;
  }
  .no-plan-header-right-menu span {
    padding-left: 20px;
  }
  .no-plan-header-right-menu a {
    text-decoration: underline;
    /*color: #07d;*/
    color: #5AC8FA;
    font-family: 'Arial', sans-serif;
  }
  .no-plan-header-right-menu a:hover {
    /*color: #5AC8FA;*/
    /*color: #4de;*/
    color: #5ef;
  }
  .no-plan-header-right-menu-item {
    display: flex;
    gap: 1rem;
    /*align-items: center;*/
  }
  @media (max-width: 768px) {
    .no-plan-header-right-menu a {
      font-size:.8rem;
    }
  }
  @media (max-width: 576px) {
    .no-plan-header {
      display: block;
      height: 130px;
    }
    .no-plan-header-right-menu span, .no-plan-header-right-menu a {
      padding-left: 0;
      padding-top: 10px;
      font-size: 1rem;
    }
    .no-plan-header-right-menu {
      display: block;
    }
  }
  @media (max-width: 480px) {
    .no-plan-header {
      height: 170px;
    }
  }
</style>
<div class="no-plan-header">
  <a href="/" class="">
    <svg style="width:38px;" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 38.8 38.8" class="site-header__logo-image"><g transform="rotate(45 39.228 33.249)"><linearGradient id="a" x1="15.495" x2="15.495" y1="55.191" y2="54.191" gradientTransform="scale(14.0625 -19.6875)rotate(45 76.22 10.522)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#07d;"></stop><stop offset="1" style="stop-color:#4de;"></stop></linearGradient><path d="M16.8 16.4v19.7h5.6V22c0-2.8-2.8-5.6-5.6-5.6m8.4 5.6v14.1h5.6v-8.4c.1-2.9-2.7-5.7-5.6-5.7" style="fill:url(#a);"></path></g><g transform="rotate(135 36.76 35.749)"><linearGradient id="b" x1="53.594" x2="53.594" y1="60.246" y2="61.246" gradientTransform="scale(-14.0625 19.6875)rotate(-45 -45.198 99.736)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#4de;"></stop><stop offset="1" style="stop-color:#07d;"></stop></linearGradient><path d="M38.9 38.5v19.7h5.6V44.1c0-2.8-2.8-5.6-5.6-5.6m8.4 5.6v14.1h5.6v-8.4c0-2.9-2.8-5.7-5.6-5.7" style="fill:url(#b);"></path></g><g transform="rotate(-135 35.74 36.784)"><linearGradient id="c" x1="58.308" x2="58.308" y1="22.734" y2="23.734" gradientTransform="scale(-14.0625 19.6875)rotate(45 53.17 -64.44)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#07d;"></stop><stop offset="1" style="stop-color:#4de;"></stop></linearGradient><path d="M61 16.4v19.7h5.6v-14c0-2.9-2.8-5.7-5.6-5.7m8.4 5.7v14.1H75v-8.4c.1-2.9-2.7-5.7-5.6-5.7" style="fill:url(#c);"></path></g><g transform="rotate(-45 33.272 39.284)"><linearGradient id="d" x1="21.14" x2="21.14" y1="17.435" y2="16.435" gradientTransform="scale(14.0625 -19.6875)rotate(-45 -8.493 30.435)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#4de;"></stop><stop offset="1" style="stop-color:#07d;"></stop></linearGradient><path d="M38.9-5.7V14h5.6V-.1c.1-2.8-2.8-5.6-5.6-5.6m8.5 5.6V14H53V5.6c0-2.9-2.8-5.7-5.6-5.7" style="fill:url(#d);"></path></g></svg>
    <div>SitesGPT</div>
  </a>
  <div class="no-plan-header-right-menu">
    <div class="no-plan-header-right-menu-item"><span>Site Owner:</span>
    <a href="https://www.sitesgpt.com/" target="_blank" id="upgrade_cart_url">
      Upgrade to Remove SitesGPT Branding</a></div>
    <div class="no-plan-header-right-menu-item"><span>Visitors:</span>
    <a href="https://www.sitesgpt.com/" target="_blank" id="upgrade_home_url">
      Design a site with AI</a></div>
  </div>
</div>
`;