import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import RepairCheckout, { type CheckoutDetails } from './RepairCheckout';
afterEach(cleanup);
const values: CheckoutDetails={name:'Test',email:'test@example.com',phone:'2125550100',street:'1 Main',street2:'',city:'New York',state:'NY',zip:'10001'};
const props={values,onChange:vi.fn(),coverage:true,bags:[{id:'a',label:'Bag 1',lines:[{recommendation_id:'x',service_id:'x',name:'Stitch',price_cents:0}]}],selected:new Set(['x']),pickup:{start_time:'2099-01-01',end_time:'2099-01-02'},scheduler:<p>Available windows</p>,onConfirm:vi.fn(),onEdit:vi.fn()};
describe('single-page checkout',()=>{
 it('enables only a complete eligible repair',()=>{render(<RepairCheckout {...props}/>);expect(screen.getByRole('button',{name:'Confirm repair'})).toBeEnabled();});
 it.each([false,null])('blocks unavailable or unverified coverage: %s',coverage=>{render(<RepairCheckout {...props} coverage={coverage}/>);expect(screen.getByRole('button',{name:'Confirm repair'})).toBeDisabled();expect(screen.queryByText('Available windows')).not.toBeInTheDocument();});
 it.each(['phone','street','email','name'])('requires %s',field=>{render(<RepairCheckout {...props} values={{...values,[field]:''}}/>);expect(screen.getByRole('button',{name:'Confirm repair'})).toBeDisabled();});
 it('requires a slot and selected work',()=>{const view=render(<RepairCheckout {...props} pickup={null}/>);expect(screen.getByRole('button',{name:'Confirm repair'})).toBeDisabled();view.rerender(<RepairCheckout {...props} selected={new Set()}/>);expect(screen.getByRole('button',{name:'Confirm repair'})).toBeDisabled();});
});
