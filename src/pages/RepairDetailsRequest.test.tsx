import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { RepairDetailsRequest } from './RepairDetails';
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/integrations/api/client', () => ({ apiFetchJson: mock.api, ApiError: class extends Error {} }));
vi.mock('@/hooks/useServiceableZips', () => ({ useServiceableZips: () => ({isServiceable:()=>true,isError:false,refetch:vi.fn()}) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/context/AccountContext', () => ({ useAccount: () => ({ user: { name: 'Test', email: 'test@example.com', phone: '2125550100' }, addresses: [{street:'1 Main',city:'NY',state:'NY',zip:'10001'}] }) }));
vi.mock('@/context/BagContext', () => ({ useBag: () => ({addPair:vi.fn(),clear:vi.fn(),taggedAssessmentIds:()=>[]}), formatPrice: (c:number)=>`$${c/100}` }));
vi.mock('@/hooks/usePageMeta', () => ({ usePageMeta: () => {} }));
vi.mock('@/components/cobbli/Header', () => ({ default: () => null }));
vi.mock('@/components/cobbli/Footer', () => ({ default: () => null }));
vi.mock('@/components/cobbli/PickupScheduler', () => ({ PickupScheduler: ({onSelect}:any) => <button onClick={()=>onSelect({start_time:'2099-10-01T15:00:00Z',end_time:'2099-10-01T16:00:00Z'})}>Test pickup</button> }));
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); mock.api.mockReset(); sessionStorage.clear(); });
const line=(id:string,bag:string,name:string,group?:string)=>({recommendation_id:id,pair_id:bag,service_id:id,name,choice_group:group,tier:'essential',price_cents:1000});
const request={id:'request',status:'quote_ready',complimentary:true,updated_at:'revision-1',pairs:[{id:'a'},{id:'b'}],photo_urls:{},proposed_services:[line('stitch','a','Stitch handle','Handle'),line('replace','a','Replace handle','Handle'),line('clean','b','Clean bag')]};
const show=()=>render(<MemoryRouter><RepairDetailsRequest id="request" token="email-token" /></MemoryRouter>);
describe('email recommendation review',()=>{
 it('preselects independent repairs and one alternative, then sends the reviewed selections',async()=>{
  mock.api.mockImplementation(async(path:string)=>path.includes('confirm-complimentary')?{orderId:'order'}:request);
  show();
  const stitch=await screen.findByRole('radio',{name:/Stitch handle/});
  const replace=screen.getByRole('radio',{name:/Replace handle/});
  const clean=screen.getByRole('checkbox',{name:/Clean bag/});
  expect(stitch).toBeChecked(); expect(replace).not.toBeChecked(); expect(clean).toBeChecked();
  fireEvent.click(replace);
  expect(stitch).not.toBeChecked(); expect(replace).toBeChecked(); expect(clean).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Continue to pickup'}));
  fireEvent.change(screen.getByLabelText(/Full name/),{target:{value:'Test Customer'}});
  fireEvent.change(screen.getByLabelText(/Mobile number/),{target:{value:'2125550100'}});
  fireEvent.change(screen.getByLabelText(/Street address/),{target:{value:'1 Main'}});
  fireEvent.change(screen.getByLabelText(/ZIP code/),{target:{value:'10001'}});
  fireEvent.click(screen.getByRole('button',{name:'Test pickup'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm repair'}));
  await waitFor(()=>expect(mock.api).toHaveBeenCalledWith('/checkout/confirm-complimentary',expect.anything()));
  const call=mock.api.mock.calls.find(([path])=>path==='/checkout/confirm-complimentary')!;
  const payload=JSON.parse(call[1].body).cartPayload;
  expect(payload.selected_recommendation_ids.sort()).toEqual(['clean','replace']);
  expect(payload.proposal_token).toBe('email-token');expect(payload.recommendation_revision).toBe('revision-1');
 });

 it('disables pickup when all groups are unchecked and preserves an empty draft on remount',async()=>{
  mock.api.mockResolvedValue(request);
  const view=show();
  fireEvent.click(await screen.findByRole('checkbox',{name:'Include Handle'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Clean bag'}));
  expect(screen.getByRole('button',{name:'Continue to pickup'})).toBeDisabled();
  view.unmount(); show();
  expect(await screen.findByRole('checkbox',{name:'Include Handle'})).not.toBeChecked();
  expect(screen.getByRole('checkbox',{name:'Clean bag'})).not.toBeChecked();
  expect(screen.getByRole('button',{name:'Continue to pickup'})).toBeDisabled();
 });
 it('keeps choices when editing pickup and after failed confirmation',async()=>{
  mock.api.mockImplementation(async(path:string)=>{
   if(path.includes('confirm-complimentary')) throw new Error('Slot unavailable');
   return request;
  });
  show();
  fireEvent.click(await screen.findByRole('checkbox',{name:'Clean bag'}));
  fireEvent.click(screen.getByRole('button',{name:'Continue to pickup'}));
  expect(screen.getByRole('button',{name:'Confirm repair'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Full name/),{target:{value:'Test Customer'}});
  fireEvent.change(screen.getByLabelText(/Mobile number/),{target:{value:'2125550100'}});
  fireEvent.change(screen.getByLabelText(/Street address/),{target:{value:'1 Main'}});
  fireEvent.change(screen.getByLabelText(/ZIP code/),{target:{value:'10001'}});
  fireEvent.click(screen.getByRole('button',{name:'Test pickup'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm repair'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm repair'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Edit repairs'}));
  expect(screen.getByRole('radio',{name:/Stitch handle/})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'Clean bag'})).not.toBeChecked();
 });
 it('blocks confirmation for capacity holds',async()=>{
  mock.api.mockResolvedValue({...request,status:'waitlisted'}); show();
  expect(await screen.findByRole('button',{name:'Continue to pickup'})).toBeDisabled();
 });
 it('uses saved approved work after confirmation, rather than offering the recommendations again',async()=>{
  mock.api.mockResolvedValue({...request,status:'booked',confirmed_order:{id:'order',delivery_address:{street:'1 Main',city:'NY',state:'NY',zip:'10001'},total_cents:0,repairs_subtotal_cents:0,courier_fee_cents:0,order_number:'CB-1',status:'placed',pickup_date:'2026-10-10',pickup_time_label:'10 AM',return_date:null,return_time_label:null,order_items:[{pair_snapshot:{id:'a'},service_snapshot:{name:'Stitch handle'}}]}});
  show();
  expect(await screen.findByText('Stitch handle')).toBeInTheDocument();
  expect(screen.getByText('Stitch handle')).toBeInTheDocument();
  expect(screen.queryByText('Replace handle')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Confirm repair'})).not.toBeInTheDocument();
 });
});
