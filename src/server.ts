import app from "./app";
import { db } from "./config/db";
import { env } from "./config/env";

// Server logic starts here




app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

export { db };
