export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN_MISSING' });

  const r = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'vercel-app'
    }
  });
  const data = await r.json();
  res.json(data.map(x => ({ full_name: x.full_name })));
}
