import { createHash, randomBytes } from "node:crypto";
import { rawQuery } from "@taxum/core/extract";
import { htmlResponse, StatusCode } from "@taxum/core/http";
import { createExtractHandler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import open from "open";

const generateCodeVerifier = (): string => randomBytes(32).toString("base64url");

const generateCodeChallenge = (codeVerifier: string): string =>
    createHash("sha256").update(codeVerifier).digest("base64url");

export const getAccessToken = async (clientId: string, port: number): Promise<string> => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const redirectUri = `http://localhost:${port}/`;

    let resolve: (accessToken: string) => void;
    let reject: (error: Error) => void;

    const accessTokenPromise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    const router = new Router();

    router.route(
        "/",
        m.get(
            createExtractHandler(rawQuery).handler(async (query) => {
                const code = query.get("code");

                if (!code) {
                    reject(new Error("No authorization code received from Bitbucket"));
                    return StatusCode.BAD_REQUEST;
                }

                try {
                    const response = await fetch("https://bitbucket.org/site/oauth2/access_token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({
                            grant_type: "authorization_code",
                            code,
                            client_id: clientId,
                            code_verifier: codeVerifier,
                            redirect_uri: redirectUri,
                        }),
                    });

                    if (!response.ok) {
                        const body = await response.text();
                        reject(new Error(`Token exchange failed (${response.status}): ${body}`));
                        return StatusCode.BAD_GATEWAY;
                    }

                    const data = (await response.json()) as { access_token?: string };

                    if (!data.access_token) {
                        reject(new Error("Token response did not include an access_token"));
                        return StatusCode.BAD_GATEWAY;
                    }

                    resolve(data.access_token);

                    return htmlResponse(`
                        <html>
                            <body>
                                You can now close this tab and return to the CLI.
                            </body>
                        </html>
                    `);
                } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                    return StatusCode.INTERNAL_SERVER_ERROR;
                }
            }),
        ),
    );

    const abortController = new AbortController();

    const serverPromise = serve(router, {
        abortSignal: abortController.signal,
        port,
        unrefOnStart: true,
    });

    try {
        await open(
            `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
        );
        return await accessTokenPromise;
    } finally {
        abortController.abort();
        await serverPromise;
    }
};
