import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    const { repoFullName, images } = req.body || {};

    if (!repoFullName || !images?.length) {
      return res.status(400).json({ error: 'PARAM_REQUIRED' });
    }

    const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
    if (!NETLIFY_TOKEN) {
      return res.status(500).json({ error: 'NETLIFY_TOKEN_MISSING' });
    }

    /* 1️⃣ Ambil index.html dari GitHub */
    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/main/index.html`;
    const htmlRes = await fetch(rawUrl);

    if (!htmlRes.ok) {
      return res.status(400).json({ error: 'HTML_NOT_FOUND', rawUrl });
    }

    let html = await htmlRes.text();

    /* 2️⃣ GANTI IMG SRC (PAKSA) */
    html = html.replace(
      /<img([^>]+)src="[^"]*"([^>]*)>/i,
      `<img$1src="${images[0]}"$2>`
    );

    /* 3️⃣ TAMBAH ROTATOR */
    const rotatorScript = `
<script>
(function(){
  const IMGS = ${JSON.stringify(images)};
  const img = document.querySelector('img');
  if(!img || IMGS.length < 2) return;

  let i = 0;
  setInterval(()=>{
    i = (i + 1) % IMGS.length;
    img.src = IMGS[i];
  }, 3000);
})();
</script>
`;

    html = html.replace('</body>', rotatorScript + '\n</body>');

    /* 4️⃣ NETLIFY CREATE SITE */
    const site = await (await fetch(
      'https://api.netlify.com/api/v1/sites',
      { method:'POST', headers:{ Authorization:`Bearer ${NETLIFY_TOKEN}` } }
    )).json();

    /* 5️⃣ DEPLOY */
    const hash = crypto.createHash('sha1').update(html).digest('hex');

    const deploy = await (await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method:'POST',
        headers:{
          Authorization:`Bearer ${NETLIFY_TOKEN}`,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({ files:{ 'index.html': hash } })
      }
    )).json();

    await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`,
      {
        method:'PUT',
        headers:{
          Authorization:`Bearer ${NETLIFY_TOKEN}`,
          'Content-Type':'text/html'
        },
        body:html
      }
    );

    res.json({ url: site.ssl_url || site.url });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
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
