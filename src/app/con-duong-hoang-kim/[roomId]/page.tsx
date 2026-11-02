import HillRoom from '@/components/hill/HillRoom';
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <HillRoom room={roomId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)} />;
}
