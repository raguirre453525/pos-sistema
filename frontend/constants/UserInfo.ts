export type UserRole = 'admin' | 'cajero';

export interface UserInfo {
    username: string;
    email: string;
    tipo: UserRole;
}

export const USERS: UserInfo[] = [
    {
        username: 'Administrador',
        email: 'admin@pos.com',
        tipo: 'admin',
    },
    {
        username: 'Juan Pérez',
        email: 'juan.perez@pos.com',
        tipo: 'cajero',
    },
    {
        username: 'María García',
        email: 'maria.garcia@pos.com',
        tipo: 'cajero',
    },
    {
        username: 'Carlos López',
        email: 'carlos.lopez@pos.com',
        tipo: 'admin',
    },
    {
        username: 'Ana Martínez',
        email: 'ana.martinez@pos.com',
        tipo: 'cajero',
    },
];

export default USERS;
