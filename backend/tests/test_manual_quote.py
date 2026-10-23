from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from app.pricing import quote_assessment

def assessment():
    return {'updated_at':'v1','pairs':[{'id':'a'},{'id':'b'}], 'proposed_services':[
        {'recommendation_id':'stitch','pair_id':'a','service_id':'custom','name':'Stitch','price_cents':4700,'choice_group':'handle','limitations':'Temporary'},
        {'recommendation_id':'replace','pair_id':'a','service_id':'replace','price_cents':9000,'choice_group':'handle'},
        {'recommendation_id':'lining','pair_id':'b','service_id':'custom','price_cents':6300}]}
def payload():
    return {'recommendation_revision':'v1','selected_recommendation_ids':['stitch','lining'],'delivery_address':{'zip':'10001'},'items':[{'price_cents':1}],'total_cents':1}
@pytest.fixture(autouse=True)
def config():
    sb=MagicMock();sb.table.return_value.select.return_value.execute.return_value=SimpleNamespace(data=[],error=None)
    with patch('app.pricing.get_supabase_admin',return_value=sb),patch('app.pricing.get_pricing_catalog',side_effect=AssertionError('No catalogue')):yield

def test_staff_price_and_bag_assignment():
    q=quote_assessment(payload(),assessment());assert q.total_cents==11000
    assert [i['price_cents'] for i in q.payload['items']]==[4700,6300]
    assert [i['pair_snapshot']['id'] for i in q.payload['items']]==['a','b']
    assert q.payload['items'][0]['service_snapshot']['limitations']=='Temporary'
def test_skipped_work_and_fee():
    p=payload();p['selected_recommendation_ids']=['stitch'];assert quote_assessment(p,assessment()).total_cents==6200
@pytest.mark.parametrize('ids',[[],['stitch','replace'],['unknown'],['stitch','stitch']])
def test_bad_choices(ids):
    p=payload();p['selected_recommendation_ids']=ids
    with pytest.raises(HTTPException):quote_assessment(p,assessment())
def test_stale():
    a=assessment();a['updated_at']='v2'
    with pytest.raises(HTTPException) as e:quote_assessment(payload(),a)
    assert e.value.status_code==409
@pytest.mark.parametrize('price',[None,-1,1.5,True,'4700'])
def test_bad_price(price):
    a=assessment();a['proposed_services'][0]['price_cents']=price
    with pytest.raises(HTTPException):quote_assessment(payload(),a)
def test_comp():
    a=assessment();a['complimentary']=True
    with pytest.raises(HTTPException):quote_assessment(payload(),a)
