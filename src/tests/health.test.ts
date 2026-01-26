import request from "supertest";
import app from "../app";

describe("Health Check", () => {
    it("should return 200 OK for GET /health", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", version: "1.0.0" });
    });

    it("should return 404 for unknown routes", async () => {
        const res = await request(app).get("/random-route-that-does-not-exist");
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({
            status: false,
            message: "Endpoint not found",
            error: {
                code: "route_not_found"
            }
        });
    });
});
