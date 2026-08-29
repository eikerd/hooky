import type { AppProps } from "next/app";
import Head from "next/head";
import { trpc } from "@/utils/trpc";
import { Layout } from "@/components/layout/Layout";
import { ToastProvider } from "@/components/ui/toast";
import "@/styles/globals.css";

function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <Head>
        <title>Hooky — Claude Code hook sounds</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ToastProvider>
  );
}

export default trpc.withTRPC(App);
