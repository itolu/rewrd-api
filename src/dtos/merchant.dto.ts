export interface MerchantResponse {
    merchant_id: string;
    email: string | null;
    full_name: string | null;
    phone_number: string | null;
    created_at: Date;
    billing_email: string | null;
    currency_code: string | null;
    reply_to_email: string | null;
    sender_name: string | null;
    facebook: string | null;
    ig_handle: string | null;
    linked_in: string | null;
    telegram: string | null;
    tiktok: string | null;
    whatsapp: string | null;
    x_handle: string | null;
    youtube: string | null;
    snapchat: string | null;
    point_balance: number;
    last_chance_email_countdown: number | null;
    minimum_threshold_amount: number;
    point_should_expire: boolean;
    reactivation_email_countdown: number | null;
    point_expiration_date: number | null;
    minimum_threshold_updated_at: Date | null;
    first_name: string | null;
    last_name: string | null;
    status: string;
    ip_whitelist: string[];
    webhook_url: string | null;
    webhook_secret: string | null;
}

export const toMerchantResponse = (merchant: any): MerchantResponse => {
    return {
        merchant_id: merchant.merchant_id,
        email: merchant.email || null,
        full_name: merchant.full_name || (merchant.first_name && merchant.last_name ? `${merchant.first_name} ${merchant.last_name}` : null),
        phone_number: merchant.phone_number || null,
        created_at: merchant.created_at,
        billing_email: merchant.billing_email ?? null,
        currency_code: merchant.currency_code ?? null,
        reply_to_email: merchant.reply_to_email ?? null,
        sender_name: merchant.sender_name ?? null,
        facebook: merchant.facebook || null,
        ig_handle: merchant.ig_handle || null,
        linked_in: merchant.linked_in || null,
        telegram: merchant.telegram || null,
        tiktok: merchant.tiktok || null,
        whatsapp: merchant.whatsapp || null,
        x_handle: merchant.x_handle || null,
        youtube: merchant.youtube || null,
        snapchat: merchant.snapchat || null,
        point_balance: parseFloat(merchant.point_balance) || 0,
        last_chance_email_countdown: merchant.last_chance_email_countdown ? parseInt(merchant.last_chance_email_countdown) : null,
        minimum_threshold_amount: parseFloat(merchant.minimum_threshold_amount) || 0,
        point_should_expire: Boolean(merchant.point_should_expire),
        reactivation_email_countdown: merchant.reactivation_email_countdown ? parseInt(merchant.reactivation_email_countdown) : null,
        point_expiration_date: merchant.point_expiration_date ? parseInt(merchant.point_expiration_date) : null,
        minimum_threshold_updated_at: merchant.minimum_threshold_updated_at || null,
        first_name: merchant.first_name || null,
        last_name: merchant.last_name || null,
        status: merchant.status,
        ip_whitelist: merchant.ip_whitelist ? (typeof merchant.ip_whitelist === 'string' ? JSON.parse(merchant.ip_whitelist) : merchant.ip_whitelist) : [],
        webhook_url: merchant.webhook_url || null,
        webhook_secret: merchant.webhook_secret || null,
    };
};
