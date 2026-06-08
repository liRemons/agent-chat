import { agentConfig } from '@/lib/server/config';

interface GeocodingResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }>;
}

async function fetchJsonWithTimeout<T>(url: URL): Promise<T> {
  // 第三方地理编码接口不可控，必须设置超时，避免 /api/chat 长时间 pending。
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), agentConfig.weatherRequestTimeoutMs);

  try {
    const response = await fetch(url, {
      next: { revalidate: 300 },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchCityCoordinates(city: string) {
  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocodingUrl.searchParams.set('name', city);
  geocodingUrl.searchParams.set('count', '1');
  geocodingUrl.searchParams.set('language', 'zh');
  geocodingUrl.searchParams.set('format', 'json');

  const geocodingData = await fetchJsonWithTimeout<GeocodingResponse>(geocodingUrl);
  const location = geocodingData.results?.[0];
  if (!location) {
    return `未查询到「${city}」的经纬度，请补充更准确的城市名称。`;
  }

  const resolvedLocation = [location.name, location.admin1, location.country].filter(Boolean).join('，');

  return [
    `${resolvedLocation} 的经纬度：`,
    `纬度：${location.latitude}`,
    `经度：${location.longitude}`,
  ].join('\n');
}
