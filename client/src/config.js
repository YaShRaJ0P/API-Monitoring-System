export const config = {
    logo: "/logo.svg",
    name: "MonitoApi",
    server_uri: import.meta.env.VITE_APP_SERVER_URI,
    base_uri: normalizeBaseUri(import.meta.env.VITE_APP_BASE_URI)
};
