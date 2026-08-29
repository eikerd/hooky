import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      {/* No <title> here: Next.js warns against it in _document. It lives in
          _app.tsx via next/head instead. Only the SVG icon is referenced --
          the previous favicon.png links 404'd on every page load. */}
      <Head>
        <link rel="icon" href="/hooky-icon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
