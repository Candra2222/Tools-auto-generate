import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    const { repoFullName, images } = req.body || {};
    if (!repoFullName || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'PARAM_REQUIRED' });
    }

    const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
    if (!NETLIFY_TOKEN) {
      return res.status(500).json({ error: 'NETLIFY_TOKEN_MISSING' });
    }

    /* 1) Ambil HTML dari GitHub */
    const raw = `https://raw.githubusercontent.com/${repoFullName}/main/index.html`;
    const htmlRes = await fetch(raw);
    if (!htmlRes.ok) {
      return res.status(400).json({ error: 'HTML_NOT_FOUND', raw });
    }
    let html = await htmlRes.text();

    /* 2) Pastikan ada <img>, lalu inject rotator */
    html = html.replace(
      /<img[^>]*src="[^"]*"[^>]*>/i,
      '<img src="" alt="rotator">'
    );

    const rotator = `
<script>
(function(){
  const IMGS = ${JSON.stringify(images)};
  const img = document.querySelector('img');
  if(!img || !IMGS.length) return;
  let i = Math.floor(Math.random()*IMGS.length);
  img.src = IMGS[i];
  setInterval(()=>{
    i = (i+1) % IMGS.length;
    img.src = IMGS[i];
  }, 3000);
})();
</script>
`;
    html = html.replace('</body>', rotator + '\n</body>');

    /* 3) Create site */
    const site = await (await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
    })).json();
    if (!site.id) return res.status(500).json(site);

    /* 4) Create deploy */
    const hash = crypto.createHash('sha1').update(html).digest('hex');
    const deploy = await (await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: { 'index.html': hash } })
      }
    )).json();
    if (!deploy.id) return res.status(500).json(deploy);

    /* 5) Upload file */
    await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'text/html'
        },
        body: html
      }
    );

    res.json({ url: site.ssl_url || site.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
