import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold text-amber-400 mb-2">404</h1>
      <p className="text-neutral-400 mb-6">Página no encontrada en Bistro OS.</p>
      <Link
        href="/kiosk"
        className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-all"
      >
        Volver al Kiosko
      </Link>
    </div>
  );
}
