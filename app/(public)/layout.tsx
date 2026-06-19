import Script from "next/script";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-swiss-cream text-swiss-black antialiased">
      <Navbar />
      <main>{children}</main>
      <Footer />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </div>
  );
}
