export const metadata = {
  title: "Texas Hold'em Equity Calculator",
  description: "Monte Carlo equity calculator for Texas Hold'em",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "1rem 2rem", maxWidth: "640px" }}>
        {children}
      </body>
    </html>
  );
}
