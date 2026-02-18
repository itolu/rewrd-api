export interface RuleResponse {
    id: number;
    merchant_id: string;
    name: string;
    points: number;
    type: string;
    subtype: string | null;
    status: string;
    users_rewarded: number;
    deleted: boolean;
    created_at: Date;
    updated_at: Date;
    earning_type: string | null;
    percentage_off: number | null;
}

export const toRuleResponse = (rule: any): RuleResponse => {
    return {
        id: parseInt(rule.id),
        merchant_id: rule.merchant_id,
        name: rule.name,
        points: parseFloat(rule.points) || 0,
        type: rule.type,
        subtype: rule.subtype || null,
        status: rule.status,
        users_rewarded: parseInt(rule.users_rewarded) || 0,
        deleted: Boolean(rule.deleted),
        created_at: rule.created_at,
        updated_at: rule.updated_at,
        earning_type: rule.earning_type || null,
        percentage_off: rule.percentage_off ? parseFloat(rule.percentage_off) : null,
    };
};
