import AssetPage from '@/app/components/AssetPage';

export function generateMetadata({ params }: { params: { ticker: string } }) {
  return { title: `${params.ticker.toUpperCase()} — TheMarketMood.ai` };
}

export default function CryptoPage({ params }: { params: { ticker: string } }) {
  return <AssetPage ticker={params.ticker} assetTypeHint="crypto" />;
}
