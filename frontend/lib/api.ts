const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function getSentiment(ticker: string) {
  const res = await fetch(`${API_URL}/api/sentiment/${ticker.toUpperCase()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch sentiment for ${ticker}`);
  return res.json();
}

export async function getHome() {
  const res = await fetch(`${API_URL}/api/home`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error('Failed to fetch home data');
  return res.json();
}

export async function getHomeData() {
  const res = await fetch(`${API_URL}/api/home`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error('Failed to fetch home data');
  return res.json();
}

export async function searchTickers(query: string) {
  const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search tickers');
  return res.json();
}

export async function getMood() {
  const res = await fetch(`${API_URL}/api/mood`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error('Failed to fetch mood');
  return res.json();
}
