export interface CustomerResponse {
    uid: string;
    email: string | null;
    phone_number: string;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: Date | null;
    status: string;
    created_at: Date;
}

export const toCustomerResponse = (customer: any): CustomerResponse => {
    return {
        uid: customer.uid,
        email: customer.customer_email || customer.email,
        phone_number: customer.phone_number,
        first_name: customer.first_name ?? null,
        last_name: customer.last_name ?? null,
        date_of_birth: customer.date_of_birth ?? null,
        status: customer.status,
        created_at: customer.created_at,
    };
};
