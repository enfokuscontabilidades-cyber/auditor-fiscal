import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionGuard } from "@/components/SessionGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auditor Fiscal | Enfokus",
  description: "Plataforma interna de auditoria fiscal e tributária — Enfokus Contabilidade",
  icons: { icon: "/favicon.ico" },
};

const isHomologacao = process.env.NEXT_PUBLIC_APP_ENV === 'homologacao'

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="claro" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SessionGuard />
          {isHomologacao && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: '#b45309',
              color: '#fef3c7',
              textAlign: 'center',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              borderBottom: '2px solid #92400e',
              pointerEvents: 'none',
            }}>
              ⚠ AMBIENTE DE HOMOLOGAÇÃO — NÃO UTILIZAR DADOS REAIS ⚠
            </div>
          )}
          <div style={isHomologacao ? { paddingTop: '32px' } : undefined}>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
