import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import RepairResponse from "./RepairResponse";
import type { ResponseTransport } from "@/lib/repairResponse";
const question = { id: 'question', body: 'Please show us the handle.', created_at: '2026-10-01T10:00:00Z' };
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);
const show = (transport: ResponseTransport) => render(<RepairResponse transport={transport} bags={[{id:'bag',label:'Bag 1'}]} />);
describe('customer response', () => {
 it('requires content and shows success only after a saved receipt; no history is displayed', async () => {
  const send=vi.fn().mockResolvedValue({saved:true,response_id:'response'});
  show({load:async()=>question,send});
  expect(await screen.findByRole('button',{name:'Send response'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Your reply'),{target:{value:'Keep the original material, please.'}});
  fireEvent.click(screen.getByRole('button',{name:'Send response'}));
  expect(await screen.findByText('Response sent')).toBeInTheDocument();
  expect(send).toHaveBeenCalledWith('question','Keep the original material, please.',[],expect.any(String));
  expect(screen.queryByText(/previous messages/i)).not.toBeInTheDocument();
 });
 it('keeps drafts on failure and retries the same submission identifier',async()=>{
  const send=vi.fn().mockRejectedValue(new Error('offline')); show({load:async()=>question,send});
  fireEvent.change(await screen.findByLabelText('Your reply'),{target:{value:'My reply'}});
  fireEvent.click(screen.getByRole('button',{name:'Send response'}));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Your reply')).toHaveValue('My reply');
  fireEvent.click(screen.getByRole('button',{name:'Send response'}));
  await waitFor(()=>expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[0][3]).toBe(send.mock.calls[1][3]);
  expect(screen.queryByText('Response sent')).not.toBeInTheDocument();
 });
 it('supports a photo-only reply and removal, and rejects non-photo files',async()=>{
  show({load:async()=>question,send:vi.fn()}); await screen.findByLabelText('Your reply');
  const input=screen.getByLabelText('Choose photos');
  fireEvent.change(input,{target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})]}});
  expect(await screen.findByRole('alert')).toHaveTextContent('JPG');
  expect(screen.getByRole('button',{name:'Send response'})).toBeDisabled();
  fireEvent.change(input,{target:{files:[new File(['photo'],'handle.jpg',{type:'image/jpeg'})]}});
  expect(screen.getByRole('button',{name:'Send response'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Remove photo 1'}));
  expect(screen.getByRole('button',{name:'Send response'})).toBeDisabled();
 });
 it('does not invent a question or expose a send action when the connection is unavailable',async()=>{
  show({load:async()=>{throw new Error('unavailable')},send:vi.fn()});
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t load');
  expect(screen.queryByRole('button',{name:'Send response'})).not.toBeInTheDocument();
 });
});
