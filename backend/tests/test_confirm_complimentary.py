from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta, timezone
import pytest
from app.auth import AuthUser, optional_user

USER = AuthUser(id='user-123', email='buyer@example.com', access_token='test-token')

def row(**overrides):
    return dict(id='asm-1', user_id=USER.id, status='quote_ready', complimentary=True,
        proposal_token='secret-link', updated_at='2026-10-02T00:00:00Z',
        pairs=[{'id':'bag-a','photoPaths':['private/a.jpg']},{'id':'bag-b'}],
        proposed_services=[
            {'recommendation_id':'stitch-a','pair_id':'bag-a','service_id':'stitch','name':'Stitch handle','choice_group':'Handle','limitations':'Temporary'},
            {'recommendation_id':'replace-a','pair_id':'bag-a','service_id':'replace','name':'Replace handle','choice_group':'Handle'},
            {'recommendation_id':'stitch-b','pair_id':'bag-b','service_id':'stitch','name':'Stitch handle'},
        ], **overrides)

def payload():
    start=datetime.now(timezone.utc)+timedelta(days=2)
    return {'assessment_id':'asm-1','recommendation_revision':'2026-10-02T00:00:00Z',
        'selected_recommendation_ids':['stitch-a','stitch-b'], 'contact_email':'buyer@example.com','contact_phone':'2125550100',
        'delivery_address':{'street':'1 Test Street','city':'New York','state':'NY','zip':'10001'},
        'pickup_window':{'start':start.isoformat(),'end':(start+timedelta(hours=1)).isoformat()},
        'items':[{'service_snapshot':{'name':'FORGED WORK'}}]}

@pytest.fixture
def setup(client):
    client.app.dependency_overrides[optional_user]=lambda:USER
    assessment=MagicMock(); assessment.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value=SimpleNamespace(data=row(),error=None)
    orders=MagicMock(); orders.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value=SimpleNamespace(data=None,error=None)
    areas=MagicMock(); areas.select.return_value.eq.return_value.eq.return_value.execute.return_value=SimpleNamespace(data=[{'zip':'10001'}],error=None)
    sb=MagicMock();sb.table.side_effect=lambda name: {'assessments':assessment,'orders':orders,'service_areas':areas}[name]
    sb.rpc.return_value.execute.return_value=SimpleNamespace(data={'order_id':'order-1','event_uri':'booking-1'},error=None)
    with patch('app.routes.create_checkout.get_supabase_admin',return_value=sb), patch('app.routes.create_checkout._book_pickup',return_value='booking-1') as book, patch('app.routes.create_checkout._cancel_pickup') as cancel:
        yield client,sb,assessment,orders,book,cancel
    client.app.dependency_overrides.pop(optional_user,None)

def request(setup,p=None): return setup[0].post('/checkout/confirm-complimentary',json={'cartPayload':p or payload()})
def setrow(setup,**updates):
    value=row();value.update(updates)
    setup[2].select.return_value.eq.return_value.maybe_single.return_value.execute.return_value=SimpleNamespace(data=value,error=None)

def test_confirm_uses_staff_snapshots_and_preserves_bag_links(setup):
    response=request(setup); assert response.status_code==200
    params=setup[1].rpc.call_args.args[1]
    items=params['p_payload']['items']
    assert [i['pair_snapshot']['id'] for i in items]==['bag-a','bag-b']
    assert items[0]['service_snapshot']['limitations']=='Temporary'
    assert all(i['price_cents']==0 for i in items)
    assert 'FORGED' not in str(items)

@pytest.mark.parametrize('status',['pending','waitlisted','declined','service_unavailable','needs_more_info'])
def test_unavailable_states_never_book(setup,status):
    setrow(setup,status=status);assert request(setup).status_code==409;setup[4].assert_not_called()

def test_unflagged_zero_is_not_complimentary(setup):
    setrow(setup,complimentary=False);assert request(setup).status_code==403;setup[4].assert_not_called()

