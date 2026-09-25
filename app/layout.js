import './globals.css';

export const metadata = {
  title: 'Cozinha Sem Fronteiras',
  description: 'Cardápio e pedidos do restaurante',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
