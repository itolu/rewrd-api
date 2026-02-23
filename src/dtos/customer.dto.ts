export interface CustomerResponse {
    uid: string;
    email: string | null;
    phone_number: string;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: Date | null;
    status: string;
    points_balance: number;
    created_at: Date;
}

export interface JoinedCustomer {
    // Fields from Customers
    id: number;
    uid: string;
    merchant_id: string;
    status: string;
    source: string | null;
    points_balance: number | string;
    created_at: Date;
    updated_at: Date;

    // Fields from UniqueCustomers (joined)
    customer_email?: string;
    email?: string; // Aliased in query
    phone_number: string;
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: Date | null;
}

export const toCustomerResponse = (customer: JoinedCustomer | any): CustomerResponse => {
    return {
        uid: customer.uid,
        email: customer.customer_email || customer.email || null,
        phone_number: customer.phone_number,
        first_name: customer.first_name ?? null,
        last_name: customer.last_name ?? null,
        date_of_birth: customer.date_of_birth ?? null,
        status: customer.status,
        points_balance: typeof customer.points_balance === 'string' ? parseFloat(customer.points_balance) : (customer.points_balance || 0),
        created_at: customer.created_at,
    };
};
