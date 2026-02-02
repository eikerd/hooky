import type { AppProps } from "next/app";
import { trpc } from "@/utils/trpc";
import { Layout } from "@/components/layout/Layout";
import { ToastProvider } from "@/components/ui/toast";
import "@/styles/globals.css";

function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ToastProvider>
  );
}

export default trpc.withTRPC(App);
