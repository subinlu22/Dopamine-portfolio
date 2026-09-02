// app/layout.jsx
import './styles/global.css';

export const metadata = {
  title: 'Dopamine - AI Music Diary',
  description: 'AI Music Diary App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}