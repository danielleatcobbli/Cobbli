import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MobileAccountNav from './MobileAccountNav';
const items = [{to:'/account/orders',label:'My Repairs'},{to:'/account/addresses',label:'My Addresses'},{to:'/account/payment-methods',label:'My Payment Methods'}];
afterEach(cleanup);
function open(path='/account/orders', onSignOut=vi.fn()) { render(<MemoryRouter initialEntries={[path]}><MobileAccountNav items={items} onSignOut={onSignOut} /></MemoryRouter>); }
it('identifies the section on nested pages', () => { open('/account/payment-methods/new'); expect(screen.getByRole('button',{name:'Account section: My Payment Methods'})).toBeTruthy(); });
it('lets keyboard users switch sections and closes the menu', async () => {
 open(); fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'My Addresses'}));
 expect(screen.getByRole('button',{name:'Account section: My Addresses'})).toBeTruthy();
 expect(screen.queryByRole('menu')).toBeNull();
});
it('keeps sign out as an explicit separate action', async () => {
 const signOut=vi.fn(); open('/account/orders',signOut);
 fireEvent.keyDown(screen.getByRole('button'),{key:'Enter'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'Sign Out'}));
 expect(signOut).toHaveBeenCalledTimes(1);
});
