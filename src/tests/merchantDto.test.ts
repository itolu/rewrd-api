import { toMerchantResponse } from "../dtos/merchant.dto";

describe("Merchant DTO Mapping", () => {
    const mockMerchant = {
        id: 1,
        merchant_id: "7611589",
        email: "silverg33k@gmail.com",
        full_name: "Balogun Silver",
        phone_number: "+2348085801335",
        created_at: new Date("2025-07-09T07:58:14.771Z"),
        facebook: null,
        ig_handle: "https://instagram.com/wefkh_ghjigkqfgkdddddddd",
        linked_in: null,
        telegram: null,
        tiktok: null,
        whatsapp: null,
        x_handle: null,
        youtube: null,
        snapchat: null,
        point_balance: "78506",
        last_chance_email_countdown: "12",
        minimum_threshold_amount: "0",
        point_should_expire: 1,
        reactivation_email_countdown: "7",
        point_expiration_date: "365",
        minimum_threshold_updated_at: null,
        first_name: "Balogun",
        last_name: "Silver",
        status: "active",
        ip_whitelist: '[]',
        webhook_url: null,
        webhook_secret: null,
        updated_at: new Date("2025-12-11T11:06:26.040Z"), // Should be excluded
        password: "secret_password", // Should be excluded
        pin_hash: "secret_pin" // Should be excluded
    };

    it("should correctly map exactly 31 requested merchant fields in the strict order", () => {
        const response = toMerchantResponse(mockMerchant);

        // Check keys order and length
        const keys = Object.keys(response);
        const expectedOrder = [
            "merchant_id",
            "email",
            "full_name",
            "phone_number",
            "created_at",
            "facebook",
            "ig_handle",
            "linked_in",
            "telegram",
            "tiktok",
            "whatsapp",
            "x_handle",
            "youtube",
            "snapchat",
            "point_balance",
            "last_chance_email_countdown",
            "minimum_threshold_amount",
            "point_should_expire",
            "reactivation_email_countdown",
            "point_expiration_date",
            "minimum_threshold_updated_at",
            "first_name",
            "last_name",
            "status",
            "ip_whitelist",
            "webhook_url",
            "webhook_secret"
        ];

        expect(keys.length).toBe(27);
        expect(keys).toEqual(expectedOrder);

        expect(response).toEqual({
            merchant_id: "7611589",
            email: "silverg33k@gmail.com",
            full_name: "Balogun Silver",
            phone_number: "+2348085801335",
            created_at: mockMerchant.created_at,
            facebook: null,
            ig_handle: "https://instagram.com/wefkh_ghjigkqfgkdddddddd",
            linked_in: null,
            telegram: null,
            tiktok: null,
            whatsapp: null,
            x_handle: null,
            youtube: null,
            snapchat: null,
            point_balance: 78506,
            last_chance_email_countdown: 12,
            minimum_threshold_amount: 0,
            point_should_expire: true,
            reactivation_email_countdown: 7,
            point_expiration_date: 365,
            minimum_threshold_updated_at: null,
            first_name: "Balogun",
            last_name: "Silver",
            status: "active",
            ip_whitelist: [],
            webhook_url: null,
            webhook_secret: null
        });

        // Explicitly check that updated_at is NOT there
        expect(response).not.toHaveProperty("updated_at");
    });
});

import { toRuleResponse } from "../dtos/rule.dto";

describe("Earning Rule DTO Mapping", () => {
    const mockRule = {
        id: "184",
        merchant_id: "7611589",
        name: "Place an order",
        points: "200",
        type: "task",
        subtype: "order",
        status: "active",
        users_rewarded: "0",
        deleted: 0,
        created_at: new Date("2025-10-06T13:22:48.942Z"),
        updated_at: new Date("2025-10-06T13:22:48.942Z"),
        earning_type: "fixed",
        percentage_off: null
    };

    it("should correctly map all earning rule fields and handle type conversions", () => {
        const response = toRuleResponse(mockRule);

        expect(response).toEqual({
            id: 184,
            merchant_id: "7611589",
            name: "Place an order",
            points: 200,
            type: "task",
            subtype: "order",
            status: "active",
            users_rewarded: 0,
            deleted: false,
            created_at: mockRule.created_at,
            updated_at: mockRule.updated_at,
            earning_type: "fixed",
            percentage_off: null
        });
    });

    it("should handle null and missing optional fields", () => {
        const minimalRule = {
            id: 1,
            merchant_id: "mer_1",
            name: "Rule 1",
            points: 10,
            type: "social",
            status: "active",
            created_at: new Date(),
            updated_at: new Date(),
            deleted: false
        };

        const response = toRuleResponse(minimalRule);
        expect(response.subtype).toBeNull();
        expect(response.earning_type).toBeNull();
        expect(response.percentage_off).toBeNull();
    });
});
