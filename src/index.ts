import { rawQuery } from "@taxum/core/extract";
import { htmlResponse, StatusCode } from "@taxum/core/http";
import { createExtractHandler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import open from "open";

export const getAccessToken = async (clientId: string, port: number): Promise<string> => {
    let resolve: (accessToken: string) => void;

    const accessTokenPromise = new Promise<string>((res) => {
        resolve = res;
    });

    const router = new Router();

    router.route(
        "/",
        m.get(() =>
            htmlResponse(`
                <html>
                    <head>
                        <script type="text/javascript">
                            const params = new URLSearchParams(window.location.hash.substring(1));
    
                            fetch("/token?accessToken=" + params.get("access_token")).then(() => {
                                document.body.innerText = "You can now close this tab and return to the CLI.";
                            });
                        </script>
                    </head>
                    <body>
                        Please wait…                    
                    </body>
                </html>
            `),
        ),
    );

    router.route(
        "/token",
        m.get(
            createExtractHandler(rawQuery).handler((query) => {
                const accessToken = query.get("accessToken");

                if (accessToken) {
                    resolve(accessToken);
                }

                return StatusCode.NO_CONTENT;
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
            `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&response_type=token`,
        );
        return await accessTokenPromise;
    } finally {
        abortController.abort();
        await serverPromise;
    }
};
