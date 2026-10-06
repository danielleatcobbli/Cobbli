from types import SimpleNamespace
from unittest.mock import MagicMock, patch

def test_token_photo_signing_cannot_read_another_customers_folder(client):
    sb=MagicMock(); q=MagicMock()
    for method in ('select','eq','maybe_single'):getattr(q,method).return_value=q
    sb.table.return_value=q
    q.execute.return_value=SimpleNamespace(data=dict(id='assessment',user_id='owner',status='quote_ready',pairs=[{'photoPaths':['owner/allowed.jpg','other/private.jpg','owner/../other/private.jpg']}]),error=None)
    sign=sb.storage.from_.return_value.create_signed_url
    sign.return_value={'signedURL':'signed-allowed'}
    with patch('app.routes.public_proposal.get_supabase_admin',return_value=sb):
        response=client.get('/public/proposal/valid-token')
    assert response.status_code==200
    assert response.json()['photo_urls']=={'owner/allowed.jpg':'signed-allowed'}
    sign.assert_called_once_with('owner/allowed.jpg',3600)
    assert 'user_id' not in response.json()
