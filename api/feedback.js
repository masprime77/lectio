export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, title, body, version } = req.body;

  // Validación básica
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const label = type === 'feature' ? 'enhancement' : 'bug';
  const fullBody = `${body.trim()}\n\n---\n_Lectio v${version || '?'}_`;

  const response = await fetch(
    'https://api.github.com/repos/masprime77/lectio/issues',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: title.trim(),
        body: fullBody,
        labels: [label],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('GitHub API error:', err);
    return res.status(502).json({ error: 'Failed to create issue' });
  }

  const issue = await response.json();
  return res.status(200).json({ ok: true, url: issue.html_url });
}