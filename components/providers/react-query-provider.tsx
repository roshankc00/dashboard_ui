import { PropsWithChildren } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * (60 * 1000),
      refetchOnWindowFocus: false,
    },
  },
});

const ReactQueryProvider = ({ children }: PropsWithChildren<unknown>) => {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export default ReactQueryProvider;