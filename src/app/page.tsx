import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Puzzle Hub</h1>
          <p className="mt-2 text-gray-600">Choose a puzzle tool to get started.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link
            href="/puzzle"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition"
          >
            <div className="text-3xl mb-3">🧩</div>
            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-700">
              Vocabulary Puzzle Generator
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Build printable vocabulary puzzles with custom shapes, translation, and image generation.
            </p>
            <div className="mt-4 text-sm font-medium text-blue-600">Open tool →</div>
          </Link>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6">
            <div className="text-3xl mb-3">✨</div>
            <h2 className="text-xl font-semibold text-gray-500">More puzzle tools</h2>
            <p className="mt-2 text-sm text-gray-500">Coming soon.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
