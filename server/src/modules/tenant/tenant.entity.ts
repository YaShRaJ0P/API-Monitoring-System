export interface ITenant {
    id: string;
    email: string;
    google_id?: string | undefined;
    name?: string | undefined;
    avatar?: string | undefined;
    refresh_token?: string | undefined;
    env_id?: string | undefined; // type is UUID


    created_at: Date;
    updated_at: Date;
}
