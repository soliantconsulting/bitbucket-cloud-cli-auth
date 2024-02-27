import Koa from "koa";
import open from "open";

export const getAccessToken = async (clientId: string, port: number): Promise<string> => {
    const app = new Koa();

    app.use(async (context, next) => {
        if (context.path !== "/") {
            return next();
        }

        context.status = 200;
        context.set("Content-Type", "text/html; charset=utf-8");
        context.body = `
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
        `;
    });

    const accessTokenPromise = new Promise<string>((resolve, reject) => {
        app.use(async (context, next) => {
            if (context.path !== "/token") {
                return next();
            }

            if (typeof context.query.accessToken !== "string") {
                reject(Error("Access token missing in query parameter"));
                return;
            }

            resolve(context.query.accessToken);
            context.status = 204;
        });
    });

    const server = app.listen(port);
    server.keepAliveTimeout = 100;

    try {
        await open(
            `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&response_type=token`,
        );
        return await accessTokenPromise;
    } finally {
        const closePromise = new Promise((resolve) => server.on("close", resolve));
        server.close();
        await closePromise;
    }
};
