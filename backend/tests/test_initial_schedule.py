from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from app.auth import AuthUser, optional_user

USER = AuthUser(id='owner',email='buyer@example.com',access_token='test')

@pytest.fixture
def booking(client):
    client.app.dependency_overrides[optional_user] = lambda: USER
    order = dict(id='order',user_id='owner',status='ready-for-return',contact_email='buyer@example.com',contact_phone='2125550100',delivery_address=dict(street='1 Main',city='NY',state='NY',zip='10001'))
    query = MagicMock()
    for method in ('select','eq','maybe_single','update','is_'):
        getattr(query,method).return_value=query
    sb=MagicMock();sb.table.return_value=query
    query.execute.side_effect=[SimpleNamespace(data=order,error=None),SimpleNamespace(data=[{'id':'order'}],error=None)]
    start=datetime.now(timezone.utc)+timedelta(days=3)
    body=dict(kind='return',start=start.isoformat(),end=(start+timedelta(hours=1)).isoformat())
    with patch('app.routes.create_checkout.get_supabase_admin',return_value=sb), patch('app.routes.create_checkout._book_pickup',return_value='event-new') as book, patch('app.routes.create_checkout._cancel_pickup') as cancel:
        yield client,order,query,body,book,cancel

def call(b):return b[0].post('/checkout/schedule/order',json=b[3])

def test_owner_schedules_initial_return(booking):
    response=call(booking)
    assert response.status_code==200
    assert response.json()['return_calendly_event_uri']=='event-new'
    booking[2].is_.assert_called_with('return_calendly_event_uri','null')
    booking[5].assert_not_called()

@pytest.mark.parametrize('change',[{'user_id':'someone-else'},{'status':'in-repair'},{'status':'cancelled'},{'return_calendly_event_uri':'existing'}])
def test_ineligible_never_books(booking,change):
    booking[1].update(change)
    assert call(booking).status_code in (404,409)
    booking[4].assert_not_called()

def test_guest_cannot_schedule_someone_elses_order(booking):
    booking[0].app.dependency_overrides[optional_user]=lambda:None
    assert call(booking).status_code==401
    booking[4].assert_not_called()

def test_failed_calendar_never_saves(booking):
    booking[4].return_value=None
    assert call(booking).status_code==409
    booking[2].update.assert_not_called()

def test_concurrent_winner_preserved_and_extra_event_cancelled(booking):
    booking[2].execute.side_effect=[SimpleNamespace(data=booking[1],error=None),SimpleNamespace(data=[],error=None),SimpleNamespace(data={'return_calendly_event_uri':'event-winner'},error=None)]
    assert call(booking).status_code==409
    booking[5].assert_called_once_with('event-new')

def test_timeout_after_commit_reconciles_without_cancellation(booking):
    booking[2].execute.side_effect=[SimpleNamespace(data=booking[1],error=None),TimeoutError(),SimpleNamespace(data={'return_calendly_event_uri':'event-new'},error=None)]
    assert call(booking).status_code==200
    booking[5].assert_not_called()

def test_uncertain_save_does_not_cancel_possibly_saved_event(booking):
    booking[2].execute.side_effect=[SimpleNamespace(data=booking[1],error=None),TimeoutError(),TimeoutError()]
    assert call(booking).status_code==503
    booking[5].assert_not_called()

def test_guest_with_matching_request_token_can_schedule(booking):
    client, order, query, body, book, _ = booking
    client.app.dependency_overrides[optional_user] = lambda: None
    order['assessment_id'] = 'request'
    body['proposal_token'] = 'correct-token'
    query.execute.side_effect = [SimpleNamespace(data=order,error=None), SimpleNamespace(data={'id':'request','proposal_token':'correct-token','user_id':None},error=None), SimpleNamespace(data=[{'id':'order'}],error=None)]
    assert call(booking).status_code == 200
    book.assert_called_once()


def test_guest_wrong_request_token_cannot_book(booking):
    client, order, query, body, book, _ = booking
    client.app.dependency_overrides[optional_user] = lambda: None
    order['assessment_id'] = 'request'
    body['proposal_token'] = 'wrong-token'
    query.execute.side_effect = [SimpleNamespace(data=order,error=None), SimpleNamespace(data={'id':'request','proposal_token':'correct-token','user_id':None},error=None)]
    assert call(booking).status_code == 403
    book.assert_not_called()
