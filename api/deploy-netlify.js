import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const { repoFullName, images } = req.body || {};

    if (!repoFullName || !Array.isArray(images) || images.length < 1) {
      return res.status(400).json({
        error: "PARAM_REQUIRED",
        example: {
          repoFullName: "username/repo",
          images: ["https://example.com/img1.jpg"]
        }
      });
    }

    const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
    if (!NETLIFY_TOKEN) {
      return res.status(500).json({ error: "NETLIFY_TOKEN_MISSING" });
    }

    /* =====================================================
       1️⃣ Ambil index.html dari GitHub
    ===================================================== */
    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/main/index.html`;
    const htmlRes = await fetch(rawUrl);

    if (!htmlRes.ok) {
      return res.status(404).json({
        error: "HTML_NOT_FOUND",
        rawUrl
      });
    }

    let html = await htmlRes.text();

    /* =====================================================
       2️⃣ PAKSA ganti IMG SRC pertama
    ===================================================== */
    const firstImg = images[0];

    if (/<img[^>]+src=/.test(html)) {
      html = html.replace(
        /<img([^>]+)src="[^"]*"([^>]*)>/i,
        `<img$1src="${firstImg}"$2>`
      );
    } else {
      // fallback jika HTML tidak punya <img>
      html = html.replace(
        "</body>",
        `<img src="${firstImg}" style="max-width:100%">\n</body>`
      );
    }

    /* =====================================================
       3️⃣ Tambahkan ROTATOR (AMAN & RINGAN)
    ===================================================== */
    if (images.length > 1) {
      const rotator = `
<script>
(function(){
  const IMGS = ${JSON.stringify(images)};
  const img = document.querySelector("img");
  if(!img) return;
  let i = 0;
  setInterval(()=>{
    i = (i + 1) % IMGS.length;
    img.src = IMGS[i];
  }, 3000);
})();
</script>
`;
      html = html.replace("</body>", rotator + "\n</body>");
    }

    /* =====================================================
       4️⃣ CREATE NETLIFY SITE
    ===================================================== */
    const siteRes = await fetch(
      "https://api.netlify.com/api/v1/sites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`
        }
      }
    );

    const site = await siteRes.json();
    if (!site.id) {
      return res.status(500).json({
        error: "NETLIFY_SITE_FAILED",
        detail: site
      });
    }

    /* =====================================================
       5️⃣ CREATE DEPLOY
    ===================================================== */
    const hash = crypto
      .createHash("sha1")
      .update(html)
      .digest("hex");

    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          files: {
            "index.html": hash
          }
        })
      }
    );

    const deploy = await deployRes.json();
    if (!deploy.id) {
      return res.status(500).json({
        error: "NETLIFY_DEPLOY_FAILED",
        detail: deploy
      });
    }

    /* =====================================================
       6️⃣ UPLOAD FILE
    ===================================================== */
    await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          "Content-Type": "text/html"
        },
        body: html
      }
    );

    /* =====================================================
       7️⃣ DONE
    ===================================================== */
    return res.json({
      url: site.ssl_url || site.url,
      state: "ready"
    });

  } catch (e) {
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: e.message
    });
  }
}
