import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-medium text-sky-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Product not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist.</p>
      <Link href="/products" className="mt-6 inline-block rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
        Browse all products
      </Link>
    </div>
  );
}