@pytest.mark.parametrize('selected',[[],['stitch-a','replace-a'],['invented'],['stitch-a','stitch-a'],[{}]])
def test_invalid_scope_never_books(setup,selected):
    p=payload();p['selected_recommendation_ids']=selected
    assert request(setup,p).status_code in (400,409);setup[4].assert_not_called()

def test_stale_revision_never_books(setup):
    p=payload();p['recommendation_revision']='old';assert request(setup,p).status_code==409;setup[4].assert_not_called()

def test_guest_needs_token_even_for_null_owner(setup):
    setup[0].app.dependency_overrides[optional_user]=lambda:None
    setrow(setup,user_id=None)
    assert request(setup).status_code==403;setup[4].assert_not_called()
    p=payload();p['proposal_token']='secret-link';assert request(setup,p).status_code==200

def test_wrong_account_cannot_confirm_by_id(setup):
    setrow(setup,user_id='someone-else');assert request(setup).status_code==403;setup[4].assert_not_called()

def test_calendar_failure_does_not_write_order(setup):
    setup[4].return_value=None;assert request(setup).status_code==409;setup[1].rpc.assert_not_called()

def test_db_failure_cancels_unattached_booking(setup):
    setup[1].rpc.return_value.execute.side_effect=RuntimeError('db rejected')
    assert request(setup).status_code==409;setup[5].assert_called_once_with('booking-1')

def test_repeat_rpc_result_cancels_extra_booking(setup):
    setup[1].rpc.return_value.execute.return_value=SimpleNamespace(data={'order_id':'order-1','event_uri':'existing-booking'},error=None)
    assert request(setup).status_code==200;setup[5].assert_called_once_with('booking-1')

def test_timeout_after_commit_returns_committed_order_without_cancel(setup):
    setup[1].rpc.return_value.execute.side_effect=RuntimeError('timeout')
    setup[3].select.return_value.eq.return_value.maybe_single.return_value.execute.return_value=SimpleNamespace(data={'id':'order-1','pickup_calendly_event_uri':'booking-1','payment_status':'complimentary','status':'placed'},error=None)
    assert request(setup).status_code==200;setup[5].assert_not_called()

def test_uncertain_reconciliation_never_claims_success(setup):
    setup[1].rpc.return_value.execute.side_effect=RuntimeError('timeout')
    setup[3].select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect=RuntimeError('db offline')
    assert request(setup).status_code==503;setup[5].assert_not_called()

def test_completed_retry_does_not_book_again(setup):
    setrow(setup,status='booked')
    setup[3].select.return_value.eq.return_value.maybe_single.return_value.execute.return_value=SimpleNamespace(data={'id':'order-1','payment_status':'complimentary'},error=None)
    assert request(setup).status_code==200;setup[4].assert_not_called()

@pytest.mark.parametrize('change',[{'pickup_window':None},{'pickup_window':{'start':'invalid','end':'invalid'}},{'delivery_address':{'street':''}}])
def test_missing_pickup_or_address_never_books(setup,change):
    p=payload();p.update(change);assert request(setup,p).status_code==400;setup[4].assert_not_called()

def test_payment_creation_disabled_by_default(client,monkeypatch):
    monkeypatch.delenv('PAYMENTS_ENABLED',raising=False)
    from app.settings import get_settings
    get_settings.cache_clear()
    with patch('app.routes.create_checkout.stripe.checkout.Session.create') as stripe:
        assert client.post('/checkout/',json={'kind':'cart','returnUrl':'https://example.com'}).status_code==403
        stripe.assert_not_called()


def test_unsupported_zip_never_books(setup):
    setup[1].table('service_areas').select.return_value.eq.return_value.eq.return_value.execute.return_value=SimpleNamespace(data=[],error=None)
    assert request(setup).status_code==400
    setup[4].assert_not_called()

def test_coverage_failure_never_books(setup):
    setup[1].table('service_areas').select.return_value.eq.return_value.eq.return_value.execute.side_effect=RuntimeError('offline')
    assert request(setup).status_code==503
    setup[4].assert_not_called()
