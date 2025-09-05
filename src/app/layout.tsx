import "./globals.css";
// import Link from "next/link";

export const metadata = {
  title: "Badminton Partner Finder",
  description: "Find partners, chat, and book courts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* Navbar */}
        
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
