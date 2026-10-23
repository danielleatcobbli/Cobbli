import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as any, loading: true }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => state }));
vi.mock('@/hooks/usePageMeta', () => ({ usePageMeta: () => {} }));
vi.mock('@/components/cobbli/Header', () => ({ default: () => null }));
vi.mock('@/components/cobbli/Footer', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }));
import SignIn from './SignIn';
import { saveReturnTo } from '@/lib/authRedirect';
function open() { return render(<MemoryRouter initialEntries={['/signin']}><Routes><Route path='/signin' element={<SignIn />} /><Route path='/account/orders' element={<p>My Repairs destination</p>} /><Route path='/checkout' element={<p>Checkout destination</p>} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); sessionStorage.clear(); state.user = null; state.loading = true; });
describe('sign-in destination', () => {
 it('shows loading instead of the sign-in form while restoring a session', () => { open(); expect(screen.getByRole('heading', { name: 'Signing you in…' })).toBeTruthy(); expect(screen.queryByLabelText('Password')).toBeNull(); });
 it('opens My Repairs after a session becomes available', async () => { state.user = { id: 'customer' }; state.loading = false; open(); await waitFor(() => expect(screen.getByText('My Repairs destination')).toBeTruthy()); });
 it('preserves an explicit checkout return', async () => { saveReturnTo('/checkout'); state.user = { id: 'customer' }; state.loading = false; open(); await waitFor(() => expect(screen.getByText('Checkout destination')).toBeTruthy()); });
});
