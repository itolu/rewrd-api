export interface PointsTransactionResponse {
    id: number;
    customer_uid: string;
    points: number;
    title: string;
    narration: string | null;
    transaction_type: string;
    ledger_type: string;
    status: string;
    reference_id: string;
    balance_before: number;
    balance_after: number;
    created_at: Date;
}

export const toPointsTransactionResponse = (tx: any): PointsTransactionResponse => {
    return {
        id: parseInt(tx.id),
        customer_uid: tx.member_uid || tx.customer_uid,
        points: parseFloat(tx.points) || 0,
        title: tx.title,
        narration: tx.narration || null,
        transaction_type: tx.transaction_type,
        ledger_type: tx.ledger_type,
        status: tx.status,
        reference_id: tx.reference_id,
        balance_before: parseFloat(tx.points_balance_before) || 0,
        balance_after: parseFloat(tx.points_balance_after) || 0,
        created_at: tx.created_at,
    };
};
